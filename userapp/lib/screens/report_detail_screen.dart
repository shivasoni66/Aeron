import 'package:flutter/material.dart';
import '../../models/citizen_report.dart';
import '../../core/constants.dart';
import '../../theme/app_colors.dart';

class ReportDetailScreen extends StatelessWidget {
  final CitizenReport report;

  const ReportDetailScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    final stages = AppConstants.stageLabels;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: Text(
          report.reportId,
          style: const TextStyle(
            fontFamily: 'Space Mono',
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status & Category Badge Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.surfaceHighest),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primaryAccent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Text(
                          report.category.replaceAll('_', ' '),
                          style: const TextStyle(
                            fontFamily: 'Space Mono',
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryAccent,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceHigh,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Text(
                          report.statusLabel,
                          style: const TextStyle(
                            fontFamily: 'Space Mono',
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    report.description,
                    style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        report.locationTag,
                        style: const TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 6-Stage Timeline
            const Text(
              '6-STAGE MUNICIPAL PROGRESSION',
              style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.surfaceHighest),
              ),
              child: Column(
                children: List.generate(stages.length, (index) {
                  final stageNum = index + 1;
                  final isCompleted = stageNum < report.currentStage;
                  final isCurrent = stageNum == report.currentStage;
                  final isLast = index == stages.length - 1;

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isCompleted || isCurrent ? AppColors.primaryAccent : AppColors.surfaceHigh,
                              border: Border.all(
                                color: isCompleted || isCurrent ? AppColors.primaryAccent : AppColors.surfaceHighest,
                              ),
                            ),
                            child: Center(
                              child: isCompleted
                                  ? const Icon(Icons.check, size: 14, color: AppColors.onPrimaryAccent)
                                  : Text(
                                      '$stageNum',
                                      style: TextStyle(
                                        fontFamily: 'Space Mono',
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: isCurrent ? AppColors.onPrimaryAccent : AppColors.textMuted,
                                      ),
                                    ),
                            ),
                          ),
                          if (!isLast)
                            Container(
                              width: 2,
                              height: 32,
                              color: isCompleted ? AppColors.primaryAccent : AppColors.surfaceHighest,
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2, bottom: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                stages[index],
                                style: TextStyle(
                                  fontFamily: 'Space Mono',
                                  fontSize: 11,
                                  fontWeight: isCurrent || isCompleted ? FontWeight.bold : FontWeight.normal,
                                  color: isCurrent
                                      ? AppColors.primaryAccent
                                      : (isCompleted ? AppColors.textPrimary : AppColors.textMuted),
                                ),
                              ),
                              if (isCurrent)
                                const Padding(
                                  padding: EdgeInsets.only(top: 2),
                                  child: Text(
                                    'Active Stage • In progress by Municipal Aerial Unit',
                                    style: TextStyle(fontSize: 10, color: AppColors.primaryAccent),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ),
            ),
            const SizedBox(height: 20),

            // Verified Civic Points Note
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.military_tech, color: AppColors.primaryAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${report.earnedPoints} Civic Points earned upon public works resolution and verification closeout.',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

