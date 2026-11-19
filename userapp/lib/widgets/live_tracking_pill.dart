import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/constants.dart';
import '../models/citizen_report.dart';
import '../screens/report_detail_screen.dart';
import '../theme/app_colors.dart';
import 'inspection_progress_line.dart';

/// Persistent and expandable inspection-tracking capsule for citizen services.
///
/// When an active report exists (Stage 3 or 4), displays a pulsating AERON lime indicator,
/// report ID, lifecycle stage, and on expansion the 6-stage progress line and detail navigation.
///
/// When no active inspection exists, displays a neutral non-blinking radar indicator with
/// "NO ACTIVE INSPECTION", and on expansion explains the inspection lifecycle clearly.
///
/// Error and loading states are handled separately with distinct visual indicators.
class LiveTrackingPill extends StatefulWidget {
  final CitizenReport? report;
  final DateTime? lastRefreshedAt;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback? onRefresh;
  final GlobalKey<NavigatorState>? navigatorKey;
  final bool initialExpanded;
  final bool animatePulse;

  const LiveTrackingPill({
    super.key,
    this.report,
    this.lastRefreshedAt,
    this.isLoading = false,
    this.errorMessage,
    this.onRefresh,
    this.navigatorKey,
    this.initialExpanded = false,
    this.animatePulse = true,
  });

  @override
  State<LiveTrackingPill> createState() => _LiveTrackingPillState();
}

