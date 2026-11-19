import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:latlong2/latlong.dart';
import '../core/gis_utils.dart';

/// Controlled delivery lifecycle status matching AERON Backend schema.
enum DeliveryStatus {
  ordered,
  assigned,
  dispatched,
  inTransit,
  approaching,
  delivered,
  cancelled;

  static DeliveryStatus fromBackend(String? value) {
    if (value == null) return DeliveryStatus.ordered;
    switch (value.toUpperCase().trim()) {
      case 'ORDERED':
        return DeliveryStatus.ordered;
      case 'ASSIGNED':
        return DeliveryStatus.assigned;
      case 'DISPATCHED':
        return DeliveryStatus.dispatched;
      case 'IN_TRANSIT':
        return DeliveryStatus.inTransit;
      case 'APPROACHING':
        return DeliveryStatus.approaching;
      case 'DELIVERED':
        return DeliveryStatus.delivered;
      case 'CANCELLED':
        return DeliveryStatus.cancelled;
      default:
        return DeliveryStatus.ordered;
    }
  }

  String get backendString {
    switch (this) {
      case DeliveryStatus.ordered:
        return 'ORDERED';
      case DeliveryStatus.assigned:
        return 'ASSIGNED';
      case DeliveryStatus.dispatched:
        return 'DISPATCHED';
      case DeliveryStatus.inTransit:
        return 'IN_TRANSIT';
      case DeliveryStatus.approaching:
        return 'APPROACHING';
      case DeliveryStatus.delivered:
        return 'DELIVERED';
      case DeliveryStatus.cancelled:
        return 'CANCELLED';
    }
  }

  String get displayName {
    switch (this) {
      case DeliveryStatus.ordered:
        return 'Order Placed';
      case DeliveryStatus.assigned:
        return 'Drone Assigned';
      case DeliveryStatus.dispatched:
        return 'Dispatched';
      case DeliveryStatus.inTransit:
        return 'In Transit';
      case DeliveryStatus.approaching:
        return 'Approaching';
      case DeliveryStatus.delivered:
        return 'Delivered';
      case DeliveryStatus.cancelled:
        return 'Cancelled';
    }
  }

  bool get isActive {
    return this != DeliveryStatus.delivered && this != DeliveryStatus.cancelled;
  }

  int get stageIndex {
    switch (this) {
      case DeliveryStatus.ordered:
        return 1;
      case DeliveryStatus.assigned:
        return 2;
      case DeliveryStatus.dispatched:
        return 3;
      case DeliveryStatus.inTransit:
        return 4;
      case DeliveryStatus.approaching:
        return 5;
      case DeliveryStatus.delivered:
        return 6;
      case DeliveryStatus.cancelled:
        return -1;
    }
  }
}

/// Telemetry freshness states matching Backend 30s SLA.
enum TelemetryFreshness {
  available,
  stale,
  unavailable;

  static TelemetryFreshness fromBackend(String? value) {
    if (value == null) return TelemetryFreshness.unavailable;
    switch (value.toUpperCase().trim()) {
      case 'AVAILABLE':
        return TelemetryFreshness.available;
      case 'STALE':
        return TelemetryFreshness.stale;
      case 'UNAVAILABLE':
      default:
        return TelemetryFreshness.unavailable;
    }
  }

  String get displayName {
    switch (this) {
      case TelemetryFreshness.available:
        return 'Live GPS';
      case TelemetryFreshness.stale:
        return 'Stale GPS';
      case TelemetryFreshness.unavailable:
        return 'GPS Unavailable';
    }
  }
}

/// Real-time Socket.IO connection status.
enum SocketConnectionStatus {
  disconnected,
  connecting,
  reconnecting,
  connected,
  error;

