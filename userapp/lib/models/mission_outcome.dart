class PublicMissionOutcome {
  final String id;
  final String outcomeId;
  final String outcomeType;
  final String summary;
  final String findings;
  final DateTime? publishedAt;
  final List<dynamic> evidenceAssets;
  final String missionTitle;
  final String missionCategory;

  const PublicMissionOutcome({
    required this.id,
    required this.outcomeId,
    required this.outcomeType,
    required this.summary,
    required this.findings,
    this.publishedAt,
    this.evidenceAssets = const [],
    this.missionTitle = 'Municipal Survey Mission',
    this.missionCategory = 'CIVIC_INFRASTRUCTURE',
  });

  String get categoryLabel {
    switch (outcomeType) {
      case 'CIVIC_INFRASTRUCTURE':
        return 'CIVIL INFRA';
      case 'PUBLIC_SAFETY':
        return 'ZONE SAFETY';
      case 'ENVIRONMENTAL_AUDIT':
        return 'ECO AUDIT';
      case 'RESCUE_OPERATION':
        return 'SAR OPS';
      default:
        return outcomeType.replaceAll('_', ' ');
    }
  }

  factory PublicMissionOutcome.fromJson(Map<String, dynamic> json) {
    String mTitle = 'Municipal Survey Mission';
    String mCat = 'CIVIC_INFRASTRUCTURE';

    if (json['missionId'] is Map<String, dynamic>) {
      final m = json['missionId'] as Map<String, dynamic>;
      mTitle = m['title'] as String? ?? mTitle;
      mCat = m['category'] as String? ?? mCat;
    }

    return PublicMissionOutcome(
      id: json['_id'] as String? ?? json['id'] as String? ?? '',
      outcomeId: json['outcomeId'] as String? ?? 'OUT-UNKNOWN',
      outcomeType: json['outcomeType'] as String? ?? 'CIVIC_INFRASTRUCTURE',
      summary: json['summary'] as String? ?? '',
      findings: json['findings'] as String? ?? '',
      publishedAt: json['publishedAt'] != null
          ? DateTime.tryParse(json['publishedAt'] as String)
          : null,
      evidenceAssets: json['evidenceAssets'] as List<dynamic>? ?? const [],
      missionTitle: mTitle,
      missionCategory: mCat,
    );
  }
}

