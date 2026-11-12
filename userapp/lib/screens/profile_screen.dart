import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/citizen_api_service.dart';
import '../../models/achievement_badge.dart';
import '../../theme/app_colors.dart';
import 'auth/login_screen.dart';
import 'auth/register_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _authService = CitizenAuthService();
  final _apiService = CitizenApiService();

  List<AchievementBadge> _badges = [];
  bool _isLoadingBadges = false;

  @override
  void initState() {
    super.initState();
    _authService.addListener(_onAuthChanged);
    _loadAchievements();
  }

  @override
  void dispose() {
    _authService.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadAchievements() async {
    if (!_authService.isAuthenticated) return;
    setState(() => _isLoadingBadges = true);
    try {
      final res = await _apiService.getAchievements();
      if (mounted) {
        setState(() {
          _badges = res['badges'] as List<AchievementBadge>;
          _isLoadingBadges = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingBadges = false);
    }
  }

  void _showEditNameDialog() {
    final nameController = TextEditingController(text: _authService.currentUser?.name ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'UPDATE CITIZEN CALLSIGN',
          style: TextStyle(fontFamily: 'Space Mono', fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        content: TextField(
          controller: nameController,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surfaceLow,
            hintText: 'Enter full name',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('CANCEL', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.trim().length >= 2) {
                await _apiService.updateProfile(name: nameController.text);
                if (ctx.mounted) Navigator.of(ctx).pop();
              }
            },
            child: const Text('SAVE', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: const Text(
          'CITIZEN PROFILE',
          style: TextStyle(
            fontFamily: 'Space Mono',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: user == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.account_circle_outlined, size: 64, color: AppColors.textMuted),
                    const SizedBox(height: 16),
                    const Text(
                      'AUTHENTICATION REQUIRED',
                      style: TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Sign in to track your civic reports, earned points, and community achievements.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      ),
                      child: const Text('SIGN IN TO CITIZEN SERVICES'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primaryAccent,
                        side: const BorderSide(color: AppColors.primaryAccent),
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RegisterScreen()),
                      ),
                      child: const Text('CREATE CITIZEN ACCOUNT'),
                    ),
                  ],
                ),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Profile Header Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.surfaceHighest),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceHigh,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.5)),
                          ),
                          child: const Center(
                            child: Icon(Icons.person, color: AppColors.primaryAccent, size: 28),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      user.name,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit, size: 16, color: AppColors.textMuted),
                                    onPressed: _showEditNameDialog,
                                  ),
                                ],
                              ),
                              Text(
                                user.email,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryAccent.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(9999),
                                ),
                                child: Text(
                                  'ROLE: ${user.role.toUpperCase()}',
                                  style: const TextStyle(
                                    fontFamily: 'Space Mono',
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primaryAccent,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Impact Stats Grid
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatBox(
                          'TOTAL REPORTS',
                          '${user.stats.totalReports}',
                          Icons.assignment,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildStatBox(
                          'AERIAL VERIFIED',
                          '${user.stats.verifiedReports}',
                          Icons.verified,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildStatBox(
                          'CIVIC POINTS',
                          '${user.stats.civicPoints}',
                          Icons.military_tech,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Verified Achievements Section
                  const Text(
                    'COMMUNITY ACHIEVEMENTS',
                    style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 10),
                  _isLoadingBadges
                      ? const Center(child: CircularProgressIndicator(color: AppColors.primaryAccent))
                      : _badges.isEmpty
                          ? Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLow,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.surfaceHighest),
                              ),
                              child: const Text(
                                'Standby • Achievements update automatically as reports are verified.',
                                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                            )
                          : Column(
                              children: _badges.map((b) => _buildBadgeTile(b)).toList(),
                            ),
                  const SizedBox(height: 24),

                  // Session Actions
                  OutlinedButton.icon(
                    icon: const Icon(Icons.logout, size: 16),
                    label: const Text('SIGN OUT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.surfaceHighest),
                      shape: const StadiumBorder(),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () async {
                      await _authService.logout();
                    },
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () async {
                      await _authService.logoutAll();
                    },
                    child: const Text(
                      'Revoke all active sessions',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStatBox(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceHighest),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.primaryAccent),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Space Mono',
              fontSize: 8,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadgeTile(AchievementBadge badge) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: badge.unlocked ? AppColors.surfaceHigh : AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: badge.unlocked ? AppColors.primaryAccent.withValues(alpha: 0.4) : AppColors.surfaceHighest,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: badge.unlocked ? AppColors.primaryAccent.withValues(alpha: 0.2) : AppColors.surfaceHighest,
            ),
            child: Icon(
              badge.unlocked ? Icons.military_tech : Icons.lock_outline,
              color: badge.unlocked ? AppColors.primaryAccent : AppColors.textMuted,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      badge.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: badge.unlocked ? AppColors.textPrimary : AppColors.textMuted,
                      ),
                    ),
                    Text(
                      badge.unlocked ? 'UNLOCKED' : '${badge.current}/${badge.target}',
                      style: TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: badge.unlocked ? AppColors.primaryAccent : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  badge.description,
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

