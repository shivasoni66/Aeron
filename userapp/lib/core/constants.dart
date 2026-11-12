class AppConstants {
  AppConstants._();

  static const String appName = 'AERON';
  static const String appSubTitle = 'CITIZEN SERVICES';

  /// Base API URL. Can be overridden via dart-define:
  /// flutter run --dart-define=AERON_API_URL=https://aeron.onrender.com/api/v1
  static String apiBaseUrl = const String.fromEnvironment(
    'AERON_API_URL',
    defaultValue: 'https://aeron.onrender.com/api/v1',
  );

  static const String prodApiBaseUrl = 'https://aeron.onrender.com/api/v1';

  // Canonical Citizen Report Categories matching Mongoose Model
  static const String catRoadStructural = 'ROAD_STRUCTURAL';
  static const String catCrowdSafety = 'CROWD_SAFETY';
  static const String catMicroClimateEco = 'MICRO_CLIMATE_ECO';
  static const String catSearchRescue = 'SEARCH_RESCUE';

  // User-Facing Display Labels
  static const Map<String, String> categoryLabels = {
    catRoadStructural: 'Road & Structural',
    catCrowdSafety: 'Crowd & Public Safety',
    catMicroClimateEco: 'Micro-Climate / Eco',
    catSearchRescue: 'Search & Rescue',
  };

  // 6-Stage Report Progress Timeline
  static const List<String> stageLabels = [
    'REPORT SUBMITTED',
    'MUNICIPAL REVIEW',
    'INSPECTION SCHEDULED',
    'AERIAL VERIFIED',
    'PUBLIC WORKS',
    'RESOLVED',
  ];
}
