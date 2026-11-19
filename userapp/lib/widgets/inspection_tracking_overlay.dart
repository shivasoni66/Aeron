import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/inspection_tracking_service.dart';
import 'live_tracking_pill.dart';

/// Inherited scope providing access to [InspectionTrackingService] across the widget tree.
class InspectionTrackingScope extends InheritedNotifier<InspectionTrackingService> {
  const InspectionTrackingScope({
    super.key,
    required InspectionTrackingService service,
    required super.child,
  }) : super(notifier: service);

  static InspectionTrackingService? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<InspectionTrackingScope>()?.notifier;
  }

  static InspectionTrackingService of(BuildContext context) {
    final service = maybeOf(context);
    assert(service != null, 'No InspectionTrackingScope found in context');
    return service!;
  }
}

/// Global overlay widget providing a persistent inspection tracking capsule.
///
/// Wraps the root Navigator inside [MaterialApp.builder] so that the tracking pill
/// remains visible across all navigation tabs and pushed routes (e.g. ReportDetail, Notifications)
/// when the authenticated user has an active Stage 3 or Stage 4 report.
class InspectionTrackingOverlay extends StatefulWidget {
  final Widget child;
  final InspectionTrackingService? trackingService;
  final CitizenAuthService? authService;
  final GlobalKey<NavigatorState>? navigatorKey;
  final bool animatePulse;

  const InspectionTrackingOverlay({
    super.key,
    required this.child,
    this.trackingService,
    this.authService,
    this.navigatorKey,
    this.animatePulse = true,
  });

  @override
  State<InspectionTrackingOverlay> createState() => _InspectionTrackingOverlayState();
}

class _InspectionTrackingOverlayState extends State<InspectionTrackingOverlay> {
  InspectionTrackingService? _trackingService;
  CitizenAuthService? _authService;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _trackingService = widget.trackingService ??
        InspectionTrackingScope.maybeOf(context) ??
        InspectionTrackingService.instance;
    _authService = widget.authService ?? CitizenAuthService();
  }

  @override
  Widget build(BuildContext context) {
    final tracking = _trackingService ?? widget.trackingService ?? InspectionTrackingService.instance;
    final auth = _authService ?? widget.authService ?? CitizenAuthService();

    return ListenableBuilder(
      listenable: tracking,
      builder: (context, _) {
        final state = tracking.state;
        final bool isAuth = auth.isAuthenticated;
        final bool shouldShow = isAuth;

        if (!shouldShow) {
          return widget.child;
        }

        return Stack(
          fit: StackFit.expand,
          children: [
            widget.child,
            Positioned(
              left: 16,
              right: 16,
              bottom: 92 + MediaQuery.paddingOf(context).bottom,
              child: SafeArea(
                top: false,
                child: LiveTrackingPill(
                  report: state.activeReport,
                  lastRefreshedAt: state.lastRefreshedAt,
                  isLoading: state.isLoading,
                  errorMessage: state.errorMessage,
                  onRefresh: () => tracking.refreshNow(),
                  navigatorKey: widget.navigatorKey,
                  animatePulse: widget.animatePulse,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
