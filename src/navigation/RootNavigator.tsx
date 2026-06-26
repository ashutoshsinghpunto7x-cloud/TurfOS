import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useStore } from '../store/useStore';
import { getExistingSession, getProfileByUserId } from '../services/authService';
import { supabase } from '../lib/supabase';

import WelcomeScreen          from '../screens/WelcomeScreen';
import LoginScreen            from '../screens/LoginScreen';
import SignupScreen            from '../screens/SignupScreen';
import CompleteProfileScreen  from '../screens/CompleteProfileScreen';
import DrawerNavigator        from './DrawerNavigator';
import StaffNavigator         from './StaffNavigator';
import CustomerNavigator      from './CustomerNavigator';
import BookingDetailScreen    from '../screens/BookingDetailScreen';
import NewBookingScreen       from '../screens/NewBookingScreen';
import CustomerDetailScreen   from '../screens/CustomerDetailScreen';

export type RootStackParamList = {
  Welcome:         undefined;
  Login:           undefined;
  Signup:          undefined;
  CompleteProfile: undefined;
  OwnerMain:       undefined;
  StaffMain:       undefined;
  CustomerMain:    undefined;
  BookingDetail:   { bookingId: string };
  NewBooking:      undefined;
  CustomerDetail:  { customerId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { profile, profileMissing, setProfile, isOwnerOrAdmin } = useStore();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let booted = false;
    const finish = () => { if (!booted) { booted = true; setBooting(false); } };

    // onAuthStateChange fires immediately with INITIAL_SESSION from local storage
    // — no network call, no waiting for token refresh. Token refresh happens
    // silently in background via TOKEN_REFRESHED (we skip profile fetch there,
    // the profile doesn't change on token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setProfile(null);
          useStore.setState({ profileMissing: false });
          finish();
          return;
        }
        if (event === 'TOKEN_REFRESHED') {
          // Token silently refreshed — profile unchanged, just unblock boot if
          // INITIAL_SESSION somehow never fired.
          finish();
          return;
        }
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          try {
            const restored = await getProfileByUserId(session.user.id);
            if (restored) {
              setProfile(restored);
            } else {
              // Only mark profileMissing on SIGNED_IN (fresh login with no profile).
              // On INITIAL_SESSION a network failure returns null — treat as
              // unauthenticated so the user lands on Welcome, not CompleteProfile.
              if (event === 'SIGNED_IN') useStore.setState({ profileMissing: true });
              else setProfile(null);
            }
          } catch {
            // Network error on restore — send to Welcome, not CompleteProfile
            setProfile(null);
          }
          finish();
        }
      },
    );

    // Safety: if auth state never fires (edge case), unblock after 3 s
    const timeout = setTimeout(finish, 3000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  if (booting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3FF' }}>
        <ActivityIndicator color="#7C4DFF" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {!profile && !profileMissing ? (
          // ── Unauthenticated — Welcome → Login / Signup ────────────────
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login"   component={LoginScreen}   />
            <Stack.Screen name="Signup"  component={SignupScreen}  />
          </>

        ) : profileMissing ? (
          // ── Logged in but no role profile ─────────────────────────────
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />

        ) : isOwnerOrAdmin() ? (
          // ── Owner / Admin ──────────────────────────────────────────────
          <>
            <Stack.Screen name="OwnerMain"      component={DrawerNavigator}     />
            <Stack.Screen name="BookingDetail"  component={BookingDetailScreen} />
            <Stack.Screen name="NewBooking"     component={NewBookingScreen}    />
            <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen}/>
          </>

        ) : profile?.role === 'customer' ? (
          // ── Customer ──────────────────────────────────────────────────
          <Stack.Screen name="CustomerMain" component={CustomerNavigator} />

        ) : (
          // ── Staff ─────────────────────────────────────────────────────
          <Stack.Screen name="StaffMain" component={StaffNavigator} />
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}