  String get displayName {
    switch (this) {
      case SocketConnectionStatus.connected:
        return 'Connected';
      case SocketConnectionStatus.connecting:
        return 'Connecting';
      case SocketConnectionStatus.reconnecting:
        return 'Reconnecting';
      case SocketConnectionStatus.disconnected:
        return 'Disconnected';
      case SocketConnectionStatus.error:
        return 'Sync Error';
    }
  }

  Color get badgeColor {
    switch (this) {
      case SocketConnectionStatus.connected:
        return const Color(0xFF1B5E20);
      case SocketConnectionStatus.connecting:
        return const Color(0xFF0D47A1);
      case SocketConnectionStatus.reconnecting:
        return const Color(0xFFE65100);
      case SocketConnectionStatus.disconnected:
        return const Color(0xFF424242);
      case SocketConnectionStatus.error:
        return const Color(0xFFB71C1C);
    }
  }
}

/// Client-evaluated real-time GPS freshness state matching aerospace freshness requirements.
enum GpsFreshnessState {
  live,
  delayed,
  stale,
  unavailable;

  String get displayName {
    switch (this) {
      case GpsFreshnessState.live:
        return 'LIVE GPS';
      case GpsFreshnessState.delayed:
        return 'GPS DELAYED';
      case GpsFreshnessState.stale:
        return 'STALE GPS';
      case GpsFreshnessState.unavailable:
        return 'GPS UNAVAILABLE';
    }
  }

  Color get color {
    switch (this) {
      case GpsFreshnessState.live:
        return const Color(0xFF00C853);
      case GpsFreshnessState.delayed:
        return const Color(0xFFFFB300);
      case GpsFreshnessState.stale:
        return const Color(0xFFFF5252);
      case GpsFreshnessState.unavailable:
        return const Color(0xFF757575);
    }
  }
}

/// ETA status categories matching aviation telemetry reliability states.
enum EtaStatus {
  calculable,
  awaitingDeparture,
  calculating,
  arrivingNow,
  unavailable;

  String get displayName {
    switch (this) {
      case EtaStatus.calculable:
        return 'APPROX. ETA';
      case EtaStatus.awaitingDeparture:
        return 'AWAITING DEPARTURE';
      case EtaStatus.calculating:
        return 'CALCULATING ETA';
      case EtaStatus.arrivingNow:
        return 'ARRIVING';
      case EtaStatus.unavailable:
        return 'ETA UNAVAILABLE';
    }
  }

  Color get badgeColor {
    switch (this) {
      case EtaStatus.calculable:
      case EtaStatus.arrivingNow:
        return const Color(0xFF00C853);
      case EtaStatus.awaitingDeparture:
        return const Color(0xFF1565C0);
      case EtaStatus.calculating:
        return const Color(0xFF00838F);
      case EtaStatus.unavailable:
        return const Color(0xFF616161);
    }
  }
}

/// Dynamic ETA evaluation result with approximate remaining time and clock time.
@immutable
class DeliveryEtaEstimate {
  final EtaStatus status;
  final Duration? remainingTime;
  final DateTime? expectedArrivalTime;
  final String displayRemaining;
  final String? displayArrivalTime;
  final double? conservativeSpeed;

  const DeliveryEtaEstimate({
    required this.status,
    this.remainingTime,
    this.expectedArrivalTime,
    required this.displayRemaining,
    this.displayArrivalTime,
    this.conservativeSpeed,
  });

  const DeliveryEtaEstimate.unavailable({String message = 'ETA Unavailable'})
      : status = EtaStatus.unavailable,
        remainingTime = null,
        expectedArrivalTime = null,
        displayRemaining = message,
        displayArrivalTime = null,
        conservativeSpeed = null;

  const DeliveryEtaEstimate.awaitingDeparture()
      : status = EtaStatus.awaitingDeparture,
        remainingTime = null,
        expectedArrivalTime = null,
        displayRemaining = 'Awaiting Departure',
        displayArrivalTime = null,
        conservativeSpeed = 0.0;

