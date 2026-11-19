import 'package:flutter/material.dart';
import '../models/delivery_tracking_models.dart';
import '../screens/delivery_tracking_screen.dart';
import '../theme/app_colors.dart';

class DeliveryTrackingPill extends StatefulWidget {
  final HealthcareDelivery? delivery;
  final bool isLoading;
  final String? errorMessage;
  final SocketConnectionStatus socketStatus;
  final VoidCallback? onRefresh;
  final GlobalKey<NavigatorState>? navigatorKey;
  final bool animatePulse;
  final ValueChanged<bool>? onModalVisibilityChanged;

  const DeliveryTrackingPill({
    super.key,
    this.delivery,
    this.isLoading = false,
    this.errorMessage,
    this.socketStatus = SocketConnectionStatus.disconnected,
    this.onRefresh,
    this.navigatorKey,
    this.animatePulse = true,
    this.onModalVisibilityChanged,
  });

  @override
  State<DeliveryTrackingPill> createState() => _DeliveryTrackingPillState();
}

class _DeliveryTrackingPillState extends State<DeliveryTrackingPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;
  bool _isModalOpen = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _pulseAnimation = Tween<double>(begin: 0.2, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    if (widget.animatePulse) {
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  BuildContext _resolveNavigatorContext() {
    return widget.navigatorKey?.currentContext ??
        Navigator.maybeOf(context)?.context ??
        context;
  }

  void _onPillTapped() {
    final navContext = _resolveNavigatorContext();
    final delivery = widget.delivery;
    if (delivery != null && delivery.isActive) {
      Navigator.of(navContext).push(
        MaterialPageRoute(
          builder: (_) => DeliveryTrackingScreen(
            deliveryId: delivery.deliveryId,
          ),
        ),
      );
    } else {
      _showEmptyDeliveryModal(navContext);
    }
  }

  Future<void> _showEmptyDeliveryModal([BuildContext? targetContext]) async {
    if (_isModalOpen) return;
    final modalContext = targetContext ?? _resolveNavigatorContext();

    setState(() {
      _isModalOpen = true;
    });
    widget.onModalVisibilityChanged?.call(true);

    try {
      await showModalBottomSheet(
        context: modalContext,
        useRootNavigator: true,
        backgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white12,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.medical_services_outlined,
                      color: Colors.white70,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DRONE DELIVERY TRACKING',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.6,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'AERON Healthcare Logistics',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: const Text(
                  'No healthcare delivery is currently assigned to your address. When an emergency medical dispatch (e.g. insulin, blood plasma, antivenom) is scheduled, real-time GPS drone telemetry will stream here automatically.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    widget.onRefresh?.call();
                  },
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Check for Updates'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryAccent,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
    } finally {
      if (mounted) {
        setState(() {
          _isModalOpen = false;
        });
        widget.onModalVisibilityChanged?.call(false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isModalOpen) {
      return const SizedBox.shrink();
    }

    final delivery = widget.delivery;
    final bool hasActive = delivery != null && delivery.isActive;
    final telem = delivery?.telemetry;
    final bool isLiveGps = telem?.isLive ?? false;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _onPillTapped,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF161922).withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: hasActive
                  ? (isLiveGps ? AppColors.primaryAccent : Colors.white24)
                  : Colors.white12,
              width: hasActive && isLiveGps ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
              if (hasActive && isLiveGps)
                BoxShadow(
                  color: AppColors.primaryAccent.withValues(alpha: 0.2),
                  blurRadius: 8,
                ),
            ],
          ),
          child: Row(
            children: [
              // Left Icon / Pulsing Dot
              if (hasActive && isLiveGps)
                AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, _) {
                    return Container(
                      width: 12,
                      height: 12,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primaryAccent
                            .withValues(alpha: _pulseAnimation.value),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primaryAccent.withValues(
                              alpha: 0.6 * _pulseAnimation.value,
                            ),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    );
                  },
                )
              else
                Container(
                  padding: const EdgeInsets.all(6),
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: Colors.white10,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    hasActive
                        ? Icons.flight_takeoff
                        : Icons.medical_services_outlined,
                    color: hasActive ? AppColors.primaryAccent : Colors.white60,
                    size: 16,
                  ),
                ),

              // Title and Subtitle
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      hasActive
                          ? '${delivery.deliveryId} • ${_formatPackage(delivery.packageType)}'
                          : 'DRONE DELIVERY TRACKING',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.4,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasActive
                          ? delivery.status.displayName.toUpperCase()
                          : 'NO ACTIVE DELIVERY',
                      style: TextStyle(
                        color: hasActive
                            ? (isLiveGps
                                ? AppColors.primaryAccent
                                : AppColors.textSecondary)
                            : AppColors.textSecondary,
                        fontSize: 11,
                        fontWeight:
                            hasActive ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),

              // Right Badges & Arrow
              if (hasActive)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: isLiveGps
                            ? AppColors.primaryAccent.withValues(alpha: 0.2)
                            : Colors.white10,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isLiveGps ? 'LIVE' : (telem?.freshness.displayName ?? 'STANDBY').toUpperCase(),
                        style: TextStyle(
                          color: isLiveGps ? AppColors.primaryAccent : Colors.white60,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.chevron_right,
                      color: Colors.white54,
                      size: 20,
                    ),
                  ],
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white10,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'STANDBY',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatPackage(String raw) {
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}' : '')
        .join(' ');
  }
}
