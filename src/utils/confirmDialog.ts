import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm dialog.
 *
 * React Native Web's Alert.alert() is a no-op (see react-native-web's
 * Alert implementation — it does nothing at all), so any confirm/cancel
 * flow built on Alert.alert (e.g. "Sign Out — Are you sure?") silently
 * does nothing on web: no dialog appears and the confirm button's
 * onPress never fires. This falls back to window.confirm on web so the
 * action still runs after the user confirms.
 */
export function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'OK',
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Cross-platform informational alert (single "OK" dismissal, no branching
 * logic on the user's response).
 *
 * Same root cause as confirmDialog above — React Native Web's Alert.alert()
 * is a no-op — but this covers the far more common case in this codebase:
 * a plain `Alert.alert(title, message)` used to tell the user something
 * (payment succeeded/failed, validation errors, etc.) rather than to ask
 * for confirmation. On web that call currently does nothing at all, so the
 * user gets no feedback — most noticeably right after a Razorpay payment
 * redirects back into the app (see RootNavigator.tsx and
 * BookingRequestModal.tsx), where silence reads as the flow being broken.
 */
export function infoDialog(title: string, message: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }

  Alert.alert(title, message);
}
