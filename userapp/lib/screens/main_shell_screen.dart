import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'explore_screen.dart';
import 'my_reports_screen.dart';
import 'profile_screen.dart';
import '../widgets/floating_bottom_dock.dart';
import '../widgets/create_report_bottom_sheet.dart';
import '../services/auth_service.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    CitizenAuthService().initialize();
  }

  void _onTabSelected(int index) {
    if (index != 2) {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  void _onReportPressed() {
    CreateReportBottomSheet.show(context);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(
        onExploreTap: () => _onTabSelected(1),
        onReportsTap: () => _onTabSelected(3),
        onProfileTap: () => _onTabSelected(4),
      ),
      const ExploreScreen(),
      const SizedBox.shrink(), // Center CTA placeholder
      const MyReportsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: screens,
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: FloatingBottomDock(
              currentIndex: _currentIndex,
              onTabSelected: _onTabSelected,
              onReportPressed: _onReportPressed,
            ),
          ),
        ],
      ),
    );
  }
}
