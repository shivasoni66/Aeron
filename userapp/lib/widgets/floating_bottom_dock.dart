import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class FloatingBottomDock extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final VoidCallback onReportPressed;

  const FloatingBottomDock({
    super.key,
    required this.currentIndex,
    required this.onTabSelected,
    required this.onReportPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      height: 64,
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(
          color: AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.55),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildDockItem(index: 0, icon: Icons.home_filled, label: 'Home'),
            _buildDockItem(index: 1, icon: Icons.explore_outlined, label: 'Explore'),
            _buildCenterReportButton(),
            _buildDockItem(index: 3, icon: Icons.assignment_outlined, label: 'Reports'),
            _buildDockItem(index: 4, icon: Icons.person_outline, label: 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _buildDockItem({
    required int index,
    required IconData icon,
    required String label,
  }) {
    final isSelected = currentIndex == index;

    return GestureDetector(
      onTap: () => onTabSelected(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryAccent.withValues(alpha: 0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(26),
          border: isSelected
              ? Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.35), width: 1)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? AppColors.primaryAccent : AppColors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.primaryAccent : AppColors.textMuted,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterReportButton() {
    return GestureDetector(
      onTap: onReportPressed,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.primaryAccent,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryAccent.withValues(alpha: 0.4),
              blurRadius: 14,
              spreadRadius: 1,
            ),
          ],
        ),
        child: const Icon(
          Icons.add_alert_rounded,
          size: 26,
          color: AppColors.onPrimaryAccent,
        ),
      ),
    );
  }
}
