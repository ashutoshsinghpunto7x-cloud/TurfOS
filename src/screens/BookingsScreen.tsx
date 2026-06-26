import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchBookingsByPeriod, BookingPeriod, PeriodBooking } from '../services/bookingService';
import StatusChip from '../components/StatusChip';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { RootStackParamList } from '../types';

const PERIODS: { key: BookingPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Bookings'>;

export default function BookingsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [period, setPeriod] = useState<BookingPeriod>('today');
  const [bookings, setBookings] = useState<PeriodBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { bookings: fetched, error } = await fetchBookingsByPeriod(period);
    if (!error) setBookings(fetched);
    setLoading(false);
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = bookings.filter((b) =>
    b.customer.toLowerCase().includes(search.toLowerCase()) ||
    b.slot.includes(search) ||
    b.booking_date.includes(search),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <TouchableOpacity style={styles.addBtn}
          onPress={() => navigation.navigate('NewBooking')}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, slot, or date…"
          placeholderTextColor={colors.text3}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: colors.text3, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Period tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillScroll}
      >
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.pill, period === p.key && styles.pillActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, period === p.key && styles.pillTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>
            {search
              ? 'No bookings match your search.'
              : `No ${period} bookings found.`}
          </Text>
          <Text style={styles.emptySub}>
            {period === 'today' || period === 'upcoming'
              ? 'Tap + New to create one.'
              : 'Bookings you create will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Date group header for past/upcoming */}
          {(period === 'past' || period === 'upcoming') && (
            <Text style={styles.listNote}>
              {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
              {period === 'upcoming' ? ' upcoming' : ' in history'}
            </Text>
          )}

          {filtered.map((b, i) => (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}
            >
              <View style={styles.cardTop}>
                <Avatar
                  initials={b.customer.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  size={42}
                  index={i}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardName}>{b.customer}</Text>
                  <Text style={styles.cardSub}>{b.phone || '—'}</Text>
                </View>
                <StatusChip status={b.status} />
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>🕐</Text>
                  <Text style={styles.metaText}>{b.slot}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>📍</Text>
                  <Text style={styles.metaText}>{b.field}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>📆</Text>
                  <Text style={styles.metaText}>
                    {(period === 'past' || period === 'upcoming')
                      ? formatDate(b.booking_date)
                      : b.booking_date}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.amount}>₹{b.amount}</Text>
                <View style={[styles.paidChip, { backgroundColor: b.paid ? colors.accent2 : colors.dangerBg }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: b.paid ? colors.accentText : colors.danger }}>
                    {b.paid ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, marginHorizontal: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  pillScroll: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  pill: { minWidth: 88, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: colors.text3 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.text2, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.text3, textAlign: 'center', lineHeight: 20 },
  listNote: { fontSize: 12, color: colors.text3, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, marginHorizontal: 20, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 12, color: colors.text3, marginTop: 1 },
  cardMeta: { flexDirection: 'row', gap: 14, marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 13 },
  metaText: { fontSize: 12, color: colors.text2, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  amount: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  paidChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
});