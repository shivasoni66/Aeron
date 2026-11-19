import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/models/auth_user.dart';
import 'package:userapp/screens/delivery_tracking_screen.dart';
import 'package:userapp/screens/home_screen.dart';
import 'package:userapp/services/auth_service.dart';
import 'package:userapp/services/citizen_api_service.dart';
import 'package:userapp/services/delivery_tracking_service.dart';
import 'package:userapp/services/secure_storage_service.dart';

Future<void> _loadFontsForTesting() async {
  final fontMap = {
    'Roboto': [
      r'C:\flutter_windows_3.35.7-stable\flutter\bin\cache\artifacts\material_fonts\roboto-regular.ttf',
      r'C:\flutter_windows_3.35.7-stable\flutter\bin\cache\artifacts\material_fonts\roboto-bold.ttf',
      r'C:\flutter_windows_3.35.7-stable\flutter\bin\cache\artifacts\material_fonts\roboto-medium.ttf',
    ],
    'MaterialIcons': [
      r'C:\flutter_windows_3.35.7-stable\flutter\bin\cache\artifacts\material_fonts\materialicons-regular.otf',
    ],
  };

  for (final entry in fontMap.entries) {
    final loader = FontLoader(entry.key);
    for (final path in entry.value) {
      final f = File(path);
      if (f.existsSync()) {
        loader.addFont(Future.value(ByteData.view(f.readAsBytesSync().buffer)));
      }
    }
    await loader.load();
  }
}

// Test Fakes
class _FakeAuthService extends ChangeNotifier implements CitizenAuthService {
  @override
  bool get isAuthenticated => true;

  @override
  CitizenAuthUser? get currentUser => const CitizenAuthUser(
        id: 'cit-01',
        name: 'Demo Citizen',
        email: 'citizen.demo@aeron.gov',
        role: 'citizen',
        accountStatus: 'active',
      );

