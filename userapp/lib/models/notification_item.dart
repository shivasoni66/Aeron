class CitizenNotification {
  final String id;
  final String title;
  final String message;
  final String category;
  final DateTime? readAt;
  final DateTime createdAt;

  const CitizenNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.category,
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  factory CitizenNotification.fromJson(Map<String, dynamic> json) {
    return CitizenNotification(
      id: json['_id'] as String? ?? json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Notification',
      message: json['message'] as String? ?? '',
      category: json['category'] as String? ?? 'CIVIC_UPDATE',
      readAt: json['readAt'] != null
          ? DateTime.tryParse(json['readAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }
}

