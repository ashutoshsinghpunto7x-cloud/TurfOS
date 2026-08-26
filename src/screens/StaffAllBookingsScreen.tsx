import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StaffStackParamList } from '../navigation/StaffNavigator';
import { fetchBookingsByPeriod, BookingPeriod, PeriodBooking } from '../services/bookingService';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

// ─── Design tokens (matches StaffDashboardScreen / StaffBookingScreen) ─────────
const T = {
  bg:       '#FAFAFC',
  surface:  '#FFFFFF',
  grad0:    '#7C4DFF',
  grad1:    '#8B5CF6',
  grad2:    '#60A5FA',
  text:     '#1A1A1A',
  text2:    '#7B7B8A',
  text3:    '#AEAEBB',
  white:    '#FFFFFF',
  border:   'rgba(0,0,0,0.06)',
  okTxt:    '#10B981',
  okBg:     'rgba(16,185,129,0.10)',
  okBd:     'rgba(16,185,129,0.22)',
  redTxt:   '#EF4444',
  redBg:    'rgba(239,68,68,0.08)',
  redBd:    'rgba(239,68,68,0.18)',
  amberTxt: '#D97706',
  amberBg:  'rgba(251,191,36,0.10)',
  amberBd:  'rgba(251,191,36,0.30)',
};

const TABS: { key: BookingPeriod; label: string }[] = [
  { key: 'past',     label: 'Past' },
  { key: 'today',    label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
];

function statusColors(status: string) {
  switch (status) {
    case 'Confirmed': return { bg: T.okBg,    bd: T.okBd,    txt: T.okTxt };
    case 'Completed': return { bg: T.okBg,    bd: T.okBd,    txt: T.okTxt };
    case 'Cancelled': return { bg: T.redBg,   bd: T.redBd,   txt: T.redTxt };
    case 'Pending':   return { bg: T.amberBg, bd: T.amberBd, txt: T.amberTxt };
    default:          return { bg: T.border,  bd: T.border,  txt: T.text2 };
  }
}

function BookingCard({ item }: { item: PeriodBooking }) {
  const sc = statusColors(item.status);
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.customerName}>{item.customer}</Text>
          <Text style={s.phone}>{item.phone || '—'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.bd }]}>
          <Text style={[s.statusText, { color: sc.txt }]}>{item.status}</Text>
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

function SectionHeader({ date }: { date: string }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionDate}>{label}</Text>
    </View>
  );
}

export default function StaffAllBookingsScreen() {
  const navigation = useNavigation<Nav>();
  const [period, setPeriod]     = useState<BookingPeriod>('today');
  const [bookings, setBookings] = useState<PeriodBooking[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async (p: BookingPeriod) => {
    setLoading(true);
    try {
      const { bookings: data } = await fetchBookingsByPeriod(p);
      setBookings(data);
    } catch (err) {
      console.error('StaffAllBookingsScreen load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(period); }, [load, period]));

  const flatList = useMemo(() => {
    const map = new Map<string, PeriodBooking[]>();
    for (const b of bookings) {
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
  }, [bookings, period]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Bookings</Text>
        <View style={{ width: 38 }} />
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

      <Text style={s.totalCount}>{bookings.length} booking{bookings.length === 1 ? '' : 's'}</Text>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={T.grad0} size="large" />
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

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: T.text, lineHeight: 22 },
  title:     { fontSize: 17, fontWeight: '800', color: T.text },

  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  tabBtnActive: { backgroundColor: T.grad0, borderColor: T.grad0 },
  tabTxt:       { fontSize: 13, fontWeight: '700', color: T.text2 },
  tabTxtActive: { color: T.white },

  totalCount: { fontSize: 12, color: T.text3, paddingHorizontal: 20, paddingBottom: 6 },

  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },

  sectionHeader: { paddingVertical: 6, paddingHorizontal: 4, marginTop: 12, marginBottom: 4 },
  sectionDate:   { fontSize: 11, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 1 },

  card: {
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 14, marginBottom: 8,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  customerName:{ fontSize: 15, fontWeight: '700', color: T.text },
  phone:       { fontSize: 11, color: T.text3, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText:  { fontSize: 11, fontWeight: '800' },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  metaItem: { fontSize: 12, color: T.text2 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: T.text },
  paid:   { fontSize: 12, color: T.okTxt, fontWeight: '700' },
  unpaid: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: T.text2, fontWeight: '600' },
});
