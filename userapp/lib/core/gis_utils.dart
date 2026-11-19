import 'dart:math' as math;
import 'package:flutter/animation.dart';
import '../models/delivery_tracking_models.dart';

/// Reusable aerospace GIS and geodetic navigation utilities for AERON.
class GisUtils {
  GisUtils._();

  /// Mean Earth radius in meters according to WGS-84 / IUGG standard.
  static const double earthRadiusMeters = 6371000.0;

  /// Default proximity threshold (25 meters) for delivery arrival detection.
  static const double defaultProximityThresholdMeters = 25.0;

  /// Validates whether latitude and longitude are finite numeric values
  /// within spherical geodetic boundaries (-90..+90 and -180..+180).
  /// Note: [0.0, 0.0] is mathematically finite and valid.
  static bool isValidCoordinate(double? lat, double? lon) {
    if (lat == null || lon == null) return false;
    if (!lat.isFinite || !lon.isFinite) return false;
    if (lat < -90.0 || lat > 90.0) return false;
    if (lon < -180.0 || lon > 180.0) return false;
    return true;
  }

  /// Calculates the geodesic surface distance between two coordinates using
  /// the spherical Haversine formula.
  ///
  /// Returns distance in meters, or `null` if any coordinate is missing or invalid.
  static double? haversineDistanceMeters(
    double? lat1,
    double? lon1,
    double? lat2,
    double? lon2,
  ) {
    if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
      return null;
    }

    final phi1 = (lat1! * math.pi) / 180.0;
    final phi2 = (lat2! * math.pi) / 180.0;
    final deltaPhi = ((lat2 - lat1) * math.pi) / 180.0;
    final deltaLambda = ((lon2! - lon1!) * math.pi) / 180.0;

    final sinHalfDeltaPhi = math.sin(deltaPhi / 2.0);
    final sinHalfDeltaLambda = math.sin(deltaLambda / 2.0);

    final a = sinHalfDeltaPhi * sinHalfDeltaPhi +
        math.cos(phi1) * math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

