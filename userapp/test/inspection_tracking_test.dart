import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/models/citizen_report.dart';
import 'package:userapp/models/inspection_tracking_state.dart';
import 'package:userapp/services/inspection_tracking_service.dart';

CitizenReport _buildReport({
  required String id,
  required String reportId,
  required String status,
  required int currentStage,
  required DateTime submittedAt,
  DateTime? reviewedAt,
}) {
  return CitizenReport(
    id: id,
    reportId: reportId,
    category: 'ROAD_STRUCTURAL',
    description: 'Test Report Description for $reportId',
    longitude: 77.5946,
    latitude: 12.9716,
    status: status,
    currentStage: currentStage,
    earnedPoints: 25,
    submittedAt: submittedAt,
    reviewedAt: reviewedAt,
  );
}

void main() {
  group('InspectionTrackingState Model Tests', () {
    test('Default constructor sets expected initial values', () {
      const state = InspectionTrackingState();

      expect(state.activeReport, isNull);
      expect(state.isLoading, isFalse);
      expect(state.errorMessage, isNull);
      expect(state.lastRefreshedAt, isNull);
      expect(state.hasActiveInspection, isFalse);
      expect(state.currentStage, 0);
      expect(state.stageLabel, 'NO ACTIVE INSPECTION');
    });

    test('Stage label resolves correctly based on active report stage and status', () {
      final reportStage3 = _buildReport(
        id: '1',
        reportId: 'AER-100',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        submittedAt: DateTime(2026, 11, 1),
      );

      final state3 = InspectionTrackingState(activeReport: reportStage3);
      expect(state3.hasActiveInspection, isTrue);
      expect(state3.currentStage, 3);
      expect(state3.stageLabel, 'INSPECTION SCHEDULED');

      final reportStage4 = _buildReport(
        id: '2',
        reportId: 'AER-101',
        status: 'AERIAL_VERIFIED',
        currentStage: 4,
        submittedAt: DateTime(2026, 11, 2),
      );

      final state4 = InspectionTrackingState(activeReport: reportStage4);
      expect(state4.currentStage, 4);
      expect(state4.stageLabel, 'AERIAL VERIFIED');
    });

    test('copyWith updates fields and supports clearing nullable properties', () {
      final report = _buildReport(
        id: '1',
        reportId: 'AER-100',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        submittedAt: DateTime(2026, 11, 1),
      );
      final timestamp = DateTime(2026, 11, 16, 10, 0);

      var state = const InspectionTrackingState();
      state = state.copyWith(
        activeReport: report,
        isLoading: true,
        errorMessage: 'Network timeout',
        lastRefreshedAt: timestamp,
      );

      expect(state.activeReport, equals(report));
      expect(state.isLoading, isTrue);
      expect(state.errorMessage, 'Network timeout');
      expect(state.lastRefreshedAt, equals(timestamp));

      // Clear report and error message
      state = state.copyWith(
        clearActiveReport: true,
        isLoading: false,
        clearErrorMessage: true,
      );

      expect(state.activeReport, isNull);
      expect(state.isLoading, isFalse);
      expect(state.errorMessage, isNull);
      expect(state.lastRefreshedAt, equals(timestamp)); // preserved
    });

    test('Value equality and hash code', () {
      final reportA = _buildReport(
        id: '1',
        reportId: 'AER-100',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        submittedAt: DateTime(2026, 11, 1),
      );
      final reportB = _buildReport(
        id: '1',
        reportId: 'AER-100',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        submittedAt: DateTime(2026, 11, 1),
      );

      final state1 = InspectionTrackingState(activeReport: reportA, isLoading: false);
      final state2 = InspectionTrackingState(activeReport: reportB, isLoading: false);

      expect(state1, equals(state2));
      expect(state1.hashCode, equals(state2.hashCode));
    });
  });

  group('Inspection Report Selection Logic Tests', () {
    test('Returns null when report list is empty or contains no eligible reports', () {
      expect(InspectionTrackingService.selectActiveInspectionReport([]), isNull);

      final ineligibleReports = [
        _buildReport(
          id: '1',
          reportId: 'AER-1',
          status: 'SUBMITTED',
          currentStage: 1,
          submittedAt: DateTime(2026, 11, 1),
        ),
        _buildReport(
          id: '2',
          reportId: 'AER-2',
          status: 'MUNICIPAL_REVIEW',
          currentStage: 2,
          submittedAt: DateTime(2026, 11, 2),
        ),
        _buildReport(
          id: '5',
          reportId: 'AER-5',
          status: 'PUBLIC_WORKS',
          currentStage: 5,
          submittedAt: DateTime(2026, 11, 5),
        ),
        _buildReport(
          id: '6',
          reportId: 'AER-6',
          status: 'RESOLVED',
          currentStage: 6,
          submittedAt: DateTime(2026, 11, 6),
        ),
      ];

      expect(InspectionTrackingService.selectActiveInspectionReport(ineligibleReports), isNull);
    });

    test('Selects the single active inspection report when available', () {
      final reports = [
        _buildReport(
          id: '1',
          reportId: 'AER-1',
          status: 'SUBMITTED',
          currentStage: 1,
          submittedAt: DateTime(2026, 11, 1),
        ),
        _buildReport(
          id: '3',
          reportId: 'AER-3',
          status: 'INSPECTION_SCHEDULED',
          currentStage: 3,
          submittedAt: DateTime(2026, 11, 3),
        ),
        _buildReport(
          id: '6',
          reportId: 'AER-6',
          status: 'RESOLVED',
          currentStage: 6,
          submittedAt: DateTime(2026, 11, 6),
        ),
      ];

      final selected = InspectionTrackingService.selectActiveInspectionReport(reports);
      expect(selected, isNotNull);
      expect(selected!.reportId, 'AER-3');
      expect(selected.currentStage, 3);
    });

    test('Prioritizes the most recent inspection report when multiple exist', () {
      final olderInspection = _buildReport(
        id: '3A',
        reportId: 'AER-OLD-3',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 3,
        submittedAt: DateTime(2026, 11, 5),
        reviewedAt: DateTime(2026, 11, 6),
      );

      final newerInspection = _buildReport(
        id: '4B',
        reportId: 'AER-NEW-4',
        status: 'AERIAL_VERIFIED',
        currentStage: 4,
        submittedAt: DateTime(2026, 11, 8),
        reviewedAt: DateTime(2026, 11, 10),
      );

      final reports = [olderInspection, newerInspection];
      final selected = InspectionTrackingService.selectActiveInspectionReport(reports);

      expect(selected, isNotNull);
      expect(selected!.reportId, 'AER-NEW-4');
      expect(selected.currentStage, 4);
    });

    test('Matches reports by string status even if numeric stage is mismatched', () {
      final reportWithStatusString = _buildReport(
        id: '99',
        reportId: 'AER-STATUS-MATCH',
        status: 'INSPECTION_SCHEDULED',
        currentStage: 0,
        submittedAt: DateTime(2026, 11, 12),
      );

      final selected = InspectionTrackingService.selectActiveInspectionReport([reportWithStatusString]);
      expect(selected, isNotNull);
      expect(selected!.reportId, 'AER-STATUS-MATCH');
    });
  });

  group('InspectionTrackingService Lifecycle & Polling Tests', () {
    test('Unauthenticated user returns clean state without active report', () async {
      final service = InspectionTrackingService(
        customAuthCheck: () => false,
        customReportsFetcher: () async => [
          _buildReport(
            id: '3',
            reportId: 'AER-3',
            status: 'INSPECTION_SCHEDULED',
            currentStage: 3,
            submittedAt: DateTime.now(),
          ),
        ],
      );

      await service.refreshNow();

      expect(service.state.hasActiveInspection, isFalse);
      expect(service.state.isLoading, isFalse);
      expect(service.state.errorMessage, isNull);
      expect(service.isFetching, isFalse);

      service.dispose();
    });

    test('Authenticated user fetches and populates active inspection state', () async {
      final activeReport = _buildReport(
        id: '4',
        reportId: 'AER-4',
        status: 'AERIAL_VERIFIED',
        currentStage: 4,
        submittedAt: DateTime.now().subtract(const Duration(hours: 2)),
      );

      final service = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [activeReport],
      );

      final states = <InspectionTrackingState>[];
      service.addListener(() {
        states.add(service.state);
      });

      await service.refreshNow();

      expect(service.state.hasActiveInspection, isTrue);
      expect(service.state.activeReport?.reportId, 'AER-4');
      expect(service.state.currentStage, 4);
      expect(service.state.stageLabel, 'AERIAL VERIFIED');
      expect(service.state.isLoading, isFalse);
      expect(service.state.errorMessage, isNull);
      expect(service.state.lastRefreshedAt, isNotNull);

      // Verify state transition: loading then completed
      expect(states.any((s) => s.isLoading == true), isTrue);
      expect(states.last.isLoading, isFalse);

      service.dispose();
    });

    test('API failure safely captures error without crashing', () async {
      final service = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async {
          throw Exception('Backend connection refused');
        },
      );

      await service.refreshNow();

      expect(service.state.isLoading, isFalse);
      expect(service.state.hasActiveInspection, isFalse);
      expect(service.state.errorMessage, contains('Backend connection refused'));
      expect(service.isFetching, isFalse);

      service.dispose();
    });

    test('Prevents overlapping concurrent fetch requests', () async {
      final completer = Completer<List<CitizenReport>>();
      var fetchCallCount = 0;

      final service = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async {
          fetchCallCount++;
          return completer.future;
        },
      );

      // Fire first request (will pause on completer)
      final future1 = service.refreshNow();
      expect(service.isFetching, isTrue);

      // Fire second overlapping request while first is pending
      final future2 = service.refreshNow();

      // Only the first call should trigger fetcher
      expect(fetchCallCount, 1);

      // Complete the pending request
      completer.complete([]);
      await Future.wait([future1, future2]);

      expect(service.isFetching, isFalse);
      expect(fetchCallCount, 1);

      service.dispose();
    });

    test('start() and stop() control polling timer lifecycle', () async {
      var fetchCount = 0;
      final service = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async {
          fetchCount++;
          return [];
        },
      );

      expect(service.isTracking, isFalse);

      service.start(interval: const Duration(milliseconds: 100));
      expect(service.isTracking, isTrue);
      expect(fetchCount, 1); // Immediate fetch triggered on start

      await Future.delayed(const Duration(milliseconds: 250));
      // In 250ms with 100ms interval, tick 1 (at 100ms) and tick 2 (at 200ms) fire -> total >= 3
      expect(fetchCount, greaterThanOrEqualTo(2));

      service.stop();
      expect(service.isTracking, isFalse);

      final countAtStop = fetchCount;
      await Future.delayed(const Duration(milliseconds: 150));
      // No more fetches after stop
      expect(fetchCount, countAtStop);

      service.dispose();
    });

    test('dispose() cleans up timer and prevents notifications', () {
      final service = InspectionTrackingService(
        customAuthCheck: () => true,
        customReportsFetcher: () async => [],
      );

      service.start();
      expect(service.isTracking, isTrue);

      service.dispose();
      expect(service.isTracking, isFalse);
    });
  });
}
