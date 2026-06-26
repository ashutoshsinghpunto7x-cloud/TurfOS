import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Easing, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import Avatar from '../components/Avatar';
import StatusChip from '../components/StatusChip';

type Props = any;

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:           '#0a0d1a',
  surface:      'rgba(255,255,255,0.04)',
  surfaceMd:    'rgba(255,255,255,0.07)',
  surfaceHigh:  'rgba(255,255,255,0.10)',
  border:       'rgba(255,255,255,0.07)',
  borderMd:     'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(99,102,241,0.35)',
  accent:       '#6366f1',
  accentBright: '#818cf8',
  accentSoft:   'rgba(99,102,241,0.12)',
  cyan:         '#22d3ee',
  violet:       '#a78bfa',
  text:         '#f1f5f9',
  text2:        'rgba(241,245,249,0.55)',
  text3:        'rgba(241,245,249,0.30)',
  textAccent:   '#a5b4fc',
  success:      '#34d399',
  successSoft:  'rgba(52,211,153,0.12)',
  successBorder:'rgba(52,211,153,0.28)',
  warning:      '#fbbf24',
  warningSoft:  'rgba(251,191,36,0.12)',
  warningBorder:'rgba(251,191,36,0.28)',
  info:         '#60a5fa',
  infoSoft:     'rgba(96,165,250,0.12)',
  infoBorder:   'rgba(96,165,250,0.28)',
  danger:       '#f87171',
  dangerSoft:   'rgba(248,113,113,0.12)',
  dangerBorder: 'rgba(248,113,113,0.28)',
  orb1:         'rgba(99,102,241,0.15)',
  orb2:         'rgba(34,211,238,0.08)',
  orb3:         'rgba(167,139,250,0.10)',
};

const R = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 28 };

// ─── ORB ──────────────────────────────────────────────────────────────────────
interface OrbProps {
  color: string; size: number;
  top?: number; bottom?: number; left?: number; right?: number;
  duration: number; tx: number; ty: number;
}
function Orb({ color, size, top, bottom, left, right, duration, tx, ty }: OrbProps) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, tx] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, ty] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, backgroundColor: color,
        top, bottom, left, right,
        transform: [{ translateX }, { translateY }],
      }}
    />
  );
}

