class CitizenReport {
  final String id;
  final String reportId;
  final String category;
  final String description;
  final double longitude;
  final double latitude;
  final String status;
  final int currentStage;
  final int totalStages;
  final int earnedPoints;
  final DateTime submittedAt;
  final DateTime? reviewedAt;
  final List<dynamic> mediaAssets;

  const CitizenReport({
    required this.id,
    required this.reportId,
    required this.category,
    required this.description,
    required this.longitude,
    required this.latitude,
    required this.status,
    required this.currentStage,
    this.totalStages = 6,
    required this.earnedPoints,
    required this.submittedAt,
    this.reviewedAt,
    this.mediaAssets = const [],
  });

  // Backwards compatibility getters
  String get title => description.length > 35 ? '${description.substring(0, 35)}...' : description;
  String get locationTag => 'LAT ${latitude.toStringAsFixed(4)}°, LON ${longitude.toStringAsFixed(4)}°';
  String get statusLabel => status.replaceAll('_', ' ');
  DateTime get createdAt => submittedAt;

  factory CitizenReport.fromJson(Map<String, dynamic> json) {
    double lon = 77.5946;
    double lat = 12.9716;

    final loc = json['location'] as Map<String, dynamic>?;
    if (loc != null && loc['coordinates'] is List) {
      final coords = loc['coordinates'] as List;
      if (coords.length >= 2) {
        lon = (coords[0] as num).toDouble();
        lat = (coords[1] as num).toDouble();
      }
    }

    return CitizenReport(
      id: json['_id'] as String? ?? json['id'] as String? ?? '',
      reportId: json['reportId'] as String? ?? json['id'] as String? ?? 'AER-UNKNOWN',
      category: json['category'] as String? ?? 'ROAD_STRUCTURAL',
      description: json['description'] as String? ?? json['title'] as String? ?? '',
      longitude: lon,
      latitude: lat,
      status: json['status'] as String? ?? 'SUBMITTED',
      currentStage: json['currentStage'] as int? ?? 1,
      totalStages: json['totalStages'] as int? ?? 6,
      earnedPoints: json['earnedPoints'] as int? ?? 25,
      submittedAt: json['submittedAt'] != null
          ? DateTime.parse(json['submittedAt'] as String)
          : (json['createdAt'] != null
              ? DateTime.parse(json['createdAt'] as String)
              : DateTime.now()),
      reviewedAt: json['reviewedAt'] != null
          ? DateTime.tryParse(json['reviewedAt'] as String)
          : null,
      mediaAssets: json['mediaAssets'] as List<dynamic>? ?? const [],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'reportId': reportId,
    'category': category,
    'description': description,
    'location': {
      'type': 'Point',
      'coordinates': [longitude, latitude],
    },
    'status': status,
    'currentStage': currentStage,
    'totalStages': totalStages,
    'earnedPoints': earnedPoints,
    'submittedAt': submittedAt.toIso8601String(),
    'reviewedAt': reviewedAt?.toIso8601String(),
    'mediaAssets': mediaAssets,
  };
}
