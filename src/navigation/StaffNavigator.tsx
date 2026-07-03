import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StaffDashboardScreen from '../screens/StaffDashboardScreen';
import StaffBookingScreen from '../screens/StaffBookingScreen';
import StaffSalesScreen from '../screens/StaffSalesScreen';
import InventoryScreen from '../screens/InventoryScreen';
import CreditScreen from '../screens/CreditScreen';
import BillScreen from '../screens/BillScreen';
import PendingApprovalsScreen from '../screens/PendingApprovalsScreen';
import PastBookingsScreen from '../screens/PastBookingsScreen';
import StaffAllBookingsScreen from '../screens/StaffAllBookingsScreen';

export type StaffStackParamList = {
  StaffDashboard: undefined;
  StaffBooking: undefined;
  StaffSales:
    | {
        bookingId?: string;
        bookingCustomer?: string;
      }
    | undefined;
  StaffInventory: undefined;
  StaffCredit: undefined;
  Bill: {
    bookingId: string;
  };
  PendingApprovals: undefined;
  PastBookings: undefined;
  AllBookings: undefined;
};

const Stack = createNativeStackNavigator<StaffStackParamList>();

export default function StaffNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
      />

      <Stack.Screen
        name="StaffBooking"
        component={StaffBookingScreen}
      />

      <Stack.Screen
        name="StaffSales"
        component={StaffSalesScreen}
      />

      <Stack.Screen
        name="StaffInventory"
        component={InventoryScreen}
      />

      <Stack.Screen
        name="StaffCredit"
        component={CreditScreen}
      />

      <Stack.Screen
        name="Bill"
        component={BillScreen}
      />

      <Stack.Screen
        name="PendingApprovals"
        component={PendingApprovalsScreen}
      />

      <Stack.Screen
        name="PastBookings"
        component={PastBookingsScreen}
      />

      <Stack.Screen
        name="AllBookings"
        component={StaffAllBookingsScreen}
      />
    </Stack.Navigator>
  );
}