    final c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a));

    return earthRadiusMeters * c;
  }

  /// Formats geodesic distance into clean, human-readable aerospace metric units.
  /// Examples:
  /// - `12 m`
  /// - `450 m`
  /// - `1.4 km`
  /// - `18.5 km`
  /// - `—` when null or invalid.
  static String formatDistance(double? meters) {
    if (meters == null || meters.isNaN || !meters.isFinite || meters < 0) {
      return '—';
    }
    if (meters < 1000.0) {
      return '${meters.round()} m';
    } else {
      final km = meters / 1000.0;
      return '${km.toStringAsFixed(1)} km';
    }
  }

  /// Determines if the current distance is within arrival proximity threshold (default 25m).
  static bool isWithinProximity(
    double? distanceMeters, {
    double thresholdMeters = defaultProximityThresholdMeters,
  }) {
    if (distanceMeters == null || !distanceMeters.isFinite || distanceMeters < 0) {
      return false;
    }
    return distanceMeters <= thresholdMeters;
  }

  /// Determines whether a new GPS telemetry point should be appended to the flight trail.
  /// Enforces:
  /// 1. Valid finite geodetic coordinate bounds.
  /// 2. Strict chronological order (rejects older or duplicate timestamp packets).
  /// 3. Rejects exact duplicate coordinates.
  /// 4. Rejects high-frequency packet bursts (< minIntervalMs).
  /// 5. Spatial displacement threshold (rejects micro-jitter < minDistanceMeters).
  static bool shouldAppendTrailPoint({
    required double? lastLat,
    required double? lastLon,
    required DateTime? lastTimestamp,
    required double newLat,
    required double newLon,
    required DateTime newTimestamp,
    double minDistanceMeters = 2.0,
    int minIntervalMs = 500,
  }) {
    if (!isValidCoordinate(newLat, newLon)) {
      return false;
    }
    if (lastLat == null || lastLon == null || lastTimestamp == null) {
      return true;
    }

    // Strict chronological ordering: reject out-of-order or duplicate timestamp packets
    if (newTimestamp.isBefore(lastTimestamp)) {
      return false;
    }

    // Exact duplicate coordinates check
    if (newLat == lastLat && newLon == lastLon) {
      return false;
    }

    // Minimum time interval check
    final elapsedMs = newTimestamp.difference(lastTimestamp).inMilliseconds;
    if (elapsedMs < minIntervalMs) {
      return false;
    }

    // Spatial displacement check
    final distance = haversineDistanceMeters(
      lastLat,
      lastLon,
      newLat,
      newLon,
    );

    if (distance == null) return false;

    return distance >= minDistanceMeters;
  }

  /// Evaluates real-time GPS freshness state based on the age of the GPS packet.
  /// Freshness SLA:
  /// - Under 10s: LIVE GPS (green)
  /// - 10-30s: GPS DELAYED (amber)
  /// - Above 30s: STALE GPS (red)
  /// - No valid GPS: GPS UNAVAILABLE (grey)
  ///
  /// Never displays LIVE GPS when backend reports STALE or when underlying position is stale.
  static GpsFreshnessState evaluateFreshness({
    required DateTime? recordedAt,
    required bool hasCoordinates,
    TelemetryFreshness? backendFreshness,
    DateTime? now,
  }) {
    if (!hasCoordinates ||
        recordedAt == null ||
        backendFreshness == TelemetryFreshness.unavailable) {
      return GpsFreshnessState.unavailable;
    }

    final currentTime = now ?? DateTime.now();
    final ageMs = currentTime.difference(recordedAt).inMilliseconds;
    final ageSeconds = (ageMs < 0 ? 0 : ageMs) / 1000.0;

    // Never display LIVE GPS if backend explicitly reports stale
    if (backendFreshness == TelemetryFreshness.stale && ageSeconds < 10.0) {
      return GpsFreshnessState.delayed;
    }

    if (ageSeconds < 10.0) {
      return GpsFreshnessState.live;
    } else if (ageSeconds <= 30.0) {
      return GpsFreshnessState.delayed;
    } else {
      return GpsFreshnessState.stale;
    }
  }

  /// Formats GPS packet age into a clean UI ticker string.
  /// Examples:
  /// - "Updated just now"
  /// - "Updated 2s ago"
  /// - "Updated 15s ago"
  /// - "Updated 1m ago"
  /// - "No GPS fix" when null
  static String formatGpsAge(DateTime? recordedAt, {DateTime? now}) {
    if (recordedAt == null) {
      return 'No GPS fix';
    }
    final currentTime = now ?? DateTime.now();
    final elapsedMs = currentTime.difference(recordedAt).inMilliseconds;
    if (elapsedMs < 0) {
      return 'Updated just now';
    }
    final seconds = elapsedMs ~/ 1000;
    if (seconds == 0) {
      return 'Updated just now';
    } else if (seconds < 60) {
      return 'Updated ${seconds}s ago';
    } else if (seconds < 3600) {
      final mins = seconds ~/ 60;
      return 'Updated ${mins}m ago';
    } else {
      final hours = seconds ~/ 3600;
      return 'Updated ${hours}h ago';
    }
  }

  /// Calculates a conservative ground speed estimate from recent speed samples in m/s.
  /// Rejects NaN, non-finite, negative values, and extreme outliers (> 35 m/s).
  /// Uses a lower-bound conservative factor (0.90) and median/mean filtering
  /// to avoid wild swings from a single noisy speed packet.
  static double? calculateConservativeSpeed(List<double>? speedSamples) {
    if (speedSamples == null || speedSamples.isEmpty) return null;

    final validSpeeds = speedSamples
        .where((s) => !s.isNaN && s.isFinite && s >= 0.0 && s <= 35.0)
        .toList();

    if (validSpeeds.isEmpty) return null;

    if (validSpeeds.length == 1) {
      final s = validSpeeds.first;
      return s < 1.0 ? s : s * 0.90;
    }

    validSpeeds.sort();
    final median = validSpeeds[validSpeeds.length ~/ 2];
    final mean = validSpeeds.reduce((a, b) => a + b) / validSpeeds.length;

    // Conservative speed: take the lower of median and mean, discounted by 10%
    // to account for deceleration during final approach, climb, and wind.
    final conservative = math.min(median, mean) * 0.90;
    return conservative;
  }

  /// Formats remaining duration into approximate human-readable ETA string.
  /// Clearly prefixed with "~" or "< 1 min".
  /// Examples:
  /// - "< 1 min"
  /// - "~1 min"
  /// - "~5 mins"
  /// - "~1h 15m"
  static String formatRemainingTime(Duration remaining) {
    if (remaining.inSeconds < 60) {
      return '< 1 min';
    }
    final roundedMinutes = (remaining.inSeconds + 30) ~/ 60;
    if (roundedMinutes < 60) {
      return roundedMinutes <= 1 ? '~1 min' : '~$roundedMinutes mins';
    }
    final hours = roundedMinutes ~/ 60;
    final mins = roundedMinutes % 60;
    if (mins == 0) {
      return hours == 1 ? '~1 hr' : '~$hours hrs';
    }
    return '~${hours}h ${mins}m';
  }

  /// Formats expected arrival timestamp into approximate 12-hour clock time.
  /// Examples: "~8:45 PM", "~11:05 AM".
  static String formatClockTime(DateTime time) {
    final hour = time.hour;
    final minute = time.minute;
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = (hour % 12 == 0) ? 12 : hour % 12;
    final displayMinute = minute.toString().padLeft(2, '0');
    return '~$displayHour:$displayMinute $period';
  }

  /// Calculates dynamic healthcare drone delivery ETA based on real GPS position,
  /// remaining distance, and reliable smoothed ground speed.
  ///
  /// Strictly satisfies:
  /// 1. Delivery must be DISPATCHED, IN_TRANSIT, or APPROACHING.
  /// 2. GPS freshness must be LIVE.
  /// 3. Drone confirmed airborne via isFlying or altitude.
  /// 4. Ground speed >= 1.0 m/s.
  /// 5. Valid remaining distance and telemetry coordinates.
  /// 6. Stationary drone before departure returns "Awaiting Departure".
  /// 7. Stale/delayed GPS returns "ETA Unavailable".
  /// 8. Unreliable or stabilizing speed while airborne returns "Calculating ETA...".
  /// 9. Within arrival proximity (<= 25m) returns "< 1 min" (Arriving Now).
  /// 10. Never marks delivery as DELIVERED based on distance alone.
  static DeliveryEtaEstimate calculateEta({
    required HealthcareDelivery delivery,
    required GpsFreshnessState freshness,
    required double? distanceMeters,
    List<double>? speedHistory,
    DateTime? now,
  }) {
    final status = delivery.status;

    // Terminal statuses
    if (status == DeliveryStatus.delivered ||
        status == DeliveryStatus.cancelled) {
      return const DeliveryEtaEstimate.unavailable();
    }

    // Pre-flight stationary statuses
    if (status == DeliveryStatus.ordered ||
        status == DeliveryStatus.assigned) {
      return const DeliveryEtaEstimate.awaitingDeparture();
    }

    // Dispatched but not airborne / stationary before departure
    if (status == DeliveryStatus.dispatched) {
      final isStationary = !delivery.isFlying &&
          (delivery.telemetry?.groundSpeed == null ||
              delivery.telemetry!.groundSpeed! < 1.0);
      if (isStationary) {
        return const DeliveryEtaEstimate.awaitingDeparture();
      }
    }

    // Freshness requirement: Live GPS strictly required for dynamic ETA
    if (freshness != GpsFreshnessState.live) {
      return const DeliveryEtaEstimate.unavailable();
    }

    // Distance validity check
    if (distanceMeters == null ||
        !distanceMeters.isFinite ||
        distanceMeters.isNaN ||
        distanceMeters < 0.0) {
      return const DeliveryEtaEstimate.unavailable();
    }

    final currentTime = now ?? DateTime.now();

    // Proximity check (default 25m threshold): Final descent / arrival
    if (isWithinProximity(distanceMeters)) {
      final arr = currentTime.add(const Duration(seconds: 45));
      return DeliveryEtaEstimate.arrivingNow(
        expectedArrivalTime: arr,
        displayArrivalTime: formatClockTime(arr),
      );
    }

    // Airborne confirmation check
    final telem = delivery.telemetry;
    final isConfirmedAirborne = delivery.isFlying ||
        (telem?.altitude != null && telem!.altitude! > 1.0);

    if (!isConfirmedAirborne) {
      if (status == DeliveryStatus.dispatched) {
        return const DeliveryEtaEstimate.awaitingDeparture();
      }
      return const DeliveryEtaEstimate.calculating();
    }

    // Gather speed samples
    final samples = <double>[];
    if (speedHistory != null && speedHistory.isNotEmpty) {
      samples.addAll(speedHistory);
    }
    if (telem?.groundSpeed != null) {
      samples.add(telem!.groundSpeed!);
    }

    final conservativeSpeed = calculateConservativeSpeed(samples);

    // Minimum speed threshold requirement: at least 1.0 m/s
    if (conservativeSpeed == null || conservativeSpeed < 1.0) {
      return const DeliveryEtaEstimate.calculating();
    }

    // Conservative flight time calculation
    final rawSeconds = distanceMeters / conservativeSpeed;

    // Conservative approach deceleration allowance (10s to 45s)
    final bufferSeconds = (rawSeconds * 0.08).clamp(10.0, 45.0);
    final totalSeconds = rawSeconds + bufferSeconds;

    // Sanity check against unrealistic arrival times (> 12 hours)
    if (totalSeconds > 12 * 3600 || totalSeconds <= 0) {
      return const DeliveryEtaEstimate.unavailable();
    }

    final remaining = Duration(seconds: totalSeconds.round());
    final expectedArrival = currentTime
        .add(Duration(minutes: (totalSeconds + 30) ~/ 60));

    return DeliveryEtaEstimate(
      status: EtaStatus.calculable,
      remainingTime: remaining,
      expectedArrivalTime: expectedArrival,
      displayRemaining: formatRemainingTime(remaining),
      displayArrivalTime: formatClockTime(expectedArrival),
      conservativeSpeed: conservativeSpeed,
    );
  }
}

/// Shortest angular path heading interpolation (0..360 degrees).
class HeadingTween extends Tween<double> {
  HeadingTween({super.begin, super.end});

  @override
  double lerp(double t) {
    if (begin == null || end == null) return end ?? begin ?? 0.0;
    double diff = (end! - begin!) % 360.0;
    if (diff > 180.0) diff -= 360.0;
    if (diff < -180.0) diff += 360.0;
    final result = (begin! + diff * t) % 360.0;
    return result < 0 ? result + 360.0 : result;
  }
}
