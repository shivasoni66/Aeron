import 'package:flutter_test/flutter_test.dart';
import 'package:userapp/main.dart';

void main() {
  testWidgets('AeronCitizenApp builds and renders header', (WidgetTester tester) async {
    await tester.pumpWidget(const AeronCitizenApp());
    expect(find.text('AERON'), findsOneWidget);
    expect(find.text('SEC-NORM'), findsOneWidget);
    expect(find.text('1,280 PTS'), findsOneWidget);
  });
}
