import 'package:flutter/material.dart';
import 'home_screen.dart';
import '../services/auth_service.dart';

/// Minimal shell screen for AERON Dedicated Drone Tracking App.
/// Hosts the primary HomeScreen without unrelated citizen navigation tabs.
class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  @override
  void initState() {
    super.initState();
    CitizenAuthService().initialize();
  }

  @override
  Widget build(BuildContext context) {
    return const HomeScreen();
  }
}
