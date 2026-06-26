import '@expo/metro-runtime';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';
import RootNavigator from './src/navigation/RootNavigator';

function useOTAUpdate() {
  useEffect(() => {
    // Skip in development builds — Updates API only works in production
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    async function checkAndPrompt() {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;

        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        Alert.alert(
          'Update Available',
          'A new version of Playbox has been downloaded. Restart now to apply it.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
          ],
          { cancelable: true },
        );
      } catch {
        // Update check failed silently — user keeps running current version
      }
    }

    // Small delay so the app finishes rendering before network call
    const t = setTimeout(checkAndPrompt, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
}

export default function App() {
  useOTAUpdate();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
