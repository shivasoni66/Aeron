import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Delivery, DeliveryStatus } from '../models/Delivery.js';
import { Drone } from '../models/Drone.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { getSocketServer } from '../sockets/socket.server.js';
import {
  CreateDeliverySchema,
  AssignDroneSchema,
  UpdateDeliveryStatusSchema
} from '../validators/delivery.validator.js';

const VALID_DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  ORDERED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT', 'APPROACHING', 'DELIVERED', 'CANCELLED'],
  IN_TRANSIT: ['APPROACHING', 'DELIVERED', 'CANCELLED'],
  APPROACHING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};

function safeEmit(event: string, payload: unknown, room?: string) {
  try {
    const io = getSocketServer();
    if (room) {
      io.to(room).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch {
    // Socket server might not be active in unit tests; ignore silently
  }
}

export class DeliveryController {
  /**
   * POST /api/v1/manager/deliveries
   * Creates a new healthcare medicine delivery with recipient validation and optional drone assignment.
   */
  public static async createDelivery(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateDeliverySchema.parse(req.body);

      // Verify recipient exists
      const recipient = await User.findById(validated.recipientId);
      if (!recipient) {
        res.status(400).json({
          status: 'error',
          code: 'RECIPIENT_NOT_FOUND',
          message: `Recipient user with ID '${validated.recipientId}' does not exist`
        });
        return;
      }

      // Resolve and verify drone if provided
      let resolvedDroneObjectId: mongoose.Types.ObjectId | null = null;
      let resolvedDroneIdString: string | null = null;

      if (validated.assignedDrone) {
        const drone = mongoose.isValidObjectId(validated.assignedDrone)
          ? await Drone.findById(validated.assignedDrone)
          : await Drone.findOne({ droneId: validated.assignedDrone.toUpperCase() });

        if (!drone) {
          res.status(400).json({
            status: 'error',
            code: 'DRONE_NOT_FOUND',
            message: `Assigned drone '${validated.assignedDrone}' does not exist in registry`
          });
          return;
        }

        if (drone.operationalStatus === 'MAINTENANCE' || drone.operationalStatus === 'OFFLINE') {
          res.status(400).json({
            status: 'error',
            code: 'DRONE_NOT_ELIGIBLE',
            message: `Drone '${drone.droneId}' is currently ${drone.operationalStatus} and cannot be assigned`
          });
          return;
        }

        resolvedDroneObjectId = drone._id as mongoose.Types.ObjectId;
        resolvedDroneIdString = drone.droneId;
      }

      // Generate unique delivery ID
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const deliveryId = `DEL-${randomSuffix}`;

      const initialStatus: DeliveryStatus = resolvedDroneObjectId ? 'ASSIGNED' : 'ORDERED';

      const delivery = await Delivery.create({
        deliveryId,
        recipientId: new mongoose.Types.ObjectId(validated.recipientId),
        assignedDrone: resolvedDroneObjectId,
        assignedDroneId: resolvedDroneIdString,
        packageType: validated.packageType,
        priority: validated.priority || 'URGENT',
        pickupLocation: validated.pickupLocation,
        destinationLocation: validated.destinationLocation,
        status: initialStatus,
        notes: validated.notes
      });

      // Audit Log
      const actorId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      await AuditLog.create({
        actorId,
        action: 'DELIVERY_CREATED',
        entityType: 'Delivery',
        entityId: delivery.deliveryId,
        source: 'MANAGER_WEB',
        metadata: {
          recipientId: validated.recipientId,
          packageType: validated.packageType,
          assignedDroneId: resolvedDroneIdString,
          status: initialStatus
        }
      });

      const populated = await Delivery.findById(delivery._id)
        .populate('recipientId', 'name email role accountStatus')
        .populate('assignedDrone', 'droneId displayName model operationalStatus');

      safeEmit('delivery:created', populated);

      res.status(201).json({
        status: 'success',
        data: { delivery: populated }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_FAILED',
          message: err.message,
          details: (err as any).issues
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DELIVERY_CREATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/deliveries
   * Lists healthcare deliveries with pagination, status filtering, and search.
   */
  public static async getDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};

      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.priority) {
        filter.priority = req.query.priority;
      }
      if (req.query.recipientId && mongoose.isValidObjectId(req.query.recipientId as string)) {
        filter.recipientId = new mongoose.Types.ObjectId(req.query.recipientId as string);
      }
      if (req.query.droneId) {
        const droneParam = (req.query.droneId as string).trim();
        if (mongoose.isValidObjectId(droneParam)) {
          filter.$or = [
            { assignedDrone: new mongoose.Types.ObjectId(droneParam) },
            { assignedDroneId: droneParam.toUpperCase() }
          ];
        } else {
          filter.assignedDroneId = droneParam.toUpperCase();
        }
      }
      if (req.query.search) {
        const regex = new RegExp(req.query.search as string, 'i');
        filter.$or = [
          { deliveryId: regex },
          { packageType: regex },
          { 'destinationLocation.address': regex },
          { 'destinationLocation.name': regex }
        ];
      }

      const [deliveries, total] = await Promise.all([
        Delivery.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('recipientId', 'name email role accountStatus')
          .populate('assignedDrone', 'droneId displayName model operationalStatus')
          .lean(),
        Delivery.countDocuments(filter)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          deliveries,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DELIVERIES_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/deliveries/:deliveryId
   * Retrieves full details for a single delivery by unique deliveryId or ObjectId.
   */
  public static async getDeliveryById(req: Request, res: Response): Promise<void> {
    try {
      const idParam = String(req.params.deliveryId);
      const query = mongoose.isValidObjectId(idParam)
        ? { $or: [{ deliveryId: idParam.toUpperCase() }, { _id: idParam }] }
        : { deliveryId: idParam.toUpperCase() };

      const delivery = await Delivery.findOne(query)
        .populate('recipientId', 'name email role accountStatus')
        .populate('assignedDrone', 'droneId displayName model operationalStatus');

      if (!delivery) {
        res.status(404).json({
          status: 'error',
          code: 'DELIVERY_NOT_FOUND',
          message: `Delivery '${idParam}' was not found`
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { delivery }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DELIVERY_FETCH_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/deliveries/:deliveryId/assign-drone
   * Assigns an available drone to a delivery and advances status to ASSIGNED if currently ORDERED.
   */
  public static async assignDrone(req: Request, res: Response): Promise<void> {
    try {
      const validated = AssignDroneSchema.parse(req.body);
      const idParam = String(req.params.deliveryId);

      const query = mongoose.isValidObjectId(idParam)
        ? { $or: [{ deliveryId: idParam.toUpperCase() }, { _id: idParam }] }
        : { deliveryId: idParam.toUpperCase() };

      const delivery = await Delivery.findOne(query);
      if (!delivery) {
        res.status(404).json({
          status: 'error',
          code: 'DELIVERY_NOT_FOUND',
          message: `Delivery '${idParam}' was not found`
        });
        return;
      }

      if (delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED') {
        res.status(400).json({
          status: 'error',
          code: 'DELIVERY_ALREADY_CLOSED',
          message: `Cannot assign drone to a closed delivery with status '${delivery.status}'`
        });
        return;
      }

      const drone = mongoose.isValidObjectId(validated.droneId)
        ? await Drone.findById(validated.droneId)
        : await Drone.findOne({ droneId: validated.droneId.toUpperCase() });

      if (!drone) {
        res.status(400).json({
          status: 'error',
          code: 'DRONE_NOT_FOUND',
          message: `Drone '${validated.droneId}' does not exist in registry`
        });
        return;
      }

      if (drone.operationalStatus === 'MAINTENANCE' || drone.operationalStatus === 'OFFLINE') {
        res.status(400).json({
          status: 'error',
          code: 'DRONE_NOT_ELIGIBLE',
          message: `Drone '${drone.droneId}' is currently ${drone.operationalStatus} and cannot be assigned`
        });
        return;
      }

      delivery.assignedDrone = drone._id as mongoose.Types.ObjectId;
      delivery.assignedDroneId = drone.droneId;
      if (delivery.status === 'ORDERED') {
        delivery.status = 'ASSIGNED';
      }

      await delivery.save();

      // Audit Log
      const actorId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      await AuditLog.create({
        actorId,
        action: 'DELIVERY_DRONE_ASSIGNED',
        entityType: 'Delivery',
        entityId: delivery.deliveryId,
        source: 'MANAGER_WEB',
        metadata: {
          droneId: drone.droneId,
          status: delivery.status
        }
      });

      const populated = await Delivery.findById(delivery._id)
        .populate('recipientId', 'name email role accountStatus')
        .populate('assignedDrone', 'droneId displayName model operationalStatus');

      safeEmit('delivery:assigned', populated);

      res.status(200).json({
        status: 'success',
        data: { delivery: populated }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_FAILED',
          message: err.message,
          details: (err as any).issues
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DRONE_ASSIGNMENT_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/deliveries/:deliveryId/status
   * Controlled lifecycle transitions for healthcare delivery.
   */
  public static async updateDeliveryStatus(req: Request, res: Response): Promise<void> {
    try {
      const validated = UpdateDeliveryStatusSchema.parse(req.body);
      const idParam = String(req.params.deliveryId);

      const query = mongoose.isValidObjectId(idParam)
        ? { $or: [{ deliveryId: idParam.toUpperCase() }, { _id: idParam }] }
        : { deliveryId: idParam.toUpperCase() };

      const delivery = await Delivery.findOne(query);
      if (!delivery) {
        res.status(404).json({
          status: 'error',
          code: 'DELIVERY_NOT_FOUND',
          message: `Delivery '${idParam}' was not found`
        });
        return;
      }

      const currentStatus = delivery.status;
      const targetStatus = validated.status;

      if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
        res.status(400).json({
          status: 'error',
          code: 'DELIVERY_ALREADY_CLOSED',
          message: `Cannot transition delivery from terminal status '${currentStatus}'`
        });
        return;
      }

      const allowedTransitions = VALID_DELIVERY_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(targetStatus)) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition delivery from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowedTransitions.join(', ')}]`
        });
        return;
      }

      if (targetStatus === 'DISPATCHED' && !delivery.assignedDrone) {
        res.status(400).json({
          status: 'error',
          code: 'NO_DRONE_ASSIGNED',
          message: 'Cannot dispatch delivery without an assigned drone'
        });
        return;
      }

      // Lifecycle timestamp progression
      if (targetStatus === 'DISPATCHED' && !delivery.dispatchedAt) {
        delivery.dispatchedAt = new Date();
      }
      if (targetStatus === 'DELIVERED' && !delivery.deliveredAt) {
        delivery.deliveredAt = new Date();
      }
      if (validated.estimatedDeliveryAt) {
        delivery.estimatedDeliveryAt = new Date(validated.estimatedDeliveryAt);
      }
      if (validated.notes) {
        delivery.notes = validated.notes;
      }

      delivery.status = targetStatus;
      await delivery.save();

      // Audit Log
      const actorId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      await AuditLog.create({
        actorId,
        action: 'DELIVERY_STATUS_UPDATED',
        entityType: 'Delivery',
        entityId: delivery.deliveryId,
        source: 'MANAGER_WEB',
        metadata: {
          from: currentStatus,
          to: targetStatus,
          dispatchedAt: delivery.dispatchedAt,
          deliveredAt: delivery.deliveredAt
        }
      });

      const populated = await Delivery.findById(delivery._id)
        .populate('recipientId', 'name email role accountStatus')
        .populate('assignedDrone', 'droneId displayName model operationalStatus');

      safeEmit('delivery:status_updated', populated);

      res.status(200).json({
        status: 'success',
        data: { delivery: populated }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_FAILED',
          message: err.message,
          details: (err as any).issues
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DELIVERY_STATUS_UPDATE_FAILED', message: msg });
    }
  }
}
