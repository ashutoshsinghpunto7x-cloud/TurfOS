import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { colors, radius } from '../theme/theme';
import { weekRevenue, weekLabels } from '../data/mockData';

const PERIODS = ['This Week', 'This Month', 'Last Month'];

export default function ReportsScreen() {
  const { transactions, bookings, inventory } = useStore();
  const [period, setPeriod] = useState('This Week');

  const posRevenue = transactions.filter((t) => !t.undone).reduce((a, t) => a + t.total, 0);
  const bookingRevenue = bookings.filter((b) => b.paid).reduce((a, b) => a + b.amount, 0);
  const totalRevenue = weekRevenue.reduce((a, b) => a + b, 0);
  const maxR = Math.max(...weekRevenue);

  const summaryCards = [
    { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰', color: colors.accent },
    { label: 'Bookings Revenue', value: `₹${bookingRevenue}`, icon: '📅', color: colors.info },
    { label: 'POS Revenue', value: `₹${posRevenue}`, icon: '🛒', color: colors.warn },
    { label: 'Transactions', value: `${transactions.filter((t) => !t.undone).length}`, icon: '🧾', color: colors.accent },
    { label: 'Undone Sales', value: `${transactions.filter((t) => t.undone).length}`, icon: '↩️', color: colors.danger },
    { label: 'Low Stock Items', value: `${inventory.filter((i) => i.stock <= i.minStock).length}`, icon: '📦', color: colors.warn },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Period Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p} style={[styles.pill, period === p && styles.pillActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.pillText, period === p && styles.pillTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenue — {period}</Text>
          <Text style={styles.chartTotal}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
          <View style={styles.barRow}>
            {weekRevenue.map((v, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barVal}>₹{(v / 1000).toFixed(1)}k</Text>
                <View style={[styles.bar, { height: Math.round((v / maxR) * 100), backgroundColor: i === 6 ? colors.accent : colors.accent2, borderWidth: i === 6 ? 0 : 1, borderColor: colors.border }]} />
                <Text style={styles.barLabel}>{weekLabels[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</Text>
              <Text style={[styles.summaryVal, { color: card.color }]}>{card.value}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Top items */}
        <Text style={styles.sectionTitle}>Top Selling Items</Text>
        <View style={styles.listCard}>
          {[
            { name: 'Tea', sold: 48, revenue: 960 },
            { name: 'Coffee', sold: 32, revenue: 960 },
            { name: 'Water Bottle', sold: 29, revenue: 725 },
            { name: 'Energy Drink', sold: 12, revenue: 960 },
          ].map((item, i) => (
            <View key={item.name} style={[styles.topRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemRevenue}>₹{item.revenue}</Text>
                <Text style={styles.itemSold}>{item.sold} sold</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  pillRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text2 },
  pillTextActive: { color: '#fff' },
  chartCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 4 },
  chartTitle: { fontSize: 12, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartTotal: { fontSize: 28, fontWeight: '800', color: colors.text, marginVertical: 8, fontVariant: ['tabular-nums'] },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6, marginTop: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barVal: { fontSize: 9, color: colors.text3, fontVariant: ['tabular-nums'] },
  barLabel: { fontSize: 10, color: colors.text3, fontWeight: '500' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
  summaryCard: { width: '47%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16 },
  summaryVal: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 12, color: colors.text3, marginTop: 2, fontWeight: '500' },
  listCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rank: { fontSize: 13, fontWeight: '700', color: colors.text3, width: 24 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  itemRevenue: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  itemSold: { fontSize: 11, color: colors.text3 },
});