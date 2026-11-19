import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/delivery_tracking_service.dart';
import '../screens/delivery_tracking_screen.dart';
import 'delivery_tracking_pill.dart';

/// Inherited scope providing access to [HealthcareDeliveryTrackingService] across the widget tree.
class DeliveryTrackingScope extends InheritedNotifier<HealthcareDeliveryTrackingService> {
  const DeliveryTrackingScope({
    super.key,
    required HealthcareDeliveryTrackingService service,
    required super.child,
  }) : super(notifier: service);

  static HealthcareDeliveryTrackingService? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<DeliveryTrackingScope>()?.notifier;
  }

  static HealthcareDeliveryTrackingService of(BuildContext context) {
    final service = maybeOf(context);
    assert(service != null, 'No DeliveryTrackingScope found in context');
    return service!;
  }
}

/// Persistent global overlay for Healthcare Drone Delivery Tracking.
///
/// Wraps the root Navigator inside [MaterialApp.builder] so that the tracking pill
/// remains visible across all navigation tabs and pushed routes for authenticated citizens.
class DeliveryTrackingOverlay extends StatefulWidget {
  final Widget child;
  final HealthcareDeliveryTrackingService? trackingService;
  final CitizenAuthService? authService;
  final GlobalKey<NavigatorState>? navigatorKey;
  final bool animatePulse;

  const DeliveryTrackingOverlay({
    super.key,
    required this.child,
    this.trackingService,
    this.authService,
    this.navigatorKey,
    this.animatePulse = true,
  });

  @override
  State<DeliveryTrackingOverlay> createState() => _DeliveryTrackingOverlayState();
}

class _DeliveryTrackingOverlayState extends State<DeliveryTrackingOverlay> {
  HealthcareDeliveryTrackingService? _trackingService;
  CitizenAuthService? _authService;
  bool _isModalOpen = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _trackingService = widget.trackingService ??
        DeliveryTrackingScope.maybeOf(context) ??
        HealthcareDeliveryTrackingService.instance;
    _authService = widget.authService ?? CitizenAuthService();
  }

  @override
  Widget build(BuildContext context) {
    final tracking = _trackingService ??
        widget.trackingService ??
        HealthcareDeliveryTrackingService.instance;
    final auth = _authService ?? widget.authService ?? CitizenAuthService();

    return ListenableBuilder(
      listenable: Listenable.merge([
        tracking,
        DeliveryTrackingScreen.isTrackingScreenActive,
      ]),
      builder: (context, _) {
        final state = tracking.state;
        final bool isAuth = auth.isAuthenticated;

        if (!isAuth) {
          return widget.child;
        }

        final bool isTrackingScreenOpen = DeliveryTrackingScreen.isTrackingScreenActive.value;
        final bool isPillVisible = !_isModalOpen && !isTrackingScreenOpen;

        return Stack(
          fit: StackFit.expand,
          children: [
            widget.child,
            Positioned(
              left: 16,
              right: 16,
              bottom: 20 + MediaQuery.paddingOf(context).bottom,
              child: Visibility(
                key: const ValueKey('deliveryTrackingOverlayVisibility'),
                visible: isPillVisible,
                maintainState: true,
                child: SafeArea(
                  top: false,
                  child: DeliveryTrackingPill(
                    delivery: state.activeDelivery,
                    isLoading: state.isLoading,
                    errorMessage: state.errorMessage,
                    socketStatus: state.socketStatus,
                    onRefresh: () => tracking.refreshNow(),
                    navigatorKey: widget.navigatorKey,
                    animatePulse: widget.animatePulse,
                    onModalVisibilityChanged: (isOpen) {
                      if (mounted && _isModalOpen != isOpen) {
                        setState(() {
                          _isModalOpen = isOpen;
                        });
                      }
                    },
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
