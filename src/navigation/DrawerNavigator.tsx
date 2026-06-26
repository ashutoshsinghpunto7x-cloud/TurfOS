import React from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { colors } from '../theme/theme';
import { signOut } from '../services/authService';
import { useStore } from '../store/useStore';

import TabNavigator from './TabNavigator';

import CustomersScreen from '../screens/CustomersScreen';
import CreditScreen from '../screens/CreditScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PendingApprovalsScreen from '../screens/PendingApprovalsScreen';
import BillScreen from '../screens/BillScreen';
import DayBookingsScreen from '../screens/DayBookingsScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import CouponManagementScreen from '../screens/CouponManagementScreen';
import PastBookingsScreen     from '../screens/PastBookingsScreen';

// ✅ NEW TOURNAMENT SCREENS
import TournamentsScreen from '../screens/TournamentsScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import MatchScoringScreen from '../screens/MatchScoringScreen';

export type DrawerParamList = {
  OwnerDrawer:  undefined;
  Customers:    undefined;
  Credit:       undefined;
  Reports:      undefined;
  Settings:     undefined;
  PendingApprovals: undefined;
  PastBookings: undefined;

  Bill: {
    bookingId: string;
  };

  DayBookings: {
    isoDate: string;
    label: string;
  };

  BookingDetail: {
    bookingId: string;
  };

  Coupons: undefined;

  // ✅ NEW TOURNAMENT ROUTES
  Tournaments: undefined;

  TournamentDetail: {
    tournamentId: string;
  };

  MatchScoring: {
    matchId: string;
  };
};

const Drawer = createDrawerNavigator<DrawerParamList>();
const Stack = createNativeStackNavigator<DrawerParamList>();

function CustomDrawerContent(props: any) {
  const { profile, setProfile } = useStore();

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingTop: 0 }}
    >
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={{ fontSize: 22 }}>⚽</Text>
        </View>

        <Text style={styles.appName}>Playbox</Text>

        <Text style={styles.role}>
          {profile?.full_name ?? 'Owner'} · {profile?.role ?? 'owner'}
        </Text>
      </View>

      <DrawerItemList {...props} />

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

/**
 * ✅ DRAWER CONTENT
 */
function OwnerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.text2,
        drawerActiveBackgroundColor: colors.accent2,
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 280,
        },
        drawerLabelStyle: {
          fontWeight: '600',
          fontSize: 14,
        },
      }}
    >
      <Drawer.Screen
        name="Tabs"
        component={TabNavigator}
        options={{
          title: 'Home',
          drawerIcon: () => <Text>🏠</Text>,
        }}
      />

      <Drawer.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          drawerIcon: () => <Text>👥</Text>,
        }}
      />

      <Drawer.Screen
        name="Credit"
        component={CreditScreen}
        options={{
          title: 'Credit Ledger',
          drawerIcon: () => <Text>💳</Text>,
        }}
      />

      <Drawer.Screen
        name="PendingApprovals"
        component={PendingApprovalsScreen}
        options={{
          title: 'Pending Approvals',
          drawerIcon: () => <Text>📋</Text>,
        }}
      />

      <Drawer.Screen
        name="Coupons"
        component={CouponManagementScreen}
        options={{
          title: 'Coupon Codes',
          drawerIcon: () => <Text>🏷️</Text>,
        }}
      />

      <Drawer.Screen
        name="PastBookings"
        component={PastBookingsScreen}
        options={{
          title: 'Past Bookings',
          drawerIcon: () => <Text>📂</Text>,
        }}
      />

      {/* ✅ NEW TOURNAMENTS DRAWER SCREEN */}
      <Drawer.Screen
        name="Tournaments"
        component={TournamentsScreen}
        options={{
          title: 'Tournaments',
          drawerIcon: () => <Text>🏆</Text>,
        }}
      />

      {/* HIDDEN DRAWER ROUTES */}

      <Drawer.Screen
        name="Bill"
        component={BillScreen}
        options={{
          title: 'Bill',
          drawerIcon: () => <Text>🧾</Text>,
          drawerItemStyle: { display: 'none' },
        }}
      />

      <Drawer.Screen
        name="DayBookings"
        component={DayBookingsScreen}
        options={{
          title: 'Day Bookings',
          drawerIcon: () => <Text>📅</Text>,
          drawerItemStyle: { display: 'none' },
        }}
      />

      <Drawer.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{
          title: 'Booking Detail',
          drawerIcon: () => <Text>📋</Text>,
          drawerItemStyle: { display: 'none' },
        }}
      />

      {/* ✅ HIDDEN TOURNAMENT DETAIL SCREEN */}
      <Drawer.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={{
          title: 'Tournament Detail',
          drawerIcon: () => <Text>🏆</Text>,
          drawerItemStyle: { display: 'none' },
        }}
      />

      {/* ✅ HIDDEN MATCH SCORING SCREEN */}
      <Drawer.Screen
        name="MatchScoring"
        component={MatchScoringScreen}
        options={{
          title: 'Match Scoring',
          drawerIcon: () => <Text>🏏</Text>,
          drawerItemStyle: { display: 'none' },
        }}
      />

      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          drawerIcon: () => <Text>📊</Text>,
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: () => <Text>⚙️</Text>,
        }}
      />
    </Drawer.Navigator>
  );
}

/**
 * ✅ ROOT STACK
 * Hidden screens are handled here programmatically
 */
export default function DrawerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerDrawer" component={OwnerDrawer} />

      {/* OPTIONAL STACK ACCESS */}
      <Stack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
      />

      <Stack.Screen
        name="MatchScoring"
        component={MatchScoringScreen}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.dark,
    padding: 24,
    paddingTop: 52,
    paddingBottom: 24,
  },

  logoBox: {
    width: 48,
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },

  role: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'capitalize',
  },

  footer: {
    padding: 24,
    marginTop: 'auto',
  },

  signOut: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
});