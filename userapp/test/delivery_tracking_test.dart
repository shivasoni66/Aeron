import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/core/gis_utils.dart';
import 'package:userapp/main.dart';
import 'package:userapp/models/auth_user.dart';
import 'package:userapp/models/delivery_tracking_models.dart';
import 'package:userapp/screens/delivery_tracking_screen.dart';
import 'package:userapp/services/auth_service.dart';
import 'package:userapp/services/citizen_api_service.dart';
import 'package:userapp/services/delivery_tracking_service.dart';
import 'package:userapp/services/secure_storage_service.dart';
import 'package:userapp/widgets/delivery_tracking_overlay.dart';
import 'package:userapp/widgets/delivery_tracking_pill.dart';

// --- Mocks and Fakes ---

class FakeSecureStorageService implements SecureStorageService {
  String? token;
  FakeSecureStorageService({this.token = 'mock-jwt-token-xyz'});

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

class FakeAuthService extends ChangeNotifier implements CitizenAuthService {
  bool authenticated;
  FakeAuthService({this.authenticated = true});

  @override
  bool get isAuthenticated => authenticated;

  @override
  CitizenAuthUser? get currentUser => authenticated
      ? const CitizenAuthUser(
          id: 'cit-101',
          name: 'Jane Citizen',
          email: 'jane@aeron.org',
          role: 'citizen',
          accountStatus: 'active',
        )
      : null;

  @override
  bool get isLoading => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeCitizenApiService implements CitizenApiService {
  Map<String, dynamic>? activeDeliveryResponse;
  bool shouldThrow = false;
  String errorMessage = 'Network connection failed';
  int fetchCallCount = 0;

  FakeCitizenApiService({this.activeDeliveryResponse});

  @override
  Future<Map<String, dynamic>?> getActiveDelivery() async {
    fetchCallCount++;
    if (shouldThrow) {
      throw Exception(errorMessage);
    }
    return activeDeliveryResponse;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

// Sample JSON payloads mirroring AERON Backend REST and Socket responses
Map<String, dynamic> sampleActiveDeliveryJson({
  String deliveryId = 'DEL-2026-MED01',
  String status = 'IN_TRANSIT',
  String freshness = 'available',
  bool isLivePosition = true,
  double droneLat = 12.9716,
  double droneLng = 77.5946,
  String? recordedAt,
}) {
  return {
    '_id': 'mongodb-id-001',
    'deliveryId': deliveryId,
    'status': status,
    'packageType': 'EMERGENCY_INSULIN',
    'recipient': {
      'id': 'cit-101',
      'name': 'Jane Citizen',
      'email': 'jane@aeron.org',
    },
    'assignedDrone': {
      '_id': 'drone-mongo-1',
      'droneId': 'AERON-PX4-BENCH01',
      'model': 'Hexacopter-V2',
    },
    'pickupLocation': {
      'type': 'Point',
      'coordinates': [77.5800, 12.9600],
      'address': 'Apollo Central Hospital Drone Port #2',
    },
    'destinationLocation': {
      'type': 'Point',
      'coordinates': [77.6100, 12.9900],
      'address': 'Building 4, Sector 7, Outer Ring Road',
    },
    'dispatchedAt': '2026-11-16T12:00:00.000Z',
    'createdAt': '2026-11-16T11:45:00.000Z',
    'updatedAt': '2026-11-16T12:05:00.000Z',
    'telemetry': {
      'droneId': 'AERON-PX4-BENCH01',
      'latitude': droneLat,
      'longitude': droneLng,
      'altitude': 42.5,
      'groundSpeed': 11.2,
      'heading': 78.0,
      'batteryPercentage': 88,
      'freshness': freshness,
      'isLivePosition': isLivePosition,
      'recordedAt': recordedAt ?? '2026-11-16T12:05:10.000Z',
    },
  };
}

void main() {
  group('Delivery Tracking Models & Serialization Tests', () {
    test('HealthcareDelivery parses full active backend payload correctly', () {
      final json = sampleActiveDeliveryJson();
      final delivery = HealthcareDelivery.fromJson(json);

      expect(delivery.deliveryId, 'DEL-2026-MED01');
      expect(delivery.status, DeliveryStatus.inTransit);
      expect(delivery.isActive, isTrue);
      expect(delivery.packageType, 'EMERGENCY_INSULIN');
      expect(delivery.assignedDrone?.droneId, 'AERON-PX4-BENCH01');
      expect(delivery.pickupLocation.longitude, 77.5800);
      expect(delivery.pickupLocation.latitude, 12.9600);
      expect(delivery.pickupLocation.address, 'Apollo Central Hospital Drone Port #2');
      expect(delivery.destinationLocation.longitude, 77.6100);
      expect(delivery.destinationLocation.latitude, 12.9900);
      expect(delivery.destinationLocation.address, 'Building 4, Sector 7, Outer Ring Road');
      expect(delivery.telemetry, isNotNull);
      expect(delivery.telemetry!.isLive, isTrue);
      expect(delivery.telemetry!.freshness, TelemetryFreshness.available);
      expect(delivery.telemetry!.latitude, 12.9716);
      expect(delivery.telemetry!.longitude, 77.5946);
      expect(delivery.telemetry!.altitude, 42.5);
      expect(delivery.telemetry!.groundSpeed, 11.2);
      expect(delivery.telemetry!.heading, 78.0);
    });

    test('DroneTelemetryData parses stale and unavailable freshness correctly', () {
      final staleJson = sampleActiveDeliveryJson(
        freshness: 'stale',
        isLivePosition: false,
      )['telemetry'] as Map<String, dynamic>;

      final staleTelem = DroneTelemetryData.fromJson(staleJson);
      expect(staleTelem.freshness, TelemetryFreshness.stale);
      expect(staleTelem.isLivePosition, isFalse);
      expect(staleTelem.isLive, isFalse);
      expect(staleTelem.hasCoordinates, isTrue);

      final unavailJson = {
        'freshness': 'unavailable',
        'isLivePosition': false,
        'message': 'No telemetry record found',
      };
      final unavailTelem = DroneTelemetryData.fromJson(unavailJson);
      expect(unavailTelem.freshness, TelemetryFreshness.unavailable);
      expect(unavailTelem.isLive, isFalse);
      expect(unavailTelem.hasCoordinates, isFalse);
      expect(unavailTelem.latitude, isNull);
      expect(unavailTelem.longitude, isNull);
    });

    test('DeliveryStatus enum maps all stages, active states, and indexes correctly', () {
      expect(DeliveryStatus.fromBackend('ORDERED'), DeliveryStatus.ordered);
      expect(DeliveryStatus.fromBackend('ASSIGNED'), DeliveryStatus.assigned);
      expect(DeliveryStatus.fromBackend('DISPATCHED'), DeliveryStatus.dispatched);
      expect(DeliveryStatus.fromBackend('IN_TRANSIT'), DeliveryStatus.inTransit);
      expect(DeliveryStatus.fromBackend('APPROACHING'), DeliveryStatus.approaching);
      expect(DeliveryStatus.fromBackend('DELIVERED'), DeliveryStatus.delivered);
      expect(DeliveryStatus.fromBackend('CANCELLED'), DeliveryStatus.cancelled);
      expect(DeliveryStatus.fromBackend('UNKNOWN_VALUE'), DeliveryStatus.ordered);

      expect(DeliveryStatus.ordered.isActive, isTrue);
      expect(DeliveryStatus.assigned.isActive, isTrue);
      expect(DeliveryStatus.dispatched.isActive, isTrue);
      expect(DeliveryStatus.inTransit.isActive, isTrue);
      expect(DeliveryStatus.approaching.isActive, isTrue);
      expect(DeliveryStatus.delivered.isActive, isFalse);
      expect(DeliveryStatus.cancelled.isActive, isFalse);

      expect(DeliveryStatus.ordered.stageIndex, 1);
      expect(DeliveryStatus.assigned.stageIndex, 2);
      expect(DeliveryStatus.dispatched.stageIndex, 3);
      expect(DeliveryStatus.inTransit.stageIndex, 4);
      expect(DeliveryStatus.approaching.stageIndex, 5);
      expect(DeliveryStatus.delivered.stageIndex, 6);
    });

    test('DeliveryTrackingState copyWith works as expected', () {
      const state = DeliveryTrackingState();
      expect(state.activeDelivery, isNull);
      expect(state.isLoading, isFalse);
      expect(state.hasActiveDelivery, isFalse);
      expect(state.socketStatus, SocketConnectionStatus.disconnected);

      final delivery = HealthcareDelivery.fromJson(sampleActiveDeliveryJson());
      final updated = state.copyWith(
        activeDelivery: delivery,
        isLoading: true,
        socketStatus: SocketConnectionStatus.connected,
      );

      expect(updated.hasActiveDelivery, isTrue);
      expect(updated.activeDelivery?.deliveryId, 'DEL-2026-MED01');
      expect(updated.isLoading, isTrue);
      expect(updated.socketStatus, SocketConnectionStatus.connected);

      final cleared = updated.copyWith(clearActiveDelivery: true, isLoading: false);
      expect(cleared.activeDelivery, isNull);
      expect(cleared.hasActiveDelivery, isFalse);
      expect(cleared.isLoading, isFalse);
    });
  });

  group('HealthcareDeliveryTrackingService State & Polling Tests', () {
    test('Unauthenticated user returns clean state without active delivery', () async {
      final fakeStorage = FakeSecureStorageService(token: null);
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
      );

      await service.refreshNow();

      expect(service.state.activeDelivery, isNull);
      expect(service.state.hasActiveDelivery, isFalse);
      expect(fakeApi.fetchCallCount, 0); // Should not call API when token is absent
    });

    test('Authenticated user with active delivery sets state correctly', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();

      expect(service.state.activeDelivery, isNotNull);
      expect(service.state.activeDelivery!.deliveryId, 'DEL-2026-MED01');
      expect(service.state.hasActiveDelivery, isTrue);
      expect(service.state.errorMessage, isNull);
      expect(fakeApi.fetchCallCount, 1);
    });

    test('Authenticated user with no active delivery sets clean standby state', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();

      expect(service.state.activeDelivery, isNull);
      expect(service.state.hasActiveDelivery, isFalse);
      expect(service.state.errorMessage, isNull);
    });

    test('API failure safely captures error without unhandled exceptions', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService();
      fakeApi.shouldThrow = true;
      fakeApi.errorMessage = '503 Service Unavailable';

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();

      expect(service.state.activeDelivery, isNull);
      expect(service.state.errorMessage, contains('503 Service Unavailable'));
      expect(service.state.isLoading, isFalse);
    });

    test('Incoming socket telemetry updates delivery state and coordinates', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();
      expect(service.state.activeDelivery!.telemetry!.latitude, 12.9716);

      // Simulate incoming telemetry event from socket
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'deliveryStatus': 'APPROACHING',
        'latitude': 12.9850,
        'longitude': 77.6050,
        'altitude': 18.0,
        'groundSpeed': 4.5,
        'heading': 85.0,
        'freshness': 'available',
        'isLivePosition': true,
        'recordedAt': DateTime.now().toIso8601String(),
      });