  const DeliveryEtaEstimate.calculating()
      : status = EtaStatus.calculating,
        remainingTime = null,
        expectedArrivalTime = null,
        displayRemaining = 'Calculating ETA...',
        displayArrivalTime = null,
        conservativeSpeed = null;

  const DeliveryEtaEstimate.arrivingNow({
    this.expectedArrivalTime,
    this.displayArrivalTime,
  })  : status = EtaStatus.arrivingNow,
        remainingTime = const Duration(seconds: 45),
        displayRemaining = '< 1 min',
        conservativeSpeed = null;

  bool get isApproximate =>
      status == EtaStatus.calculable || status == EtaStatus.arrivingNow;

  @override
  String toString() =>
      'DeliveryEtaEstimate(status: $status, remaining: $displayRemaining, arrival: $displayArrivalTime)';
}

/// Geographic point with optional name and address.
@immutable
class DeliveryLocation {
  final String? name;
  final String? address;
  final double latitude;
  final double longitude;

  const DeliveryLocation({
    this.name,
    this.address,
    required this.latitude,
    required this.longitude,
  });

  factory DeliveryLocation.fromJson(Map<String, dynamic> json) {
    double lat = 0.0;
    double lon = 0.0;

    final coords = json['coordinates'];
    if (coords is List && coords.length >= 2) {
      // GeoJSON standard: [longitude, latitude]
      lon = (coords[0] as num).toDouble();
      lat = (coords[1] as num).toDouble();
    } else {
      lat = (json['latitude'] as num?)?.toDouble() ?? 0.0;
      lon = (json['longitude'] as num?)?.toDouble() ?? 0.0;
    }

    return DeliveryLocation(
      name: json['name'] as String?,
      address: json['address'] as String?,
      latitude: lat,
      longitude: lon,
    );
  }

  Map<String, dynamic> toJson() => {
        if (name != null) 'name': name,
        if (address != null) 'address': address,
        'type': 'Point',
        'coordinates': [longitude, latitude],
      };
}

/// Assigned UAV specifications.
@immutable
class AssignedDroneInfo {
  final String droneId;
  final String displayName;
  final String model;

  const AssignedDroneInfo({
    required this.droneId,
    required this.displayName,
    required this.model,
  });

  factory AssignedDroneInfo.fromJson(Map<String, dynamic> json) {
    return AssignedDroneInfo(
      droneId: json['droneId'] as String? ?? 'AERON-AIRFRAME',
      displayName: json['displayName'] as String? ?? 'AERON Medical UAV',
      model: json['model'] as String? ?? 'AERON Delivery Drone',
    );
  }
}

/// Sanitized, citizen-safe live UAV telemetry.
@immutable
class DroneTelemetryData {
  final String droneId;
  final double? latitude;
  final double? longitude;
  final double? altitude;
  final double? groundSpeed;
  final double? heading;
  final DateTime? recordedAt;
  final TelemetryFreshness freshness;
  final bool isLivePosition;

  const DroneTelemetryData({
    required this.droneId,
    this.latitude,
    this.longitude,
    this.altitude,
    this.groundSpeed,
    this.heading,
    this.recordedAt,
    required this.freshness,
    this.isLivePosition = false,
  });

  bool get hasCoordinates => latitude != null && longitude != null;

  bool get isLive =>
      hasCoordinates &&
      freshness == TelemetryFreshness.available &&
      isLivePosition;

