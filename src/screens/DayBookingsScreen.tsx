import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

interface DayBooking {
  id:           string;
  customer:     string;
  phone:        string;
  slot:         string;
  sport:        string | null;
  status:       string;
  amount:       number;
  advance_amount: number;
  paid:         boolean;
}

function toAppBooking(row: any): DayBooking {
  return {
    id:             row.id,
    customer:       row.customer,
    phone:          row.phone ?? '',
    slot:           row.slot,
    sport:          row.sport ?? null,
    status:         row.status,
    amount:         Number(row.amount ?? 0),
    advance_amount: Number(row.advance_amount ?? 0),
    paid:           Boolean(row.paid),
  };
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function DayBookingsScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { isoDate, label } = (route.params as { isoDate: string; label: string }) ?? {};

  const [bookings, setBookings] = useState<DayBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      supabase
        .from('bookings')
        .select('id, customer, phone, slot, sport, status, amount, advance_amount, paid')
        .eq('booking_date', isoDate)
        .neq('status', 'Cancelled')
        .order('slot')
        .then(({ data, error: e }) => {
          if (e) setError(e.message);
          else setBookings((data ?? []).map(toAppBooking));
          setLoading(false);
        });
    }, [isoDate]),
  );

  const statusColor = (s: string) =>
    s === 'Confirmed' ? colors.accent
    : s === 'Completed' ? colors.info
    : colors.warn;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Bookings</Text>
          <Text style={styles.headerSub}>{fmtDate(isoDate)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyText}>No bookings for this day.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={styles.countNote}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
          {bookings.map((b, i) => (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              onPress={() => (navigation as any).navigate('Bill', { bookingId: b.id })}
              activeOpacity={0.75}
            >
              {/* Customer + sport */}
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {b.customer.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName}>{b.customer.split(' ')[0]}</Text>
                    {b.sport && (
                      <View style={styles.sportChip}>
                        <Text style={styles.sportChipText}>{b.sport}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSlot}>{b.slot}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusColor(b.status) + '22', borderColor: statusColor(b.status) }]}>
                  <Text style={[styles.statusText, { color: statusColor(b.status) }]}>{b.status}</Text>
                </View>
              </View>

              {/* Amount row */}
              <View style={styles.cardFooter}>
                <Text style={styles.amountLabel}>Amount  ₹{b.amount}</Text>
                <Text style={styles.paidBadge}>
                  {b.paid ? '✓ Paid' : '○ Unpaid'}
                </Text>
                <Text style={styles.invoiceHint}>Tap for invoice →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn:     { width: 40, height: 40, backgroundColor: colors.surface2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 22, color: colors.text, lineHeight: 26 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSub:   { fontSize: 12, color: colors.text3, marginTop: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: colors.text3 },
  errorText:   { fontSize: 13, color: colors.danger, textAlign: 'center', padding: 20 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon:   { fontSize: 36 },
  emptyText:   { fontSize: 14, color: colors.text2, fontWeight: '500' },
  countNote:   { fontSize: 12, color: colors.text3, paddingHorizontal: 20, paddingVertical: 12 },
  card:        { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginBottom: 10, padding: 16 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:      { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent2, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 14, fontWeight: '800', color: colors.accentText },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName:    { fontSize: 15, fontWeight: '700', color: colors.text },
  sportChip:   { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  sportChipText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  cardSlot:    { fontSize: 12, color: colors.text3, marginTop: 3, fontVariant: ['tabular-nums'] },
  statusChip:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: '600' },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  amountLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  paidBadge:   { fontSize: 12, color: colors.accent, fontWeight: '600' },
  invoiceHint: { fontSize: 11, color: colors.text3 },
});