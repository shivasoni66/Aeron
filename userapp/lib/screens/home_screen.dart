import 'package:flutter/material.dart';
import '../core/constants.dart';
import '../models/citizen_report.dart';
import '../models/mission_outcome.dart';
import '../models/achievement_badge.dart';
import '../services/auth_service.dart';
import '../services/citizen_api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/create_report_bottom_sheet.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'report_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback? onExploreTap;
  final VoidCallback? onReportsTap;
  final VoidCallback? onProfileTap;

  const HomeScreen({
    super.key,
    this.onExploreTap,
    this.onReportsTap,
    this.onProfileTap,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _authService = CitizenAuthService();
  final _apiService = CitizenApiService();

  CitizenReport? _latestReport;
  List<AchievementBadge> _badges = [];
  List<PublicMissionOutcome> _outcomes = [];
  Map<String, dynamic> _publicStats = {
    'verifiedThisMonth': 184,
    'averageTriageHours': 4.2,
    'airspaceStatus': 'SEC-NORM',
    'activeSafetyAlerts': 2,
  };
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _authService.addListener(_onAuthChanged);
    _loadAllData();
  }

  @override
  void dispose() {
    _authService.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (mounted) {
      _loadAllData();
    }
  }

  Future<void> _loadAllData() async {
    try {
      final futures = await Future.wait([
        _apiService.getPublicStats(),
        _apiService.getPublicOutcomes(limit: 2),
        if (_authService.isAuthenticated) _apiService.getMyReports(limit: 1) else Future.value({'reports': <CitizenReport>[]}),
        if (_authService.isAuthenticated) _apiService.getAchievements() else Future.value({'badges': <AchievementBadge>[]}),
        if (_authService.isAuthenticated) _apiService.getNotifications(limit: 1) else Future.value({'unreadCount': 0}),
      ]);

      if (mounted) {
        setState(() {
          _publicStats = futures[0];
          final outcomesRes = futures[1];
          _outcomes = outcomesRes['outcomes'] as List<PublicMissionOutcome>;

          if (_authService.isAuthenticated) {
            final reportsRes = futures[2];
            final reports = reportsRes['reports'] as List<CitizenReport>;
            _latestReport = reports.isNotEmpty ? reports.first : null;

            final achRes = futures[3];
            _badges = achRes['badges'] as List<AchievementBadge>;

            final notifRes = futures[4];
            _unreadNotifications = notifRes['unreadCount'] as int;
          }
        });
      }
    } catch (_) {}
  }

  void _openReportSheet([String? category]) {
    CreateReportBottomSheet.show(
      context,
      onReportSubmitted: (newReport) {
        setState(() => _latestReport = newReport);
        _loadAllData();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;
    final int points = user?.stats.civicPoints ?? 1280;
    final String pointsFormatted = points >= 1000
        ? '${(points ~/ 1000)},${(points % 1000).toString().padLeft(3, '0')}'
        : '$points';
    final int level = (points ~/ 500) + 1;
    final int nextMilestone = ((level) * 500) - points;
    final double xpPercent = ((points % 500) / 500.0).clamp(0.05, 0.95);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: Row(
          children: [
            const Text(
              'AERON',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
                fontSize: 20,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: AppColors.primaryAccent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.surfaceHigh,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text(
                _publicStats['airspaceStatus'] as String? ?? 'SEC-NORM',
                style: const TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 9,
                  color: AppColors.primaryAccent,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        actions: [
          // Points Counter Tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfaceHigh,
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(
                color: AppColors.primaryAccent.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.military_tech, size: 16, color: AppColors.primaryAccent),
                const SizedBox(width: 4),
                Text(
                  '$pointsFormatted PTS',
                  style: const TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primaryAccent,
                  ),
                ),
              ],
            ),
          ),
          // Notification Icon with unread dot
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.notifications_none, size: 22, color: AppColors.textPrimary),
                if (_unreadNotifications > 0)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.primaryAccent,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              );
            },
          ),
          // User Avatar Action
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: InkWell(
              onTap: () {
                if (widget.onProfileTap != null) {
                  widget.onProfileTap!();
                } else {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ProfileScreen()),
                  );
                }
              },
              borderRadius: BorderRadius.circular(9999),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceHigh,
                  border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.4)),
                ),
                child: const Center(
                  child: Icon(Icons.person, size: 18, color: AppColors.primaryAccent),
                ),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primaryAccent,
        backgroundColor: AppColors.surfaceHigh,
        onRefresh: _loadAllData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Recent Impact Toast Banner
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.primaryAccent.withValues(alpha: 0.3),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.verified, size: 18, color: AppColors.primaryAccent),
                    SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'VERIFIED REPORT RESOLVED',
                                style: TextStyle(
                                  fontFamily: 'Space Mono',
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryAccent,
                                ),
                              ),
                              SizedBox(width: 4),
                              Text('• MUNICIPAL CONFIRMATION', style: TextStyle(fontSize: 9, color: AppColors.textMuted)),
                            ],
                          ),
                          Text(
                            'Road Fracture Forwarded & Patched (+50 Verified Civic Pts)',
                            style: TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Zone & Airspace Tag
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.primaryAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'SECTOR NORTH • ZONE 04',
                          style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Text(
                      'NEARBY ALERTS: ${_publicStats['activeSafetyAlerts']} ACTIVE',
                      style: const TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 1. Citizen Impact Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceHighest),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primaryAccent.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(9999),
                              ),
                              child: const Text(
                                'CITIZEN CONTRIBUTION SCORE',
                                style: TextStyle(
                                  fontFamily: 'Space Mono',
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryAccent,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'LVL $level • CIVIC ADVOCATE',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const Text(
                              'Points earned for verified, non-duplicate reports',
                              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        // Circular meter
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            SizedBox(
                              width: 50,
                              height: 50,
                              child: CircularProgressIndicator(
                                value: xpPercent,
                                strokeWidth: 4,
                                backgroundColor: AppColors.surfaceHighest,
                                color: AppColors.primaryAccent,
                              ),
                            ),
                            Text(
                              '${(xpPercent * 100).toInt()}%',
                              style: const TextStyle(
                                fontFamily: 'Space Mono',
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Inner points box
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHigh,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    pointsFormatted,
                                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text('CIVIC PTS', style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent, fontWeight: FontWeight.bold)),
                                ],
                              ),
                              Text(
                                '$nextMilestone pts to LVL ${level + 1}',
                                style: const TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(9999),
                            child: LinearProgressIndicator(
                              value: xpPercent,
                              minHeight: 6,
                              backgroundColor: AppColors.surfaceHighest,
                              color: AppColors.primaryAccent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 2. Community Achievement Badges Rack
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.workspace_premium, size: 16, color: AppColors.primaryAccent),
                      SizedBox(width: 6),
                      Text(
                        'COMMUNITY ACHIEVEMENT BADGES',
                        style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  Text(
                    '${_badges.where((b) => b.unlocked).length} UNLOCKED',
                    style: const TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _badges.isEmpty
                      ? [
                          _buildBadgeCard('COMMUNITY WATCH', '10 Hazard Logs', true),
                          _buildBadgeCard('VERIFIED CONTRIBUTOR', 'Evidence Confirmed', true),
                          _buildBadgeCard('CIVIC ADVOCATE', 'Public Escalations', true),
                          _buildBadgeCard('ECO STEWARD', '1 Report Left', false),
                        ]
                      : _badges.map((b) => _buildBadgeCard(b.title, b.unlocked ? 'UNLOCKED' : '${b.current}/${b.target}', b.unlocked)).toList(),
                ),
              ),
              const SizedBox(height: 20),

              // 3. Primary Action Hero Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceHigh,
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: const Text(
                            'CITIZEN SERVICE INTAKE',
                            style: TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.primaryAccent, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const Row(
                          children: [
                            Icon(Icons.military_tech, size: 14, color: AppColors.primaryAccent),
                            SizedBox(width: 4),
                            Text(
                              'EARN UP TO +100 PTS',
                              style: TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.primaryAccent, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'REPORT A CIVIC ISSUE OR HAZARD',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Submit localized photos and hazard details. Municipal services schedule aerial drone inspection and dispatch public works.',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryAccent,
                        foregroundColor: AppColors.onPrimaryAccent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9999)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () => _openReportSheet(),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_circle, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'SUBMIT CIVIC REPORT',
                            style: TextStyle(fontFamily: 'Space Mono', fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 4. Latest Active Report Progression Journey
              if (_latestReport != null) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Text(
                                '#${_latestReport!.reportId}',
                                style: const TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryAccent),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryAccent.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(9999),
                                ),
                                child: const Text(
                                  'TRACK SUBMITTED REPORT',
                                  style: TextStyle(fontFamily: 'Space Mono', fontSize: 8, fontWeight: FontWeight.bold, color: AppColors.primaryAccent),
                                ),
                              ),
                            ],
                          ),
                          const Icon(Icons.timeline, color: AppColors.primaryAccent, size: 18),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _latestReport!.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 12),
                      // 6-stage mini timeline
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (index) {
                          final stageNum = index + 1;
                          final isPassed = stageNum <= _latestReport!.currentStage;
                          return Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isPassed ? AppColors.primaryAccent : AppColors.surfaceHighest,
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'STAGE ${_latestReport!.currentStage}/6 // ${_latestReport!.statusLabel}',
                            style: const TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.primaryAccent, fontWeight: FontWeight.bold),
                          ),
                          InkWell(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => ReportDetailScreen(report: _latestReport!)),
                            ),
                            child: const Row(
                              children: [
                                Text('VIEW STATUS', style: TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.textPrimary)),
                                Icon(Icons.chevron_right, size: 14, color: AppColors.primaryAccent),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // 5. Mission Category Touch Grid (2x2)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'DISPATCH BY CATEGORY',
                    style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                  ),
                  InkWell(
                    onTap: () => _openReportSheet(),
                    child: const Text('SELECT CATEGORY', style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.35,
                children: [
                  _buildCategoryCard('Road & Structural', Icons.handyman, '+25 XP', 'Potholes, broken streetlamps, cave-ins & open conduits.', AppConstants.catRoadStructural),
                  _buildCategoryCard('Crowd & Safety', Icons.groups, '+25 XP', 'Hazardous bottlenecks, crosswalk blocks & transit alerts.', AppConstants.catCrowdSafety),
                  _buildCategoryCard('Micro-Climate', Icons.thermostat, '+30 XP', 'Illegal dumping, open storm drainage & canopy damage.', AppConstants.catMicroClimateEco),
                  _buildCategoryCard('Search & Rescue', Icons.crisis_alert, '+40 XP', 'Flash flood hazard markers & citizen assistance requests.', AppConstants.catSearchRescue),
                ],
              ),
              const SizedBox(height: 20),

              // 6. Neighborhood Impact Metrics Bento
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.surfaceHighest),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.verified, size: 14, color: AppColors.primaryAccent),
                              SizedBox(width: 4),
                              Text('THIS MONTH', style: TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.textMuted)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${_publicStats['verifiedThisMonth']}',
                            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          const Text('Citizen Reports Verified', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.surfaceHighest),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.timer_outlined, size: 14, color: AppColors.primaryAccent),
                              SizedBox(width: 4),
                              Text('AVG VERIFY TIME', style: TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.textMuted)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${_publicStats['averageTriageHours']}',
                                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                              ),
                              const SizedBox(width: 4),
                              const Text('HRS', style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, color: AppColors.primaryAccent, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const Text('From Submission to Triage', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // 7. Published Mission Outcomes Preview
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'EXPLORE VERIFIED FINDINGS',
                    style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  InkWell(
                    onTap: widget.onExploreTap,
                    child: const Text('VIEW ALL', style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.primaryAccent)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (_outcomes.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.surfaceHighest),
                  ),
                  child: const Text(
                    'AERON Registry • No public mission outcomes published at this time.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                )
              else
                Column(
                  children: _outcomes.map((o) => _buildOutcomeCard(o)).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBadgeCard(String title, String subtitle, bool unlocked) {
    return Container(
      width: 110,
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: unlocked ? AppColors.primaryAccent.withValues(alpha: 0.3) : AppColors.surfaceHighest,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: unlocked ? AppColors.primaryAccent.withValues(alpha: 0.15) : AppColors.surfaceHighest,
            ),
            child: Icon(
              unlocked ? Icons.military_tech : Icons.lock_outline,
              size: 16,
              color: unlocked ? AppColors.primaryAccent : AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontFamily: 'Space Mono', fontSize: 8, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(fontFamily: 'Space Mono', fontSize: 8, color: unlocked ? AppColors.primaryAccent : AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryCard(String title, IconData icon, String xp, String desc, String categoryKey) {
    return InkWell(
      onTap: () => _openReportSheet(categoryKey),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceHighest),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceHigh,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 16, color: AppColors.primaryAccent),
                ),
                Text(
                  xp,
                  style: const TextStyle(fontFamily: 'Space Mono', fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primaryAccent),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  desc,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOutcomeCard(PublicMissionOutcome item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceHighest),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '#${item.outcomeId} // ${item.categoryLabel}',
                style: const TextStyle(fontFamily: 'Space Mono', fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primaryAccent),
              ),
              const Text('CONFIRMED', style: TextStyle(fontFamily: 'Space Mono', fontSize: 8, color: AppColors.primaryAccent)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.summary,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 4),
          Text(
            item.findings,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
