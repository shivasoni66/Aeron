import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/main.dart';
import 'package:userapp/models/auth_user.dart';
import 'package:userapp/models/citizen_report.dart';
import 'package:userapp/models/inspection_tracking_state.dart';
import 'package:userapp/screens/report_detail_screen.dart';
import 'package:userapp/services/auth_service.dart';
import 'package:userapp/services/inspection_tracking_service.dart';
import 'package:userapp/widgets/inspection_progress_line.dart';
import 'package:userapp/widgets/live_tracking_pill.dart';

CitizenReport _buildReport({
  required String id,
  required String reportId,
  required String status,
  required int currentStage,
  String category = 'ROAD_STRUCTURAL',
  String description = 'Pavement fracture detected near Sector 4 transit route',
}) {
  return CitizenReport(
    id: id,
    reportId: reportId,
    category: category,
    description: description,
    longitude: 77.5946,
    latitude: 12.9716,
    status: status,
    currentStage: currentStage,
    earnedPoints: 25,
    submittedAt: DateTime(2026, 11, 10, 8, 30),
    reviewedAt: DateTime(2026, 11, 12, 14, 0),
  );
}

class FakeAuthService extends ChangeNotifier implements CitizenAuthService {
  bool authenticated;
  FakeAuthService({this.authenticated = true});

  @override
  bool get isAuthenticated => authenticated;

  set setAuthenticated(bool val) {
    authenticated = val;
    notifyListeners();
  }

  @override
  CitizenAuthUser? get currentUser => authenticated
      ? const CitizenAuthUser(
          id: 'cit-101',
          name: 'Jane Citizen',
          email: 'jane@aeron.org',
          role: 'citizen',
          accountStatus: 'active',
          stats: CitizenStats(civicPoints: 1280),
        )
      : null;

  @override
  bool get isLoading => false;

  @override
  Future<void> initialize() async {}

  @override
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) async =>
      {'success': true};

  @override
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async =>
      {'success': true};

  @override
  Future<bool> refresh() async => true;

  @override
  Future<void> reloadProfile() async {}

  @override
  Future<void> logout() async {
    authenticated = false;
    notifyListeners();
  }

  @override
  Future<void> logoutAll() async {
    authenticated = false;
    notifyListeners();
  }
}