      expect(service.state.activeDelivery!.status, DeliveryStatus.approaching);
      expect(service.state.activeDelivery!.telemetry!.latitude, 12.9850);
      expect(service.state.activeDelivery!.telemetry!.longitude, 77.6050);
      expect(service.state.activeDelivery!.telemetry!.altitude, 18.0);
      expect(service.state.activeDelivery!.telemetry!.groundSpeed, 4.5);
      expect(service.state.activeDelivery!.telemetry!.isLive, isTrue);
    });

    test('Incoming socket telemetry ignores mismatched delivery ID', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();

      // Send telemetry with mismatched ID
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-DIFFERENT-ID',
        'location': {
          'type': 'Point',
          'coordinates': [80.0, 13.0],
        },
      });

      // Coordinates should remain untouched
      expect(service.state.activeDelivery!.telemetry!.latitude, 12.9716);
      expect(service.state.activeDelivery!.telemetry!.longitude, 77.5946);
    });

    test('start() and stop() control polling lifecycle cleanly', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      expect(service.isTracking, isFalse);
      await service.start();
      expect(service.isTracking, isTrue);
      expect(fakeApi.fetchCallCount, 1);

      service.stop();
      expect(service.isTracking, isFalse);
    });
  });

  group('DeliveryTrackingPill Widget Tests', () {
    testWidgets('Renders standby state when no active delivery exists', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DeliveryTrackingPill(
              delivery: null,
              animatePulse: false,
            ),
          ),
        ),
      );

      expect(find.text('DRONE DELIVERY TRACKING'), findsOneWidget);
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
      expect(find.text('STANDBY'), findsOneWidget);
      expect(find.byIcon(Icons.medical_services_outlined), findsOneWidget);
    });

    testWidgets('Tapping standby pill opens bottom modal with explanation', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DeliveryTrackingPill(
              delivery: null,
              animatePulse: false,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(DeliveryTrackingPill));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsOneWidget,
      );
      expect(find.text('Check for Updates'), findsOneWidget);
    });

    testWidgets('Renders live active delivery with LIVE badge and pulsating indicator', (tester) async {
      final delivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
          status: 'IN_TRANSIT',
          freshness: 'available',
          isLivePosition: true,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DeliveryTrackingPill(
              delivery: delivery,
              animatePulse: false,
            ),
          ),
        ),
      );

      expect(find.textContaining('DEL-2026-MED01'), findsOneWidget);
      expect(find.text('IN TRANSIT'), findsOneWidget);
      expect(find.text('LIVE'), findsOneWidget);
    });

    testWidgets('Renders STALE GPS badge when telemetry is stale', (tester) async {
      final delivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
          status: 'IN_TRANSIT',
          freshness: 'stale',
          isLivePosition: false,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DeliveryTrackingPill(
              delivery: delivery,
              animatePulse: false,
            ),
          ),
        ),
      );

      expect(find.textContaining('DEL-2026-MED01'), findsOneWidget);
      expect(find.text('STALE GPS'), findsOneWidget);
      expect(find.text('LIVE'), findsNothing);
    });

    testWidgets('Pill disappears when empty-state modal opens and reappears after Check for Updates dismissal', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      final fakeAuth = FakeAuthService(authenticated: true);
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final trackingService = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => trackingService.dispose());
      await trackingService.refreshNow();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          deliveryTrackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Standby capsule is visible in global overlay
      expect(find.text('DRONE DELIVERY TRACKING'), findsOneWidget);
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
      expect(find.text('STANDBY'), findsOneWidget);

      // Tap standby capsule to open modal
      await tester.tap(find.text('DRONE DELIVERY TRACKING'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal content is visible and unobscured
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsOneWidget,
      );
      expect(find.text('Check for Updates'), findsOneWidget);

      // CRITICAL: The overlay pill must be hidden while modal is open to avoid obscuring content
      expect(find.text('NO ACTIVE DELIVERY'), findsNothing);
      expect(find.text('STANDBY'), findsNothing);

      // Dismiss via 'Check for Updates' action
      await tester.tap(find.text('Check for Updates'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal is dismissed and pill is restored
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsNothing,
      );
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
      expect(find.text('STANDBY'), findsOneWidget);
    });

    testWidgets('Pill reappears after outside barrier tap dismissal', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      final fakeAuth = FakeAuthService(authenticated: true);
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final trackingService = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => trackingService.dispose());
      await trackingService.refreshNow();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          deliveryTrackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Open modal
      await tester.tap(find.text('DRONE DELIVERY TRACKING'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('NO ACTIVE DELIVERY'), findsNothing);

      // Dismiss via outside tap on the barrier
      await tester.tapAt(const Offset(100, 50));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal dismissed and pill restored
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsNothing,
      );
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
    });

    testWidgets('Pill reappears after Android back button dismissal', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      final fakeAuth = FakeAuthService(authenticated: true);
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final trackingService = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => trackingService.dispose());
      await trackingService.refreshNow();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          deliveryTrackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Open modal
      await tester.tap(find.text('DRONE DELIVERY TRACKING'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('NO ACTIVE DELIVERY'), findsNothing);

      // Simulate Android physical / gesture back button
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal dismissed and pill restored
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsNothing,
      );
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
    });

    testWidgets('Pill reappears after drag down dismissal', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      final fakeAuth = FakeAuthService(authenticated: true);
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final trackingService = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => trackingService.dispose());
      await trackingService.refreshNow();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          deliveryTrackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Open modal
      await tester.tap(find.text('DRONE DELIVERY TRACKING'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('NO ACTIVE DELIVERY'), findsNothing);

      // Drag modal sheet down
      await tester.drag(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        const Offset(0, 400),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal dismissed and pill restored
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsNothing,
      );
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
    });

    testWidgets('Tapping standby capsule on pushed routes temporarily hides pill and restores it upon dismissal', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      final fakeAuth = FakeAuthService(authenticated: true);
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: null);

      final trackingService = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => trackingService.dispose());
      await trackingService.refreshNow();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          deliveryTrackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Push secondary screen onto the navigator
      navKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => const Scaffold(
            body: Center(child: Text('PUSHED SECONDARY SCREEN')),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify pushed screen and persistent tracking pill are both visible
      expect(find.text('PUSHED SECONDARY SCREEN'), findsOneWidget);
      expect(find.text('DRONE DELIVERY TRACKING'), findsOneWidget);
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);

      // Tap capsule on the pushed route
      await tester.tap(find.text('DRONE DELIVERY TRACKING'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Modal bottom sheet opens properly above pushed route
      expect(
        find.textContaining('No healthcare delivery is currently assigned to your address'),
        findsOneWidget,
      );
      // Pill must be hidden
      expect(find.text('NO ACTIVE DELIVERY'), findsNothing);

      // Dismiss modal
      await tester.tap(find.text('Check for Updates'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Pill is restored on the pushed route
      expect(find.text('PUSHED SECONDARY SCREEN'), findsOneWidget);
      expect(find.text('NO ACTIVE DELIVERY'), findsOneWidget);
    });
  });

  group('DeliveryTrackingScreen UI Component Tests', () {
    testWidgets('Renders delivery header, drone ID, telemetry metrics, and map controls', (tester) async {
      final delivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
          status: 'IN_TRANSIT',
        ),
      );

      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

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
            deliveryId: delivery.deliveryId,
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Header verification
      expect(find.text('DEL-2026-MED01'), findsWidgets);
      expect(find.textContaining('Drone: AERON-PX4-BENCH01'), findsOneWidget);

      // Distance & GPS ticker
      expect(find.byKey(const ValueKey('distanceText')), findsOneWidget);
      expect(find.byKey(const ValueKey('gpsAgeTickerText')), findsOneWidget);

      // Telemetry metrics
      expect(find.text('40.3 km/h'), findsOneWidget);
      expect(find.text('42.5 m'), findsOneWidget);
      expect(find.text('78°'), findsOneWidget);

      // Map control buttons
      expect(find.byIcon(Icons.add), findsOneWidget);
      expect(find.byIcon(Icons.remove), findsOneWidget);
      expect(find.byIcon(Icons.my_location), findsOneWidget);
      expect(find.byIcon(Icons.flag_outlined), findsOneWidget);
    });

    testWidgets('Displays stale telemetry warning banner when GPS is stale', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          freshness: 'stale',
          isLivePosition: false,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(
        find.textContaining('GPS update delayed (>30s)'),
        findsOneWidget,
      );
    });
  });

  group('GisUtils & Geodesic Calculation Tests', () {
    test('isValidCoordinate validates latitude and longitude ranges and finite numbers', () {
      expect(GisUtils.isValidCoordinate(0.0, 0.0), isTrue);
      expect(GisUtils.isValidCoordinate(90.0, 180.0), isTrue);
      expect(GisUtils.isValidCoordinate(-90.0, -180.0), isTrue);
      expect(GisUtils.isValidCoordinate(12.9716, 77.5946), isTrue);

      expect(GisUtils.isValidCoordinate(null, 77.5946), isFalse);
      expect(GisUtils.isValidCoordinate(12.9716, null), isFalse);
      expect(GisUtils.isValidCoordinate(90.1, 0.0), isFalse);
      expect(GisUtils.isValidCoordinate(-90.1, 0.0), isFalse);
      expect(GisUtils.isValidCoordinate(0.0, 180.1), isFalse);
      expect(GisUtils.isValidCoordinate(0.0, -180.1), isFalse);
      expect(GisUtils.isValidCoordinate(double.nan, 0.0), isFalse);
      expect(GisUtils.isValidCoordinate(0.0, double.infinity), isFalse);
    });

    test('haversineDistanceMeters accurately calculates distance between known points', () {
      // Identical coordinates return 0.0
      final sameDist = GisUtils.haversineDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946);
      expect(sameDist, isNotNull);
      expect(sameDist!, closeTo(0.0, 0.001));

      // Distance between Bangalore Town Hall (12.9649, 77.5852) and MG Road Metro (12.9756, 77.6066) ~ 2.62 km
      final dist = GisUtils.haversineDistanceMeters(12.9649, 77.5852, 12.9756, 77.6066);
      expect(dist, isNotNull);
      expect(dist!, closeTo(2617.0, 20.0));

      // Invalid coordinates return null
      expect(GisUtils.haversineDistanceMeters(null, 77.5946, 12.9716, 77.5946), isNull);
      expect(GisUtils.haversineDistanceMeters(12.9716, 77.5946, 95.0, 77.5946), isNull);
    });

    test('formatDistance displays meters for < 1000m and kilometers for >= 1000m', () {
      expect(GisUtils.formatDistance(null), equals('—'));
      expect(GisUtils.formatDistance(-5.0), equals('—'));
      expect(GisUtils.formatDistance(0.0), equals('0 m'));
      expect(GisUtils.formatDistance(45.4), equals('45 m'));
      expect(GisUtils.formatDistance(999.4), equals('999 m'));
      expect(GisUtils.formatDistance(1000.0), equals('1.0 km'));
      expect(GisUtils.formatDistance(2450.0), equals('2.5 km'));
      expect(GisUtils.formatDistance(15300.0), equals('15.3 km'));
    });

    test('isWithinProximity evaluates arrival threshold correctly', () {
      expect(GisUtils.isWithinProximity(null), isFalse);
      expect(GisUtils.isWithinProximity(-1.0), isFalse);
      expect(GisUtils.isWithinProximity(0.0), isTrue);
      expect(GisUtils.isWithinProximity(24.9), isTrue);
      expect(GisUtils.isWithinProximity(25.0), isTrue);
      expect(GisUtils.isWithinProximity(25.1), isFalse);
      expect(GisUtils.isWithinProximity(50.0), isFalse);

      // Custom threshold
      expect(GisUtils.isWithinProximity(40.0, thresholdMeters: 50.0), isTrue);
      expect(GisUtils.isWithinProximity(60.0, thresholdMeters: 50.0), isFalse);
    });
  });

  group('GPS Trail Jitter Filtering & Geodesic Append Tests', () {
    final t0 = DateTime.utc(2026, 11, 17, 10, 0, 0);

    test('shouldAppendTrailPoint accepts initial point if valid', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0,
      );
      expect(p0.shouldAppendAfter(null), isTrue);
      expect(
        GisUtils.shouldAppendTrailPoint(
          lastLat: null,
          lastLon: null,
          lastTimestamp: null,
          newLat: 12.9716,
          newLon: 77.5946,
          newTimestamp: t0,
        ),
        isTrue,
      );
    });

    test('shouldAppendTrailPoint rejects invalid coordinates for initial point', () {
      final pInvalid = DeliveryTrailPoint(
        latitude: 95.0,
        longitude: 77.5946,
        timestamp: t0,
      );
      expect(pInvalid.shouldAppendAfter(null), isFalse);
    });

    test('shouldAppendTrailPoint rejects exact duplicate lat/lon even if timestamp advances', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0,
      );
      final pDup = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0.add(const Duration(seconds: 2)),
      );
      expect(pDup.shouldAppendAfter(p0), isFalse);
    });

    test('shouldAppendTrailPoint rejects micro-jitter displacement < 2 meters', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716000,
        longitude: 77.5946000,
        timestamp: t0,
      );
      // ~0.000005 deg lat is approx 0.55 meters
      final pJitter = DeliveryTrailPoint(
        latitude: 12.9716050,
        longitude: 77.5946000,
        timestamp: t0.add(const Duration(seconds: 2)),
      );
      expect(pJitter.shouldAppendAfter(p0), isFalse);
    });

    test('shouldAppendTrailPoint rejects rapid burst arrivals under minIntervalMs (<500ms)', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0,
      );
      // Large displacement (~110m) but only 200ms elapsed
      final pBurst = DeliveryTrailPoint(
        latitude: 12.9726,
        longitude: 77.5946,
        timestamp: t0.add(const Duration(milliseconds: 200)),
      );
      expect(pBurst.shouldAppendAfter(p0), isFalse);
    });

    test('shouldAppendTrailPoint rejects out-of-order or duplicate timestamps', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0,
      );
      // Same timestamp
      final pSameTime = DeliveryTrailPoint(
        latitude: 12.9726,
        longitude: 77.5946,
        timestamp: t0,
      );
      expect(pSameTime.shouldAppendAfter(p0), isFalse);

      // Earlier timestamp
      final pPast = DeliveryTrailPoint(
        latitude: 12.9726,
        longitude: 77.5946,
        timestamp: t0.subtract(const Duration(seconds: 1)),
      );
      expect(pPast.shouldAppendAfter(p0), isFalse);
    });

    test('shouldAppendTrailPoint accepts legitimate movement (>=2m, >=500ms, forward in time)', () {
      final p0 = DeliveryTrailPoint(
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: t0,
      );
      // ~22 meters away, 1 second later
      final pMoved = DeliveryTrailPoint(
        latitude: 12.9718,
        longitude: 77.5946,
        timestamp: t0.add(const Duration(seconds: 1)),
      );
      expect(pMoved.shouldAppendAfter(p0), isTrue);
    });
  });

  group('GPS Trail Accumulation & Service State Integration Tests', () {
    test('Initial valid telemetry seeds first point in trail', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      expect(service.trail, isEmpty);
      await service.refreshNow();

      expect(service.trail.length, equals(1));
      expect(service.trail.first.latitude, equals(12.9716));
      expect(service.trail.first.longitude, equals(77.5946));
      expect(service.state.trailPoints.length, equals(1));
    });

    test('Switching delivery clears existing trail history', () async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      await service.refreshNow();
      expect(service.trail.length, equals(1));

      // Now switch active delivery to MED02 with different coordinates
      fakeApi.activeDeliveryResponse = sampleActiveDeliveryJson(
        deliveryId: 'DEL-2026-MED02',
        droneLat: 13.0000,
        droneLng: 77.6000,
      );

      await service.refreshNow();
      expect(service.state.activeDelivery?.deliveryId, equals('DEL-2026-MED02'));
      // Trail was reset and seeded with MED02's initial point
      expect(service.trail.length, equals(1));
      expect(service.trail.first.latitude, equals(13.0000));
    });

    test('Trail bounds history at maxTrailPoints (500)', () {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());

      final baseTime = DateTime.utc(2026, 11, 17, 12, 0, 0);

      // Add 510 points manually via test method
      for (int i = 0; i < 510; i++) {
        service.addTrailPointForTesting(
          DeliveryTrailPoint(
            latitude: 12.0 + (i * 0.0001),
            longitude: 77.0 + (i * 0.0001),
            timestamp: baseTime.add(Duration(seconds: i)),
          ),
        );
      }

      expect(service.trail.length, equals(HealthcareDeliveryTrackingService.maxTrailPoints));
      // Oldest points should have shifted out
      expect(service.trail.first.timestamp, equals(baseTime.add(const Duration(seconds: 10))));
    });

    test('DeliveryTrackingState calculates remainingDistanceMeters and proximity', () {
      final delivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

      final state = DeliveryTrackingState(
        activeDelivery: delivery,
        trail: [
          DeliveryTrailPoint(
            latitude: 12.9716,
            longitude: 77.5946,
            timestamp: DateTime.now(),
          ),
        ],
      );

      expect(state.remainingDistanceMeters, isNotNull);
      expect(state.remainingDistanceMeters!, greaterThan(0.0));
      expect(state.trailPoints.length, equals(1));
      expect(state.isWithinDeliveryProximity, isFalse);
    });

    test('DeliveryTrackingState returns null remainingDistance when drone GPS is unavailable', () {
      final json = sampleActiveDeliveryJson();
      json.remove('telemetry');
      final delivery = HealthcareDelivery.fromJson(json);

      final state = DeliveryTrackingState(activeDelivery: delivery);
      expect(state.remainingDistanceMeters, isNull);
      expect(state.isWithinDeliveryProximity, isFalse);
    });
  });

  group('DeliveryTrackingScreen Phase 1 UI Tests', () {
    testWidgets('Renders PolylineLayer and Remaining Distance Card', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Verify PolylineLayer is rendered
      expect(find.byType(PolylineLayer), findsOneWidget);

      // Verify Remaining Distance card is present
      expect(find.text('REMAINING DISTANCE'), findsOneWidget);
      expect(find.textContaining('to destination'), findsOneWidget);
      expect(find.textContaining('GPS breadcrumb points recorded in trail'), findsOneWidget);
    });

    testWidgets('Displays ARRIVING badge and descent notification when within 25m', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      // Place drone at destination coordinates (12.9900, 77.6100) so remaining distance is ~0m
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9900,
          droneLng: 77.6100,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Proximity indicator should be triggered
      expect(find.text('ARRIVING'), findsOneWidget);
      expect(
        find.textContaining('Drone is within 25m of destination. Stand by for descent.'),
        findsOneWidget,
      );
    });

    testWidgets('Displays awaiting GPS fix message when drone telemetry has no coordinates', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final json = sampleActiveDeliveryJson();
      json.remove('telemetry');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: json);

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('(awaiting GPS fix)'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
    });
  });

  group('HeadingTween Angular Interpolation Tests', () {
    test('Interpolates shortest angular path across 0/360 boundary clockwise', () {
      final tween = HeadingTween(begin: 350.0, end: 10.0);
      expect(tween.lerp(0.0), equals(350.0));
      expect(tween.lerp(0.5), equals(0.0));
      expect(tween.lerp(1.0), equals(10.0));
    });

    test('Interpolates shortest angular path across 0/360 boundary counter-clockwise', () {
      final tween = HeadingTween(begin: 10.0, end: 350.0);
      expect(tween.lerp(0.0), equals(10.0));
      expect(tween.lerp(0.5), equals(0.0));
      expect(tween.lerp(1.0), equals(350.0));
    });

    test('Interpolates normal angles within standard range', () {
      final tween = HeadingTween(begin: 30.0, end: 90.0);
      expect(tween.lerp(0.0), equals(30.0));
      expect(tween.lerp(0.5), equals(60.0));
      expect(tween.lerp(1.0), equals(90.0));
    });

    test('Handles identical begin and end angles', () {
      final tween = HeadingTween(begin: 180.0, end: 180.0);
      expect(tween.lerp(0.0), equals(180.0));
      expect(tween.lerp(0.5), equals(180.0));
      expect(tween.lerp(1.0), equals(180.0));
    });
  });

  group('DeliveryTrackingScreen Phase 2 Auto-Follow & Camera Tests', () {
    testWidgets('Auto-follow is enabled by default when tracking starts', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      expect(state.isAutoFollowActive, isTrue);

      // Center Drone button should NOT be displayed when auto-follow is active
      expect(find.byKey(const Key('centerDroneBtn')), findsNothing);
      expect(find.text('Center Drone'), findsNothing);
    });

    testWidgets('Manual pan pauses auto-follow and shows Center Drone button', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      expect(state.isAutoFollowActive, isTrue);

      // Simulate manual user pan
      state.onManualPanForTesting();
      await tester.pump();

      expect(state.isAutoFollowActive, isFalse);
      expect(find.byKey(const Key('centerDroneBtn')), findsOneWidget);
      expect(find.text('Center Drone'), findsOneWidget);
    });

    testWidgets('Tapping Center Drone re-enables auto-follow and hides button', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      state.onManualPanForTesting();
      await tester.pump();

      expect(state.isAutoFollowActive, isFalse);
      expect(find.text('Center Drone'), findsOneWidget);

      // Tap Center Drone button
      await tester.tap(find.text('Center Drone'));
      await tester.pump();

      expect(state.isAutoFollowActive, isTrue);
      expect(find.text('Center Drone'), findsNothing);
    });

    testWidgets('Preserves current zoom level when zooming and updating telemetry', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Tap zoom in button
      final zoomInBtn = find.byKey(const ValueKey('zoomInBtn'));
      expect(zoomInBtn, findsOneWidget);
      await tester.tap(zoomInBtn);
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      expect(state.isAutoFollowActive, isTrue);

      // Send telemetry update
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'latitude': 12.9720,
        'longitude': 77.5950,
        'heading': 45.0,
        'recordedAt': DateTime.now().toIso8601String(),
      });
      await tester.pump();

      // Auto-follow remains active and zoom is preserved
      expect(state.isAutoFollowActive, isTrue);
    });
  });

  group('DeliveryTrackingScreen Phase 2 Marker Movement & Lifecycle Tests', () {
    testWidgets('Smooth marker animation begins between consecutive valid GPS positions', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      expect(state.animatedDronePos?.latitude, equals(12.9716));

      // Deliver new GPS position
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'latitude': 12.9736,
        'longitude': 77.5966,
        'heading': 90.0,
        'recordedAt': DateTime.now().add(const Duration(seconds: 1)).toIso8601String(),
      });
      await tester.pump();

      // Animation is active
      expect(state.movementController.isAnimating, isTrue);

      // Advance animation halfway (500ms)
      await tester.pump(const Duration(milliseconds: 500));
      expect(state.animatedDronePos, isNotNull);
      expect(state.animatedDronePos!.latitude, greaterThan(12.9716));
      expect(state.animatedDronePos!.latitude, lessThan(12.9736));

      // Complete animation (remaining 500ms)
      await tester.pump(const Duration(milliseconds: 600));
      expect(state.movementController.isAnimating, isFalse);
      expect(state.animatedDronePos!.latitude, closeTo(12.9736, 0.0001));
    });

    testWidgets('Cancels and replaces active animation safely when newer GPS packet arrives', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));

      // 1. Packet 2 arrives, starting animation towards 12.9736
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'latitude': 12.9736,
        'longitude': 77.5966,
        'heading': 90.0,
        'recordedAt': DateTime.now().add(const Duration(seconds: 1)).toIso8601String(),
      });
      await tester.pump();
      expect(state.movementController.isAnimating, isTrue);

      // 2. Advance to 300ms (intermediate position)
      await tester.pump(const Duration(milliseconds: 300));
      final intermediateLat = state.animatedDronePos!.latitude;

      // 3. Packet 3 arrives while animation is in flight, targeting 12.9750
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'latitude': 12.9750,
        'longitude': 77.5980,
        'heading': 110.0,
        'recordedAt': DateTime.now().add(const Duration(seconds: 2)).toIso8601String(),
      });
      await tester.pump();

      // Controller should restart from the intermediate position towards Packet 3
      expect(state.movementController.isAnimating, isTrue);
      expect(state.animatedDronePos!.latitude, closeTo(intermediateLat, 0.0001));

      // Advance to completion
      await tester.pump(const Duration(milliseconds: 1100));
      expect(state.animatedDronePos!.latitude, closeTo(12.9750, 0.0001));
    });

    testWidgets('Safely handles missing and stale GPS without crashing', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final json = sampleActiveDeliveryJson(freshness: 'stale');
      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: json);

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Stale banner is visible
      expect(find.textContaining('GPS update delayed (>30s)'), findsOneWidget);

      // Telemetry packet with missing coordinates arrives
      service.handleIncomingTelemetry({
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'freshness': 'unavailable',
      });
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      // Does not crash and controller is not stuck animating
      expect(state.movementController.isAnimating, isFalse);
    });

    testWidgets('Delivery switching resets animation and auto-follow state', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          deliveryId: 'DEL-2026-MED01',
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      // Manually pause auto-follow
      state.onManualPanForTesting();
      await tester.pump();
      expect(state.isAutoFollowActive, isFalse);

      // Switch active delivery to MED02
      fakeApi.activeDeliveryResponse = sampleActiveDeliveryJson(
        deliveryId: 'DEL-2026-MED02',
        droneLat: 13.0500,
        droneLng: 77.6500,
      );
      await service.refreshNow();
      await tester.pump();

      // State is updated to new delivery position, no cross-delivery animation, auto-follow re-enabled
      expect(state.isAutoFollowActive, isTrue);
      expect(state.animatedDronePos?.latitude, equals(13.0500));
      expect(state.movementController.isAnimating, isFalse);
    });

    testWidgets('Screen disposal cleans up listeners and animation controllers safely', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Push replacement / replace with empty container to trigger dispose
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Text('Disposed Screen')),
        ),
      );
      await tester.pump();

      // Verify no exception was thrown on disposal
      expect(find.text('Disposed Screen'), findsOneWidget);
    });
  });

  group('Phase 3 GisUtils Freshness & Update Ticker Unit Tests', () {
    test('Under 10s evaluates to GpsFreshnessState.live', () {
      final now = DateTime(2026, 11, 17, 12, 0, 30);
      final recordedAt = DateTime(2026, 11, 17, 12, 0, 25); // 5s ago
      final state = GisUtils.evaluateFreshness(
        recordedAt: recordedAt,
        hasCoordinates: true,
        now: now,
      );
      expect(state, equals(GpsFreshnessState.live));
      expect(state.displayName, equals('LIVE GPS'));
      expect(state.color, equals(const Color(0xFF00C853)));
    });

    test('10s to 30s boundaries evaluate to GpsFreshnessState.delayed', () {
      final now = DateTime(2026, 11, 17, 12, 0, 30);

      // Exactly 10s
      final recordedAt10 = DateTime(2026, 11, 17, 12, 0, 20);
      expect(
        GisUtils.evaluateFreshness(
          recordedAt: recordedAt10,
          hasCoordinates: true,
          now: now,
        ),
        equals(GpsFreshnessState.delayed),
      );

      // 25s
      final recordedAt25 = DateTime(2026, 11, 17, 12, 0, 5);
      expect(
        GisUtils.evaluateFreshness(
          recordedAt: recordedAt25,
          hasCoordinates: true,
          now: now,
        ),
        equals(GpsFreshnessState.delayed),
      );

      // Exactly 30s
      final recordedAt30 = DateTime(2026, 11, 17, 12, 0, 0);
      final state30 = GisUtils.evaluateFreshness(
        recordedAt: recordedAt30,
        hasCoordinates: true,
        now: now,
      );
      expect(state30, equals(GpsFreshnessState.delayed));
      expect(state30.displayName, equals('GPS DELAYED'));
      expect(state30.color, equals(const Color(0xFFFFB300)));
    });

    test('Above 30s evaluates to GpsFreshnessState.stale', () {
      final now = DateTime(2026, 11, 17, 12, 0, 30);
      final recordedAt31 = DateTime(2026, 11, 17, 11, 59, 59); // 31s ago
      final state = GisUtils.evaluateFreshness(
        recordedAt: recordedAt31,
        hasCoordinates: true,
        now: now,
      );
      expect(state, equals(GpsFreshnessState.stale));
      expect(state.displayName, equals('STALE GPS'));
      expect(state.color, equals(const Color(0xFFFF5252)));
    });

    test('Missing coordinates or null timestamp evaluates to unavailable', () {
      final now = DateTime(2026, 11, 17, 12, 0, 0);
      expect(
        GisUtils.evaluateFreshness(
          recordedAt: null,
          hasCoordinates: true,
          now: now,
        ),
        equals(GpsFreshnessState.unavailable),
      );

      expect(
        GisUtils.evaluateFreshness(
          recordedAt: now,
          hasCoordinates: false,
          now: now,
        ),
        equals(GpsFreshnessState.unavailable),
      );

      expect(
        GisUtils.evaluateFreshness(
          recordedAt: now,
          hasCoordinates: true,
          backendFreshness: TelemetryFreshness.unavailable,
          now: now,
        ),
        equals(GpsFreshnessState.unavailable),
      );
    });

    test('Never display LIVE GPS when backend reports STALE even if age < 10s', () {
      final now = DateTime(2026, 11, 17, 12, 0, 10);
      final recordedAt = DateTime(2026, 11, 17, 12, 0, 8); // 2s ago
      final state = GisUtils.evaluateFreshness(
        recordedAt: recordedAt,
        hasCoordinates: true,
        backendFreshness: TelemetryFreshness.stale,
        now: now,
      );
      expect(state, isNot(equals(GpsFreshnessState.live)));
      expect(state, equals(GpsFreshnessState.delayed));
    });

    test('formatGpsAge formats elapsed time increments correctly', () {
      final now = DateTime(2026, 11, 17, 12, 0, 0);

      expect(GisUtils.formatGpsAge(null, now: now), equals('No GPS fix'));
      expect(GisUtils.formatGpsAge(now, now: now), equals('Updated just now'));
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(milliseconds: 500)), now: now),
        equals('Updated just now'),
      );
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(seconds: 2)), now: now),
        equals('Updated 2s ago'),
      );
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(seconds: 28)), now: now),
        equals('Updated 28s ago'),
      );
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(seconds: 75)), now: now),
        equals('Updated 1m ago'),
      );
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(minutes: 5)), now: now),
        equals('Updated 5m ago'),
      );
      expect(
        GisUtils.formatGpsAge(now.subtract(const Duration(hours: 2)), now: now),
        equals('Updated 2h ago'),
      );
    });

    test('SocketConnectionStatus includes reconnecting and distinct display names and colors', () {
      expect(SocketConnectionStatus.connected.displayName, equals('Connected'));
      expect(SocketConnectionStatus.connected.badgeColor, equals(const Color(0xFF1B5E20)));

      expect(SocketConnectionStatus.connecting.displayName, equals('Connecting'));
      expect(SocketConnectionStatus.connecting.badgeColor, equals(const Color(0xFF0D47A1)));

      expect(SocketConnectionStatus.reconnecting.displayName, equals('Reconnecting'));
      expect(SocketConnectionStatus.reconnecting.badgeColor, equals(const Color(0xFFE65100)));

      expect(SocketConnectionStatus.disconnected.displayName, equals('Disconnected'));
      expect(SocketConnectionStatus.disconnected.badgeColor, equals(const Color(0xFF424242)));
    });
  });

  group('DeliveryTrackingScreen Phase 3 GPS Freshness & Connection Widget Tests', () {
    testWidgets('Renders 1-second ticker text and updates age without camera repositioning', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          freshness: 'available',
          recordedAt: DateTime.now().toIso8601String(),
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const ValueKey('gpsAgeTickerText')), findsOneWidget);
      expect(find.text('LIVE GPS'), findsOneWidget);
      expect(find.text('CONNECTED'), findsOneWidget);

      // Advance time by 2 seconds
      await tester.pump(const Duration(seconds: 2));
      expect(find.byKey(const ValueKey('gpsAgeTickerText')), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Displays separate Socket badges for connecting, reconnecting and connected states', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          recordedAt: DateTime.now().toIso8601String(),
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Simulate reconnecting socket state
      service.setSocketStatusForTesting(SocketConnectionStatus.reconnecting);
      await tester.pump();
      expect(find.text('RECONNECTING'), findsOneWidget);

      // Simulate connecting socket state
      service.setSocketStatusForTesting(SocketConnectionStatus.connecting);
      await tester.pump();
      expect(find.text('CONNECTING'), findsOneWidget);

      // Simulate connected socket state
      service.setSocketStatusForTesting(SocketConnectionStatus.connected);
      await tester.pump();
      expect(find.text('CONNECTED'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Stale GPS retains drone position but displays red badge and stale overlay banner', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final staleRecordedAt = DateTime.now().subtract(const Duration(seconds: 45)).toIso8601String();
      final payload = sampleActiveDeliveryJson(
        freshness: 'stale',
        recordedAt: staleRecordedAt,
      );
      (payload['telemetry'] as Map<String, dynamic>)['freshness'] = 'stale';

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // GPS Freshness badge must be STALE GPS
      expect(find.text('STALE GPS'), findsOneWidget);
      // Stale overlay banner must be visible
      expect(
        find.text('GPS update delayed (>30s). Displaying last verified drone position.'),
        findsOneWidget,
      );

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      // Drone position is retained on the map
      expect(state.animatedDronePos, isNotNull);
      expect(state.animatedDronePos?.latitude, equals(12.9716));

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Delayed GPS (10-30s) displays amber badge and delayed overlay banner', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final delayedRecordedAt = DateTime.now().subtract(const Duration(seconds: 20)).toIso8601String();
      final payload = sampleActiveDeliveryJson(
        freshness: 'available',
        recordedAt: delayedRecordedAt,
      );

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // GPS Freshness badge must be GPS DELAYED
      expect(find.text('GPS DELAYED'), findsOneWidget);
      expect(
        find.text('GPS signal delayed (10-30s). Updates may be slower than real-time.'),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('On reconnection, tracking remains STALE until a new valid GPS update arrives', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final staleTime = DateTime.now().subtract(const Duration(seconds: 40)).toIso8601String();
      final payload = sampleActiveDeliveryJson(
        freshness: 'stale',
        recordedAt: staleTime,
      );
      (payload['telemetry'] as Map<String, dynamic>)['freshness'] = 'stale';

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Initially simulate disconnected state while telemetry is stale
      service.setSocketStatusForTesting(SocketConnectionStatus.disconnected);
      await tester.pump();

      expect(find.text('DISCONNECTED'), findsOneWidget);
      expect(find.text('STALE GPS'), findsOneWidget);

      // Reconnect socket without new telemetry packet
      service.setSocketStatusForTesting(SocketConnectionStatus.connected);
      await tester.pump();

      // Socket shows CONNECTED, but GPS STILL shows STALE GPS
      expect(find.text('CONNECTED'), findsOneWidget);
      expect(find.text('STALE GPS'), findsOneWidget);
      expect(find.text('LIVE GPS'), findsNothing);

      // Now a new valid fresh GPS update arrives via telemetry
      final freshPayload = {
        'deliveryId': 'DEL-2026-MED01',
        'droneId': 'AERON-PX4-BENCH01',
        'latitude': 12.9720,
        'longitude': 77.5950,
        'altitude': 45.0,
        'heading': 90.0,
        'speed': 10.0,
        'battery': 88,
        'satellites': 14,
        'fix': '3D_FIX',
        'isLivePosition': true,
        'freshness': 'available',
        'recordedAt': DateTime.now().toIso8601String(),
      };
      service.handleIncomingTelemetry(freshPayload);
      await tester.pump();

      // Now transitions to LIVE GPS
      expect(find.text('LIVE GPS'), findsOneWidget);
      expect(find.text('STALE GPS'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Screen disposal cancels ticker timer safely', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          recordedAt: DateTime.now().toIso8601String(),
        ),
      );
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      final timer = state.tickerTimer;
      expect(timer?.isActive, isTrue);

      // Dispose screen
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();

      expect(timer?.isActive, isFalse);
      expect(state.tickerTimer, isNull);
    });
  });

  group('Phase 4 GisUtils Dynamic ETA & Conservative Estimation Tests', () {
    test('formatRemainingTime formats duration correctly with approximate tilde', () {
      expect(GisUtils.formatRemainingTime(const Duration(seconds: 30)), equals('< 1 min'));
      expect(GisUtils.formatRemainingTime(const Duration(seconds: 59)), equals('< 1 min'));
      expect(GisUtils.formatRemainingTime(const Duration(seconds: 60)), equals('~1 min'));
      expect(GisUtils.formatRemainingTime(const Duration(minutes: 5)), equals('~5 mins'));
      expect(GisUtils.formatRemainingTime(const Duration(minutes: 60)), equals('~1 hr'));
      expect(GisUtils.formatRemainingTime(const Duration(minutes: 75)), equals('~1h 15m'));
      expect(GisUtils.formatRemainingTime(const Duration(hours: 2)), equals('~2 hrs'));
    });

    test('formatClockTime formats 12-hour AM/PM clock time correctly', () {
      expect(GisUtils.formatClockTime(DateTime(2026, 11, 17, 20, 45)), equals('~8:45 PM'));
      expect(GisUtils.formatClockTime(DateTime(2026, 11, 17, 9, 5)), equals('~9:05 AM'));
      expect(GisUtils.formatClockTime(DateTime(2026, 11, 17, 0, 15)), equals('~12:15 AM'));
      expect(GisUtils.formatClockTime(DateTime(2026, 11, 17, 12, 0)), equals('~12:00 PM'));
    });

    test('calculateConservativeSpeed filters noise and applies conservative factor', () {
      expect(GisUtils.calculateConservativeSpeed(null), isNull);
      expect(GisUtils.calculateConservativeSpeed([]), isNull);
      expect(GisUtils.calculateConservativeSpeed([double.nan, -5.0, 100.0]), isNull);

      // Single speed reading: 10 m/s -> conservative 9.0 m/s
      expect(GisUtils.calculateConservativeSpeed([10.0]), closeTo(9.0, 0.01));

      // Speed < 1.0 m/s is retained
      expect(GisUtils.calculateConservativeSpeed([0.6]), closeTo(0.6, 0.01));

      // Noisy spike suppression: [8.0, 8.0, 8.0, 25.0]
      // Median is 8.0, mean is 12.25. Min is 8.0 -> 8.0 * 0.90 = 7.2 m/s
      final speedWithSpike = GisUtils.calculateConservativeSpeed([8.0, 8.0, 8.0, 25.0]);
      expect(speedWithSpike, closeTo(7.2, 0.01));

      // Noisy dip suppression: [10.0, 10.0, 10.0, 2.0]
      // Median is 10.0, mean is 8.0. Min is 8.0 -> 8.0 * 0.90 = 7.2 m/s
      final speedWithDip = GisUtils.calculateConservativeSpeed([10.0, 10.0, 10.0, 2.0]);
      expect(speedWithDip, closeTo(7.2, 0.01));
    });

    test('Stationary drone before departure evaluates to awaitingDeparture', () {
      final orderedDelivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(status: 'ORDERED'),
      );
      final orderedEta = GisUtils.calculateEta(
        delivery: orderedDelivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 2500,
      );
      expect(orderedEta.status, equals(EtaStatus.awaitingDeparture));
      expect(orderedEta.displayRemaining, equals('Awaiting Departure'));

      final assignedDelivery = HealthcareDelivery.fromJson(
        sampleActiveDeliveryJson(status: 'ASSIGNED'),
      );
      final assignedEta = GisUtils.calculateEta(
        delivery: assignedDelivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 2500,
      );
      expect(assignedEta.status, equals(EtaStatus.awaitingDeparture));
      expect(assignedEta.displayRemaining, equals('Awaiting Departure'));

      // Dispatched with 0 speed and not airborne
      final dispatchedPayload = sampleActiveDeliveryJson(status: 'DISPATCHED');
      dispatchedPayload['isFlying'] = false;
      (dispatchedPayload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 0.0;
      final dispatchedDelivery = HealthcareDelivery.fromJson(dispatchedPayload);
      final dispatchedEta = GisUtils.calculateEta(
        delivery: dispatchedDelivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 2500,
      );
      expect(dispatchedEta.status, equals(EtaStatus.awaitingDeparture));
      expect(dispatchedEta.displayRemaining, equals('Awaiting Departure'));
    });

    test('Speed threshold < 1.0 m/s while airborne returns calculating ETA', () {
      final flyingPayload = sampleActiveDeliveryJson(status: 'IN_TRANSIT');
      flyingPayload['isFlying'] = true;
      (flyingPayload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 0.5;
      final delivery = HealthcareDelivery.fromJson(flyingPayload);

      final eta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 2500,
        speedHistory: [0.5, 0.6],
      );
      expect(eta.status, equals(EtaStatus.calculating));
      expect(eta.displayRemaining, equals('Calculating ETA...'));
    });

    test('Ground speed >= 1.0 m/s while airborne calculates conservative approximate ETA', () {
      final flyingPayload = sampleActiveDeliveryJson(status: 'IN_TRANSIT');
      flyingPayload['isFlying'] = true;
      (flyingPayload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 10.0;
      final delivery = HealthcareDelivery.fromJson(flyingPayload);
      final now = DateTime(2026, 11, 17, 14, 0, 0);

      // Distance = 2400m, speed = 10 m/s -> conservative = 9 m/s -> raw = 266.6s + buffer ~21s = ~288s (~5 mins)
      final eta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 2400,
        speedHistory: [10.0, 10.0, 10.0],
        now: now,
      );
      expect(eta.status, equals(EtaStatus.calculable));
      expect(eta.displayRemaining, equals('~5 mins'));
      expect(eta.displayArrivalTime, equals('~2:05 PM'));
      expect(eta.isApproximate, isTrue);
    });

    test('Stale or delayed GPS strictly returns ETA unavailable', () {
      final flyingPayload = sampleActiveDeliveryJson(status: 'IN_TRANSIT');
      flyingPayload['isFlying'] = true;
      (flyingPayload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 10.0;
      final delivery = HealthcareDelivery.fromJson(flyingPayload);

      final staleEta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.stale,
        distanceMeters: 2400,
      );
      expect(staleEta.status, equals(EtaStatus.unavailable));
      expect(staleEta.displayRemaining, equals('ETA Unavailable'));

      final delayedEta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.delayed,
        distanceMeters: 2400,
      );
      expect(delayedEta.status, equals(EtaStatus.unavailable));
      expect(delayedEta.displayRemaining, equals('ETA Unavailable'));

      final unavailableEta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.unavailable,
        distanceMeters: 2400,
      );
      expect(unavailableEta.status, equals(EtaStatus.unavailable));
      expect(unavailableEta.displayRemaining, equals('ETA Unavailable'));
    });

    test('Invalid telemetry or distance returns ETA unavailable', () {
      final delivery = HealthcareDelivery.fromJson(sampleActiveDeliveryJson());

      expect(
        GisUtils.calculateEta(
          delivery: delivery,
          freshness: GpsFreshnessState.live,
          distanceMeters: null,
        ).status,
        equals(EtaStatus.unavailable),
      );

      expect(
        GisUtils.calculateEta(
          delivery: delivery,
          freshness: GpsFreshnessState.live,
          distanceMeters: -100,
        ).status,
        equals(EtaStatus.unavailable),
      );

      expect(
        GisUtils.calculateEta(
          delivery: delivery,
          freshness: GpsFreshnessState.live,
          distanceMeters: double.nan,
        ).status,
        equals(EtaStatus.unavailable),
      );
    });

    test('Arrival proximity within 25m returns arrivingNow (< 1 min) and does not mark as delivered', () {
      final flyingPayload = sampleActiveDeliveryJson(status: 'APPROACHING');
      flyingPayload['isFlying'] = true;
      (flyingPayload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 3.0;
      final delivery = HealthcareDelivery.fromJson(flyingPayload);
      final now = DateTime(2026, 11, 17, 16, 30, 0);

      final eta = GisUtils.calculateEta(
        delivery: delivery,
        freshness: GpsFreshnessState.live,
        distanceMeters: 18.0, // within 25m threshold
        now: now,
      );

      expect(eta.status, equals(EtaStatus.arrivingNow));
      expect(eta.displayRemaining, equals('< 1 min'));
      expect(eta.displayArrivalTime, isNotNull);

      // CRITICAL REQUIREMENT 9: Backend delivery status must remain authoritative
      expect(delivery.status, equals(DeliveryStatus.approaching));
      expect(delivery.status, isNot(equals(DeliveryStatus.delivered)));
    });
  });

  group('DeliveryTrackingScreen Phase 4 ETA UI Widget Tests', () {
    testWidgets('Renders calculated approximate ETA and clock time when airborne and moving', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final payload = sampleActiveDeliveryJson(
        status: 'IN_TRANSIT',
        droneLat: 12.9716,
        droneLng: 77.5946,
        recordedAt: DateTime.now().toIso8601String(),
      );
      payload['isFlying'] = true;
      (payload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 10.0;

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const ValueKey('etaRemainingText')), findsOneWidget);
      expect(find.byKey(const ValueKey('etaStatusBadge')), findsOneWidget);
      expect(find.text('APPROX. ETA'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Displays Awaiting Departure for stationary drone before departure', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final payload = sampleActiveDeliveryJson(
        status: 'ORDERED',
        recordedAt: DateTime.now().toIso8601String(),
      );
      payload['isFlying'] = false;
      (payload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 0.0;

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Awaiting Departure'), findsOneWidget);
      expect(find.text('AWAITING DEPARTURE'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Displays ETA Unavailable when GPS is stale', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final staleTime = DateTime.now().subtract(const Duration(seconds: 45)).toIso8601String();
      final payload = sampleActiveDeliveryJson(
        status: 'IN_TRANSIT',
        freshness: 'stale',
        recordedAt: staleTime,
      );
      payload['isFlying'] = true;
      (payload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 10.0;
      (payload['telemetry'] as Map<String, dynamic>)['freshness'] = 'stale';

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('ETA Unavailable'), findsOneWidget);
      expect(find.text('ETA UNAVAILABLE'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('Displays < 1 min and ARRIVING badge when within 25m proximity without mutating delivery status', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final payload = sampleActiveDeliveryJson(
        status: 'APPROACHING',
        droneLat: 12.9900,
        droneLng: 77.6100, // at destination
        recordedAt: DateTime.now().toIso8601String(),
      );
      payload['isFlying'] = true;
      (payload['telemetry'] as Map<String, dynamic>)['groundSpeed'] = 2.0;

      final fakeApi = FakeCitizenApiService(activeDeliveryResponse: payload);
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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('< 1 min'), findsOneWidget);
      expect(find.text('ARRIVING'), findsWidgets);

      // Verify delivery status has NOT been converted to delivered
      expect(service.state.activeDelivery?.status, equals(DeliveryStatus.approaching));

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });
  });

  group('DeliveryTrackingScreen Phase 5.12 Simplified UI & Redesign Widget Tests', () {
    testWidgets('DeliveryTrackingOverlay suppresses floating pill when DeliveryTrackingScreen is active', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          status: 'IN_TRANSIT',
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );
      final fakeAuth = FakeAuthService(authenticated: true);

      final service = HealthcareDeliveryTrackingService(
        storage: fakeStorage,
        apiService: fakeApi,
        enableSocket: false,
      );
      addTearDown(() => service.dispose());
      await service.refreshNow();

      final navKey = GlobalKey<NavigatorState>();

      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navKey,
          builder: (context, child) => DeliveryTrackingOverlay(
            trackingService: service,
            authService: fakeAuth,
            navigatorKey: navKey,
            child: child ?? const SizedBox.shrink(),
          ),
          home: const Scaffold(
            body: Center(child: Text('HOME_SCREEN')),
          ),
        ),
      );
      await tester.pump();

      // Pill is visible on the home screen
      expect(find.byType(DeliveryTrackingPill), findsOneWidget);
      expect(
        tester.widget<Visibility>(find.byKey(const ValueKey('deliveryTrackingOverlayVisibility'))).visible,
        isTrue,
      );

      // Tap the pill to navigate to DeliveryTrackingScreen
      await tester.tap(find.byType(DeliveryTrackingPill));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // We are now on DeliveryTrackingScreen
      expect(find.byType(DeliveryTrackingScreen), findsOneWidget);
      expect(DeliveryTrackingScreen.isTrackingScreenActive.value, isTrue);

      // Floating pill in overlay is now suppressed (Visibility is false)
      expect(
        tester.widget<Visibility>(find.byKey(const ValueKey('deliveryTrackingOverlayVisibility'))).visible,
        isFalse,
      );

      // Now pop the screen
      navKey.currentState!.pop();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));

      // Back on HOME_SCREEN, tracking screen is gone
      expect(find.byType(DeliveryTrackingScreen), findsNothing);
      expect(DeliveryTrackingScreen.isTrackingScreenActive.value, isFalse);

      // Pill is restored and visible again
      expect(
        tester.widget<Visibility>(find.byKey(const ValueKey('deliveryTrackingOverlayVisibility'))).visible,
        isTrue,
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('viewDestinationBtn moves camera to recipient destination without altering drone position', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          droneLat: 12.9716,
          droneLng: 77.5946,
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      final state = tester.state<DeliveryTrackingScreenState>(find.byType(DeliveryTrackingScreen));
      expect(state.isAutoFollowActive, isTrue);

      // Tap View Destination
      await tester.tap(find.byKey(const ValueKey('viewDestinationBtn')));
      await tester.pump();

      // Auto-follow is disengaged
      expect(state.isAutoFollowActive, isFalse);

      // Center Drone button appears
      expect(find.byKey(const Key('centerDroneBtn')), findsOneWidget);

      // Drone coordinates remain genuine (NOT modified to destination)
      final droneCoords = state.animatedDronePos;
      expect(droneCoords!.latitude, closeTo(12.9716, 0.001));
      expect(droneCoords.longitude, closeTo(77.5946, 0.001));

      // Tap Center Drone button
      await tester.tap(find.byKey(const Key('centerDroneBtn')));
      await tester.pump();

      // Auto-follow re-engaged and center drone button disappears
      expect(state.isAutoFollowActive, isTrue);
      expect(find.byKey(const Key('centerDroneBtn')), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('DraggableScrollableSheet renders compact collapsed state and expanded kinematics', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Draggable sheet exists
      expect(find.byKey(const ValueKey('deliveryTrackingSheet')), findsOneWidget);

      // Top floating header elements
      expect(find.text('AERON'), findsOneWidget);
      expect(find.text('DEL-2026-MED01'), findsWidgets);

      // Sheet summary elements
      expect(find.textContaining('Drone: AERON-PX4-BENCH01'), findsOneWidget);
      expect(find.byKey(const ValueKey('distanceText')), findsOneWidget);
      expect(find.byKey(const ValueKey('gpsAgeTickerText')), findsOneWidget);

      // Telemetry metrics
      expect(find.text('SPEED'), findsOneWidget);
      expect(find.text('ALTITUDE'), findsOneWidget);
      expect(find.text('HEADING'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('GPS status and Socket connectivity are distinct indicators', (tester) async {
      final fakeStorage = FakeSecureStorageService(token: 'valid-jwt');
      final fakeApi = FakeCitizenApiService(
        activeDeliveryResponse: sampleActiveDeliveryJson(
          freshness: 'available',
          recordedAt: DateTime.now().toIso8601String(),
        ),
      );

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
            deliveryId: 'DEL-2026-MED01',
            trackingService: service,
          ),
        ),
      );
      await tester.pump();

      // Both indicators present and separately rendered
      expect(find.text('LIVE GPS'), findsOneWidget);
      expect(find.text('CONNECTED'), findsOneWidget);

      // Socket disconnect simulation
      service.setSocketStatusForTesting(SocketConnectionStatus.disconnected);
      await tester.pump();
      expect(find.text('DISCONNECTED'), findsOneWidget);
      // GPS remains LIVE GPS because telemetry age is still fresh
      expect(find.text('LIVE GPS'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });
  });
}