class _LiveTrackingPillState extends State<LiveTrackingPill>
    with SingleTickerProviderStateMixin {
  late bool _isExpanded;
  AnimationController? _pulseController;
  Animation<double>? _pulseAnimation;

  bool get _hasActiveInspection => widget.report != null;
  bool get _hasError => widget.errorMessage != null && widget.report == null;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initialExpanded;

    if (widget.animatePulse) {
      _pulseController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1400),
      )..repeat(reverse: true);

      _pulseAnimation = Tween<double>(begin: 0.35, end: 1.0).animate(
        CurvedAnimation(parent: _pulseController!, curve: Curves.easeInOut),
      );
    }
  }

  @override
  void dispose() {
    _pulseController?.dispose();
    super.dispose();
  }

  void _toggleExpanded() {
    setState(() {
      _isExpanded = !_isExpanded;
    });
  }

  void _openReportDetail(CitizenReport report) {
    final nav = widget.navigatorKey?.currentState ?? Navigator.maybeOf(context);
    if (nav != null) {
      nav.push(
        MaterialPageRoute(
          builder: (_) => ReportDetailScreen(report: report),
        ),
      );
    }
  }

  String _formatRefreshTime(DateTime? timestamp) {
    if (timestamp == null) return 'PENDING SYNC';
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    if (difference.inSeconds < 45) {
      return 'JUST NOW';
    }
    return DateFormat('h:mm a').format(timestamp);
  }

  @override
  Widget build(BuildContext context) {
    return _isExpanded ? _buildExpandedCard() : _buildCollapsedPill();
  }

  // ===========================================================================
  // COLLAPSED PILL VARIANTS
  // ===========================================================================

  Widget _buildCollapsedPill() {
    if (_hasActiveInspection) {
      return _buildActiveCollapsedPill(widget.report!);
    } else if (_hasError) {
      return _buildErrorCollapsedPill();
    } else if (widget.isLoading) {
      return _buildLoadingCollapsedPill();
    } else {
      return _buildEmptyCollapsedPill();
    }
  }

  /// Collapsed pill for active Stage 3 or 4 inspection.
  Widget _buildActiveCollapsedPill(CitizenReport report) {
    final stageIndex = report.currentStage;
    final stageText = stageIndex >= 1 && stageIndex <= AppConstants.stageLabels.length
        ? AppConstants.stageLabels[stageIndex - 1]
        : report.statusLabel;

    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: _toggleExpanded,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(9999),
            border: Border.all(
              color: AppColors.primaryAccent.withValues(alpha: 0.45),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: AppColors.primaryAccent.withValues(alpha: 0.08),
                blurRadius: 10,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildPulsingDot(),
              const SizedBox(width: 8),
              const Text(
                'INSPECTION TRACKING',
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                  color: AppColors.primaryAccent,
                ),
              ),
              const SizedBox(width: 6),
              _buildSeparatorDot(AppColors.border),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  report.reportId,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHighest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  stageText,
                  style: const TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primaryAccent,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.keyboard_arrow_up,
                size: 16,
                color: AppColors.primaryAccent,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Collapsed pill when no report is currently in Stage 3 or 4.
  Widget _buildEmptyCollapsedPill() {
    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: _toggleExpanded,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(9999),
            border: Border.all(
              color: AppColors.border,
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.40),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.radar_outlined,
                size: 14,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 8),
              const Text(
                'INSPECTION TRACKING',
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 6),
              _buildSeparatorDot(AppColors.borderSubtle),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHighest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'NO ACTIVE INSPECTION',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.keyboard_arrow_up,
                size: 16,
                color: AppColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Collapsed pill when API call failed.
  Widget _buildErrorCollapsedPill() {
    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: _toggleExpanded,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(9999),
            border: Border.all(
              color: AppColors.warning.withValues(alpha: 0.5),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.40),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.sync_problem_rounded,
                size: 14,
                color: AppColors.warning,
              ),
              const SizedBox(width: 8),
              const Text(
                'INSPECTION TRACKING',
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                  color: AppColors.warning,
                ),
              ),
              const SizedBox(width: 6),
              _buildSeparatorDot(AppColors.borderSubtle),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceHighest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'SYNC FAILED',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    color: AppColors.warning,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.keyboard_arrow_up,
                size: 16,
                color: AppColors.warning,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Collapsed pill while initial sync is executing.
  Widget _buildLoadingCollapsedPill() {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: AppColors.border, width: 1.0),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: AppColors.primaryAccent,
              ),
            ),
            SizedBox(width: 8),
            Text(
              'INSPECTION TRACKING',
              style: TextStyle(
                fontFamily: 'Space Mono',
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.6,
                color: AppColors.textSecondary,
              ),
            ),
            SizedBox(width: 6),
            Text(
              '• SYNCING...',
              style: TextStyle(
                fontFamily: 'Space Mono',
                fontSize: 8,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // EXPANDED CARD VARIANTS
  // ===========================================================================

  Widget _buildExpandedCard() {
    if (_hasActiveInspection) {
      return _buildActiveExpandedCard(widget.report!);
    } else if (_hasError) {
      return _buildErrorExpandedCard();
    } else {
      return _buildEmptyExpandedCard();
    }
  }

  /// Full expanded card for an active Stage 3 or Stage 4 inspection.
  Widget _buildActiveExpandedCard(CitizenReport report) {
    final categoryLabel = AppConstants.categoryLabels[report.category] ??
        report.category.replaceAll('_', ' ');

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.primaryAccent.withValues(alpha: 0.55),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Pulsing dot, title, collapse button
            Row(
              children: [
                _buildPulsingDot(),
                const SizedBox(width: 8),
                const Text(
                  'INSPECTION TRACKING',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: AppColors.primaryAccent,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: _toggleExpanded,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighest,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      size: 16,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Report ID & Category Tag
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  report.reportId,
                  style: const TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primaryAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: AppColors.primaryAccent.withValues(alpha: 0.35),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    categoryLabel,
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
            const SizedBox(height: 6),

            // Description
            Text(
              report.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 14),

            // 6-Stage Progress Line
            InspectionProgressLine(currentStage: report.currentStage),
            const SizedBox(height: 14),

            // Footer: Last Refreshed & Action Button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'LAST SYNC',
                      style: TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 8,
                        letterSpacing: 0.6,
                        color: AppColors.textMuted,
                      ),
                    ),
                    Text(
                      _formatRefreshTime(widget.lastRefreshedAt),
                      style: const TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () => _openReportDetail(report),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryAccent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.background),
                        SizedBox(width: 6),
                        Text(
                          'VIEW REPORT DETAILS',
                          style: TextStyle(
                            fontFamily: 'Space Mono',
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppColors.background,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Expanded card when no active inspection exists.
  Widget _buildEmptyExpandedCard() {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.border,
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Neutral icon, title, collapse button
            Row(
              children: [
                const Icon(
                  Icons.radar_outlined,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 8),
                const Text(
                  'INSPECTION TRACKING',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: AppColors.textSecondary,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: _toggleExpanded,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighest,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      size: 16,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surfaceHighest,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: const Text(
                'NO ACTIVE INSPECTION IN PROGRESS',
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Explanation
            const Text(
              'None of your submitted civic reports are currently in Stage 3 (Inspection Scheduled) or Stage 4 (Aerial Verified).',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'When municipal authorities schedule an aerial drone inspection for one of your submitted reports, live progress will be tracked here automatically.',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 14),

            // Footer: Last sync & Refresh action
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'LAST SYNC',
                      style: TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 8,
                        letterSpacing: 0.6,
                        color: AppColors.textMuted,
                      ),
                    ),
                    Text(
                      _formatRefreshTime(widget.lastRefreshedAt),
                      style: const TextStyle(
                        fontFamily: 'Space Mono',
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                if (widget.onRefresh != null)
                  GestureDetector(
                    onTap: widget.onRefresh,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHighest,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.refresh_rounded, size: 12, color: AppColors.textSecondary),
                          SizedBox(width: 4),
                          Text(
                            'REFRESH STATUS',
                            style: TextStyle(
                              fontFamily: 'Space Mono',
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Expanded card when API sync fails.
  Widget _buildErrorExpandedCard() {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.warning.withValues(alpha: 0.5),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Warning icon, title, collapse button
            Row(
              children: [
                const Icon(
                  Icons.sync_problem_rounded,
                  size: 16,
                  color: AppColors.warning,
                ),
                const SizedBox(width: 8),
                const Text(
                  'INSPECTION TRACKING',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: AppColors.warning,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: _toggleExpanded,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighest,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      size: 16,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surfaceHighest,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
              ),
              child: const Text(
                'UNABLE TO RETRIEVE INSPECTION STATUS',
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  color: AppColors.warning,
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Error details
            Text(
              widget.errorMessage ?? 'An unexpected network error occurred while syncing reports.',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),

            // Footer: Retry action
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'NETWORK STATUS: OFFLINE',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 8,
                    letterSpacing: 0.6,
                    color: AppColors.textMuted,
                  ),
                ),
                if (widget.onRefresh != null)
                  GestureDetector(
                    onTap: widget.onRefresh,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.refresh_rounded, size: 12, color: AppColors.warning),
                          SizedBox(width: 4),
                          Text(
                            'RETRY SYNC',
                            style: TextStyle(
                              fontFamily: 'Space Mono',
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: AppColors.warning,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  Widget _buildPulsingDot() {
    if (_pulseAnimation != null) {
      return AnimatedBuilder(
        animation: _pulseAnimation!,
        builder: (context, child) {
          final alpha = _pulseAnimation!.value;
          return Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: AppColors.primaryAccent,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.primaryAccent.withValues(alpha: alpha * 0.7),
                  blurRadius: 6,
                  spreadRadius: 1.5,
                ),
              ],
            ),
          );
        },
      );
    }

    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: AppColors.primaryAccent,
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _buildSeparatorDot(Color color) {
    return Container(
      width: 3,
      height: 3,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}
