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
