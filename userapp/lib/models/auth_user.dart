class CitizenStats {
  final int totalReports;
  final int verifiedReports;
  final int resolvedReports;
  final int civicPoints;

  const CitizenStats({
    this.totalReports = 0,
    this.verifiedReports = 0,
    this.resolvedReports = 0,
    this.civicPoints = 0,
  });

  factory CitizenStats.fromJson(Map<String, dynamic> json) {
    return CitizenStats(
      totalReports: json['totalReports'] as int? ?? 0,
      verifiedReports: json['verifiedReports'] as int? ?? 0,
      resolvedReports: json['resolvedReports'] as int? ?? 0,
      civicPoints: json['civicPoints'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'totalReports': totalReports,
    'verifiedReports': verifiedReports,
    'resolvedReports': resolvedReports,
    'civicPoints': civicPoints,
  };
}

class CitizenAuthUser {
  final String id;
  final String name;
  final String email;
  final String role;
  final String accountStatus;
  final DateTime? createdAt;
  final CitizenStats stats;

  const CitizenAuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.accountStatus,
    this.createdAt,
    this.stats = const CitizenStats(),
  });

  factory CitizenAuthUser.fromJson(Map<String, dynamic> json) {
    final rawStats = json['stats'] as Map<String, dynamic>?;
    return CitizenAuthUser(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      name: json['name'] as String? ?? 'Citizen User',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? 'citizen',
      accountStatus: json['accountStatus'] as String? ?? 'active',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      stats: rawStats != null ? CitizenStats.fromJson(rawStats) : const CitizenStats(),
    );
  }

  CitizenAuthUser copyWith({
    String? name,
    String? email,
    CitizenStats? stats,
  }) {
    return CitizenAuthUser(
      id: id,
      name: name ?? this.name,
      email: email ?? this.email,
      role: role,
      accountStatus: accountStatus,
      createdAt: createdAt,
      stats: stats ?? this.stats,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
    'accountStatus': accountStatus,
    'createdAt': createdAt?.toIso8601String(),
    'stats': stats.toJson(),
  };
}

