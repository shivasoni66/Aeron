import 'package:flutter/material.dart';
import '../models/delivery_tracking_models.dart';
import '../services/auth_service.dart';
import '../services/delivery_tracking_service.dart';
import '../theme/app_colors.dart';
import 'auth/login_screen.dart';
import 'delivery_tracking_screen.dart';
import 'profile_screen.dart';

/// Screen 1 — Dedicated Aerospace Home Screen for AERON Drone Tracking.
///
/// Provides a minimal, premium drone tracking entry point for citizens:
/// - AERON branding with aerospace visual identity
/// - Clean radar / drone illustration
/// - Primary heading: "Track Your Drone"
/// - Subtitle: "Your delivery. Your drone. Live tracking."
/// - Prominent CTA: "TRACK YOUR DRONE"
/// - Validated routing to active delivery tracking or "No drone assigned yet" notice
class HomeScreen extends StatefulWidget {
  final VoidCallback? onExploreTap;
  final VoidCallback? onReportsTap;
  final VoidCallback? onProfileTap;
  final HealthcareDeliveryTrackingService? trackingService;
  final CitizenAuthService? authService;

  const HomeScreen({
    super.key,
    this.onExploreTap,
    this.onReportsTap,
    this.onProfileTap,
    this.trackingService,
    this.authService,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final CitizenAuthService _authService;
  late final HealthcareDeliveryTrackingService _trackingService;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  bool _showNoDroneNotice = false;

  @override
  void initState() {
    super.initState();
    _authService = widget.authService ?? CitizenAuthService();
    _trackingService = widget.trackingService ??
        HealthcareDeliveryTrackingService.instance;

    _authService.addListener(_onStateChanged);
    _trackingService.addListener(_onStateChanged);

    // Immediately start active delivery and drone telemetry tracking
    _trackingService.start();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    _pulseAnimation = CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _authService.removeListener(_onStateChanged);
    _trackingService.removeListener(_onStateChanged);
    _pulseController.dispose();
    super.dispose();
  }

  void _onStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _handleTrackYourDronePressed() {
    // 1. Check for active delivery first (allows live drone tracking without login barriers)
    final activeDelivery = _trackingService.state.activeDelivery;
    if (activeDelivery != null && activeDelivery.isActive) {
      setState(() {
        _showNoDroneNotice = false;
      });
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DeliveryTrackingScreen(
            deliveryId: activeDelivery.deliveryId,
            trackingService: _trackingService,
          ),
        ),
      );
      return;
    }

    // 2. If no active delivery loaded yet, enforce authentication requirement
    if (!_authService.isAuthenticated) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      return;
    }

