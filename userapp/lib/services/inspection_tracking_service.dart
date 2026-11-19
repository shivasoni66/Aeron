import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/citizen_report.dart';
import '../models/inspection_tracking_state.dart';
import 'auth_service.dart';
import 'citizen_api_service.dart';

/// Service responsible for polling and managing the citizen's active inspection lifecycle.
///
/// Polls the Citizen API every 30 seconds (configurable) to check for reports currently in
/// Stage 3 (INSPECTION_SCHEDULED) or Stage 4 (AERIAL_VERIFIED).
class InspectionTrackingService extends ChangeNotifier {
  static InspectionTrackingService? _sharedInstance;
  static InspectionTrackingService get instance =>
      _sharedInstance ??= InspectionTrackingService();

  static set instance(InspectionTrackingService service) {
    _sharedInstance = service;
  }

  static void resetSharedInstance() {
    _sharedInstance?.dispose();
    _sharedInstance = null;
  }

  final CitizenApiService _apiService;
  final CitizenAuthService _authService;
  final Duration pollInterval;
  final Future<List<CitizenReport>> Function()? customReportsFetcher;
  final bool Function()? customAuthCheck;

  Timer? _pollTimer;
  bool _isFetching = false;
  bool _isDisposed = false;

  InspectionTrackingState _state = const InspectionTrackingState();

  InspectionTrackingService({
    CitizenApiService? apiService,
    CitizenAuthService? authService,
    this.pollInterval = const Duration(seconds: 30),
    this.customReportsFetcher,
    this.customAuthCheck,
  })  : _apiService = apiService ?? CitizenApiService(),
        _authService = authService ?? CitizenAuthService();

  /// Current inspection tracking state.
  InspectionTrackingState get state => _state;

  /// Helper to force state updates in widget and unit tests.
  @visibleForTesting
  void updateStateForTesting(InspectionTrackingState newState) {
    _updateState(newState);
  }

  /// Whether polling timer is currently active.
  bool get isTracking => _pollTimer?.isActive ?? false;

  /// Whether an API request is currently in progress.
  bool get isFetching => _isFetching;

  /// Starts periodic tracking. Immediately triggers a fetch, then polls on the given interval.
  void start({Duration? interval}) {
    if (_isDisposed) return;
    stop();

    final activeInterval = interval ?? pollInterval;
    _pollTimer = Timer.periodic(activeInterval, (_) => refreshNow());
    refreshNow();
  }

  /// Stops the background polling timer.
  void stop() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  /// Fetches reports and updates the active inspection state.
  /// Prevents overlapping API calls and handles unauthenticated state gracefully.
  Future<void> refreshNow() async {
    if (_isDisposed || _isFetching) return;

    _isFetching = true;

    final authCheck = customAuthCheck;
    final isAuthenticated = authCheck != null
        ? authCheck()
        : _authService.isAuthenticated;

    if (!isAuthenticated) {
      _isFetching = false;
      _updateState(_state.copyWith(
        clearActiveReport: true,
        isLoading: false,
        clearErrorMessage: true,
      ));
      return;
    }

    _updateState(_state.copyWith(
      isLoading: true,
      clearErrorMessage: true,
    ));

    try {
      final List<CitizenReport> reports;
      final reportsFetcher = customReportsFetcher;
      if (reportsFetcher != null) {
        reports = await reportsFetcher();
      } else {
        final response = await _apiService.getMyReports(limit: 20);
        final rawReports = response['reports'] as List<dynamic>? ?? [];
        reports = rawReports.cast<CitizenReport>();
      }

      final activeReport = selectActiveInspectionReport(reports);

      _updateState(_state.copyWith(
        activeReport: activeReport,
        clearActiveReport: activeReport == null,
        isLoading: false,
        clearErrorMessage: true,
        lastRefreshedAt: DateTime.now(),
      ));
    } catch (e) {
      _updateState(_state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      ));
    } finally {
      _isFetching = false;
    }
  }

  /// Selects the most recent report at Stage 3 or Stage 4.
  ///
  /// Eligible criteria:
  /// - Stage 3: `INSPECTION_SCHEDULED` or `currentStage == 3`
  /// - Stage 4: `AERIAL_VERIFIED` or `currentStage == 4`
  ///
  /// Recency is determined by `reviewedAt` if present, falling back to `submittedAt`.
  static CitizenReport? selectActiveInspectionReport(List<CitizenReport> reports) {
    final eligible = reports.where(_isEligibleStage).toList();
    if (eligible.isEmpty) return null;

    eligible.sort(_compareReportsByRecency);
    return eligible.first;
  }

  static bool _isEligibleStage(CitizenReport report) {
    final isStage3 = report.currentStage == 3 || report.status == 'INSPECTION_SCHEDULED';
    final isStage4 = report.currentStage == 4 || report.status == 'AERIAL_VERIFIED';
    return isStage3 || isStage4;
  }

  static int _compareReportsByRecency(CitizenReport a, CitizenReport b) {
    final dateA = a.reviewedAt ?? a.submittedAt;
    final dateB = b.reviewedAt ?? b.submittedAt;
    final comparison = dateB.compareTo(dateA);
    if (comparison != 0) return comparison;
    return b.submittedAt.compareTo(a.submittedAt);
  }

  void _updateState(InspectionTrackingState newState) {
    if (_isDisposed) return;
    _state = newState;
    notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _pollTimer?.cancel();
    _pollTimer = null;
    super.dispose();
  }
}
