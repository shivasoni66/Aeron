import 'package:geolocator/geolocator.dart';

enum LocationAccessStatus {
  granted,
  denied,
  permanentlyDenied,
  serviceDisabled,
}

class LocationResult {
  final double latitude;
  final double longitude;
  final bool isAccurateGps;
  final String statusMessage;

  const LocationResult({
    required this.latitude,
    required this.longitude,
    required this.isAccurateGps,
    required this.statusMessage,
  });

  /// GeoJSON coordinate format: [longitude, latitude]
  List<double> toGeoJsonCoordinates() => [longitude, latitude];

  String get formattedCoordinates =>
      'LAT ${latitude.toStringAsFixed(4)}° N, LON ${longitude.toStringAsFixed(4)}° E';
}

class LocationService {
  /// Default municipal reference location when GPS is unavailable:
  /// Sector 04 Central Municipal Corridor
  static const double defaultLatitude = 12.9716;
  static const double defaultLongitude = 77.5946;

  static bool isValidCoordinate(double latitude, double longitude) {
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  }

  Future<LocationAccessStatus> checkPermissionStatus() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationAccessStatus.serviceDisabled;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return LocationAccessStatus.denied;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return LocationAccessStatus.permanentlyDenied;
    }

    return LocationAccessStatus.granted;
  }

  Future<LocationResult> acquireObservationLocation() async {
    try {
      final status = await checkPermissionStatus();

      if (status == LocationAccessStatus.serviceDisabled) {
        return const LocationResult(
          latitude: defaultLatitude,
          longitude: defaultLongitude,
          isAccurateGps: false,
          statusMessage: 'Device location services disabled. Using Sector 04 reference datum.',
        );
      }

      if (status == LocationAccessStatus.denied || status == LocationAccessStatus.permanentlyDenied) {
        return const LocationResult(
          latitude: defaultLatitude,
          longitude: defaultLongitude,
          isAccurateGps: false,
          statusMessage: 'GPS permission denied. Using Sector 04 municipal reference coordinates.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );

      return LocationResult(
        latitude: position.latitude,
        longitude: position.longitude,
        isAccurateGps: true,
        statusMessage: 'Device GPS acquisition locked (Observation coordinate)',
      );
    } catch (_) {
      return const LocationResult(
        latitude: defaultLatitude,
        longitude: defaultLongitude,
        isAccurateGps: false,
        statusMessage: 'GPS signal timeout. Applied Sector 04 reference coordinates.',
      );
    }
  }
}

