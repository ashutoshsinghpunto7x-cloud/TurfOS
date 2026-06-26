import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import {
  fetchCoupons, sendCouponToCustomer, assignVBadge,
  removeVBadge, fetchCustomerBadge, Coupon,
} from '../services/couponService';
import { useStore } from '../store/useStore';
import { colors, radius } from '../theme/theme';

// ── Free Fire style badge (local copy for this screen) ────────────────────

interface FFBadgeProps { letter: 'A' | 'V'; size?: number; animate?: boolean; }

function FFBadge({ letter, size = 28, animate = true }: FFBadgeProps) {
  const glow  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow,  { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(glow,  { toValue: 0,    duration: 2000, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [animate]);

  const isA        = letter === 'A';
  const outerColor = isA ? '#E53935' : '#F5A623';
  const innerTop   = isA ? '#FF6B6B' : '#FFD700';
  const innerBot   = isA ? '#B71C1C' : '#FF8C00';
  const shadowCol  = isA ? 'rgba(229,57,53,0.7)' : 'rgba(245,166,35,0.7)';

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.46;
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
  const innerR = r * 0.78;
  const innerPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + innerR * Math.cos(angle)},${cy + innerR * Math.sin(angle)}`;
  }).join(' ');

  return (
    <Animated.View style={{
      width: size, height: size,
      opacity: glowOpacity,
      transform: [{ scale: pulse }],
      shadowColor: shadowCol,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 8,
    }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id={`og${letter}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={outerColor} stopOpacity="1" />
            <Stop offset="1" stopColor={isA ? '#7B0000' : '#B8600A'} stopOpacity="1" />
          </SvgGradient>
          <SvgGradient id={`ig${letter}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={innerTop} stopOpacity="1" />
            <Stop offset="1" stopColor={innerBot} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Polygon points={hexPoints}  fill={`url(#og${letter})`} />
        <Polygon points={innerPoints} fill={`url(#ig${letter})`} />
        <SvgText
          x={cx} y={cy + size * 0.13}
          textAnchor="middle"
          fontSize={size * 0.38}
          fontWeight="900"
          fill="#fff"
          fontFamily="System"
        >
          {letter}
        </SvgText>
      </Svg>
    </Animated.View>
  );
}

// ── Data helpers ───────────────────────────────────────────────────────────

interface CustomerSummary {
  customer_name:  string;
  phone:          string;
  booking_spend:  number;
  pos_spend:      number;
  total_spend:    number;
  booking_count:  number;
  customer_id:    string | null;
  has_v_badge:    boolean;
}

async function fetchRealCustomers(): Promise<{
  customers: CustomerSummary[]; error: string | null;
}> {
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('customer, phone, amount, customer_id')
    .neq('status', 'Cancelled');

  if (bErr) return { customers: [], error: bErr.message };

  const { data: txData, error: tErr } = await supabase
    .from('pos_transactions')
    .select('customer, total')
    .neq('status', 'undone');

  if (tErr) return { customers: [], error: tErr.message };

  const { data: badges } = await supabase
    .from('customer_badges')
    .select('customer_id, badge_type')
    .eq('badge_type', 'V');

  const badgeSet = new Set<string>((badges ?? []).map((b: any) => b.customer_id));

  const map = new Map<string, CustomerSummary>();

  for (const b of bookings ?? []) {
    const name  = (b.customer ?? '').trim();
    const phone = (b.phone ?? '').trim();
    if (!name) continue;
    const key  = name.toLowerCase();
    const prev = map.get(key) ?? {
      customer_name: name, phone, booking_spend: 0, pos_spend: 0,
      total_spend: 0, booking_count: 0,
      customer_id: b.customer_id ?? null, has_v_badge: false,
    };
    prev.booking_spend += Number(b.amount ?? 0);
    prev.booking_count += 1;
    if (phone && !prev.phone) prev.phone = phone;
    if (b.customer_id && !prev.customer_id) prev.customer_id = b.customer_id;
    if (b.customer_id && badgeSet.has(b.customer_id)) prev.has_v_badge = true;
    map.set(key, prev);
  }

  for (const tx of txData ?? []) {
    const name = (tx.customer ?? '').trim();
    if (!name) continue;
    const key  = name.toLowerCase();
    const prev = map.get(key) ?? {
      customer_name: name, phone: '', booking_spend: 0, pos_spend: 0,
      total_spend: 0, booking_count: 0, customer_id: null, has_v_badge: false,
    };
    prev.pos_spend += Number(tx.total ?? 0);
    map.set(key, prev);
  }

  const customers = Array.from(map.values()).map((c) => ({
    ...c, total_spend: c.booking_spend + c.pos_spend,
  }));
  customers.sort((a, b) => b.total_spend - a.total_spend);

  return { customers, error: null };
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const { profile } = useStore();
  const [customers, setCustomers]       = useState<CustomerSummary[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState<CustomerSummary | null>(null);
  const [coupons, setCoupons]           = useState<Coupon[]>([]);
  const [couponModal, setCouponModal]   = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [sendingCoupon, setSendingCoupon]   = useState(false);
  const [badgeLoading, setBadgeLoading]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { customers: fetched, error } = await fetchRealCustomers();
    if (error) Alert.alert('Error', error);
    else setCustomers(fetched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = customers.filter((c) =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search),
  );

  const handleOpenCouponSend = async (customer: CustomerSummary) => {
    if (!customer.customer_id) {
      Alert.alert('No Account', 'This customer does not have a registered account. Coupons can only be sent to registered customers.');
      return;
    }
    setSelected(customer);
    setLoadingCoupons(true);
    const { coupons: fetched } = await fetchCoupons();
    setCoupons(fetched.filter((c) => c.is_active));
    setLoadingCoupons(false);
    setCouponModal(true);
  };

  const handleSendCoupon = async (coupon: Coupon, customer: CustomerSummary) => {
    if (!customer.customer_id || !profile?.id) return;
    setSendingCoupon(true);

    // Each send creates a unique sent_coupon instance (Task 7)
    const { sentCoupon, error } = await sendCouponToCustomer({
      coupon,
      customerId:   customer.customer_id,
      customerName: customer.customer_name,
      sentBy:       profile.id,
    });

    setSendingCoupon(false);
    if (error || !sentCoupon) {
      Alert.alert('Send Failed', error ?? 'Could not send coupon.');
      return;
    }

    Alert.alert(
      '✓ Coupon Sent',
      `Coupon "${coupon.code}" has been sent to ${customer.customer_name}.\n\nUnique ID: ${sentCoupon.id.slice(0, 8)}…\n\nThey will see it in their notification bell.`,
    );
    setCouponModal(false);
  };

  const handleToggleBadge = async (customer: CustomerSummary) => {
    if (!customer.customer_id || !profile?.id) {
      Alert.alert('No Account', 'This customer does not have a registered account.');
      return;
    }

    setBadgeLoading(true);

    if (customer.has_v_badge) {
      Alert.alert(
        'Remove V Badge',
        `Remove the loyal customer badge from ${customer.customer_name}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setBadgeLoading(false) },
          {
            text: 'Remove', style: 'destructive',
            onPress: async () => {
              const { error } = await removeVBadge(customer.customer_id!);
              setBadgeLoading(false);
              if (error) { Alert.alert('Error', error); return; }
              setCustomers((prev) => prev.map((c) =>
                c.customer_id === customer.customer_id ? { ...c, has_v_badge: false } : c,
              ));
              if (selected?.customer_id === customer.customer_id) {
                setSelected((s) => s ? { ...s, has_v_badge: false } : s);
              }
            },
          },
        ],
      );
    } else {
      const { error } = await assignVBadge(customer.customer_id, profile.id);
      setBadgeLoading(false);
      if (error) { Alert.alert('Error', error); return; }
      setCustomers((prev) => prev.map((c) =>
        c.customer_id === customer.customer_id ? { ...c, has_v_badge: true } : c,
      ));
      if (selected?.customer_id === customer.customer_id) {
        setSelected((s) => s ? { ...s, has_v_badge: true } : s);
      }
      Alert.alert('✓ Badge Assigned', `${customer.customer_name} is now a Loyal Customer (V badge).`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Text style={styles.subtitle}>{customers.length} total · sorted by spend</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer or phone…"
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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading customers…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>
            {search ? 'No customers match.' : 'No customer data yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {filtered.map((c, i) => (
            <TouchableOpacity
              key={`customer-${c.customer_name}-${i}`}
              style={styles.card}
              onPress={() => setSelected(c)}
              activeOpacity={0.75}
            >
              <View style={[styles.rankBadge, i < 3 && styles.rankBadgePremium]}>
                <Text style={[styles.rankText, i < 3 && { color: '#fff' }]}>#{i + 1}</Text>
              </View>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>
                  {c.customer_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{c.customer_name}</Text>
                  {c.has_v_badge && (
                    <View style={{ marginLeft: 6 }}>
                      <FFBadge letter="V" size={20} animate />
                    </View>
                  )}
                </View>
                <Text style={styles.cardPhone}>{c.phone || '—'}</Text>
                <Text style={styles.cardSub}>
                  {c.booking_count} booking{c.booking_count !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.totalSpend}>₹{c.total_spend.toLocaleString('en-IN')}</Text>
                <Text style={styles.totalLabel}>total spent</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Customer detail modal */}
      <Modal visible={!!selected && !couponModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <>
                {/* Header row: name + V badge */}
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.modalTitle}>{selected.customer_name}</Text>
                  {selected.has_v_badge && (
                    <View style={{ marginLeft: 10 }}>
                      <FFBadge letter="V" size={32} animate />
                    </View>
                  )}
                </View>

                {[
                  { label: 'Phone',         value: selected.phone || '—' },
                  { label: 'Booking Spend', value: `₹${selected.booking_spend.toLocaleString('en-IN')}` },
                  { label: 'POS Spend',     value: `₹${selected.pos_spend.toLocaleString('en-IN')}` },
                  { label: 'Total Spent',   value: `₹${selected.total_spend.toLocaleString('en-IN')}` },
                  { label: 'Bookings',      value: String(selected.booking_count) },
                ].map((row) => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    <Text style={styles.detailValue}>{row.value}</Text>
                  </View>
                ))}

                {/* V badge assign/remove (owner only) */}
                {selected.customer_id && (
                  <TouchableOpacity
                    style={[styles.badgeBtn, selected.has_v_badge && styles.badgeBtnRemove]}
                    onPress={() => handleToggleBadge(selected)}
                    disabled={badgeLoading}
                  >
                    {badgeLoading ? (
                      <ActivityIndicator color={selected.has_v_badge ? colors.danger : '#FF8C00'} />
                    ) : (
                      <Text style={[styles.badgeBtnText, selected.has_v_badge && { color: colors.danger }]}>
                        {selected.has_v_badge ? '✕  Remove Loyal Badge' : '⭐  Assign Loyal (V) Badge'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Send coupon */}
                <TouchableOpacity style={styles.couponBtn} onPress={() => handleOpenCouponSend(selected)}>
                  <Text style={styles.couponBtnText}>🏷️  Send Coupon Code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Coupon select modal */}
      <Modal visible={couponModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Coupon to Send</Text>
            {selected && (
              <Text style={styles.modalSub}>Sending to: {selected.customer_name}</Text>
            )}
            <Text style={styles.uniqueNote}>
              ℹ️  Each send creates a unique coupon instance for this customer.
            </Text>
            {loadingCoupons ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
            ) : coupons.length === 0 ? (
              <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 20 }}>
                No active coupons. Create one in Coupon Codes.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {coupons.map((coupon) => (
                  <TouchableOpacity
                    key={`sendcoupon-${coupon.id}`}
                    style={[styles.couponRow, sendingCoupon && { opacity: 0.6 }]}
                    onPress={() => !sendingCoupon && selected && handleSendCoupon(coupon, selected)}
                    disabled={sendingCoupon}
                  >
                    <View style={styles.couponCodeBox}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.couponDiscount}>
                        {coupon.discount_type === 'percent'
                          ? `${coupon.discount_value}% off`
                          : `₹${coupon.discount_value} off`}
                      </Text>
                      {coupon.min_booking_amount > 0 && (
                        <Text style={styles.couponMeta}>Min ₹{coupon.min_booking_amount}</Text>
                      )}
                      {coupon.valid_until && (
                        <Text style={styles.couponMeta}>Expires {coupon.valid_until}</Text>
                      )}
                    </View>
                    {sendingCoupon ? (
                      <ActivityIndicator color={colors.accent} size="small" />
                    ) : (
                      <Text style={styles.sendArrow}>Send →</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setCouponModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.bg },
  header:            { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:             { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle:          { fontSize: 12, color: colors.text3, marginTop: 2 },
  searchBar:         { flexDirection: 'row', alignItems: 'center', margin: 12, marginHorizontal: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:       { flex: 1, fontSize: 14, color: colors.text },
  loadingWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:       { fontSize: 13, color: colors.text3 },
  emptyWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyIcon:         { fontSize: 36 },
  emptyText:         { fontSize: 14, color: colors.text2, textAlign: 'center' },
  card:              { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingVertical: 14 },
  rankBadge:         { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: colors.border },
  rankBadgePremium:  { backgroundColor: colors.accent },
  rankText:          { fontSize: 10, fontWeight: '700', color: colors.text2 },
  cardAvatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent2, alignItems: 'center', justifyContent: 'center' },
  cardAvatarText:    { fontSize: 13, fontWeight: '800', color: colors.accentText },
  nameRow:           { flexDirection: 'row', alignItems: 'center' },
  cardName:          { fontSize: 14, fontWeight: '700', color: colors.text },
  cardPhone:         { fontSize: 12, color: colors.text3, marginTop: 1 },
  cardSub:           { fontSize: 11, color: colors.text3, marginTop: 1 },
  totalSpend:        { fontSize: 16, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  totalLabel:        { fontSize: 10, color: colors.text3, marginTop: 2 },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle:       { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  detailHeaderRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalTitle:        { fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 },
  modalSub:          { fontSize: 13, color: colors.text3, marginBottom: 6 },
  uniqueNote:        { fontSize: 11, color: colors.info, backgroundColor: colors.infoBg, borderRadius: 6, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#B5D4F4' },
  detailRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel:       { fontSize: 13, color: colors.text2, fontWeight: '500' },
  detailValue:       { fontSize: 14, fontWeight: '700', color: colors.text },
  badgeBtn:          { backgroundColor: '#FFF8E1', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#F5A623' },
  badgeBtnRemove:    { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  badgeBtnText:      { fontSize: 14, fontWeight: '700', color: '#F5A623' },
  couponBtn:         { backgroundColor: colors.accent2, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: colors.accent },
  couponBtnText:     { fontSize: 15, fontWeight: '700', color: colors.accentText },
  closeBtn:          { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  closeBtnText:      { fontSize: 14, color: colors.text2, fontWeight: '600' },
  couponRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  couponCodeBox:     { backgroundColor: colors.accent2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  couponCode:        { fontSize: 14, fontWeight: '800', color: colors.accentText, letterSpacing: 1 },
  couponDiscount:    { fontSize: 14, fontWeight: '600', color: colors.text },
  couponMeta:        { fontSize: 11, color: colors.text3, marginTop: 2 },
  sendArrow:         { fontSize: 13, color: colors.accent, fontWeight: '700' },
});