import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { colors, radius, font, spacing, statusConfig } from '../theme/theme';
import { fetchBookingsByPeriod, BookingPeriod, PeriodBooking } from '../services/bookingService';

// ── Filters ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['All', 'Confirmed', 'Completed', 'Cancelled', 'Pending'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const TABS: { key: BookingPeriod; label: string }[] = [
  { key: 'past',     label: 'Past' },
  { key: 'today',    label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
];

// ── Booking card ───────────────────────────────────────────────────────────

function BookingCard({ item }: { item: PeriodBooking }) {
  const sc = statusConfig[item.status] ?? statusConfig.Confirmed;
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Text style={s.customerName}>{item.customer}</Text>
          <Text style={s.phone}>{item.phone || '—'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[s.statusText, { color: sc.text }]}>{item.status}</Text>
        </View>
      </View>
      <View style={s.cardMeta}>
        <Text style={s.metaItem}>🕐 {item.slot}</Text>
        <Text style={s.metaItem}>🏟 {item.turf}</Text>
        {item.sport ? <Text style={s.metaItem}>⚽ {item.sport}</Text> : null}
      </View>
      <View style={s.cardBottom}>
        <Text style={s.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
        {item.paid
          ? <Text style={s.paid}>✓ Paid</Text>
          : <Text style={s.unpaid}>Unpaid</Text>}
      </View>
    </View>
  );
}

// ── Section header (date group) ────────────────────────────────────────────

function SectionHeader({ date }: { date: string }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionDate}>{label}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function OwnerAllBookingsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod]         = useState<BookingPeriod>('today');
  const [bookings, setBookings]     = useState<PeriodBooking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const load = useCallback(async (p: BookingPeriod) => {
    setLoading(true);
    try {
      const { bookings: data } = await fetchBookingsByPeriod(p);
      setBookings(data);
    } catch (err) {
      console.error('OwnerAllBookingsScreen load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(period); }, [load, period]));

  const filtered = useMemo(
    () => statusFilter === 'All' ? bookings : bookings.filter(b => b.status === statusFilter),
    [bookings, statusFilter],
  );

  // Group bookings by date for section headers
  const flatList = useMemo(() => {
    const map = new Map<string, PeriodBooking[]>();
    for (const b of filtered) {
      const arr = map.get(b.booking_date) ?? [];
      arr.push(b);
      map.set(b.booking_date, arr);
    }
    const sections = Array.from(map.entries()).map(([date, items]) => ({ date, items }));
    sections.sort((a, b) => period === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

    const rows: ({ type: 'header'; date: string } | { type: 'item'; item: PeriodBooking })[] = [];
    for (const sec of sections) {
      rows.push({ type: 'header', date: sec.date });
      for (const item of sec.items) rows.push({ type: 'item', item });
    }
    return rows;
  }, [filtered, period]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} hitSlop={12}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.title}>Bookings</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Period tabs */}
      <View style={s.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === period;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => setPeriod(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status chips */}
      <View style={s.chips}>
        {STATUS_FILTERS.map(sf => {
          const active = sf === statusFilter;
          return (
            <TouchableOpacity
              key={sf}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setStatusFilter(sf)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{sf}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.totalCount}>{filtered.length} booking{filtered.length === 1 ? '' : 's'}</Text>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : flatList.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>No {period} bookings</Text>
        </View>
      ) : (
        <FlatList
          data={flatList}
          keyExtractor={(row, i) => row.type === 'header' ? `h-${row.date}` : `b-${row.item.id}`}
          contentContainerStyle={s.listContent}
          renderItem={({ item: row }) =>
            row.type === 'header'
              ? <SectionHeader date={row.date} />
              : <BookingCard item={row.item} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon:    { fontSize: 22, color: colors.text },
  title:       { fontSize: font.lg, fontWeight: font.bold, color: colors.text },

  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md,
    backgroundColor: colors.cardGlass, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.accent2, borderColor: colors.accent },
  tabTxt:       { fontSize: font.sm, fontWeight: font.bold, color: colors.text2 },
  tabTxtActive: { color: colors.accentText },

  chips: {
    flexDirection:    'row',
    gap:              6,
    paddingHorizontal: spacing.lg,
    paddingTop:       spacing.xs,
    paddingBottom:    spacing.sm,
    flexWrap:         'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      radius.pill,
    backgroundColor:   colors.cardGlass,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  chipActive:     { backgroundColor: colors.accent2, borderColor: colors.accent },
  chipText:       { fontSize: font.xs, color: colors.text2, fontWeight: font.medium },
  chipTextActive: { color: colors.accentText },

  totalCount: { fontSize: font.sm, color: colors.text3, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },

  listContent: { padding: spacing.md, paddingTop: 4 },

  sectionHeader: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: 4,
    marginTop:         spacing.md,
    marginBottom:      4,
  },
  sectionDate: {
    fontSize:      font.xs,
    fontWeight:    font.bold,
    color:         colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.xs,
  },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   6,
  },
  cardLeft:    { flex: 1, marginRight: 8 },
  customerName:{ fontSize: font.md, fontWeight: font.semibold, color: colors.text },
  phone:       { fontSize: font.xs, color: colors.text3, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      radius.pill,
    borderWidth:       1,
  },
  statusText: { fontSize: font.xs, fontWeight: font.bold },

  cardMeta: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginBottom:   6,
  },
  metaItem:  { fontSize: font.xs, color: colors.text2 },

  cardBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      2,
  },
  amount: { fontSize: font.md, fontWeight: font.bold, color: colors.text },
  paid:   { fontSize: font.xs, color: colors.success, fontWeight: font.semibold },
  unpaid: { fontSize: font.xs, color: colors.warning, fontWeight: font.semibold },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontSize: font.md, color: colors.text2, fontWeight: font.semibold },
});
