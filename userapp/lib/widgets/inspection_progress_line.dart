import 'package:flutter/material.dart';
import '../core/constants.dart';
import '../theme/app_colors.dart';

/// A 6-stage horizontal progress line representing the AERON civic inspection lifecycle.
///
/// Uses canonical [AppConstants.stageLabels] and highlights completed, active, and pending stages.
class InspectionProgressLine extends StatelessWidget {
  final int currentStage;

  const InspectionProgressLine({
    super.key,
    required this.currentStage,
  });

  @override
  Widget build(BuildContext context) {
    final stages = AppConstants.stageLabels;
    final int clampedStage = currentStage.clamp(1, stages.length);
    final String activeLabel = stages[clampedStage - 1];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Stage title badge
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'LIFECYCLE STAGE $clampedStage OF ${stages.length}',
              style: const TextStyle(
                fontFamily: 'Space Mono',
                fontSize: 9,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                color: AppColors.primaryAccent,
              ),
            ),
            Text(
              activeLabel,
              style: const TextStyle(
                fontFamily: 'Space Mono',
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Horizontal step progress nodes with connectors
        Row(
          children: List.generate(stages.length * 2 - 1, (index) {
            if (index.isOdd) {
              // Connector line between nodes
              final stepIndex = (index ~/ 2) + 1;
              final isPassed = stepIndex < clampedStage;

              return Expanded(
                child: Container(
                  height: 2,
                  color: isPassed
                      ? AppColors.primaryAccent
                      : AppColors.borderSubtle,
                ),
              );
            } else {
              // Node circle
              final step = (index ~/ 2) + 1;
              final isCompleted = step < clampedStage;
              final isActive = step == clampedStage;

              return _buildNode(step: step, isCompleted: isCompleted, isActive: isActive);
            }
          }),
        ),
        const SizedBox(height: 6),

        // Numbered milestone indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(stages.length, (index) {
            final step = index + 1;
            final isHighlight = step <= clampedStage;

            return SizedBox(
              width: 18,
              child: Text(
                '0$step',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Space Mono',
                  fontSize: 8,
                  fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal,
                  color: isHighlight
                      ? AppColors.primaryAccent
                      : AppColors.textMuted,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildNode({
    required int step,
    required bool isCompleted,
    required bool isActive,
  }) {
    if (isCompleted) {
      return Container(
        width: 18,
        height: 18,
        decoration: const BoxDecoration(
          color: AppColors.primaryAccent,
          shape: BoxShape.circle,
        ),
        child: const Center(
          child: Icon(
            Icons.check,
            size: 11,
            color: AppColors.background,
          ),
        ),
      );
    } else if (isActive) {
      return Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: AppColors.primaryAccent.withValues(alpha: 0.25),
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.primaryAccent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryAccent.withValues(alpha: 0.45),
              blurRadius: 6,
              spreadRadius: 1,
            ),
          ],
        ),
        child: Center(
          child: Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: AppColors.primaryAccent,
              shape: BoxShape.circle,
            ),
          ),
        ),
      );
    } else {
      return Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: AppColors.surfaceHighest,
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.borderSubtle,
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            '$step',
            style: const TextStyle(
              fontFamily: 'Space Mono',
              fontSize: 8,
              color: AppColors.textMuted,
            ),
          ),
        ),
      );
    }
  }
}
