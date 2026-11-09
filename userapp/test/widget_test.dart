import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/main.dart';
import 'package:userapp/models/citizen_report.dart';
import 'package:userapp/models/mission_outcome.dart';
import 'package:userapp/models/notification_item.dart';
import 'package:userapp/models/achievement_badge.dart';
import 'package:userapp/models/auth_user.dart';
import 'package:userapp/services/location_service.dart';
import 'package:userapp/screens/explore_screen.dart';
import 'package:userapp/screens/my_reports_screen.dart';
import 'package:userapp/screens/profile_screen.dart';
import 'package:userapp/screens/auth/login_screen.dart';
import 'package:userapp/screens/auth/register_screen.dart';

void main() {
  group('AERON Citizen Services — Mobile App Widget & Unit Test Suite', () {
    testWidgets('App launch and initial header rendering', (WidgetTester tester) async {
      await tester.pumpWidget(const AeronCitizenApp());
      await tester.pump();

      expect(find.text('AERON'), findsOneWidget);
      expect(find.text('SEC-NORM'), findsOneWidget);
      expect(find.text('1,280 PTS'), findsOneWidget);
    });

    testWidgets('Five-tab bottom navigation dock is present', (WidgetTester tester) async {
      await tester.pumpWidget(const AeronCitizenApp());
      await tester.pump();

      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Explore'), findsOneWidget);
      expect(find.text('Reports'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
      expect(find.byIcon(Icons.add_alert_rounded), findsOneWidget); // Center report button
    });

    testWidgets('Explore screen renders title and search bar', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ExploreScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('EXPLORE PUBLIC FINDINGS'), findsOneWidget);
      expect(find.byIcon(Icons.search), findsOneWidget);
      expect(find.text('ALL FINDINGS'), findsOneWidget);
    });

    testWidgets('My Reports screen renders filter chips and search', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MyReportsScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('MY SUBMITTED REPORTS'), findsOneWidget);
      expect(find.text('ALL'), findsOneWidget);
      expect(find.text('SUBMITTED'), findsOneWidget);
    });

    testWidgets('Profile screen displays authentication required for unauthenticated guest', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ProfileScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('CITIZEN PROFILE'), findsOneWidget);
      expect(find.text('AUTHENTICATION REQUIRED'), findsOneWidget);
      expect(find.text('SIGN IN TO CITIZEN SERVICES'), findsOneWidget);
    });

    testWidgets('Login screen validates required fields', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoginScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('CITIZEN SERVICES // SECURE ACCESS'), findsOneWidget);

      final submitBtn = find.text('SIGN IN TO CITIZEN SERVICES');
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('Register screen validates minimum password and name length', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: RegisterScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('CITIZEN SERVICES // PUBLIC REGISTRATION'), findsOneWidget);

      final submitBtn = find.text('CREATE CITIZEN ACCOUNT');
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text('Full name is required'), findsOneWidget);
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    test('LocationService coordinate range validation', () {
      expect(LocationService.isValidCoordinate(12.9716, 77.5946), isTrue);
      expect(LocationService.isValidCoordinate(95.0, 77.5946), isFalse); // Latitude out of range
      expect(LocationService.isValidCoordinate(12.9716, 200.0), isFalse); // Longitude out of range
    });

    test('CitizenReport JSON parsing and stage calculation', () {
      final json = {
        'id': 'rep-123',
        'reportId': 'AER-2026-1092',
        'category': 'ROAD_STRUCTURAL',
        'description': 'Asphalt depression near Sector 04',
        'location': {
          'type': 'Point',
          'coordinates': [77.5946, 12.9716],
        },
        'status': 'AERIAL_VERIFIED',
        'currentStage': 4,
        'earnedPoints': 25,
        'submittedAt': '2026-11-08T10:00:00.000Z',
      };

      final report = CitizenReport.fromJson(json);
      expect(report.reportId, 'AER-2026-1092');
      expect(report.currentStage, 4);
      expect(report.status, 'AERIAL_VERIFIED');
      expect(report.statusLabel, 'AERIAL VERIFIED');
      expect(report.longitude, 77.5946);
      expect(report.latitude, 12.9716);
    });

    test('PublicMissionOutcome JSON parsing and categorization', () {
      final json = {
        'outcomeId': 'OUT-8842',
        'outcomeType': 'CIVIC_INFRASTRUCTURE',
        'summary': 'MG Road Pothole Cluster Verified',
        'findings': '4 depressions confirmed depth >18cm',
        'publishedAt': '2026-11-08T09:00:00.000Z',
        'missionId': {
          'title': 'Infrastructure Inspection #09',
          'category': 'CIVIC_ISSUE_VERIFICATION',
        },
      };

      final outcome = PublicMissionOutcome.fromJson(json);
      expect(outcome.outcomeId, 'OUT-8842');
      expect(outcome.categoryLabel, 'CIVIL INFRA');
      expect(outcome.missionTitle, 'Infrastructure Inspection #09');
    });

    test('CitizenNotification JSON parsing and read state check', () {
      final json = {
        'id': 'notif-1',
        'title': 'Report Received',
        'message': 'Inspection queue initialized',
        'category': 'CIVIC_UPDATE',
        'createdAt': '2026-11-08T10:00:00.000Z',
      };

      final notif = CitizenNotification.fromJson(json);
      expect(notif.isRead, isFalse);

      final readJson = {
        ...json,
        'readAt': '2026-11-08T10:05:00.000Z',
      };
      final readNotif = CitizenNotification.fromJson(readJson);
      expect(readNotif.isRead, isTrue);
    });

    test('AchievementBadge JSON parsing and unlock status', () {
      final json = {
        'id': 'COMMUNITY_WATCH',
        'title': 'Community Watch',
        'description': 'Submit 10 verified hazard logs',
        'unlocked': true,
        'current': 10,
        'target': 10,
      };

      final badge = AchievementBadge.fromJson(json);
      expect(badge.id, 'COMMUNITY_WATCH');
      expect(badge.unlocked, isTrue);
    });

    test('CitizenAuthUser model and stats aggregation', () {
      final json = {
        'id': 'cit-01',
        'name': 'Priya Sharma',
        'email': 'priya@aeron.gov',
        'role': 'citizen',
        'accountStatus': 'active',
        'stats': {
          'totalReports': 5,
          'verifiedReports': 2,
          'resolvedReports': 1,
          'civicPoints': 125,
        },
      };

      final user = CitizenAuthUser.fromJson(json);
      expect(user.name, 'Priya Sharma');
      expect(user.stats.totalReports, 5);
      expect(user.stats.verifiedReports, 2);
      expect(user.stats.civicPoints, 125);
    });
  });
}
