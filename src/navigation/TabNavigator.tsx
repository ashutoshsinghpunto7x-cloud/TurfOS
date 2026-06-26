import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Calendar, ShoppingCart, Package } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen  from '../screens/CalendarScreen';
import POSScreen       from '../screens/POSScreen';
import InventoryScreen from '../screens/InventoryScreen';

const Tab = createBottomTabNavigator();

const PURPLE  = '#8B5CF6';
const PILL_BG = 'rgba(139,92,246,0.16)';
const INACT   = 'rgba(255,255,255,0.35)';
const BAR_BG  = '#0C0A1A';

const TAB_ICONS: Record<string, React.ElementType> = {
  Dashboard: Home,
  Calendar:  Calendar,
  POS:       ShoppingCart,
  Inventory: Package,
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Dashboard',
  Calendar:  'Bookings',
  POS:       'POS',
  Inventory: 'Inventory',
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tb.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const active = state.index === index;
        const Icon   = TAB_ICONS[route.name] ?? Home;
        const label  = TAB_LABELS[route.name] ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} style={tb.tab} onPress={onPress} activeOpacity={0.7}>
            <View style={[tb.pill, active && tb.pillActive]}>
              <Icon size={20} color={active ? PURPLE : INACT} />
              <Text style={[tb.label, active && tb.labelActive]}>{label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar:        { flexDirection: 'row', backgroundColor: BAR_BG, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, paddingHorizontal: 8 },
  tab:        { flex: 1, alignItems: 'center' },
  pill:       { alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, minWidth: 64 },
  pillActive: { backgroundColor: PILL_BG },
  label:      { fontSize: 10, fontWeight: '600', color: INACT },
  labelActive:{ color: PURPLE, fontWeight: '700' },
});

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar"  component={CalendarScreen} />
      <Tab.Screen name="POS"       component={POSScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
    </Tab.Navigator>
  );
}
