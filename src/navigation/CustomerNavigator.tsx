import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomerDashboardScreen from '../screens/CustomerDashboardScreen';
import CustomerBookingScreen   from '../screens/CustomerBookingScreen';
import BillScreen              from '../screens/BillScreen';
import CustomerLiveScoringScreen from '../screens/CustomerLiveScoringScreen';
import MatchScoringScreen from '../screens/MatchScoringScreen';

export type CustomerStackParamList = {
  CustomerDashboard: undefined;
  CustomerBooking:   undefined;
  Bill: { bookingId: string };
  CustomerLiveScoring: undefined;
  MatchScoring: { fixtureId: string; tournamentId: string };
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerDashboard" component={CustomerDashboardScreen} />
      <Stack.Screen name="CustomerBooking"   component={CustomerBookingScreen}   />
      <Stack.Screen name="Bill"              component={BillScreen}              />
      <Stack.Screen name="CustomerLiveScoring" component={CustomerLiveScoringScreen} />
<Stack.Screen name="MatchScoring" component={MatchScoringScreen} />
    </Stack.Navigator>
  );
}