import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/main.dart';
import 'package:userapp/models/citizen_report.dart';
import 'package:userapp/models/mission_outcome.dart';
import 'package:userapp/models/notification_item.dart';
import 'package:userapp/models/achievement_badge.dart';
import 'package:userapp/models/auth_user.dart';
import 'package:userapp/services/location_service.dart';
import 'package:userapp/services/auth_service.dart';
import 'package:userapp/services/citizen_api_service.dart';
import 'package:userapp/services/delivery_tracking_service.dart';
import 'package:userapp/services/secure_storage_service.dart';
import 'package:userapp/screens/delivery_tracking_screen.dart';
import 'package:userapp/screens/explore_screen.dart';
import 'package:userapp/screens/home_screen.dart';
import 'package:userapp/screens/my_reports_screen.dart';
import 'package:userapp/screens/profile_screen.dart';
import 'package:userapp/screens/auth/login_screen.dart';
import 'package:userapp/screens/auth/register_screen.dart';

// Test Fakes
class _FakeAuthService extends ChangeNotifier implements CitizenAuthService {
  bool authenticated;
  _FakeAuthService({this.authenticated = true});

  @override
  bool get isAuthenticated => authenticated;

  @override
  CitizenAuthUser? get currentUser => authenticated
      ? const CitizenAuthUser(
          id: 'cit-01',
          name: 'Demo Citizen',
          email: 'citizen.demo@aeron.gov',
          role: 'citizen',
          accountStatus: 'active',
        )
      : null;

  @override
  bool get isLoading => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeStorageService implements SecureStorageService {
  String? token = 'mock-jwt-token';
  _FakeStorageService();

  @override
  Future<String?> getAccessToken() async => token;

  @override
  Future<String?> getRefreshToken() async => 'mock-refresh-token';

  @override
  Future<void> saveTokens({required String accessToken, String? refreshToken}) async {
    token = accessToken;
  }

  @override
  Future<void> clearAll() async {
    token = null;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeCitizenApiService implements CitizenApiService {
  Map<String, dynamic>? activeDeliveryResponse;

  _FakeCitizenApiService({this.activeDeliveryResponse});

  @override
  Future<Map<String, dynamic>?> getActiveDelivery() async => activeDeliveryResponse;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Map<String, dynamic> _buildSampleDeliveryJson({
  String deliveryId = 'DEL-6P1SNZ',
  String status = 'ASSIGNED',
  String packageType = 'ANTIVENOM',
  double droneLat = 12.9716,
  double droneLng = 77.5946,
}) {
  return {
    '_id': 'mongo-del-001',
    'deliveryId': deliveryId,
    'status': status,
    'packageType': packageType,
    'pickupLocation': {
      'name': 'AERON Central Medical Depot',
      'address': 'Bangalore City Hub',
      'latitude': 12.9716,
      'longitude': 77.5946,
    },
    'destinationLocation': {
      'name': 'Bhopal Health Center, Sector 4',
      'address': 'Bhopal Hospital',
      'latitude': 23.2650,
      'longitude': 77.4200,
    },
    'assignedDrone': {
      '_id': 'drone-mongo-001',
      'droneId': 'DRONE-SIM-01',
      'status': 'ASSIGNED',
    },
    'telemetry': {
      'latitude': droneLat,
      'longitude': droneLng,
      'altitude': 15.0,
      'groundSpeed': 0.0,
      'heading': 90.0,
      'recordedAt': DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
      'freshness': 'stale',
      'isLivePosition': false,
    },
  };
}

void main() {
  group('AERON Citizen Services — Mobile App Widget & Unit Test Suite', () {
    testWidgets('App launch and initial home screen rendering', (WidgetTester tester) async {
      await tester.pumpWidget(const AeronCitizenApp());
      await tester.pump();

      expect(find.text('AERON'), findsOneWidget);
      expect(find.text('Track Your Drone'), findsOneWidget);
      expect(find.text('Your delivery. Your drone. Live tracking.'), findsOneWidget);
      expect(find.text('TRACK YOUR DRONE'), findsOneWidget);
    });

    testWidgets('Unauthenticated citizen tapping CTA is redirected to LoginScreen', (WidgetTester tester) async {
      await tester.pumpWidget(const AeronCitizenApp());
      await tester.pump();

      final cta = find.byKey(const ValueKey('trackYourDroneCta'));
      expect(cta, findsOneWidget);
      await tester.tap(cta);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // Expect login screen transition
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('Authenticated citizen with active delivery renders delivery card and navigates to tracking screen', (WidgetTester tester) async {
      final fakeAuth = _FakeAuthService(authenticated: true);
      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(activeDeliveryResponse: _buildSampleDeliveryJson());

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            authService: fakeAuth,
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Active delivery preview card
      expect(find.text('DEL-6P1SNZ'), findsOneWidget);
      expect(find.text('DRONE ASSIGNED'), findsOneWidget);
      expect(find.text('Antivenom'), findsOneWidget);
      expect(find.text('Drone: DRONE-SIM-01'), findsOneWidget);

      // Tap CTA
      final cta = find.byKey(const ValueKey('trackYourDroneCta'));
      await tester.tap(cta);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // Pushed to DeliveryTrackingScreen
      expect(find.byType(DeliveryTrackingScreen), findsOneWidget);
      expect(find.text('DEL-6P1SNZ'), findsWidgets);
    });

    testWidgets('Authenticated citizen with no active delivery shows No drone assigned yet notice', (WidgetTester tester) async {
      final fakeAuth = _FakeAuthService(authenticated: true);
      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(activeDeliveryResponse: null);

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            authService: fakeAuth,
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Initially no notice card
      expect(find.byKey(const ValueKey('noDroneAssignedFeedback')), findsNothing);

      // Tap CTA
      final cta = find.byKey(const ValueKey('trackYourDroneCta'));
      await tester.tap(cta);
      await tester.pump();

      // Notice card and text appears
      expect(find.byKey(const ValueKey('noDroneAssignedFeedback')), findsOneWidget);
      expect(find.text('No drone assigned yet'), findsOneWidget);
      expect(find.textContaining('There is currently no healthcare drone assigned'), findsOneWidget);
    });

    testWidgets('Moto G34 360dp width layout overflow verification', (WidgetTester tester) async {
      // Set logical resolution to 360 x 800 dp (Moto G34)
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(activeDeliveryResponse: _buildSampleDeliveryJson());
      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      await tester.pumpWidget(
        MaterialApp(
          home: DeliveryTrackingScreen(
            deliveryId: 'DEL-6P1SNZ',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Verify no RenderFlex exception was thrown on 360dp screen
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('distanceText')), findsOneWidget);
      expect(find.textContaining('to destination'), findsOneWidget);
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

      expect(find.text('CITIZEN SERVICES • SECURE ACCESS'), findsOneWidget);

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

      expect(find.text('CITIZEN SERVICES • PUBLIC REGISTRATION'), findsOneWidget);

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
