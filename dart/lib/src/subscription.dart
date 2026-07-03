class AfterLinkSubscription {
  final String topic;
  final Function(Map<String, dynamic>) callback;
  final Future<void> Function() onCancel;

  AfterLinkSubscription({
    required this.topic,
    required this.callback,
    required this.onCancel,
  });

  Future<void> cancel() async {
    await onCancel();
  }
}
