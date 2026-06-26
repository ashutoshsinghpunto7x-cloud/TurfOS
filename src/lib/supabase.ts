import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// expo-secure-store is native-only — use AsyncStorage on web
const buildStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem:    (key: string) => AsyncStorage.getItem(key),
      setItem:    (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    };
  }

  // Native: SecureStore for small values, AsyncStorage for large (>2KB)
  // IMPORTANT: always clear the OTHER store on write/delete to prevent
  // stale tokens being returned after a refresh changes the value size.
  const SecureStore = require('expo-secure-store');
  return {
    getItem: async (key: string) => {
      try {
        const secureValue = await SecureStore.getItemAsync(key);
        if (secureValue !== null) return secureValue;
      } catch {}
      return AsyncStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
      if (value.length < 2000) {
        await SecureStore.setItemAsync(key, value);
        await AsyncStorage.removeItem(key);          // clear stale AsyncStorage copy
      } else {
        await AsyncStorage.setItem(key, value);
        try { await SecureStore.deleteItemAsync(key); } catch {}  // clear stale SecureStore copy
      }
    },
    removeItem: async (key: string) => {
      try { await SecureStore.deleteItemAsync(key); } catch {}
      await AsyncStorage.removeItem(key);
    },
  };
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: buildStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});