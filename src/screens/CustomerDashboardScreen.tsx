import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert, Clipboard,
  Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { signOut } from '../services/authService';
import { fetchCustomerSentCoupons, markCouponRead, SentCoupon } from '../services/couponService';
import { useStore } from '../store/useStore';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:       '#F2F1FF',   // light lavender from screenshot
  surface:  '#FFFFFF',
  border:   'rgba(0,0,0,0.055)',
  grad0:    '#7C4DFF',
  grad1:    '#8B5CF6',
  grad2:    '#60A5FA',
  orange:   '#F97316',
  orangeSf: 'rgba(249,115,22,0.11)',
  orangeBd: 'rgba(249,115,22,0.22)',
  pinkOr:   '#EC4899',
  text:     '#1A1A1A',
  text2:    '#7B7B8A',
  text3:    '#AEAEBB',
  white:    '#FFFFFF',
  redTxt:   '#EF4444',
  redBg:    'rgba(239,68,68,0.07)',
  redBd:    'rgba(239,68,68,0.18)',
  greenDark:'#0F3D25',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];
const BTN_GRAD: [string, string, string] = [T.grad0, T.pinkOr, T.orange];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CustomerBooking {
  id: string; slot: string; turf: string; booking_date: string;
  status: string; sport: string | null; amount: number;
  advance_amount: number; paid: boolean;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch { return iso; }
}

function fmtShortDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch { return iso; }
}

