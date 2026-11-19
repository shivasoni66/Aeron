import 'package:flutter/material.dart';
import 'screens/main_shell_screen.dart';
import 'services/auth_service.dart';
import 'services/delivery_tracking_service.dart';
import 'services/inspection_tracking_service.dart';
import 'theme/app_theme.dart';
import 'widgets/delivery_tracking_overlay.dart';
import 'widgets/inspection_tracking_overlay.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AeronCitizenApp());
}

class AeronCitizenApp extends StatefulWidget {
  final HealthcareDeliveryTrackingService? deliveryTrackingService;
  final InspectionTrackingService? trackingService;
  final CitizenAuthService? authService;
  final bool animatePulse;
  final bool autoStartTracking;
  final GlobalKey<NavigatorState>? navigatorKey;

  const AeronCitizenApp({
    super.key,
    this.deliveryTrackingService,
    this.trackingService,
    this.authService,
    this.animatePulse = true,
    this.autoStartTracking = true,
    this.navigatorKey,
  });

  @override
  State<AeronCitizenApp> createState() => _AeronCitizenAppState();
}

class _AeronCitizenAppState extends State<AeronCitizenApp> {
  late final HealthcareDeliveryTrackingService _deliveryTrackingService;
  late final InspectionTrackingService _inspectionTrackingService;
  late final CitizenAuthService _authService;
  late final GlobalKey<NavigatorState> _navigatorKey;

  @override
  void initState() {
    super.initState();
    _authService = widget.authService ?? CitizenAuthService();
    _deliveryTrackingService =
        widget.deliveryTrackingService ?? HealthcareDeliveryTrackingService.instance;
    _inspectionTrackingService =
        widget.trackingService ?? InspectionTrackingService.instance;
    _navigatorKey = widget.navigatorKey ?? GlobalKey<NavigatorState>();

    _authService.addListener(_onAuthChanged);
    if (widget.autoStartTracking) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _onAuthChanged();
      });
    }
  }

  void _onAuthChanged() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_authService.isAuthenticated) {
        if (!_deliveryTrackingService.isTracking) {
          _deliveryTrackingService.start();
        }
        if (!_inspectionTrackingService.isTracking) {
          _inspectionTrackingService.start();
        }
      } else {
        if (_deliveryTrackingService.isTracking) {
          _deliveryTrackingService.stop();
        }
        if (!_inspectionTrackingService.isTracking) {
          _inspectionTrackingService.stop();
        }
      }
    });
  }

  @override
  void dispose() {
    _authService.removeListener(_onAuthChanged);
    _deliveryTrackingService.stop();
    _inspectionTrackingService.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'AERON Citizen Services',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      builder: (context, child) {
        final content = child ?? const SizedBox.shrink();

        // If legacy inspection tracking was explicitly passed in widget tests
        if (widget.trackingService != null && widget.deliveryTrackingService == null) {
          return InspectionTrackingScope(
            service: _inspectionTrackingService,
            child: InspectionTrackingOverlay(
              trackingService: _inspectionTrackingService,
              authService: _authService,
              navigatorKey: _navigatorKey,
              animatePulse: widget.animatePulse,
              child: content,
            ),
          );
        }

        // Phase 4: Healthcare Drone Delivery Tracking Global Overlay
        return DeliveryTrackingScope(
          service: _deliveryTrackingService,
          child: DeliveryTrackingOverlay(
            trackingService: _deliveryTrackingService,
            authService: _authService,
            navigatorKey: _navigatorKey,
            animatePulse: widget.animatePulse,
            child: content,
          ),
        );
      },
      home: const MainShellScreen(),
    );
  }
}