  factory DroneTelemetryData.fromJson(Map<String, dynamic> json) {
    DateTime? recorded;
    if (json['recordedAt'] != null) {
      recorded = DateTime.tryParse(json['recordedAt'].toString())?.toLocal();
    }

    return DroneTelemetryData(
      droneId: json['droneId'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      altitude: (json['altitude'] as num?)?.toDouble(),
      groundSpeed: (json['groundSpeed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      recordedAt: recorded,
      freshness: TelemetryFreshness.fromBackend(json['freshness'] as String?),
      isLivePosition: json['isLivePosition'] as bool? ?? false,
    );
  }
}

/// Complete healthcare delivery domain model.
@immutable
class HealthcareDelivery {
  final String deliveryId;
  final String packageType;
  final String priority;
  final DeliveryStatus status;
  final bool isFlying;
  final DeliveryLocation pickupLocation;
  final DeliveryLocation destinationLocation;
  final DateTime? dispatchedAt;
  final DateTime? deliveredAt;
  final DateTime? estimatedDeliveryAt;
  final String? notes;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final AssignedDroneInfo? assignedDrone;
  final DroneTelemetryData? telemetry;

  const HealthcareDelivery({
    required this.deliveryId,
    required this.packageType,
    required this.priority,
    required this.status,
    required this.isFlying,
    required this.pickupLocation,
    required this.destinationLocation,
    this.dispatchedAt,
    this.deliveredAt,
    this.estimatedDeliveryAt,
    this.notes,
    this.createdAt,
    this.updatedAt,
    this.assignedDrone,
    this.telemetry,
  });

  bool get isActive => status.isActive;

  HealthcareDelivery copyWith({
    DeliveryStatus? status,
    bool? isFlying,
    DroneTelemetryData? telemetry,
    DateTime? dispatchedAt,
    DateTime? deliveredAt,
    DateTime? estimatedDeliveryAt,
    String? notes,
  }) {
    return HealthcareDelivery(
      deliveryId: deliveryId,
      packageType: packageType,
      priority: priority,
      status: status ?? this.status,
      isFlying: isFlying ?? this.isFlying,
      pickupLocation: pickupLocation,
      destinationLocation: destinationLocation,
      dispatchedAt: dispatchedAt ?? this.dispatchedAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      estimatedDeliveryAt: estimatedDeliveryAt ?? this.estimatedDeliveryAt,
      notes: notes ?? this.notes,
      createdAt: createdAt,
      updatedAt: updatedAt,
      assignedDrone: assignedDrone,
      telemetry: telemetry ?? this.telemetry,
    );
  }

  factory HealthcareDelivery.fromJson(Map<String, dynamic> json) {
    final status = DeliveryStatus.fromBackend(json['status'] as String?);

    final pickupJson = json['pickupLocation'] as Map<String, dynamic>? ?? {};
    final destJson = json['destinationLocation'] as Map<String, dynamic>? ?? {};

    AssignedDroneInfo? drone;
    if (json['assignedDrone'] is Map<String, dynamic>) {
      drone = AssignedDroneInfo.fromJson(json['assignedDrone'] as Map<String, dynamic>);
    }

    DroneTelemetryData? telem;
    if (json['telemetry'] is Map<String, dynamic>) {
      telem = DroneTelemetryData.fromJson(json['telemetry'] as Map<String, dynamic>);
    }

    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      return DateTime.tryParse(val.toString())?.toLocal();
    }

    return HealthcareDelivery(
      deliveryId: json['deliveryId'] as String? ?? 'DEL-UNKNOWN',
      packageType: json['packageType'] as String? ?? 'MEDICAL_SUPPLIES',
      priority: json['priority'] as String? ?? 'URGENT',
      status: status,
      isFlying: json['isFlying'] as bool? ?? false,
      pickupLocation: DeliveryLocation.fromJson(pickupJson),
      destinationLocation: DeliveryLocation.fromJson(destJson),
      dispatchedAt: parseDate(json['dispatchedAt']),
      deliveredAt: parseDate(json['deliveredAt']),
      estimatedDeliveryAt: parseDate(json['estimatedDeliveryAt']),
      notes: json['notes'] as String?,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
      assignedDrone: drone,
      telemetry: telem,
    );
  }
}

/// Single geodetic point in the actual traveled GPS trail.
@immutable
class DeliveryTrailPoint {
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double? altitude;
  final double? heading;

  const DeliveryTrailPoint({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.altitude,
    this.heading,
  });

  /// Converts this trail point to LatLng for flutter_map / Leaflet polylines.
  LatLng toLatLng() => LatLng(latitude, longitude);

  /// Helper to test if this point should be appended after [lastPoint].
  bool shouldAppendAfter(
    DeliveryTrailPoint? lastPoint, {
    double minDistanceMeters = 2.0,
    int minIntervalMs = 500,
  }) {
    return GisUtils.shouldAppendTrailPoint(
      lastLat: lastPoint?.latitude,
      lastLon: lastPoint?.longitude,
      lastTimestamp: lastPoint?.timestamp,
      newLat: latitude,
      newLon: longitude,
      newTimestamp: timestamp,
      minDistanceMeters: minDistanceMeters,
      minIntervalMs: minIntervalMs,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DeliveryTrailPoint &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude &&
          timestamp == other.timestamp;

  @override
  int get hashCode => Object.hash(latitude, longitude, timestamp);

  @override
  String toString() =>
      'DeliveryTrailPoint($latitude, $longitude, at: $timestamp)';
}

/// State representation of the delivery tracking service.
@immutable
class DeliveryTrackingState {
  final HealthcareDelivery? activeDelivery;
  final List<DeliveryTrailPoint> trail;
  final List<double> recentSpeeds;
  final bool isLoading;
  final String? errorMessage;
  final SocketConnectionStatus socketStatus;
  final DateTime? lastRefreshedAt;

  const DeliveryTrackingState({
    this.activeDelivery,
    this.trail = const [],
    this.recentSpeeds = const [],
    this.isLoading = false,
    this.errorMessage,
    this.socketStatus = SocketConnectionStatus.disconnected,
    this.lastRefreshedAt,
  });

  bool get hasActiveDelivery =>
      activeDelivery != null && activeDelivery!.status.isActive;

  bool get hasLiveDroneGps =>
      hasActiveDelivery && (activeDelivery!.telemetry?.isLive ?? false);

  /// Traveled GPS coordinates formatted for Leaflet / flutter_map PolylineLayer.
  List<LatLng> get trailPoints =>
      trail.map((p) => LatLng(p.latitude, p.longitude)).toList();

  /// Geodesic distance in meters between latest valid drone GPS and destination location.
  /// Returns null if active delivery or drone GPS coordinates are missing/invalid.
  double? get remainingDistanceMeters {
    if (activeDelivery == null) return null;
    final telem = activeDelivery!.telemetry;
    if (telem == null || !telem.hasCoordinates) return null;
    return GisUtils.haversineDistanceMeters(
      telem.latitude,
      telem.longitude,
      activeDelivery!.destinationLocation.latitude,
      activeDelivery!.destinationLocation.longitude,
    );
  }

  /// Whether the drone is within arrival proximity threshold (default 25m).
  bool get isWithinDeliveryProximity =>
      GisUtils.isWithinProximity(remainingDistanceMeters);

  DeliveryTrackingState copyWith({
    HealthcareDelivery? activeDelivery,
    bool clearActiveDelivery = false,
    List<DeliveryTrailPoint>? trail,
    bool clearTrail = false,
    List<double>? recentSpeeds,
    bool clearRecentSpeeds = false,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    SocketConnectionStatus? socketStatus,
    DateTime? lastRefreshedAt,
  }) {
    return DeliveryTrackingState(
      activeDelivery: clearActiveDelivery
          ? null
          : (activeDelivery ?? this.activeDelivery),
      trail: clearTrail ? const [] : (trail ?? this.trail),
      recentSpeeds:
          clearRecentSpeeds ? const [] : (recentSpeeds ?? this.recentSpeeds),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      socketStatus: socketStatus ?? this.socketStatus,
      lastRefreshedAt: lastRefreshedAt ?? this.lastRefreshedAt,
    );
  }
}
