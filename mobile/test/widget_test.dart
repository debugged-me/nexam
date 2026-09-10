import 'package:flutter_test/flutter_test.dart';

import 'package:nexam_omr/app/app.dart';

void main() {
  testWidgets('App builds without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const NexamOmrApp());
    // The app will show a loading indicator during bootstrap.
    expect(find.byType(NexamOmrApp), findsOneWidget);
  });
}
