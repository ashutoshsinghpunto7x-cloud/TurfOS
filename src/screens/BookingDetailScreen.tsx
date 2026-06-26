import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

interface BookingDetail {
  id:             string;
  customer:       string;
  phone:          string;
  slot:           string;
  turf:           string;
  booking_date:   string;
  status:         string;
  sport:          string | null;
  amount:         number;
  advance_amount: number;
  paid:           boolean;
  booking_source_role: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function sourceLabel(role: string | null): string {
  if (role === 'customer') return 'C';
  if (role === 'staff')    return 'S';
  return 'O';
}

export default function BookingDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { bookingId } = (route.params as { bookingId: string }) ?? {};

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!bookingId) { setError('No booking ID.'); setLoading(false); return; }
      supabase
        .from('bookings')
        .select('id, customer, phone, slot, turf, booking_date, status, sport, amount, advance_amount, paid, booking_source_role')
        .eq('id', bookingId)
        .single()
        .then(({ data, error: e }) => {
          if (e || !data) { setError(e?.message ?? 'Booking not found.'); setLoading(false); return; }
          setBooking(data as BookingDetail);
          setLoading(false);
        });
    }, [bookingId]),
  );

  const statusColor = (s: string) =>
    s === 'Confirmed' ? colors.accent
    : s === 'Completed' ? colors.info
    : s === 'Cancelled' ? colors.danger
    : colors.warn;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error ?? 'Could not load booking.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Status bar */}
        <View style={[styles.statusBar, { borderColor: statusColor(booking.status) }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(booking.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(booking.status) }]}>{booking.status}</Text>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{sourceLabel(booking.booking_source_role)}</Text>
          </View>
        </View>

        {/* Detail card */}
        <View style={styles.detailCard}>
          <InfoRow icon="👤" label="Customer"   value={booking.customer} />
          <InfoRow icon="📞" label="Phone"      value={booking.phone || '—'} />
          <InfoRow icon="🏏" label="Sport"      value={booking.sport || '—'} />
          <InfoRow icon="📅" label="Date"       value={fmtDate(booking.booking_date)} />
          <InfoRow icon="🕐" label="Time Slot"  value={booking.slot} />
          <InfoRow icon="📍" label="Turf"       value={booking.turf} />
          <InfoRow icon="💰" label="Amount"     value={`₹${booking.amount}`} />
          <InfoRow icon="🎯" label="Advance Paid" value={`₹${booking.advance_amount}`} />
          <InfoRow
            icon="✅"
            label="Payment"
            value={booking.paid ? 'Paid' : 'Unpaid'}
            valueColor={booking.paid ? colors.accent : colors.danger}
          />
        </View>

        {/* Invoice button */}
        <TouchableOpacity
          style={styles.invoiceBtn}
          onPress={() => (navigation as any).navigate('Bill', { bookingId: booking.id })}
        >
          <Text style={styles.invoiceBtnText}>🧾  View Invoice</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={rowS.row}>
      <Text style={rowS.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rowS.label}>{label}</Text>
        <Text style={[rowS.value, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      </View>
    </View>
  );
}

const rowS = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  icon:  { fontSize: 18, width: 26, textAlign: 'center', marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
});

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { width: 40, height: 40, backgroundColor: colors.surface2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  backBtnText:   { fontSize: 22, color: colors.text, lineHeight: 26 },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: colors.text },
  loadingWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:     { fontSize: 14, color: colors.danger, textAlign: 'center', padding: 20 },
  statusBar:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.sm, borderWidth: 1.5, padding: 12, marginBottom: 16 },
  statusDot:     { width: 10, height: 10, borderRadius: 5 },
  statusText:    { fontSize: 15, fontWeight: '700', flex: 1 },
  sourceBadge:   { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  sourceBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  detailCard:    { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  invoiceBtn:    { backgroundColor: colors.dark, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  invoiceBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});