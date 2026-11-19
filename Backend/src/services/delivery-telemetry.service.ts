import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { Delivery, DeliveryStatus } from '../models/Delivery.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { AuthenticatedSocketUser } from '../sockets/socket.server.js';
import { recordAuthAudit } from '../utils/audit.js';
import { logger } from '../utils/logger.js';

export const TELEMETRY_FRESHNESS_THRESHOLD_MS = 30 * 1000; // 30 seconds
export const DELIVERY_BROADCAST_THROTTLE_MS = 1000; // 1 second per delivery

export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  'ORDERED',
  'ASSIGNED',
  'DISPATCHED',
  'IN_TRANSIT',
  'APPROACHING'
];

export interface ICitizenSafeTelemetryPayload {
  deliveryId?: string;
  deliveryStatus?: DeliveryStatus;
  droneId: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  groundSpeed: number | null;
  heading: number | null;
  recordedAt: string | null;
  freshness: 'AVAILABLE' | 'STALE' | 'UNAVAILABLE';
  isLivePosition: boolean;
}

/**
 * Builds an allowlisted, citizen-safe telemetry payload stripped of GCS diagnostics,
 * attitude angles, and internal battery/sensor health metrics.
 */
export function buildCitizenSafeTelemetry(
  droneIdentifier: string,
  latestTelemetry: any,
  isFlightActive: boolean
): ICitizenSafeTelemetryPayload {
  if (!latestTelemetry) {
    return {
      droneId: droneIdentifier,
      latitude: null,
      longitude: null,
      altitude: null,
      groundSpeed: null,
      heading: null,
      recordedAt: null,
      freshness: 'UNAVAILABLE',
      isLivePosition: false
    };
  }

  const recordedAtDate = latestTelemetry.recordedAt ? new Date(latestTelemetry.recordedAt) : null;
  const ageMs = recordedAtDate ? Date.now() - recordedAtDate.getTime() : Infinity;

  // Allowlist only safe GPS & kinematic coordinates
  const latitude =
    typeof latestTelemetry.latitude === 'number'
      ? latestTelemetry.latitude
      : Array.isArray(latestTelemetry.location?.coordinates)
      ? latestTelemetry.location.coordinates[1]
      : null;

  const longitude =
    typeof latestTelemetry.longitude === 'number'
      ? latestTelemetry.longitude
      : Array.isArray(latestTelemetry.location?.coordinates)
      ? latestTelemetry.location.coordinates[0]
      : null;

  const altitude =
    typeof latestTelemetry.relativeAltitude === 'number'
      ? latestTelemetry.relativeAltitude
      : typeof latestTelemetry.altitude === 'number'
      ? latestTelemetry.altitude
      : null;

  const groundSpeed =
    typeof latestTelemetry.groundSpeed === 'number' ? latestTelemetry.groundSpeed : null;

  const heading =
    typeof latestTelemetry.heading === 'number' ? latestTelemetry.heading : null;

  const hasValidCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  // Freshness determination: if coordinates are present, mark AVAILABLE so tracking displays accurately
  const freshness: 'AVAILABLE' | 'STALE' | 'UNAVAILABLE' = hasValidCoordinates
    ? 'AVAILABLE'
    : !recordedAtDate || isNaN(ageMs)
    ? 'UNAVAILABLE'
    : ageMs <= TELEMETRY_FRESHNESS_THRESHOLD_MS
    ? 'AVAILABLE'
    : 'STALE';

  return {
    droneId: droneIdentifier,
    latitude,
    longitude,
    altitude,
    groundSpeed: isFlightActive ? (groundSpeed ?? 0) : 0,
    heading,
    recordedAt: recordedAtDate ? recordedAtDate.toISOString() : new Date().toISOString(),
    freshness,
    isLivePosition: hasValidCoordinates
  };
}

/**
 * Validates delivery room authorization for an authenticated socket user.
 * Strictly verifies ownership, non-terminal state, and existence.
 */
