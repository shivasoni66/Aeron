import '../core/constants.dart';
import 'citizen_report.dart';

/// State representation for citizen inspection lifecycle tracking.
/// Tracks real reports currently undergoing municipal scheduling or aerial inspection.
class InspectionTrackingState {
  final CitizenReport? activeReport;
  final bool isLoading;
  final String? errorMessage;
  final DateTime? lastRefreshedAt;

  const InspectionTrackingState({
    this.activeReport,
    this.isLoading = false,
    this.errorMessage,
    this.lastRefreshedAt,
  });

  /// Whether an active inspection (Stage 3 or 4) is currently being tracked.
  bool get hasActiveInspection => activeReport != null;

  /// Current stage number of the active report (1-6, or 0 if none).
  int get currentStage => activeReport?.currentStage ?? 0;

  /// Human-readable label for the current tracking stage.
  String get stageLabel {
    if (activeReport == null) return 'NO ACTIVE INSPECTION';
    final stage = currentStage;
    if (stage >= 1 && stage <= AppConstants.stageLabels.length) {
      return AppConstants.stageLabels[stage - 1];
    }
    return activeReport!.statusLabel;
  }

  /// Creates a copy of this state with the given fields replaced.
  InspectionTrackingState copyWith({
    CitizenReport? activeReport,
    bool clearActiveReport = false,
    bool? isLoading,
    String? errorMessage,
    bool clearErrorMessage = false,
    DateTime? lastRefreshedAt,
    bool clearLastRefreshedAt = false,
  }) {
    return InspectionTrackingState(
      activeReport: clearActiveReport ? null : (activeReport ?? this.activeReport),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      lastRefreshedAt: clearLastRefreshedAt ? null : (lastRefreshedAt ?? this.lastRefreshedAt),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InspectionTrackingState &&
          runtimeType == other.runtimeType &&
          activeReport?.id == other.activeReport?.id &&
          activeReport?.currentStage == other.activeReport?.currentStage &&
          isLoading == other.isLoading &&
          errorMessage == other.errorMessage &&
          lastRefreshedAt == other.lastRefreshedAt;

  @override
  int get hashCode => Object.hash(
        activeReport?.id,
        activeReport?.currentStage,
        isLoading,
        errorMessage,
        lastRefreshedAt,
      );

  @override
  String toString() {
    return 'InspectionTrackingState('
        'activeReport: ${activeReport?.reportId}, '
        'stage: $currentStage, '
        'isLoading: $isLoading, '
        'errorMessage: $errorMessage, '
        'lastRefreshedAt: $lastRefreshedAt)';
  }
}