// ─── STAT BOX ─────────────────────────────────────────────────────────────────
function StatBox({
  value, label, danger, last,
}: { value: string; label: string; danger?: boolean; last?: boolean }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,    tension: 60, friction: 9, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.statBox, !last && styles.statBoxBorder, { transform: [{ scale }], opacity }]}>
      <Text style={[styles.statVal, danger && { color: C.danger }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </Animated.View>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <LinearGradient colors={[C.accent, C.violet]} style={styles.sectionAccentLine} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function CustomerDetailScreen({ route, navigation }: Props) {
  const { customerId }                     = route.params;
  const { customers, bookings, ledger }    = useStore();
  const customer                           = customers.find((c) => c.id === customerId);

  const headerFade  = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(headerFade,  { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(contentFade, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!customer) return null;

  const custBookings = bookings.filter((b) => b.customer === customer.name);
  const custLedger   = ledger.filter((l) => l.customer === customer.name);

  function statusPalette(s: string) {
    if (s === 'Confirmed') return { bg: C.successSoft, text: C.success, border: C.successBorder };
    if (s === 'Completed') return { bg: C.infoSoft,    text: C.info,    border: C.infoBorder    };
    return                         { bg: C.warningSoft, text: C.warning, border: C.warningBorder };
  }

  const headerTranslate  = headerFade.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const contentTranslate = contentFade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#07091a', '#0a0d1f', '#080c19']} style={StyleSheet.absoluteFill} />

      {/* Orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Orb color={C.orb1} size={320} top={-80}   left={-80}   duration={9000}  tx={22} ty={32} />
        <Orb color={C.orb2} size={200} bottom={300} right={-50}  duration={11000} tx={-18} ty={14} />
        <Orb color={C.orb3} size={160} top={300}   left={30}    duration={13000} tx={14} ty={-20} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ───────────────────────────────────────────────── */}
        <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerTranslate }] }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <LinearGradient colors={[C.surfaceHigh, C.surfaceMd]} style={[StyleSheet.absoluteFill, { borderRadius: R.sm }]} />
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Profile</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          style={{ opacity: contentFade, transform: [{ translateY: contentTranslate }] }}
        >
          {/* ── Profile Card ──────────────────────────────────────── */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(99,102,241,0.1)', 'rgba(99,102,241,0.03)']}
              style={StyleSheet.absoluteFill}
            />
            {/* Top accent line */}
            <LinearGradient
              colors={[C.accent, C.violet, 'transparent']}
              style={styles.profileTopLine}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />

            <View style={styles.profileInner}>
              {/* Avatar */}
              <View style={styles.profileAvatarWrap}>
                <LinearGradient colors={[C.accent, '#4f46e5']} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
                <Text style={styles.profileAvatarText}>{customer.initials}</Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{customer.name}</Text>
                <Text style={styles.profilePhone}>{customer.phone}</Text>
                {customer.credit > 0 && (
                  <View style={styles.dueBadge}>
                    <Text style={styles.dueBadgeText}>₹{customer.credit} outstanding</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Stats Row ─────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']} style={[StyleSheet.absoluteFill, { borderRadius: R.lg }]} />
            <StatBox label="Bookings"    value={String(customer.bookings)} />
            <StatBox label="Outstanding" value={`₹${customer.credit}`} danger={customer.credit > 0} />
            <StatBox label="Total Spent" value={`₹${(customer.totalSpent / 1000).toFixed(1)}k`} last />
          </View>

          {/* ── Booking History ───────────────────────────────────── */}
          <SectionHeader title="Booking History" />
          <View style={styles.listCard}>
            <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']} style={[StyleSheet.absoluteFill, { borderRadius: R.lg }]} />
            {custBookings.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              custBookings.map((b, i) => {
                const sc = statusPalette(b.status);
                return (
                  <View key={b.id} style={[styles.listRow, i < custBookings.length - 1 && styles.listRowBorder]}>
                    {/* Left stripe */}
                    <LinearGradient colors={[C.accent, C.violet]} style={styles.listStripe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.listMain}>{b.slot} · {b.field}</Text>
                      <Text style={styles.listSub}>{b.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.listAmount}>₹{b.amount}</Text>
                      <View style={[styles.statusChip, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{b.status}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Credit Ledger ─────────────────────────────────────── */}
          <SectionHeader title="Credit Ledger" />
          <View style={styles.listCard}>
            <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']} style={[StyleSheet.absoluteFill, { borderRadius: R.lg }]} />
            {custLedger.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyIcon}>📒</Text>
                <Text style={styles.emptyText}>No credit entries</Text>
              </View>
            ) : (
              custLedger.map((entry, i) => {
                const isCredit = entry.type === 'credit';
                return (
                  <View key={entry.id} style={[styles.listRow, i < custLedger.length - 1 && styles.listRowBorder]}>
                    {/* Colored stripe */}
                    <View style={[styles.listStripe, { backgroundColor: isCredit ? C.danger : C.success }]} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.listMain}>{entry.item}</Text>
                      <Text style={styles.listSub}>{entry.date} · {entry.note}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.ledgerAmount, { color: isCredit ? C.danger : C.success }]}>
                        {isCredit ? '−' : '+'}₹{entry.amount}
                      </Text>
                      <View style={[
                        styles.ledgerTypeBadge,
                        { backgroundColor: isCredit ? C.dangerSoft : C.successSoft, borderColor: isCredit ? C.dangerBorder : C.successBorder },
                      ]}>
                        <Text style={[styles.ledgerTypeText, { color: isCredit ? C.danger : C.success }]}>
                          {isCredit ? 'Debit' : 'Credit'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Summary Section ───────────────────────────────────── */}
          {(custBookings.length > 0 || custLedger.length > 0) && (
            <>
              <SectionHeader title="Summary" />
              <View style={styles.summaryCard}>
                <LinearGradient colors={[C.accentSoft, 'transparent']} style={[StyleSheet.absoluteFill, { borderRadius: R.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Booking Revenue</Text>
                  <Text style={styles.summaryVal}>
                    ₹{custBookings.reduce((acc, b) => acc + (Number(b.amount) || 0), 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                  <Text style={styles.summaryLabel}>Confirmed Bookings</Text>
                  <Text style={styles.summaryVal}>
                    {custBookings.filter(b => b.status === 'Confirmed').length}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Completed Sessions</Text>
                  <Text style={[styles.summaryVal, { color: C.accentBright }]}>
                    {custBookings.filter(b => b.status === 'Completed').length}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: 'rgba(10,13,26,0.8)',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: R.sm,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: C.borderMd,
  },
  backBtnText: { fontSize: 22, color: C.text, lineHeight: 26 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

  // ── Profile card
  profileCard: {
    overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: C.border,
  },
  profileTopLine: { height: 2, position: 'absolute', top: 0, left: 0, right: 0 },
  profileInner: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 22 },
  profileAvatarWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: C.borderAccent,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  profileAvatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileInfo:       { marginLeft: 16, flex: 1 },
  profileName:       { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  profilePhone:      { fontSize: 13, color: C.text3, marginTop: 3 },
  dueBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
  },
  dueBadgeText: { fontSize: 11, fontWeight: '700', color: '#f87171' },

  // ── Stats
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  statBox:       { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBoxBorder: { borderRightWidth: 1, borderRightColor: C.border },
  statVal: {
    fontSize: 20, fontWeight: '800', color: C.text,
    fontVariant: ['tabular-nums'],
  },
  statLbl: { fontSize: 10, color: C.text3, marginTop: 3, fontWeight: '600', letterSpacing: 0.5 },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
  },
  sectionAccentLine: { width: 3, height: 16, borderRadius: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.text3, textTransform: 'uppercase', letterSpacing: 2 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: C.border },

  // ── List card
  listCard: {
    marginHorizontal: 16, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 0 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  listStripe: { width: 3, alignSelf: 'stretch' },
  listMain:   { fontSize: 14, fontWeight: '600', color: C.text },
  listSub:    { fontSize: 12, color: C.text3, marginTop: 3 },
  listAmount: { fontSize: 15, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },

  // ── Status chip
  statusChip: {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  // ── Ledger
  ledgerAmount: {
    fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'],
  },
  ledgerTypeBadge: {
    marginTop: 4, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1,
  },
  ledgerTypeText: { fontSize: 9, fontWeight: '700' },

  // ── Empty row
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  emptyIcon: { fontSize: 20 },
  emptyText: { fontSize: 13, color: C.text3 },

  // ── Summary card
  summaryCard: {
    marginHorizontal: 16, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.borderAccent,
    overflow: 'hidden', paddingHorizontal: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  summaryLabel: { fontSize: 13, color: C.text3, fontWeight: '500' },
  summaryVal:   { fontSize: 15, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
});