  @override
  bool get isLoading => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeStorageService implements SecureStorageService {
  @override
  Future<String?> getAccessToken() async => 'mock-jwt-token';

  @override
  Future<String?> getRefreshToken() async => 'mock-refresh-token';

  @override
  Future<void> saveTokens({required String accessToken, String? refreshToken}) async {}

  @override
  Future<void> clearAll() async {}

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

Map<String, dynamic> _buildActiveDeliveryJson({
  String deliveryId = 'DEL-6P1SNZ',
  String status = 'ASSIGNED',
  String packageType = 'ANTIVENOM',
  String freshness = 'stale',
  bool isLivePosition = false,
  double speed = 0.0,
  double altitude = 15.0,
  double heading = 90.0,
  int ageMinutes = 5,
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
      'latitude': 12.9716,
      'longitude': 77.5946,
      'altitude': altitude,
      'groundSpeed': speed,
      'heading': heading,
      'recordedAt': DateTime.now().subtract(Duration(minutes: ageMinutes)).toIso8601String(),
      'freshness': freshness,
      'isLivePosition': isLivePosition,
    },
  };
}

const String _artifactsDir =
    r'C:\Users\bunde\.gemini\antigravity\brain\332e7796-3623-45f0-8f1d-2d2f3556364a';

Future<void> _captureRepaintBoundary({
  required WidgetTester tester,
  required GlobalKey key,
  required String fileName,
}) async {
  await tester.runAsync(() async {
    final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2.0);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final bytes = byteData!.buffer.asUint8List();
    final file = File('$_artifactsDir\\$fileName');
    file.writeAsBytesSync(bytes);
    debugPrint('Captured: ${file.path} (${bytes.length} bytes)');
    image.dispose();
  });
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadFontsForTesting();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (MethodCall methodCall) async {
        return '.';
      },
    );
  });

  group('AERON Phase 5.14A Visual UI Verification Suite', () {
    testWidgets('1. Home Screen — Active Delivery', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeAuth = _FakeAuthService();
      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(
        activeDeliveryResponse: _buildActiveDeliveryJson(),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final boundaryKey = GlobalKey();

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'Roboto'),
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: boundaryKey,
            child: HomeScreen(
              authService: fakeAuth,
              trackingService: service,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      await _captureRepaintBoundary(
        tester: tester,
        key: boundaryKey,
        fileName: 'screen_514a_home_active.png',
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Track Your Drone'), findsOneWidget);
      expect(find.text('DEL-6P1SNZ'), findsOneWidget);
      expect(find.text('TRACK YOUR DRONE'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('2. Home Screen — No Active Delivery', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeAuth = _FakeAuthService();
      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(activeDeliveryResponse: null);

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final boundaryKey = GlobalKey();

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'Roboto'),
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: boundaryKey,
            child: HomeScreen(
              authService: fakeAuth,
              trackingService: service,
            ),
          ),
        ),
      );
      await tester.pump();

      // Tap CTA to trigger "No drone assigned yet" notice
      await tester.tap(find.byKey(const ValueKey('trackYourDroneCta')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      await _captureRepaintBoundary(
        tester: tester,
        key: boundaryKey,
        fileName: 'screen_514a_home_no_delivery.png',
      );

      expect(tester.takeException(), isNull);
      expect(find.text('No drone assigned yet'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('3. Drone Tracking — Collapsed Panel', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(
        activeDeliveryResponse: _buildActiveDeliveryJson(
          freshness: 'available',
          isLivePosition: true,
          speed: 12.5,
          altitude: 45.0,
          heading: 90.0,
          ageMinutes: 0,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final boundaryKey = GlobalKey();

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'Roboto'),
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: boundaryKey,
            child: DeliveryTrackingScreen(
              deliveryId: 'DEL-6P1SNZ',
              trackingService: service,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await _captureRepaintBoundary(
        tester: tester,
        key: boundaryKey,
        fileName: 'screen_514a_tracking_collapsed.png',
      );

      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('deliveryTrackingSheet')), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('4. Drone Tracking — Expanded Panel', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(
        activeDeliveryResponse: _buildActiveDeliveryJson(
          freshness: 'available',
          isLivePosition: true,
          speed: 12.5,
          altitude: 45.0,
          heading: 90.0,
          ageMinutes: 0,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final boundaryKey = GlobalKey();

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'Roboto'),
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: boundaryKey,
            child: DeliveryTrackingScreen(
              deliveryId: 'DEL-6P1SNZ',
              trackingService: service,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Drag bottom sheet up to expand and reveal kinematics
      await tester.drag(
        find.byType(SingleChildScrollView),
        const Offset(0, -350),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await _captureRepaintBoundary(
        tester: tester,
        key: boundaryKey,
        fileName: 'screen_514a_tracking_expanded.png',
      );

      expect(tester.takeException(), isNull);
      expect(find.text('SPEED'), findsOneWidget);
      expect(find.text('ALTITUDE'), findsOneWidget);
      expect(find.text('HEADING'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('5. Drone Tracking — Stale GPS', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final fakeStorage = _FakeStorageService();
      final fakeApi = _FakeCitizenApiService(
        activeDeliveryResponse: _buildActiveDeliveryJson(
          freshness: 'stale',
          isLivePosition: false,
          speed: 0.0,
          altitude: 15.0,
          heading: 90.0,
          ageMinutes: 6,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final boundaryKey = GlobalKey();

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'Roboto'),
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: boundaryKey,
            child: DeliveryTrackingScreen(
              deliveryId: 'DEL-6P1SNZ',
              trackingService: service,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await _captureRepaintBoundary(
        tester: tester,
        key: boundaryKey,
        fileName: 'screen_514a_tracking_stale.png',
      );

      expect(tester.takeException(), isNull);
      expect(find.text('STALE GPS'), findsOneWidget);
      expect(
        find.textContaining('GPS update delayed (>30s)'),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox());
    });
  });
}
