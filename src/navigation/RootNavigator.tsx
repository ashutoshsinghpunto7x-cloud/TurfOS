import React, { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useStore } from '../store/useStore';
import { getExistingSession, getProfileByUserId } from '../services/authService';
import { supabase } from '../lib/supabase';
import { recoverPendingPayment } from '../services/pendingPaymentRecovery';

import WelcomeScreen          from '../screens/WelcomeScreen';
import LoginScreen            from '../screens/LoginScreen';
import SignupScreen            from '../screens/SignupScreen';
import CompleteProfileScreen  from '../screens/CompleteProfileScreen';

// Lazy-load each role's screen tree as its own bundle chunk. Without this,
// EVERY visitor — including a customer who only ever sees CustomerNavigator —
// downloads and parses the owner's entire admin dashboard (reports, POS,
// inventory, attendance, coupons, tournaments, ...) and the staff tree too,
// before the login screen can even render. These three branches are mutually
// exclusive by role, so splitting them is pure win with no UX downside.
const DrawerNavigator        = React.lazy(() => import('./DrawerNavigator'));
const StaffNavigator         = React.lazy(() => import('./StaffNavigator'));
const CustomerNavigator      = React.lazy(() => import('./CustomerNavigator'));
const BookingDetailScreen    = React.lazy(() => import('../screens/BookingDetailScreen'));
const NewBookingScreen       = React.lazy(() => import('../screens/NewBookingScreen'));
const CustomerDetailScreen   = React.lazy(() => import('../screens/CustomerDetailScreen'));

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

const BootSpinner = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3FF' }}>
    <ActivityIndicator color="#7C4DFF" size="large" />
  </View>
);

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

  // Recover from a client crash/reload that happened mid-payment (see
  // pendingPaymentRecovery.ts) — runs once per app boot, after auth has
  // settled, so a customer who gets dumped back to a crashed/blank tab right
  // after paying sees a real answer next time the app opens instead of
  // silence. No-ops instantly if there's nothing to recover.
  useEffect(() => {
    if (booting || !profile?.id) return;
    let cancelled = false;
    (async () => {
      const result = await recoverPendingPayment();
      if (cancelled || !result) return;
      const { status } = result;
      if (status === 'approved') {
        Alert.alert('✓ Booking Confirmed', 'Good news — your last booking payment went through and your slot is confirmed.');
      } else if (status === 'rejected') {
        Alert.alert('Booking Not Confirmed', 'Your last payment could not be matched to a confirmed slot. If you were charged, contact support and we\'ll sort it out.');
      } else {
        // 'pending' or 'unknown' — still resolvable server-side (manual review
        // or the webhook hasn't landed yet). Don't alarm the user; keep it light.
        Alert.alert('Checking Your Last Booking', 'Your last payment is still being confirmed. Check your Bookings tab shortly — if it doesn\'t show up, contact support.');
      }
    })();
    return () => { cancelled = true; };
  }, [booting, profile?.id]);

  if (booting) {
    return <BootSpinner />;
  }

  return (
    <NavigationContainer>
      {/* Suspense boundary for the lazy-loaded role trees above — the same
          spinner used while auth is booting doubles as the "loading this
          role's screens" fallback, so there's no jarring UI swap. */}
      <Suspense fallback={<BootSpinner />}>
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
      </Suspense>
    </NavigationContainer>
  );
}