    // 3. No active delivery state
    setState(() {
      _showNoDroneNotice = true;
    });
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'No drone assigned yet. Check back when your healthcare delivery is dispatched.',
          style: TextStyle(color: Colors.white, fontSize: 13),
        ),
        backgroundColor: Color(0xFF1E2433),
        duration: Duration(seconds: 4),
      ),
    );
  }

  String _formatPackageType(String raw) {
    if (raw.isEmpty) return 'Healthcare Supplies';
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isNotEmpty
            ? '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}'
            : '')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final activeDelivery = _trackingService.state.activeDelivery;
    final isAuth = _authService.isAuthenticated;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF10141E),
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            const Text(
              'AERON',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
                fontSize: 20,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(
                color: AppColors.primaryAccent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF181F2C),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: Colors.white12),
              ),
              child: const Text(
                'DRONE OPS',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                  color: AppColors.primaryAccent,
                ),
              ),
            ),
          ],
        ),
        actions: [
          if (isAuth)
            IconButton(
              key: const ValueKey('profileBtn'),
              icon: const Icon(
                Icons.account_circle_outlined,
                color: AppColors.primaryAccent,
                size: 24,
              ),
              tooltip: 'Citizen Profile',
              onPressed: () {
                widget.onProfileTap?.call();
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ProfileScreen()),
                );
              },
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton.icon(
                key: const ValueKey('signInBtn'),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                icon: const Icon(Icons.login, size: 16, color: AppColors.primaryAccent),
                label: const Text(
                  'SIGN IN',
                  style: TextStyle(
                    color: AppColors.primaryAccent,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 110),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 12),

              // 1. Clean Aerospace Drone Radar Illustration
              _buildDroneVisual(),
              const SizedBox(height: 32),

              // 2. Main Heading & Subtitle
              const Text(
                'Track Your Drone',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Your delivery. Your drone. Live tracking.',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),

              // 3. Active Delivery Preview Card (if assigned)
              if (activeDelivery != null && activeDelivery.isActive) ...[
                _buildActiveDeliveryCard(activeDelivery),
                const SizedBox(height: 20),
              ],

              // 4. "No drone assigned yet" notice (when triggered)
              if (_showNoDroneNotice && (activeDelivery == null || !activeDelivery.isActive)) ...[
                _buildNoDroneAssignedCard(),
                const SizedBox(height: 20),
              ],

              // 5. One Prominent CTA: "TRACK YOUR DRONE"
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton.icon(
                  key: const ValueKey('trackYourDroneCta'),
                  onPressed: _handleTrackYourDronePressed,
                  icon: const Icon(
                    Icons.navigation_outlined,
                    size: 20,
                    color: Colors.black,
                  ),
                  label: const Text(
                    'TRACK YOUR DRONE',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                      color: Colors.black,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryAccent,
                    foregroundColor: Colors.black,
                    elevation: 6,
                    shadowColor: AppColors.primaryAccent.withValues(alpha: 0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),
              // Subtle aerospace status tag
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isAuth ? const Color(0xFF00C853) : const Color(0xFF757575),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      isAuth
                        ? (activeDelivery != null
                            ? 'ACTIVE HEALTHCARE FLIGHT'
                            : 'SECURE CITIZEN TELEMETRY')
                        : 'AUTHENTICATION REQUIRED',
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.8,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Clean aerospace drone radar illustration
  Widget _buildDroneVisual() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        final pulse = _pulseAnimation.value;
        return SizedBox(
          width: 170,
          height: 170,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer radar ring with soft pulse
              Container(
                width: 160 + (pulse * 8),
                height: 160 + (pulse * 8),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primaryAccent.withValues(alpha: 0.12 + (pulse * 0.10)),
                    width: 1.2,
                  ),
                ),
              ),
              // Intermediate radar circle
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white12,
                    width: 1.0,
                  ),
                ),
              ),
              // Radar crosshairs ticks
              CustomPaint(
                size: const Size(160, 160),
                painter: _CrosshairPainter(),
              ),
              // Inner drone cockpit circle
              Container(
                width: 74,
                height: 74,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF131822),
                  border: Border.all(
                    color: AppColors.primaryAccent.withValues(alpha: 0.6),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryAccent.withValues(alpha: 0.15 + (pulse * 0.10)),
                      blurRadius: 18,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.flight_takeoff_rounded,
                    size: 34,
                    color: AppColors.primaryAccent,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Active delivery status card preview
  Widget _buildActiveDeliveryCard(HealthcareDelivery delivery) {
    return InkWell(
      onTap: _handleTrackYourDronePressed,
      borderRadius: BorderRadius.circular(14),
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF141924),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.primaryAccent.withValues(alpha: 0.4),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(
                      Icons.local_shipping_outlined,
                      size: 16,
                      color: AppColors.primaryAccent,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        delivery.deliveryId,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primaryAccent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.primaryAccent, width: 0.8),
                ),
                child: Text(
                  delivery.status.displayName.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.primaryAccent,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _formatPackageType(delivery.packageType),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Drone: ${delivery.assignedDrone?.droneId ?? 'Pending'}',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    )
    );
  }

  /// Clean empty-state notice when no drone is assigned
  Widget _buildNoDroneAssignedCard() {
    return Container(
      key: const ValueKey('noDroneAssignedFeedback'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF181C26),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Colors.white24,
          width: 1.0,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline,
            size: 20,
            color: AppColors.primaryAccent,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'No drone assigned yet',
                  key: ValueKey('noDroneAssignedText'),
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'There is currently no healthcare drone assigned to your address. Check back when a delivery is dispatched.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () => _trackingService.refreshNow(),
                  child: const Text(
                    'Check for Updates',
                    style: TextStyle(
                      color: AppColors.primaryAccent,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CrosshairPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white24
      ..strokeWidth = 1.0;

    final cx = size.width / 2;
    final cy = size.height / 2;
    const tickLen = 8.0;

    // Top tick
    canvas.drawLine(Offset(cx, 10), Offset(cx, 10 + tickLen), paint);
    // Bottom tick
    canvas.drawLine(Offset(cx, size.height - 10 - tickLen), Offset(cx, size.height - 10), paint);
    // Left tick
    canvas.drawLine(Offset(10, cy), Offset(10 + tickLen, cy), paint);
    // Right tick
    canvas.drawLine(Offset(size.width - 10 - tickLen, cy), Offset(size.width - 10, cy), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