// ─── Quick action card ─────────────────────────────────────────────────────────
function QuickCard({ icon, title, sub, badge, tint, onPress }: {
  icon: string; title: string; sub: string; badge?: number;
  tint: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 3 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start()}
    >
      <Animated.View style={[qc.card, { transform: [{ scale }] }]}>
        {badge !== undefined && (
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={qc.badge}>
            <Text style={qc.badgeTxt}>{badge}</Text>
          </LinearGradient>
        )}
        <View style={qc.iconWrap}>
          <Text style={qc.icon}>{icon}</Text>
        </View>
        <View style={qc.body}>
          <Text style={qc.title}>{title}</Text>
          <Text style={[qc.sub, { color: tint }]}>{sub}</Text>
        </View>
        <View style={qc.arrowWrap}>
          <Text style={qc.arrow}>›</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const CARD_W = (SW - 32 - 10) / 2;
const qc = StyleSheet.create({
  card:     { width: CARD_W, backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 16, shadowColor: 'rgba(0,0,0,0.07)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3, position: 'relative', overflow: 'hidden' },
  badge:    { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  badgeTxt: { color: T.white, fontSize: 10, fontWeight: '800' },
  iconWrap: { marginBottom: 10 },
  icon:     { fontSize: 32 },
  body:     { flex: 1, gap: 3 },
  title:    { fontSize: 14, fontWeight: '700', color: T.text },
  sub:      { fontSize: 12, fontWeight: '600' },
  arrowWrap:{ position: 'absolute', bottom: 14, right: 14 },
  arrow:    { fontSize: 18, color: T.text3, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerDashboardScreen() {
  const navigation              = useNavigation<any>();
  const { profile, setProfile } = useStore();
  const insets                  = useSafeAreaInsets();

  const [myBookings, setMyBookings]             = useState<CustomerBooking[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedBooking, setSelectedBooking]   = useState<CustomerBooking | null>(null);
  const [sentCoupons, setSentCoupons]           = useState<SentCoupon[]>([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [couponPanel, setCouponPanel]           = useState(false);
  const [loadingCoupons, setLoadingCoupons]     = useState(false);
  const [profileMenu, setProfileMenu]           = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [myRes, couponRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id,slot,turf,booking_date,status,sport,amount,advance_amount,paid')
        .eq('customer_id', profile.id)
        .neq('status', 'Cancelled')
        .order('booking_date', { ascending: false })
        .limit(20),
      fetchCustomerSentCoupons(profile.id),
    ]);
    setMyBookings(
      (myRes.data ?? []).map((b: any) => ({
        id: b.id, slot: b.slot, turf: b.turf ?? 'Turf A',
        booking_date: b.booking_date, status: b.status,
        sport: b.sport ?? null, amount: Number(b.amount ?? 0),
        advance_amount: Number(b.advance_amount ?? 0), paid: Boolean(b.paid),
      })),
    );
    setSentCoupons(couponRes.sentCoupons);
    setUnreadCount(couponRes.unreadCount);
    setLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Coupons ───────────────────────────────────────────────────────────────
  const openCoupons = async () => {
    setCouponPanel(true);
    setLoadingCoupons(true);
    if (profile?.id) {
      const { sentCoupons: fresh, unreadCount: uc } = await fetchCustomerSentCoupons(profile.id);
      setSentCoupons(fresh);
      setUnreadCount(uc);
      for (const sc of fresh.filter((c) => !c.is_read)) await markCouponRead(sc.id);
      setUnreadCount(0);
    }
    setLoadingCoupons(false);
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    setProfileMenu(false);
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut(); setProfile(null);
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={T.grad0} size="large" />
      </View>
    );
  }

  const nextMatch = myBookings.find((b) => b.status === 'Confirmed' || b.status === 'Pending');
  const firstName = profile?.full_name?.trim().split(' ')[0] ?? 'Player';
  const initials  = (profile?.full_name ?? 'C').charAt(0).toUpperCase();

  return (
    <View style={s.root}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: 110 + insets.bottom }]}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.hCircle} onPress={() => setProfileMenu(true)} activeOpacity={0.8}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hCircleGrad}>
              <Text style={s.hCircleTxt}>{initials}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.logoRow}>
            <Text style={s.logoEmoji}>🏟</Text>
            <Text style={s.logoName}>
              Turf<Text style={s.logoAccent}>OS</Text>
            </Text>
          </View>

          <TouchableOpacity style={s.hCircle} onPress={openCoupons} activeOpacity={0.8}>
            <Text style={s.hCircleIcon}>🔔</Text>
            {unreadCount > 0 && (
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bellDot}>
                <Text style={s.bellDotTxt}>{unreadCount}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hero card ── */}
        <View style={s.heroCard}>
          {/* Faint field illustration — top right */}
          <View style={s.fieldIllus} pointerEvents="none">
            <View style={s.fieldCircleOuter} />
            <View style={s.fieldCircleInner} />
            <View style={s.fieldHLine} />
            <View style={s.fieldVLine} />
            <Text style={s.fieldBall}>⚽</Text>
          </View>

          {/* Greeting */}
          <Text style={s.heroHello}>Hello {firstName} 👋</Text>

          {/* Title */}
          <Text style={s.heroTitle}>Book Your Turf,</Text>
          <Text style={s.heroTitleGrad}>
            <Text style={{ color: T.grad0 }}>Play </Text>
            <Text style={{ color: T.pinkOr }}>Without </Text>
            <Text style={{ color: T.orange }}>Waiting</Text>
          </Text>

          {/* Location */}
          <View style={s.locRow}>
            <Text style={s.locPin}>📍</Text>
            <Text style={s.locTxt}>Playbox, Lucknow</Text>
          </View>

          {/* Book Slot CTA */}
          <TouchableOpacity
            onPress={() => navigation.navigate('CustomerBooking')}
            activeOpacity={0.88}
            style={{ marginTop: 20 }}
          >
            <LinearGradient colors={BTN_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bookBtn}>
              <View style={s.bookBtnIconWrap}>
                <Text style={s.bookBtnIcon}>⚽</Text>
              </View>
              <Text style={s.bookBtnLabel}>Book Slot</Text>
              <Text style={s.bookBtnSub}>Reserve your turf in just a few taps</Text>
              <View style={s.bookBtnArrowWrap}>
                <Text style={s.bookBtnArrow}>›</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Quick actions grid ── */}
        <View style={s.grid}>
          <View style={s.gridRow}>
            <QuickCard
              icon="📅" title="Available Slots" sub="24 Open Today"
              tint={T.grad0}
              onPress={() => navigation.navigate('CustomerBooking')}
            />
            <QuickCard
              icon="🎫" title="My Bookings" sub={`${myBookings.length} Upcoming`}
              tint={T.grad0}
              onPress={() => {}}
            />
          </View>
          <View style={s.gridRow}>
            <QuickCard
              icon="🏆" title="Tournaments" sub="2 Live Events"
              tint={T.orange}
              onPress={() => Alert.alert('Tournaments', 'Live tournament listings coming soon!')}
            />
            <QuickCard
              icon="👥" title="Find Players" sub="18 Nearby"
              tint={T.grad1}
              badge={3}
              onPress={() => Alert.alert('Find Players', "Player matchmaking is coming soon!")}
            />
          </View>
        </View>

        {/* ── Your Next Match ── */}
        <View style={s.section}>
          {/* Section header */}
          <View style={s.sectionHdr}>
            <Text style={s.sectionTitle}>Your Next Match</Text>
            <View style={s.upcomingPill}>
              <Text style={s.upcomingTxt}>Upcoming</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.matchCard}
            activeOpacity={0.85}
            onPress={() => nextMatch && setSelectedBooking(nextMatch)}
          >
            {/* Turf thumbnail */}
            <View style={s.turfThumb}>
              <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              {/* Field lines */}
              <View style={s.turfLineH} />
              <View style={s.turfCircle} />
              <View style={s.turfGoalTop} />
              <View style={s.turfGoalBot} />
            </View>

            {/* Details */}
            <View style={s.matchDetails}>
              <Text style={s.matchTurf}>{nextMatch?.turf ?? 'Turf A'}</Text>
              <View style={s.matchMetaRow}>
                <Text style={s.matchMetaIcon}>📅</Text>
                <Text style={s.matchMetaTxt}>
                  {nextMatch ? fmtShortDate(nextMatch.booking_date) : 'Tuesday, 16 June'}
                </Text>
              </View>
              <View style={s.matchMetaRow}>
                <Text style={s.matchMetaIcon}>⏰</Text>
                <Text style={s.matchMetaTxt}>
                  {nextMatch?.slot ?? '12:30 AM – 01:30 AM'}  ·  1 Hour
                </Text>
              </View>
              {nextMatch?.sport ? (
                <View style={s.matchMetaRow}>
                  <Text style={s.matchMetaIcon}>🏏</Text>
                  <Text style={s.matchMetaTxt}>{nextMatch.sport}</Text>
                </View>
              ) : null}
            </View>

            <Text style={s.matchChevron}>›</Text>
          </TouchableOpacity>

          {!nextMatch && (
            <View style={s.noMatchCard}>
              <Text style={s.noMatchEmoji}>🏟</Text>
              <Text style={s.noMatchTxt}>No upcoming matches</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CustomerBooking')} activeOpacity={0.85}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.noMatchBtn}>
                  <Text style={s.noMatchBtnTxt}>Book a Slot</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </Animated.ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom || 14 }]}>
        {/* Home */}
        <View style={s.navItem}>
          <Text style={[s.navIcon, { color: T.grad0 }]}>🏠</Text>
          <Text style={[s.navLabel, { color: T.grad0, fontWeight: '700' }]}>Home</Text>
          <View style={s.navDot} />
        </View>
        {/* Explore */}
        <TouchableOpacity style={s.navItem} activeOpacity={0.7}>
          <Text style={s.navIcon}>🔍</Text>
          <Text style={s.navLabel}>Explore</Text>
        </TouchableOpacity>
        {/* Book (center) */}
        <View style={s.navCenter}>
          <TouchableOpacity onPress={() => navigation.navigate('CustomerBooking')} activeOpacity={0.88}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.navCenterBtn}>
              <Text style={s.navCenterPlus}>+</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.navLabel}>Book</Text>
        </View>
        {/* Bookings */}
        <TouchableOpacity style={s.navItem} activeOpacity={0.7}>
          <Text style={s.navIcon}>📅</Text>
          <Text style={s.navLabel}>Bookings</Text>
        </TouchableOpacity>
        {/* Profile */}
        <TouchableOpacity style={s.navItem} onPress={() => setProfileMenu(true)} activeOpacity={0.7}>
          <Text style={s.navIcon}>👤</Text>
          <Text style={s.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── Profile / sign-out modal ── */}
      <Modal visible={profileMenu} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />

            {/* Profile row */}
            <View style={m.profileRow}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.avatar}>
                <Text style={m.avatarTxt}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={m.name}>{profile?.full_name ?? 'Customer'}</Text>
                <Text style={m.email}>{profile?.email ?? ''}</Text>
                <View style={m.rolePill}><Text style={m.rolePillTxt}>👤 Customer</Text></View>
              </View>
            </View>

            <View style={m.divider} />

            <TouchableOpacity style={m.item} onPress={() => { setProfileMenu(false); openCoupons(); }}>
              <View style={m.itemIcon}><Text>🏷️</Text></View>
              <Text style={m.itemLabel}>My Coupons</Text>
              {unreadCount > 0 && (
                <View style={m.badge}><Text style={m.badgeTxt}>{unreadCount}</Text></View>
              )}
              <Text style={m.arrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={m.liveCTA} onPress={() => { setProfileMenu(false); navigation.navigate('CustomerLiveScoring'); }}>
              <View style={m.liveDot} />
              <Text style={m.liveLabel}> Live Scores</Text>
            </TouchableOpacity>

            <TouchableOpacity style={m.item} onPress={() => { setProfileMenu(false); navigation.navigate('CustomerBooking'); }}>
              <View style={m.itemIcon}><Text>📅</Text></View>
              <Text style={m.itemLabel}>Book a Slot</Text>
              <Text style={m.arrow}>›</Text>
            </TouchableOpacity>

            <View style={m.divider} />

            <TouchableOpacity style={m.signOutRow} onPress={handleSignOut}>
              <View style={[m.itemIcon, m.signOutIcon]}><Text>🚪</Text></View>
              <Text style={m.signOutTxt}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={m.closeBtn} onPress={() => setProfileMenu(false)}>
              <Text style={m.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Booking detail modal ── */}
      <Modal visible={!!selectedBooking} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            {selectedBooking && (
              <>
                <Text style={m.modalTitle}>Booking Details</Text>
                {[
                  { label: 'Turf',    val: selectedBooking.turf },
                  { label: 'Date',    val: fmtDate(selectedBooking.booking_date) },
                  { label: 'Slot',    val: selectedBooking.slot },
                  { label: 'Sport',   val: selectedBooking.sport || '—' },
                  { label: 'Amount',  val: `₹${selectedBooking.amount}` },
                  { label: 'Advance', val: `₹${selectedBooking.advance_amount}` },
                  { label: 'Payment', val: selectedBooking.paid ? '✓ Paid' : 'Unpaid' },
                  { label: 'Status',  val: selectedBooking.status },
                ].map((r) => (
                  <View key={r.label} style={m.detailRow}>
                    <Text style={m.detailLabel}>{r.label}</Text>
                    <Text style={m.detailVal}>{r.val}</Text>
                  </View>
                ))}
                {['Confirmed', 'Completed'].includes(selectedBooking.status) && (
                  <TouchableOpacity
                    onPress={() => { setSelectedBooking(null); navigation.navigate('Bill', { bookingId: selectedBooking.id }); }}
                    activeOpacity={0.88}
                    style={{ marginTop: 16 }}
                  >
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.invoiceBtn}>
                      <Text style={m.invoiceBtnTxt}>🧾  View Invoice</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={m.closeBtn} onPress={() => setSelectedBooking(null)}>
                  <Text style={m.closeTxt}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Coupon panel ── */}
      <Modal visible={couponPanel} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.modalTitle}>🏷️  My Coupons</Text>
            <Text style={m.modalSub}>Coupons sent to you by the turf</Text>
            {loadingCoupons ? (
              <ActivityIndicator color={T.grad0} style={{ marginTop: 20 }} />
            ) : sentCoupons.length === 0 ? (
              <View style={m.emptyCard}>
                <Text style={{ fontSize: 36 }}>🎫</Text>
                <Text style={m.emptyTxt}>No coupons received yet</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {sentCoupons.map((sc) => (
                  <View key={sc.id} style={[m.couponCard, sc.is_used && { opacity: 0.45 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={m.couponCode}>{sc.code}</Text>
                      <Text style={m.couponDisc}>
                        {sc.discount_type === 'percent' ? `${sc.discount_value}% off` : `₹${sc.discount_value} off`}
                      </Text>
                      <Text style={m.couponDate}>
                        Received {new Date(sc.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    {!sc.is_used ? (
                      <TouchableOpacity
                        style={m.copyBtn}
                        onPress={() => { Clipboard.setString(sc.code); Alert.alert('Copied!', `"${sc.code}" copied. Use it when booking!`); }}
                      >
                        <Text style={m.copyBtnTxt}>Copy</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={m.usedBadge}><Text style={m.usedTxt}>Used</Text></View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={m.closeBtn} onPress={() => setCouponPanel(false)}>
              <Text style={m.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: T.bg },
  scroll:  { paddingHorizontal: 16, gap: 16 },

  // Header
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  hCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgba(0,0,0,0.08)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  hCircleGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hCircleTxt: { fontSize: 17, fontWeight: '800', color: T.white },
  hCircleIcon:{ fontSize: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logoEmoji: { fontSize: 22 },
  logoName:  { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: 0.2 },
  logoAccent:{ color: T.orange },
  bellDot:   { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.surface },
  bellDotTxt:{ fontSize: 8, fontWeight: '800', color: T.white },

  // Hero card
  heroCard: { backgroundColor: T.surface, borderRadius: 24, padding: 22, paddingBottom: 20, borderWidth: 1, borderColor: T.border, shadowColor: 'rgba(124,77,255,0.10)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20, elevation: 4, overflow: 'hidden', position: 'relative' },

  // Field illustration (hero)
  fieldIllus:      { position: 'absolute', top: -20, right: -20, width: 160, height: 160 },
  fieldCircleOuter:{ position: 'absolute', top: 20, right: 20, width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: 'rgba(124,77,255,0.10)', backgroundColor: 'rgba(124,77,255,0.04)' },
  fieldCircleInner:{ position: 'absolute', top: 48, right: 48, width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(124,77,255,0.08)', backgroundColor: 'rgba(124,77,255,0.03)' },
  fieldHLine:      { position: 'absolute', top: 80, right: 0, left: 0, height: 1, backgroundColor: 'rgba(124,77,255,0.07)' },
  fieldVLine:      { position: 'absolute', top: 0, bottom: 0, right: 80, width: 1, backgroundColor: 'rgba(124,77,255,0.07)' },
  fieldBall:       { position: 'absolute', top: 60, right: 60, fontSize: 28, opacity: 0.18 },

  heroHello:   { fontSize: 14, color: T.text2, fontWeight: '500', marginBottom: 8 },
  heroTitle:   { fontSize: 26, fontWeight: '800', color: T.text, lineHeight: 32, marginBottom: 2 },
  heroTitleGrad:{ fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 14 },
  locRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locPin:      { fontSize: 13 },
  locTxt:      { fontSize: 14, color: T.text2 },
  bookBtn:     { borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookBtnIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  bookBtnIcon:  { fontSize: 22 },
  bookBtnLabel: { fontSize: 17, fontWeight: '800', color: T.white, flex: 1 },
  bookBtnSub:   { display: 'none' },
  bookBtnArrowWrap:{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  bookBtnArrow: { fontSize: 20, color: T.white, fontWeight: '700' },

  // Grid
  grid:    { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },

  // Next Match
  section:     {},
  sectionHdr:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:{ fontSize: 17, fontWeight: '800', color: T.text, letterSpacing: -0.2 },
  upcomingPill:{ backgroundColor: T.orangeSf, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: T.orangeBd },
  upcomingTxt: { fontSize: 12, fontWeight: '700', color: T.orange },

  matchCard:   { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2, overflow: 'hidden' },
  turfThumb:   { width: 90, height: 90, borderRadius: 16, overflow: 'hidden', flexShrink: 0, position: 'relative', backgroundColor: '#1B5E20' },
  turfLineH:   { position: 'absolute', top: '48%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.20)' },
  turfCircle:  { position: 'absolute', top: '50%', left: '50%', width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', marginLeft: -18, marginTop: -18 },
  turfGoalTop: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 18, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)' },
  turfGoalBot: { position: 'absolute', bottom: 0, left: '28%', right: '28%', height: 18, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)' },
  matchDetails: { flex: 1, gap: 6 },
  matchTurf:   { fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 2 },
  matchMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 7 },
  matchMetaIcon:{ fontSize: 13 },
  matchMetaTxt: { fontSize: 12, color: T.text2 },
  matchChevron: { fontSize: 22, color: T.text3, fontWeight: '500' },

  noMatchCard: { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 32, alignItems: 'center', gap: 10, shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  noMatchEmoji:{ fontSize: 36 },
  noMatchTxt:  { fontSize: 14, color: T.text2 },
  noMatchBtn:  { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  noMatchBtnTxt:{ fontSize: 14, fontWeight: '700', color: T.white },

  // Bottom nav
  bottomNav:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 6, shadowColor: 'rgba(0,0,0,0.08)', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  navItem:     { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  navIcon:     { fontSize: 22, color: T.text3 },
  navLabel:    { fontSize: 10, color: T.text3 },
  navDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.grad0, marginTop: 1 },
  navCenter:   { flex: 1, alignItems: 'center', marginTop: -28, gap: 4 },
  navCenterBtn:{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: T.grad0, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 10, elevation: 8 },
  navCenterPlus:{ color: T.white, fontSize: 30, fontWeight: '700', lineHeight: 34 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, gap: 8, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle:      { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 2 },
  modalSub:    { fontSize: 12, color: T.text3, marginBottom: 8 },

  profileRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 },
  avatar:      { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 22, fontWeight: '800', color: T.white },
  name:        { fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 2 },
  email:       { fontSize: 12, color: T.text3, marginBottom: 6 },
  rolePill:    { alignSelf: 'flex-start', backgroundColor: 'rgba(124,77,255,0.09)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(124,77,255,0.20)' },
  rolePillTxt: { fontSize: 11, fontWeight: '700', color: T.grad0 },

  divider:   { height: 1, backgroundColor: T.border, marginVertical: 4 },
  item:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  itemIcon:  { width: 36, height: 36, borderRadius: 11, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: T.text2 },
  badge:     { backgroundColor: T.redBg, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: T.redBd, marginRight: 4 },
  badgeTxt:  { fontSize: 11, fontWeight: '800', color: T.redTxt },
  arrow:     { fontSize: 18, color: T.text3 },

  liveCTA:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
  liveDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: T.redTxt, marginRight: 10 },
  liveLabel: { color: T.text, fontSize: 15, fontWeight: '600' },

  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.redBg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: T.redBd, marginTop: 4 },
  signOutIcon:{ backgroundColor: 'rgba(239,68,68,0.12)', borderColor: T.redBd },
  signOutTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: T.redTxt },
  closeBtn:   { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  closeTxt:   { fontSize: 14, color: T.text3, fontWeight: '600' },

  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border },
  detailLabel:   { fontSize: 14, color: T.text3 },
  detailVal:     { fontSize: 14, fontWeight: '700', color: T.text },
  invoiceBtn:    { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  invoiceBtnTxt: { fontSize: 14, fontWeight: '700', color: T.white },

  emptyCard:   { backgroundColor: T.bg, borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.border },
  emptyTxt:    { fontSize: 14, color: T.text3, textAlign: 'center' },

  couponCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 8 },
  couponCode:   { fontSize: 16, fontWeight: '800', color: T.grad0, letterSpacing: 1.5 },
  couponDisc:   { fontSize: 13, color: T.text2, marginTop: 2 },
  couponDate:   { fontSize: 11, color: T.text3, marginTop: 2 },
  copyBtn:      { backgroundColor: 'rgba(124,77,255,0.09)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(124,77,255,0.20)' },
  copyBtnTxt:   { fontSize: 12, fontWeight: '700', color: T.grad0 },
  usedBadge:    { backgroundColor: T.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: T.border },
  usedTxt:      { fontSize: 11, color: T.text3 },
});