void main() {
  group('Six-Stage Progress Line Component Tests', () {
    testWidgets('Renders all 6 milestone numbers and active stage label', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: InspectionProgressLine(currentStage: 3),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('LIFECYCLE STAGE 3 OF 6'), findsOneWidget);
      expect(find.text('INSPECTION SCHEDULED'), findsOneWidget);
      expect(find.text('01'), findsOneWidget);
      expect(find.text('03'), findsOneWidget);
      expect(find.text('06'), findsOneWidget);
    });

    testWidgets('Completed stages render check icons', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: InspectionProgressLine(currentStage: 4),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('LIFECYCLE STAGE 4 OF 6'), findsOneWidget);
      expect(find.text('AERIAL VERIFIED'), findsOneWidget);
      // Stages 1, 2, and 3 are completed (< 4) -> 3 check icons
      expect(find.byIcon(Icons.check), findsNWidgets(3));
    });
  });

  group('LiveTrackingPill & Overlay UI Tests', () {
    testWidgets('No capsule displayed for unauthenticated guest session', (WidgetTester tester) async {
      final fakeAuth = FakeAuthService(authenticated: false);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => false,
        customReportsFetcher: () async => [],
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      expect(find.byType(LiveTrackingPill), findsNothing);
    });

    testWidgets('Persistent button displays neutral status when no active inspection exists', (WidgetTester tester) async {
      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [],
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Entry point should be visible for authenticated citizen
      expect(find.byType(LiveTrackingPill), findsOneWidget);
      expect(find.text('INSPECTION TRACKING'), findsOneWidget);
      expect(find.text('NO ACTIVE INSPECTION'), findsOneWidget);
      expect(find.byIcon(Icons.radar_outlined), findsOneWidget);
    });

    testWidgets('Empty state expands to explain absence of Stage 3 or 4 inspections', (WidgetTester tester) async {
      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [],
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Tap neutral pill to expand
      await tester.tap(find.byType(LiveTrackingPill));
      await tester.pump();

      // Expanded card shows clear empty-state explanation
      expect(find.text('NO ACTIVE INSPECTION IN PROGRESS'), findsOneWidget);
      expect(find.textContaining('None of your submitted civic reports are currently in Stage 3'), findsOneWidget);
      expect(find.text('REFRESH STATUS'), findsOneWidget);
      expect(find.byType(InspectionProgressLine), findsNothing); // No 6-stage line for empty state

      // Collapse back
      await tester.tap(find.byIcon(Icons.keyboard_arrow_down));
      await tester.pump();

      expect(find.text('NO ACTIVE INSPECTION IN PROGRESS'), findsNothing);
      expect(find.text('NO ACTIVE INSPECTION'), findsOneWidget);
    });

    testWidgets('Displays warning state when API sync fails', (WidgetTester tester) async {
      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [],
      );

      trackingService.updateStateForTesting(
        const InspectionTrackingState(
          errorMessage: 'Connection refused by AERON gateway',
        ),
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Collapsed error pill
      expect(find.byType(LiveTrackingPill), findsOneWidget);
      expect(find.text('SYNC FAILED'), findsOneWidget);
      expect(find.byIcon(Icons.sync_problem_rounded), findsOneWidget);

      // Tap to expand error card
      await tester.tap(find.byType(LiveTrackingPill));
      await tester.pump();

      expect(find.text('UNABLE TO RETRIEVE INSPECTION STATUS'), findsOneWidget);
      expect(find.text('Connection refused by AERON gateway'), findsOneWidget);
      expect(find.text('RETRY SYNC'), findsOneWidget);
    });

    testWidgets('Capsule is visible with pulsating indicator when active Stage 3 inspection exists', (WidgetTester tester) async {
      final report = _buildReport(
        id: 'rep-01',
        reportId: 'AER-2026-1092',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
      );

      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [report],
      );

      trackingService.updateStateForTesting(
        InspectionTrackingState(
          activeReport: report,
          lastRefreshedAt: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      expect(find.byType(LiveTrackingPill), findsOneWidget);
      expect(find.text('INSPECTION TRACKING'), findsOneWidget);
      expect(find.text('AER-2026-1092'), findsOneWidget);
      expect(find.text('INSPECTION SCHEDULED'), findsOneWidget);
    });

    testWidgets('Correct stage and report ID displayed in collapsed capsule', (WidgetTester tester) async {
      final report = _buildReport(
        id: 'rep-02',
        reportId: 'AER-2026-4488',
        status: 'AERIAL_VERIFIED',
        currentStage: 4,
      );

      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [report],
      );

      trackingService.updateStateForTesting(
        InspectionTrackingState(
          activeReport: report,
          lastRefreshedAt: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      expect(find.text('AER-2026-4488'), findsOneWidget);
      expect(find.text('AERIAL VERIFIED'), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_up), findsOneWidget);
    });

    testWidgets('Expand and collapse behavior when active report is tapped', (WidgetTester tester) async {
      final report = _buildReport(
        id: 'rep-03',
        reportId: 'AER-2026-7733',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        description: 'Deep pavement depression on Main Street',
      );

      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [report],
      );

      trackingService.updateStateForTesting(
        InspectionTrackingState(
          activeReport: report,
          lastRefreshedAt: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Initially collapsed: description and action button should not be displayed
      expect(find.text('Deep pavement depression on Main Street'), findsNothing);
      expect(find.text('VIEW REPORT DETAILS'), findsNothing);

      // Tap pill to expand
      await tester.tap(find.byType(LiveTrackingPill));
      await tester.pump();

      // Now expanded: full card details visible
      expect(find.text('Deep pavement depression on Main Street'), findsOneWidget);
      expect(find.byType(InspectionProgressLine), findsOneWidget);
      expect(find.text('VIEW REPORT DETAILS'), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down), findsOneWidget);

      // Tap collapse button to return to pill
      await tester.tap(find.byIcon(Icons.keyboard_arrow_down));
      await tester.pump();

      // Collapsed again
      expect(find.text('Deep pavement depression on Main Street'), findsNothing);
      expect(find.text('VIEW REPORT DETAILS'), findsNothing);
      expect(find.byIcon(Icons.keyboard_arrow_up), findsOneWidget);
    });

    testWidgets('Navigation opens ReportDetailScreen with report details', (WidgetTester tester) async {
      final report = _buildReport(
        id: 'rep-04',
        reportId: 'AER-2026-9922',
        status: 'AERIAL_VERIFIED',
        currentStage: 4,
        description: 'Culvert drainage blockage near Sector 9',
      );

      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [report],
      );

      trackingService.updateStateForTesting(
        InspectionTrackingState(
          activeReport: report,
          lastRefreshedAt: DateTime.now(),
        ),
      );

      final navKey = GlobalKey<NavigatorState>();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Expand card
      await tester.tap(find.byType(LiveTrackingPill));
      await tester.pump();

      // Tap 'VIEW REPORT DETAILS' button
      final viewDetailsBtn = find.text('VIEW REPORT DETAILS');
      expect(viewDetailsBtn, findsOneWidget);
      await tester.tap(viewDetailsBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // ReportDetailScreen should be visible on the navigator stack
      expect(find.byType(ReportDetailScreen), findsOneWidget);
      expect(find.text('AER-2026-9922'), findsAtLeastNWidgets(1));
    });

    testWidgets('Tracking overlay remains available on pushed routes', (WidgetTester tester) async {
      final report = _buildReport(
        id: 'rep-05',
        reportId: 'AER-2026-5511',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
      );

      final fakeAuth = FakeAuthService(authenticated: true);
      final trackingService = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [report],
      );

      trackingService.updateStateForTesting(
        InspectionTrackingState(
          activeReport: report,
          lastRefreshedAt: DateTime.now(),
        ),
      );

      final navKey = GlobalKey<NavigatorState>();

      await tester.pumpWidget(
        AeronCitizenApp(
          authService: fakeAuth,
          trackingService: trackingService,
          navigatorKey: navKey,
          animatePulse: false,
          autoStartTracking: false,
        ),
      );
      await tester.pump();

      // Capsule is visible on root MainShellScreen
      expect(find.byType(LiveTrackingPill), findsOneWidget);

      // Push secondary screen onto the navigator
      navKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => const Scaffold(
            body: Center(child: Text('SECONDARY PUSHED ROUTE')),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Both the secondary route AND the persistent tracking capsule are present
      expect(find.text('SECONDARY PUSHED ROUTE'), findsOneWidget);
      expect(find.byType(LiveTrackingPill), findsOneWidget);
      expect(find.text('AER-2026-5511'), findsOneWidget);
    });
  });
}
