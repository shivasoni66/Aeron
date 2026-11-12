import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'screens/main_shell_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AeronCitizenApp());
}

class AeronCitizenApp extends StatelessWidget {
  const AeronCitizenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AERON Citizen Services',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const MainShellScreen(),
    );
  }
}
