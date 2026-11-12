class AchievementBadge {
  final String id;
  final String title;
  final String description;
  final bool unlocked;
  final int current;
  final int target;

  const AchievementBadge({
    required this.id,
    required this.title,
    required this.description,
    required this.unlocked,
    required this.current,
    required this.target,
  });

  factory AchievementBadge.fromJson(Map<String, dynamic> json) {
    return AchievementBadge(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Badge',
      description: json['description'] as String? ?? '',
      unlocked: json['unlocked'] as bool? ?? false,
      current: json['current'] as int? ?? 0,
      target: json['target'] as int? ?? 1,
    );
  }
}

