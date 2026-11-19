import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/delivery_tracking_models.dart';
import '../services/delivery_tracking_service.dart';
import '../core/gis_utils.dart';
import '../theme/app_colors.dart';

class DeliveryTrackingScreen extends StatefulWidget {
  final String deliveryId;
  final HealthcareDeliveryTrackingService? trackingService;

  /// Global notifier indicating whether the dedicated tracking screen is currently open.
  /// Used by global overlays to cleanly suppress duplicate floating pills without polluting
  /// the map or sheet view.
  static final ValueNotifier<bool> isTrackingScreenActive =
      ValueNotifier<bool>(false);

  const DeliveryTrackingScreen({
    super.key,
    required this.deliveryId,
    this.trackingService,
  });

  @override
  State<DeliveryTrackingScreen> createState() => DeliveryTrackingScreenState();
}

class DeliveryTrackingScreenState extends State<DeliveryTrackingScreen>
    with TickerProviderStateMixin {
  late final MapController _mapController;
  late final HealthcareDeliveryTrackingService _trackingService;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  // Phase 2: Marker Movement & Auto-Follow State
  late final AnimationController _movementController;
  Animation<LatLng>? _latLngAnimation;
  Animation<double>? _headingAnimation;

  // Phase 3: Freshness Ticker & State
  Timer? _tickerTimer;
  late final ValueNotifier<DateTime> _tickerNow;
  GpsFreshnessState? _lastEvaluatedFreshness;

  bool _isAutoFollowActive = true;
  bool _isMapReady = false;
  LatLng? _animatedDronePos;
  LatLng? _targetDronePos;
  double _currentDroneHeading = 0.0;
  DateTime? _lastTelemetryTimestamp;
  String? _currentDeliveryId;

  @visibleForTesting
  bool get isAutoFollowActive => _isAutoFollowActive;

  @visibleForTesting
  LatLng? get animatedDronePos => _animatedDronePos;

  @visibleForTesting
  AnimationController get movementController => _movementController;

  @visibleForTesting
  ValueNotifier<DateTime> get tickerNow => _tickerNow;

  @visibleForTesting
  Timer? get tickerTimer => _tickerTimer;

  @visibleForTesting
  GpsFreshnessState? get lastEvaluatedFreshness => _lastEvaluatedFreshness;

  @visibleForTesting
  void onManualPanForTesting() {
    setState(() {
      _isAutoFollowActive = false;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        DeliveryTrackingScreen.isTrackingScreenActive.value = true;
      }
    });

    _mapController = MapController();
    _trackingService =
        widget.trackingService ?? HealthcareDeliveryTrackingService.instance;
    _trackingService.addListener(_handleServiceUpdate);

    _tickerNow = ValueNotifier(DateTime.now());
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        final now = DateTime.now();
        _tickerNow.value = now;

        final telem = _trackingService.state.activeDelivery?.telemetry;
        final newFreshness = GisUtils.evaluateFreshness(
          recordedAt: telem?.recordedAt,
          hasCoordinates: telem != null && telem.hasCoordinates,
          backendFreshness: telem?.freshness,
          now: now,
        );
        if (newFreshness != _lastEvaluatedFreshness) {
          _lastEvaluatedFreshness = newFreshness;
          setState(() {});
        }
      }
    });

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    );

    _movementController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _movementController.addListener(_onMovementTick);

    _initializeFromCurrentDelivery();
  }

  void _onMovementTick() {
    if (_latLngAnimation != null) {
      _animatedDronePos = _latLngAnimation!.value;
    }
    if (_headingAnimation != null) {
      _currentDroneHeading = _headingAnimation!.value;
    }
    if (_isAutoFollowActive && _animatedDronePos != null && _isMapReady) {
      _moveCameraSafely(_animatedDronePos!, _currentZoom);
    }
  }

  void _initializeFromCurrentDelivery() {
    final delivery = _trackingService.state.activeDelivery;
    if (delivery != null) {
      _currentDeliveryId = delivery.deliveryId;
      final telem = delivery.telemetry;
      if (telem != null &&
          telem.hasCoordinates &&
          GisUtils.isValidCoordinate(telem.latitude, telem.longitude)) {
        _animatedDronePos = LatLng(telem.latitude!, telem.longitude!);
        _targetDronePos = _animatedDronePos;
        _currentDroneHeading = telem.heading ?? 0.0;
        _lastTelemetryTimestamp = telem.recordedAt;
      }
    }
  }

  void _handleServiceUpdate() {
    if (!mounted) return;
    final state = _trackingService.state;
    final delivery = state.activeDelivery;

    // 1. Delivery cleared (logged out or no active delivery)
    if (delivery == null) {
      if (_movementController.isAnimating) {
        _movementController.stop();
      }
      _animatedDronePos = null;
      _targetDronePos = null;
      _currentDeliveryId = null;
      _lastTelemetryTimestamp = null;
      setState(() {});
      return;
    }

    // 2. Switched to another delivery
    if (_currentDeliveryId != delivery.deliveryId) {
      _currentDeliveryId = delivery.deliveryId;
      if (_movementController.isAnimating) {
        _movementController.stop();
      }
      _latLngAnimation = null;
      _headingAnimation = null;
      _lastTelemetryTimestamp = null;
      _isAutoFollowActive = true; // Auto-follow enabled by default for new delivery

      final telem = delivery.telemetry;
      if (telem != null &&
          telem.hasCoordinates &&
          GisUtils.isValidCoordinate(telem.latitude, telem.longitude)) {
        _animatedDronePos = LatLng(telem.latitude!, telem.longitude!);
        _targetDronePos = _animatedDronePos;
        _currentDroneHeading = telem.heading ?? 0.0;
        _lastTelemetryTimestamp = telem.recordedAt;
        _moveCameraSafely(_animatedDronePos!, _currentZoom);
      } else {
        _animatedDronePos = null;
        _targetDronePos = null;
        final dest = LatLng(
          delivery.destinationLocation.latitude,
          delivery.destinationLocation.longitude,
        );
        _moveCameraSafely(dest, 14.5);
      }
      setState(() {});
      return;
    }

    // 3. Same delivery: process incoming telemetry
    final telem = delivery.telemetry;
    if (telem == null ||
        !telem.hasCoordinates ||
        !GisUtils.isValidCoordinate(telem.latitude, telem.longitude)) {
      return;
    }

    final newTarget = LatLng(telem.latitude!, telem.longitude!);
    final newHeading = telem.heading ?? _currentDroneHeading;
    final newTimestamp = telem.recordedAt;

    // First time receiving coordinates for this delivery
    if (_animatedDronePos == null) {
      _animatedDronePos = newTarget;
      _targetDronePos = newTarget;
      _currentDroneHeading = newHeading;
      _lastTelemetryTimestamp = newTimestamp;
      if (_isAutoFollowActive) {
        _moveCameraSafely(newTarget, _currentZoom);
      }
      setState(() {});
      return;
    }

    // Check if position changed
    final bool positionChanged = _targetDronePos == null ||
        newTarget.latitude != _targetDronePos!.latitude ||
        newTarget.longitude != _targetDronePos!.longitude;

    if (!positionChanged) {
      // Only heading may have changed
      if (newHeading != _currentDroneHeading) {
        _currentDroneHeading = newHeading;
        setState(() {});
      }
      return;
    }

    // Safely replace or cancel ongoing animation
    final LatLng currentPos =
        _latLngAnimation?.value ?? _animatedDronePos ?? newTarget;
    final double currentHeading =
        _headingAnimation?.value ?? _currentDroneHeading;

    if (_movementController.isAnimating) {
      _movementController.stop();
    }

    // Timestamp-aware duration calculation
    Duration animDuration = const Duration(milliseconds: 1000);
    if (_lastTelemetryTimestamp != null && newTimestamp != null) {
      final elapsedMs =
          newTimestamp.difference(_lastTelemetryTimestamp!).inMilliseconds;
      if (elapsedMs >= 200 && elapsedMs <= 5000) {
        animDuration = Duration(milliseconds: elapsedMs);
      }
    }

    _lastTelemetryTimestamp = newTimestamp;
    _targetDronePos = newTarget;

    _latLngAnimation = LatLngTween(
      begin: currentPos,
      end: newTarget,
    ).animate(CurvedAnimation(
      parent: _movementController,
      curve: Curves.linear,
    ));

    _headingAnimation = HeadingTween(
      begin: currentHeading,
      end: newHeading,
    ).animate(CurvedAnimation(
      parent: _movementController,
      curve: Curves.easeInOut,
    ));

    _movementController.duration = animDuration;
    _movementController.reset();
    _movementController.forward();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      DeliveryTrackingScreen.isTrackingScreenActive.value = false;
    });
    _tickerTimer?.cancel();
    _tickerTimer = null;
    _tickerNow.dispose();
    _trackingService.removeListener(_handleServiceUpdate);
    _movementController.dispose();
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _moveCameraSafely(LatLng target, double zoom) {
    if (!_isMapReady) return;
    try {
      _mapController.move(target, zoom);
    } catch (_) {}
  }

  double get _currentZoom {
    if (!_isMapReady) return 14.5;
    try {
      return _mapController.camera.zoom;
    } catch (_) {
      return 14.5;
    }
  }

  void _centerOnDrone({bool reEnableAutoFollow = false}) {
    if (reEnableAutoFollow) {
      setState(() {
        _isAutoFollowActive = true;
      });
    }

    final delivery = _trackingService.state.activeDelivery;
    if (delivery == null) return;

    final LatLng target;
    if (_animatedDronePos != null) {
      target = _animatedDronePos!;
    } else if (delivery.telemetry != null &&
        delivery.telemetry!.hasCoordinates &&
        GisUtils.isValidCoordinate(
            delivery.telemetry!.latitude, delivery.telemetry!.longitude)) {
      target = LatLng(
        delivery.telemetry!.latitude!,
        delivery.telemetry!.longitude!,
      );
    } else {
      target = LatLng(
        delivery.destinationLocation.latitude,
        delivery.destinationLocation.longitude,
      );
    }

    _moveCameraSafely(target, _currentZoom);
  }

  void _viewDestination() {
    setState(() {
      _isAutoFollowActive = false;
    });

    final delivery = _trackingService.state.activeDelivery;
    if (delivery == null) return;

    final dest = LatLng(
      delivery.destinationLocation.latitude,
      delivery.destinationLocation.longitude,
    );
    _moveCameraSafely(dest, 14.5);
  }

  void _zoomIn() {
    final currentZoom = _currentZoom;
    final currentCenter =
        _isMapReady ? _mapController.camera.center : const LatLng(0, 0);
    _moveCameraSafely(currentCenter, currentZoom + 1);
  }

  void _zoomOut() {
    final currentZoom = _currentZoom;
    final currentCenter =
        _isMapReady ? _mapController.camera.center : const LatLng(0, 0);
    _moveCameraSafely(currentCenter, currentZoom - 1);
  }

  void _handleMapEvent(MapEvent event) {
    if (event.source != MapEventSource.mapController && _isAutoFollowActive) {
      if (event.source == MapEventSource.dragStart ||
          event.source == MapEventSource.onDrag ||
          event.source == MapEventSource.flingAnimationController ||
          event.source == MapEventSource.multiFingerGestureStart ||
          event.source == MapEventSource.onMultiFinger) {
        setState(() {
          _isAutoFollowActive = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _trackingService,
      builder: (context, _) {
        final state = _trackingService.state;
        final delivery = state.activeDelivery;

        return Scaffold(
          backgroundColor: const Color(0xFF0B0E14),
          body: delivery == null
              ? _buildLoadingOrError(state)
              : _buildDeliveryContent(delivery, state),
        );
      },
    );
  }

  Widget _buildLoadingOrError(DeliveryTrackingState state) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Center(
        child: state.isLoading
            ? const CircularProgressIndicator(color: AppColors.primaryAccent)
            : state.errorMessage != null
                ? Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            color: Colors.redAccent, size: 48),
                        const SizedBox(height: 12),
                        Text(
                          state.errorMessage!,
                          style: const TextStyle(color: Colors.white70),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () => _trackingService.refreshNow(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryAccent,
                            foregroundColor: Colors.black,
                          ),
                          child: const Text('Try Again'),
                        ),
                      ],
                    ),
                  )
                : const Text(
                    'Delivery information is currently unavailable.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
      ),
    );
  }

  Widget _buildDeliveryContent(
      HealthcareDelivery delivery, DeliveryTrackingState state) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Layer 0: Full-Screen Aerospace Drone Map
        AnimatedBuilder(
          animation: _movementController,
          builder: (context, _) => _buildMap(delivery, state),
        ),

        // Layer 1: Floating Map Controls (Right edge)
        _buildMapControls(delivery),

        // Layer 2: "Center Drone" Floating Action Pill (visible when user panned away)
        _buildCenterDroneButton(),

        // Layer 3: Compact Top Floating Header
        _buildTopHeader(delivery),

        // Layer 4: Floating GPS Freshness Warning Banner (beneath top header, only when stale/delayed)
        _buildFreshnessOverlayBanner(delivery, state),

        // Layer 5: Single Draggable Bottom Tracking Sheet
        _buildDraggableBottomSheet(delivery, state),
      ],
    );
  }

  Widget _buildTopHeader(HealthcareDelivery delivery) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xF0121620),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12, width: 1),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black54,
                  blurRadius: 12,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  tooltip: 'Back',
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text(
                            'AERON',
                            style: TextStyle(
                              color: AppColors.primaryAccent,
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Container(
                            margin: const EdgeInsets.symmetric(horizontal: 5),
                            width: 4,
                            height: 4,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.primaryAccent,
                            ),
                          ),
                          Text(
                            delivery.deliveryId,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatPackageType(delivery.packageType),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Text(
                    delivery.status.displayName.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(width: 2),
                IconButton(
                  icon: const Icon(Icons.refresh, color: AppColors.primaryAccent, size: 18),
                  onPressed: () => _trackingService.refreshNow(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  tooltip: 'Refresh Status',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMapControls(HealthcareDelivery delivery) {
    return Positioned(
      right: 14,
      top: 130,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        decoration: BoxDecoration(
          color: const Color(0xEE121620),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white12),
          boxShadow: const [
            BoxShadow(
              color: Colors.black45,
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FloatingActionButton.small(
              key: const ValueKey('zoomInBtn'),
              heroTag: 'zoomInBtn',
              elevation: 0,
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              onPressed: _zoomIn,
              tooltip: 'Zoom In',
              child: const Icon(Icons.add, size: 20),
            ),
            Container(width: 24, height: 1, color: Colors.white10),
            FloatingActionButton.small(
              key: const ValueKey('zoomOutBtn'),
              heroTag: 'zoomOutBtn',
              elevation: 0,
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              onPressed: _zoomOut,
              tooltip: 'Zoom Out',
              child: const Icon(Icons.remove, size: 20),
            ),
            Container(width: 24, height: 1, color: Colors.white10),
            FloatingActionButton.small(
              key: const ValueKey('viewDestinationBtn'),
              heroTag: 'viewDestinationBtn',
              elevation: 0,
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white70,
              onPressed: _viewDestination,
              tooltip: 'View Destination',
              child: const Icon(Icons.flag_outlined, size: 19),
            ),
            Container(width: 24, height: 1, color: Colors.white10),
            FloatingActionButton.small(
              key: const ValueKey('recenterBtn'),
              heroTag: 'recenterBtn',
              elevation: 0,
              backgroundColor: _isAutoFollowActive
                  ? AppColors.primaryAccent.withValues(alpha: 0.2)
                  : Colors.transparent,
              foregroundColor: _isAutoFollowActive
                  ? AppColors.primaryAccent
                  : Colors.white,
              onPressed: () => _centerOnDrone(reEnableAutoFollow: true),
              tooltip: _isAutoFollowActive ? 'Auto-Follow Active' : 'Center Drone',
              child: const Icon(Icons.my_location, size: 19),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterDroneButton() {
    if (_isAutoFollowActive) {
      return const SizedBox.shrink();
    }
    return Positioned(
      bottom: 230,
      left: 0,
      right: 0,
      child: Center(
        child: ElevatedButton.icon(
          key: const Key('centerDroneBtn'),
          onPressed: () => _centerOnDrone(reEnableAutoFollow: true),
          icon: const Icon(Icons.my_location, size: 16),
          label: const Text(
            'Center Drone',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryAccent,
            foregroundColor: Colors.black,
            elevation: 4,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFreshnessOverlayBanner(
      HealthcareDelivery delivery, DeliveryTrackingState state) {
    return ValueListenableBuilder<DateTime>(
      valueListenable: _tickerNow,
      builder: (context, now, child) {
        final telem = delivery.telemetry;
        final hasCoords = _animatedDronePos != null ||
            (telem != null &&
                telem.hasCoordinates &&
                GisUtils.isValidCoordinate(telem.latitude, telem.longitude));
        final freshness = GisUtils.evaluateFreshness(
          recordedAt: telem?.recordedAt,
          hasCoordinates: hasCoords,
          backendFreshness: telem?.freshness,
          now: now,
        );

        if (freshness == GpsFreshnessState.live) {
          return const SizedBox.shrink();
        }

        final bool isStale = freshness == GpsFreshnessState.stale;
        final bool isDelayed = freshness == GpsFreshnessState.delayed;
        final Color bannerBg = isStale
            ? const Color(0xFFD32F2F).withValues(alpha: 0.94)
            : isDelayed
                ? Colors.amber[900]!.withValues(alpha: 0.94)
                : Colors.black87;
        final Color borderColor = isStale
            ? Colors.redAccent
            : isDelayed
                ? Colors.amberAccent
                : Colors.white24;
        final IconData bannerIcon = isStale
            ? Icons.error_outline
            : isDelayed
                ? Icons.warning_amber_rounded
                : Icons.info_outline;
        final String bannerText = isStale
            ? 'GPS update delayed (>30s). Displaying last verified drone position.'
            : isDelayed
                ? 'GPS signal delayed (10-30s). Updates may be slower than real-time.'
                : 'Awaiting initial GPS fix from assigned delivery drone.';

        final double topPadding = MediaQuery.paddingOf(context).top + 68;

        return Positioned(
          top: topPadding,
          left: 14,
          right: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: bannerBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderColor),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black45,
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(bannerIcon, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    bannerText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildMap(HealthcareDelivery delivery, DeliveryTrackingState state) {
    final destination = LatLng(
      delivery.destinationLocation.latitude,
      delivery.destinationLocation.longitude,
    );
    final pickup = LatLng(
      delivery.pickupLocation.latitude,
      delivery.pickupLocation.longitude,
    );

    final telem = delivery.telemetry;
    final bool hasValidCoords = _animatedDronePos != null ||
        (telem != null &&
            telem.hasCoordinates &&
            GisUtils.isValidCoordinate(telem.latitude, telem.longitude));

    final dronePos = _animatedDronePos ??
        (hasValidCoords
            ? LatLng(telem!.latitude!, telem.longitude!)
            : destination);

    final initialCenter = hasValidCoords ? dronePos : destination;

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: initialCenter,
        initialZoom: 14.5,
        minZoom: 4.0,
        maxZoom: 18.0,
        onMapReady: () {
          _isMapReady = true;
          if (_isAutoFollowActive && _animatedDronePos != null) {
            _moveCameraSafely(_animatedDronePos!, _currentZoom);
          }
        },
        onPositionChanged: (camera, hasGesture) {
          if (hasGesture && _isAutoFollowActive) {
            setState(() {
              _isAutoFollowActive = false;
            });
          }
        },
        onMapEvent: _handleMapEvent,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.aeron.citizenapp',
        ),
        if (state.trailPoints.isNotEmpty)
          PolylineLayer(
            polylines: [
              Polyline(
                points: state.trailPoints,
                strokeWidth: 4.0,
                color: AppColors.primaryAccent,
                borderColor: const Color(0xFF10141D),
                borderStrokeWidth: 1.5,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            // Pickup Marker (Depot)
            Marker(
              point: pickup,
              width: 44,
              height: 44,
              child: const _MapPin(
                icon: Icons.local_hospital,
                color: Color(0xFF00C853),
                label: 'Depot',
              ),
            ),
            // Destination Marker (Patient)
            Marker(
              point: destination,
              width: 44,
              height: 44,
              child: const _MapPin(
                icon: Icons.home,
                color: Color(0xFFFF5252),
                label: 'Recipient',
              ),
            ),
            // Real-time Drone Marker
            if (hasValidCoords)
              Marker(
                point: dronePos,
                width: 64,
                height: 64,
                child: _buildDroneMarker(
                  telem,
                  _currentDroneHeading,
                  GisUtils.evaluateFreshness(
                    recordedAt: telem?.recordedAt,
                    hasCoordinates: hasValidCoords,
                    backendFreshness: telem?.freshness,
                    now: _tickerNow.value,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildDroneMarker(
      DroneTelemetryData? telem, double heading, GpsFreshnessState freshness) {
    final isLive = freshness == GpsFreshnessState.live;
    final isDelayed = freshness == GpsFreshnessState.delayed;
    final isStale = freshness == GpsFreshnessState.stale;

    final Color markerColor;
    if (isLive) {
      markerColor = AppColors.primaryAccent;
    } else if (isDelayed) {
      markerColor = const Color(0xFFFFB300);
    } else if (isStale) {
      markerColor = const Color(0xFFFF5252);
    } else {
      markerColor = Colors.grey[700]!;
    }

    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            if (isLive)
              Container(
                width: 48 + (12 * _pulseAnimation.value),
                height: 48 + (12 * _pulseAnimation.value),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryAccent.withValues(
                    alpha: 0.25 * (1 - _pulseAnimation.value),
                  ),
                ),
              ),
            Transform.rotate(
              angle: (heading * math.pi) / 180,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: markerColor,
                  border: Border.all(color: Colors.black, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: isLive
                          ? AppColors.primaryAccent.withValues(alpha: 0.6)
                          : isDelayed
                              ? Colors.amber.withValues(alpha: 0.5)
                              : isStale
                                  ? Colors.red.withValues(alpha: 0.5)
                                  : Colors.black38,
                      blurRadius: 8,
                    ),
                  ],
                ),
                child: Icon(
                  Icons.navigation,
                  size: 24,
                  color: isLive ? Colors.black : Colors.white,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildDraggableBottomSheet(
      HealthcareDelivery delivery, DeliveryTrackingState state) {
    return DraggableScrollableSheet(
      key: const ValueKey('deliveryTrackingSheet'),
      initialChildSize: 0.24,
      minChildSize: 0.18,
      maxChildSize: 0.50,
      snap: true,
      snapSizes: const [0.18, 0.24, 0.50],
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: const Color(0xFF131722),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: Colors.white12, width: 1.0),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.65),
                blurRadius: 16,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            physics: const ClampingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Drag Handle
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // 2. Collapsed Summary Row (Delivery Status, GPS Badge, Socket Link, Drone ID, GPS Ticker)
                _buildSheetPrimaryHeader(delivery, state),
                const SizedBox(height: 14),

                // 3. Proximity & Dynamic ETA Card (Remaining Distance, ETA, Proximity descent alert)
                _buildDistanceAndProximityCard(delivery, state),
                const SizedBox(height: 14),

                // 4. Telemetry Kinematics Row (Speed, Altitude, Heading)
                _buildTelemetryCards(delivery),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSheetPrimaryHeader(
      HealthcareDelivery delivery, DeliveryTrackingState state) {
    return ValueListenableBuilder<DateTime>(
      valueListenable: _tickerNow,
      builder: (context, now, child) {
        final telem = delivery.telemetry;
        final hasCoords = _animatedDronePos != null ||
            (telem != null &&
                telem.hasCoordinates &&
                GisUtils.isValidCoordinate(telem.latitude, telem.longitude));

        final GpsFreshnessState freshness;
        final String freshnessLabel;
        final Color freshnessColor;

        if (telem == null) {
          freshness = GpsFreshnessState.unavailable;
          freshnessLabel = 'WAITING FOR TELEMETRY';
          freshnessColor = const Color(0xFF455A64);
        } else if (!hasCoords) {
          freshness = GpsFreshnessState.unavailable;
          freshnessLabel = 'NO GPS FIX';
          freshnessColor = const Color(0xFF757575);
        } else {
          freshness = GisUtils.evaluateFreshness(
            recordedAt: telem.recordedAt,
            hasCoordinates: hasCoords,
            backendFreshness: telem.freshness,
            now: now,
          );
          freshnessLabel = freshness.displayName;
          freshnessColor = freshness.color;
        }

        final isLive = freshness == GpsFreshnessState.live;
        final String ageText;
        if (telem == null) {
          ageText = 'Awaiting telemetry';
        } else if (!hasCoords) {
          ageText = 'No GPS fix';
        } else {
          ageText = GisUtils.formatGpsAge(telem.recordedAt, now: now);
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    delivery.status.displayName.toUpperCase(),
                    style: TextStyle(
                      color: isLive ? AppColors.primaryAccent : Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 6),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Distinguish socket connectivity clearly from GPS freshness
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1B202D),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: state.socketStatus.badgeColor.withValues(alpha: 0.4),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: state.socketStatus.badgeColor,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            state.socketStatus.displayName.toUpperCase(),
                            style: TextStyle(
                              color: state.socketStatus.badgeColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Distinct, prominent GPS Freshness badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: freshnessColor,
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: freshnessColor.withValues(alpha: 0.35),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: Text(
                        freshnessLabel,
                        style: TextStyle(
                          color: freshness == GpsFreshnessState.live
                              ? Colors.black
                              : Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    'Drone: ${delivery.assignedDrone?.droneId ?? 'Pending Assignment'}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.access_time,
                      size: 13,
                      color: freshness == GpsFreshnessState.live
                          ? AppColors.primaryAccent
                          : (freshness == GpsFreshnessState.delayed
                              ? const Color(0xFFFFB300)
                              : (freshness == GpsFreshnessState.stale
                                  ? const Color(0xFFFF5252)
                                  : AppColors.textSecondary)),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      ageText,
                      key: const ValueKey('gpsAgeTickerText'),
                      style: TextStyle(
                        color: freshness == GpsFreshnessState.live
                            ? Colors.white70
                            : (freshness == GpsFreshnessState.delayed
                                ? const Color(0xFFFFB300)
                                : (freshness == GpsFreshnessState.stale
                                    ? const Color(0xFFFF5252)
                                    : AppColors.textSecondary)),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildDistanceAndProximityCard(
      HealthcareDelivery delivery, DeliveryTrackingState state) {
    return ValueListenableBuilder<DateTime>(
      valueListenable: _tickerNow,
      builder: (context, now, child) {
        final telem = delivery.telemetry;
        final hasCoords = _animatedDronePos != null ||
            (telem != null &&
                telem.hasCoordinates &&
                GisUtils.isValidCoordinate(telem.latitude, telem.longitude));
        final droneLat = _animatedDronePos?.latitude ?? telem?.latitude;
        final droneLng = _animatedDronePos?.longitude ?? telem?.longitude;

        final double? distanceMeters = hasCoords
            ? GisUtils.haversineDistanceMeters(
                droneLat,
                droneLng,
                delivery.destinationLocation.latitude,
                delivery.destinationLocation.longitude,
              )
            : null;
        final bool isProximity = GisUtils.isWithinProximity(distanceMeters);
        final String formattedDist = GisUtils.formatDistance(distanceMeters);

        final freshness = GisUtils.evaluateFreshness(
          recordedAt: telem?.recordedAt,
          hasCoordinates: hasCoords,
          backendFreshness: telem?.freshness,
          now: now,
        );

        final eta = GisUtils.calculateEta(
          delivery: delivery,
          freshness: freshness,
          distanceMeters: distanceMeters,
          speedHistory: state.recentSpeeds,
          now: now,
        );

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF181D2A),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isProximity ? AppColors.primaryAccent : Colors.white10,
              width: isProximity ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row: Icons, Titles and Status Badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.straighten,
                          color: isProximity
                              ? AppColors.primaryAccent
                              : Colors.white70,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        const Flexible(
                          child: Text(
                            'REMAINING DISTANCE',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    key: const ValueKey('etaStatusBadge'),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: isProximity
                          ? AppColors.primaryAccent.withValues(alpha: 0.2)
                          : eta.status.badgeColor.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isProximity
                            ? AppColors.primaryAccent
                            : eta.status.badgeColor,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isProximity
                              ? Icons.near_me
                              : (eta.status == EtaStatus.calculable
                                  ? Icons.schedule
                                  : (eta.status == EtaStatus.awaitingDeparture
                                      ? Icons.flight_takeoff
                                      : Icons.info_outline)),
                          size: 10,
                          color: isProximity
                              ? AppColors.primaryAccent
                              : eta.status.badgeColor,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          isProximity ? 'ARRIVING' : eta.status.displayName,
                          style: TextStyle(
                            color: isProximity
                                ? AppColors.primaryAccent
                                : eta.status.badgeColor,
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Metrics Row: Remaining Distance and Approximate ETA
              Row(
                children: [
                  // Distance column
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DISTANCE REMAINING',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 10,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          children: [
                            Text(
                              formattedDist,
                              key: const ValueKey('distanceText'),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              hasCoords ? 'to destination' : '(awaiting GPS fix)',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 40,
                    color: Colors.white12,
                  ),
                  const SizedBox(width: 14),
                  // Dynamic ETA column
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ESTIMATED ARRIVAL',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 10,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          eta.displayRemaining,
                          key: const ValueKey('etaRemainingText'),
                          style: TextStyle(
                            color: (eta.status == EtaStatus.calculable ||
                                    eta.status == EtaStatus.arrivingNow)
                                ? AppColors.primaryAccent
                                : Colors.white,
                            fontSize:
                                (eta.displayRemaining.length > 12) ? 13 : 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (eta.displayArrivalTime != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            'Approx. clock: ${eta.displayArrivalTime!}',
                            key: const ValueKey('etaArrivalClockText'),
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (isProximity) ...[
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryAccent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline,
                          size: 16, color: AppColors.primaryAccent),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Drone is within 25m of destination. Stand by for descent.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (eta.isApproximate) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.info_outline,
                      size: 13,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Approx. arrival time (${eta.displayArrivalTime ?? ''}) based on smoothed ground speed.',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ] else if (state.trail.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  '${state.trail.length} GPS breadcrumb points recorded in trail',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildTelemetryCards(HealthcareDelivery delivery) {
    final telem = delivery.telemetry;
    final speed = telem?.groundSpeed != null
        ? '${(telem!.groundSpeed! * 3.6).toStringAsFixed(1)} km/h'
        : 'N/A';
    final altitude =
        telem?.altitude != null ? '${telem!.altitude!.toStringAsFixed(1)} m' : 'N/A';
    final heading =
        telem?.heading != null ? '${telem!.heading!.toStringAsFixed(0)}°' : 'N/A';

    return Row(
      children: [
        Expanded(
          child: _buildTelemetryMetric(
            icon: Icons.speed,
            label: 'SPEED',
            value: speed,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildTelemetryMetric(
            icon: Icons.height,
            label: 'ALTITUDE',
            value: altitude,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildTelemetryMetric(
            icon: Icons.explore,
            label: 'HEADING',
            value: heading,
          ),
        ),
      ],
    );
  }

  Widget _buildTelemetryMetric({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF181D2A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.primaryAccent, size: 20),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 9,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  String _formatPackageType(String raw) {
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isNotEmpty
            ? '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}'
            : '')
        .join(' ');
  }
}

class _MapPin extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;

  const _MapPin({
    required this.icon,
    required this.color,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 4)],
          ),
          child: Icon(icon, size: 16, color: Colors.white),
        ),
      ],
    );
  }
}