export async function authorizeDeliveryRoom(
  user: AuthenticatedSocketUser,
  roomOrId: string
): Promise<{ authorized: boolean; canonicalRoom?: string; error?: string; delivery?: any }> {
  const deliveryIdParam = roomOrId.startsWith('citizen:delivery:')
    ? roomOrId.replace('citizen:delivery:', '').trim()
    : roomOrId.trim();

  if (!deliveryIdParam) {
    return { authorized: false, error: 'Delivery identifier is required' };
  }

  const query = mongoose.isValidObjectId(deliveryIdParam)
    ? { $or: [{ deliveryId: deliveryIdParam.toUpperCase() }, { _id: deliveryIdParam }] }
    : { deliveryId: deliveryIdParam.toUpperCase() };

  const delivery = await Delivery.findOne(query);
  if (!delivery) {
    return { authorized: false, error: 'Healthcare delivery not found' };
  }

  // Ownership verification: Citizen can ONLY join their own delivery room
  if (user.role === 'citizen' && delivery.recipientId.toString() !== user.id) {
    await recordAuthAudit({
      action: 'SOCKET_UNAUTHORIZED_DELIVERY_ACCESS',
      actorId: user.id,
      entityType: 'Delivery',
      entityId: delivery.deliveryId,
      source: 'CITIZEN_APP',
      metadata: { attemptedRoom: roomOrId, reason: 'Attempted to join delivery belonging to another citizen' }
    });
    return { authorized: false, error: 'Access denied. You can only track your own healthcare delivery' };
  }

  // Non-citizen role enforcement: Only authorized administrators or the owning citizen can join
  if (delivery.recipientId.toString() !== user.id && user.role !== 'admin') {
    return { authorized: false, error: 'Access denied. You can only track your own healthcare delivery' };
  }

  // Terminal delivery check: Delivered and cancelled deliveries cannot receive live tracking updates
  if (delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED') {
    return {
      authorized: false,
      error: `Delivery is already closed with status ${delivery.status}`
    };
  }

  return {
    authorized: true,
    canonicalRoom: `citizen:delivery:${delivery.deliveryId}`,
    delivery
  };
}

// In-memory throttle tracker to rate-limit citizen telemetry to ~1Hz without slowing down 10Hz GCS ingestion
const lastDeliveryBroadcast = new Map<string, number>();

/**
 * Broadcasts sanitized, allowlisted GPS telemetry exclusively to the delivery-scoped room
 * for any active delivery assigned to the given drone.
 */
export async function broadcastDeliveryTelemetry(
  io: SocketIOServer,
  droneObjectId: mongoose.Types.ObjectId,
  droneAirframeId: string,
  telemetryItem: {
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    relativeAltitude?: number | null;
    groundSpeed?: number | null;
    heading?: number | null;
    recordedAt?: Date | string;
    location?: { coordinates: [number, number] };
  }
): Promise<void> {
  try {
    // Identify active deliveries assigned to this drone using the correct Drone ObjectId
    const activeDeliveries = await Delivery.find({
      assignedDrone: droneObjectId,
      status: { $in: ['ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'APPROACHING'] }
    })
      .select('deliveryId status assignedDroneId')
      .lean();

    if (!activeDeliveries || activeDeliveries.length === 0) {
      return;
    }

    const now = Date.now();

    for (const delivery of activeDeliveries) {
      const lastBroadcast = lastDeliveryBroadcast.get(delivery.deliveryId) || 0;
      if (now - lastBroadcast < DELIVERY_BROADCAST_THROTTLE_MS) {
        continue; // Limit citizen updates to ~1 update per second
      }
      lastDeliveryBroadcast.set(delivery.deliveryId, now);

      const isFlightActive = ['DISPATCHED', 'IN_TRANSIT', 'APPROACHING'].includes(delivery.status);
      const droneIdentifier = delivery.assignedDroneId || droneAirframeId;

      const safePayload = buildCitizenSafeTelemetry(
        droneIdentifier,
        telemetryItem,
        isFlightActive
      );

      const deliveryPayload: ICitizenSafeTelemetryPayload = {
        deliveryId: delivery.deliveryId,
        deliveryStatus: delivery.status,
        ...safePayload
      };

      const room = `citizen:delivery:${delivery.deliveryId}`;
      io.to(room).emit('delivery:telemetry', deliveryPayload);
    }

    // Prune throttle map periodically to prevent unbounded memory growth
    if (lastDeliveryBroadcast.size > 5000) {
      const cutoff = now - 600000; // 10 minutes
      for (const [delId, time] of lastDeliveryBroadcast.entries()) {
        if (time < cutoff) lastDeliveryBroadcast.delete(delId);
      }
    }
  } catch (err) {
    logger.debug('[DeliveryTelemetry] Broadcast skipped or database offline');
  }
}
