import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  Animated, Easing, Modal, TextInput, KeyboardAvoidingView, Platform, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import { signOut } from '../services/authService';
import { supabase } from '../lib/supabase';
import { StaffStackParamList } from '../navigation/StaffNavigator';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#FAFAFC',
  surface: '#FFFFFF',
  grad0:   '#7C4DFF',
  grad1:   '#8B5CF6',
  grad2:   '#60A5FA',
  text:    '#1A1A1A',
  text2:   '#7B7B8A',
  text3:   '#AEAEBB',
  white:   '#FFFFFF',
  border:  'rgba(0,0,0,0.06)',
  okTxt:   '#10B981',
  okBg:    'rgba(16,185,129,0.10)',
  okBd:    'rgba(16,185,129,0.22)',
  saleBg:  'rgba(124,77,255,0.08)',
  saleBd:  'rgba(124,77,255,0.18)',
  redTxt:  '#EF4444',
  redBg:   'rgba(239,68,68,0.08)',
  redBd:   'rgba(239,68,68,0.18)',
};
const GRAD: [string, string, string]  = [T.grad0, T.grad1, T.grad2];
const GREEN_GRAD: [string, string]    = ['#10B981', '#059669'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  slot: string;
  turf: string;
  customer: string | null;
  phone: string | null;
  status: string;
  sport: string | null;
  amount: number;
  booking_date?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayFull() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getMonth()    { return new Date().toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(); }
function getDate()     { return new Date().getDate(); }
function getDayShort() { return new Date().toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(); }

function parseSlot(slot: string): { start: Date; end: Date } | null {
  const parts = slot.split(/\s*[–\-]\s*/);
  if (parts.length < 2) return null;
  const toDate = (t: string): Date => {
    const m = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return new Date('invalid');
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const pm = m[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  };
  const s = toDate(parts[0]);
  if (isNaN(s.getTime())) return null;
  const e = toDate(parts[1]);
  // Cross-midnight: end hour is earlier than start hour, so end is next calendar day
  if (e <= s) e.setDate(e.getDate() + 1);
  return { start: s, end: e };
}

function isCurrentSlot(slot: string): boolean {
  const times = parseSlot(slot);
  if (!times) return false;
  const now = new Date();
  return now >= times.start && now <= times.end;
}

// ─── Spring card ──────────────────────────────────────────────────────────────
function PressCard({ style, onPress, children, activeOpacity = 0.88 }: {
  style?: object; onPress?: () => void; children: React.ReactNode; activeOpacity?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    onPress?.();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPress={press} activeOpacity={activeOpacity} style={{ flex: 1 }}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StaffDashboardScreen() {
  const navigation           = useNavigation<Nav>();
  const { profile, setProfile } = useStore();

  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Booking | null>(null);
  const [editSlotTxt, setEditSlotTxt]   = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editPhone, setEditPhone]       = useState('');
  const [editAmount, setEditAmount]     = useState('');
  const [editStatus, setEditStatus]     = useState('');
  const [saving, setSaving]             = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim   = useRef(new Animated.Value(0)).current;
  const qaAnim     = useRef(new Animated.Value(0)).current;
  const slotsAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const stagger = (anim: Animated.Value, delay: number) =>
      Animated.timing(anim, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    Animated.parallel([
      stagger(headerAnim, 0),
      stagger(heroAnim,   80),
      stagger(qaAnim,     160),
      stagger(slotsAnim,  240),
    ]).start();
  }, []);

  const fade = (anim: Animated.Value, dy = 18) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  });

  const loadBookings = useCallback(async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yD = new Date(now); yD.setDate(yD.getDate() - 1);
    const yesterday = `${yD.getFullYear()}-${String(yD.getMonth() + 1).padStart(2, '0')}-${String(yD.getDate()).padStart(2, '0')}`;

    const [{ data: todayData }, { data: yestData }] = await Promise.all([
      supabase.from('bookings')
        .select('id, slot, turf, customer, phone, status, sport, amount, booking_date')
        .eq('booking_date', today)
        .in('status', ['Confirmed', 'Pending'])
        .order('slot', { ascending: true }),
      supabase.from('bookings')
        .select('id, slot, turf, customer, phone, status, sport, amount, booking_date')
        .eq('booking_date', yesterday)
        .in('status', ['Confirmed', 'Pending']),
    ]);

    // Cross-midnight: yesterday's slots whose END time is before 6 AM and hasn't passed yet.
    // Uses clock time — no dependency on staff finalizing/completing the booking.
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const crossMidnight = (yestData ?? []).filter((b: any) => {
      const parts = (b.slot ?? '').split(/\s*[–\-]\s*/);
      if (parts.length < 2) return false;
      const m = parts[1].trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (!m) return false;
      let endH = parseInt(m[1], 10);
      const endMin = parseInt(m[2], 10);
      if (m[3].toUpperCase() === 'AM' && endH === 12) endH = 0;
      if (m[3].toUpperCase() === 'PM' && endH !== 12) endH += 12;
      if (endH >= 6) return false;                          // not a cross-midnight end
      return nowMinutes < endH * 60 + endMin;               // auto-expire once slot ends
    });

    const all = [...(todayData ?? []), ...crossMidnight];
    setBookings(all.map((b: any) => ({
      id: b.id, slot: b.slot ?? '', turf: b.turf ?? 'Turf A',
      customer: b.customer ?? null, phone: b.phone ?? null,
      status: b.status, sport: b.sport ?? null,
      amount: Number(b.amount ?? 0), booking_date: b.booking_date ?? '',
    })));
  }, []);

  const loadPastBookings = useCallback(async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const { data } = await supabase
      .from('bookings')
      .select('id, slot, turf, customer, phone, status, sport, amount, booking_date')
      .lt('booking_date', today)
      .order('booking_date', { ascending: false })
      .limit(30);
    setPastBookings((data ?? []).map((b: any) => ({
      id: b.id, slot: b.slot ?? '', turf: b.turf ?? 'Turf A',
      customer: b.customer ?? null, phone: b.phone ?? null,
      status: b.status, sport: b.sport ?? null,
      amount: Number(b.amount ?? 0), booking_date: b.booking_date ?? '',
    })));
  }, []);

  useFocusEffect(useCallback(() => { loadBookings(); loadPastBookings(); }, [loadBookings, loadPastBookings]));

  // Reload at midnight so today's date flips correctly even if screen stays open
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now  = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 5, 0); // 5 s after midnight to be safe
      timer = setTimeout(() => {
        loadBookings();
        loadPastBookings();
        scheduleMidnight(); // reschedule for the following midnight
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    return () => clearTimeout(timer);
  }, [loadBookings, loadPastBookings]);

  // Also reload when phone wakes from sleep / app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadBookings();
        loadPastBookings();
      }
    });
    return () => sub.remove();
  }, [loadBookings, loadPastBookings]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); setProfile(null); } },
    ]);
  };

  const handleCancelBooking = async (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
        await supabase.from('bookings').update({ status: 'Cancelled' }).eq('id', id);
        setSelectedSlot(null);
        loadBookings();
      }},
    ]);
  };

  const openSlot = (b: Booking) => {
    setSelectedSlot(b);
    setEditSlotTxt(b.slot);
    setEditCustomer(b.customer ?? '');
    setEditPhone(b.phone ?? '');
    setEditAmount(String(b.amount));
    setEditStatus(b.status);
  };

  const handleSave = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    await supabase.from('bookings').update({
      slot:     editSlotTxt.trim(),
      customer: editCustomer.trim(),
      phone:    editPhone.trim(),
      amount:   Number(editAmount) || 0,
      status:   editStatus,
    }).eq('id', selectedSlot.id);
    setSaving(false);
    setSelectedSlot(null);
    loadBookings();
  };

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Staff';
  const initials  = (profile?.full_name?.split(' ').map((w) => w[0]).join('').slice(0, 2) ?? 'ST').toUpperCase();

  const currentBooking = bookings.find(b => isCurrentSlot(b.slot));

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Animated.View style={[s.header, fade(headerAnim, 12)]}>
            <TouchableOpacity style={s.headerLeft} onPress={() => setSidebarOpen(true)} activeOpacity={0.75}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
                <Text style={s.avatarTxt}>{initials}</Text>
              </LinearGradient>
              <View>
                <Text style={s.greeting}>Helloooo, {firstName} 👋</Text>
                <Text style={s.dateText}>{todayFull()}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Role badge ── */}
          <Animated.View style={[s.roleBadge, fade(headerAnim, 8)]}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.roleDot} />
            <Text style={s.roleTxt}>Staff · Turf Management Access</Text>
          </Animated.View>

          {/* ── Hero Card ── */}
          <Animated.View style={fade(heroAnim)}>
            <PressCard onPress={() => navigation.navigate('StaffBooking')} style={{ marginHorizontal: 20, marginBottom: 22 }}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
                <View style={s.heroBlob1} />
                <View style={s.heroBlob2} />
                <View style={s.heroLeft}>
                  <View style={s.calBox}>
                    <Text style={s.calMon}>{getMonth()}</Text>
                    <Text style={s.calNum}>{getDate()}</Text>
                    <Text style={s.calDay}>{getDayShort()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroTitle}>Book Slot</Text>
                    <Text style={s.heroSub}>Reserve turf time{'\n'}for a customer</Text>
                  </View>
                </View>
                <View style={s.turfWrap}>
                  <View style={s.turfBase}>
                    <View style={s.turfLine} />
                    <View style={s.turfCircle} />
                  </View>
                  <View style={s.clockWrap}><Text style={s.clockEmoji}>🕐</Text></View>
                </View>
                <View style={s.bookNowBtn}><Text style={s.bookNowTxt}>Book Now  →</Text></View>
              </LinearGradient>
            </PressCard>
          </Animated.View>

          {/* ── Sales (horizontal full-width) ── */}
          <Animated.View style={[fade(qaAnim), { marginHorizontal: 20, marginBottom: 22 }]}>
            <View style={s.sectionRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
            </View>
            <PressCard onPress={() => navigation.navigate('StaffSales')}>
              <View style={s.salesCard}>
                <LinearGradient colors={[T.saleBg, 'rgba(124,77,255,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <View style={s.salesIconWrap}>
                  <Text style={s.salesIcon}>🛒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.salesTitle}>Sales</Text>
                  <Text style={s.salesSub}>POS & item sales for today</Text>
                </View>
                <Text style={s.salesArrow}>›</Text>
              </View>
            </PressCard>
          </Animated.View>

          {/* ── Active Booking Card ── */}
          {currentBooking && (
            <Animated.View style={[fade(qaAnim), { marginHorizontal: 20, marginBottom: 18 }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => openSlot(currentBooking)}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.activeCard}>
                  <View style={s.activeLeft}>
                    <View style={s.activePill}>
                      <Text style={s.activePillTxt}>● Active</Text>
                    </View>
                    <Text style={s.activeName} numberOfLines={1}>{currentBooking.customer ?? 'Customer'}</Text>
                    <Text style={s.activeSlot}>{currentBooking.slot}{currentBooking.sport ? `  ·  ${currentBooking.sport}` : ''}</Text>
                  </View>
                  <View style={s.activeActions}>
                    <TouchableOpacity style={s.activeActionBtn} onPress={() => navigation.navigate('StaffSales')} activeOpacity={0.8}>
                      <Text style={s.activeActionTxt}>POS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.activeActionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => navigation.navigate('Bill', { bookingId: currentBooking.id })} activeOpacity={0.8}>
                      <Text style={s.activeActionTxt}>Invoice</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Booked Slots (today) ── */}
          {bookings.length > 0 && (
            <Animated.View style={[fade(slotsAnim), { marginBottom: 24 }]}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.okTxt }]} />
                <Text style={s.sectionLabel}>BOOKED SLOTS</Text>
                <Text style={s.slotCountBadge}>{bookings.length}</Text>
              </View>
              <View style={s.pillsWrap}>
                {bookings.map((b) => {
                  const isCurrent = isCurrentSlot(b.slot);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      activeOpacity={0.8}
                      onPress={() => openSlot(b)}
                    >
                      <LinearGradient
                        colors={isCurrent ? GREEN_GRAD : ['rgba(16,185,129,0.12)', 'rgba(5,150,105,0.10)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[s.slotPill, isCurrent && s.slotPillActive]}
                      >
                        {isCurrent && <View style={s.pillLiveDot} />}
                        <Text style={[s.pillTxt, isCurrent && s.pillTxtActive]}>{b.slot}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* ── Left Sidebar ── */}
      <Modal visible={sidebarOpen} transparent animationType="none" onRequestClose={() => setSidebarOpen(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Sidebar panel */}
          <View style={sb.panel}>
            {/* User section */}
            <View style={sb.userSection}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sb.bigAvatar}>
                <Text style={sb.bigAvatarTxt}>{initials}</Text>
              </LinearGradient>
              <Text style={sb.sbName}>{profile?.full_name ?? 'Staff'}</Text>
              <Text style={sb.sbRole}>Staff · Turf Management</Text>
            </View>

            <View style={sb.divider} />

            {/* Past Bookings */}
            {pastBookings.length > 0 && (
              <>
                <Text style={sb.pastHdr}>PAST BOOKINGS</Text>
                <ScrollView style={sb.pastScroll} showsVerticalScrollIndicator={false}>
                  {pastBookings.map((b) => {
                    const fmtDate = b.booking_date
                      ? new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '';
                    const statusColor = b.status === 'Confirmed' ? T.okTxt : b.status === 'Cancelled' ? T.redTxt : T.text2;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={sb.pastRow}
                        onPress={() => { setSidebarOpen(false); openSlot(b); }}
                        activeOpacity={0.75}
                      >
                        <Text style={sb.pastDate}>{fmtDate}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={sb.pastCustomer} numberOfLines={1}>{b.customer ?? 'Customer'}</Text>
                          <Text style={sb.pastSlot} numberOfLines={1}>{b.slot}</Text>
                        </View>
                        <Text style={[sb.pastStatus, { color: statusColor }]}>{b.status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={sb.divider} />
              </>
            )}

            {/* Sign out */}
            <TouchableOpacity style={sb.signOutBtn} onPress={() => { setSidebarOpen(false); handleSignOut(); }} activeOpacity={0.75}>
              <Text style={sb.signOutIcon}>↪</Text>
              <Text style={sb.signOutTxt}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* Tap-outside to close */}
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.40)' }} activeOpacity={1} onPress={() => setSidebarOpen(false)} />
        </View>
      </Modal>

      {/* ── Slot Detail Modal ── */}
      <Modal visible={!!selectedSlot} transparent animationType="slide">
        <KeyboardAvoidingView
          style={m.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelectedSlot(null)} />
          <ScrollView
            style={m.sheetScroll}
            contentContainerStyle={m.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={m.handle} />
            {selectedSlot && (
              <>
                <View style={m.modalHdr}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.modalTitle}>Edit Booking</Text>
                    <Text style={m.modalSub}>{selectedSlot.turf}{selectedSlot.sport ? `  ·  ${selectedSlot.sport}` : ''}</Text>
                  </View>
                  {isCurrentSlot(selectedSlot.slot) && (
                    <View style={m.liveChip}><View style={m.liveDot} /><Text style={m.liveTxt}>Live</Text></View>
                  )}
                </View>

                {([
                  { label: 'Slot Time', val: editSlotTxt,  set: setEditSlotTxt,   kb: 'default',    cap: 'none' },
                  { label: 'Customer',  val: editCustomer, set: setEditCustomer,  kb: 'default',    cap: 'words' },
                  { label: 'Phone',     val: editPhone,    set: setEditPhone,     kb: 'phone-pad',  cap: 'none' },
                  { label: 'Amount (₹)',val: editAmount,   set: setEditAmount,    kb: 'number-pad', cap: 'none' },
                ] as const).map((f) => (
                  <View key={f.label} style={m.fieldBlock}>
                    <Text style={m.fieldLbl}>{f.label}</Text>
                    <TextInput
                      style={m.fieldInput}
                      value={f.val}
                      onChangeText={f.set as (v: string) => void}
                      placeholderTextColor={T.text3}
                      keyboardType={f.kb as any}
                      autoCapitalize={f.cap as any}
                    />
                  </View>
                ))}

                <View style={m.fieldBlock}>
                  <Text style={m.fieldLbl}>Status</Text>
                  <View style={m.statusRow}>
                    {['Confirmed', 'Pending', 'Cancelled'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[m.statusPill, editStatus === st && m.statusPillActive]}
                        onPress={() => setEditStatus(st)}
                      >
                        <Text style={[m.statusPillTxt, editStatus === st && m.statusPillTxtActive]}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1, marginTop: 16 }}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.saveBtn}>
                    <Text style={m.saveBtnTxt}>{saving ? 'Saving…' : '✓  Save Changes'}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={m.cancelBookingBtn} onPress={() => handleCancelBooking(selectedSlot.id)}>
                  <Text style={m.cancelBookingTxt}>✕  Cancel Booking</Text>
                </TouchableOpacity>

                <TouchableOpacity style={m.closeBtn} onPress={() => setSelectedSlot(null)}>
                  <Text style={m.closeTxt}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: T.bg },
  scroll:  { paddingBottom: 24 },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar:      { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: T.grad0, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  avatarTxt:   { fontSize: 16, fontWeight: '800', color: T.white },
  greeting:    { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  dateText:    { fontSize: 12, color: T.text2, marginTop: 2 },

  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(124,77,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,77,255,0.16)' },
  roleDot:     { width: 8, height: 8, borderRadius: 4 },
  roleTxt:     { fontSize: 13, fontWeight: '700', color: T.grad0 },

  /* Active booking */
  activeCard:    { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: T.grad0, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 6 },
  activeLeft:    { flex: 1, gap: 2 },
  activePill:    { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2 },
  activePillTxt: { fontSize: 10, fontWeight: '700', color: T.white, letterSpacing: 0.3 },
  activeName:    { fontSize: 15, fontWeight: '800', color: T.white },
  activeSlot:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  activeActions: { flexDirection: 'row', gap: 8 },
  activeActionBtn:{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  activeActionTxt:{ fontSize: 12, fontWeight: '700', color: T.white },

  /* Hero */
  heroCard:    { borderRadius: 24, padding: 20, paddingBottom: 18, minHeight: 180, overflow: 'hidden', shadowColor: T.grad0, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 8 },
  heroBlob1:   { position: 'absolute', top: -30, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroBlob2:   { position: 'absolute', bottom: -40, left: 60, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroLeft:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  calBox:      { width: 68, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 16, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  calMon:      { fontSize: 10, fontWeight: '800', color: T.white, letterSpacing: 1 },
  calNum:      { fontSize: 28, fontWeight: '900', color: T.white, lineHeight: 32 },
  calDay:      { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.5 },
  heroTitle:   { fontSize: 22, fontWeight: '900', color: T.white, letterSpacing: -0.5 },
  heroSub:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18, marginTop: 4 },
  turfWrap:    { position: 'absolute', right: 16, top: 16, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  turfBase:    { width: 84, height: 64, backgroundColor: '#4ADE80', borderRadius: 8, opacity: 0.85, transform: [{ perspective: 600 }, { rotateX: '18deg' }, { rotateZ: '-8deg' }], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  turfLine:    { width: '60%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.60)', marginBottom: 6 },
  turfCircle:  { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.60)' },
  clockWrap:   { position: 'absolute', bottom: 2, right: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' },
  clockEmoji:  { fontSize: 20 },
  bookNowBtn:  { alignSelf: 'flex-start', backgroundColor: T.white, borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10 },
  bookNowTxt:  { fontSize: 14, fontWeight: '800', color: T.grad0 },

  /* Sections */
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: T.grad0 },
  sectionLabel: { fontSize: 9.5, fontWeight: '800', color: T.text2, letterSpacing: 2.2, textTransform: 'uppercase', flex: 1 },
  slotCountBadge:{ fontSize: 12, fontWeight: '800', color: T.okTxt, backgroundColor: T.okBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: T.okBd },

  /* Sales card */
  salesCard:   { borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: T.saleBd, backgroundColor: T.surface, overflow: 'hidden', shadowColor: 'rgba(124,77,255,0.10)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  salesIconWrap:{ width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(124,77,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  salesIcon:   { fontSize: 26 },
  salesTitle:  { fontSize: 17, fontWeight: '800', color: T.text },
  salesSub:    { fontSize: 12, color: T.text2, marginTop: 2 },
  salesArrow:  { fontSize: 22, color: T.text3, fontWeight: '600' },

  /* Booked pills */
  pillsWrap:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8 },
  slotPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: T.okBd },
  slotPillActive:{ borderColor: T.okTxt, shadowColor: T.okTxt, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  pillLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.white },
  pillTxt:     { fontSize: 13, fontWeight: '700', color: T.okTxt },
  pillTxtActive:{ color: T.white },
});

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheetScroll:  { flexGrow: 0 },
  sheet:        { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle:       { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  modalHdr:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: T.text },
  modalSub:     { fontSize: 12, color: T.text3, marginTop: 3 },
  liveChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.okBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.okBd },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: T.okTxt },
  liveTxt:      { fontSize: 11, fontWeight: '800', color: T.okTxt },

  fieldBlock:   { marginBottom: 12 },
  fieldLbl:     { fontSize: 11, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput:   { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text },

  statusRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusPill:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  statusPillActive: { backgroundColor: T.okBg, borderColor: T.okBd },
  statusPillTxt:    { fontSize: 13, fontWeight: '600', color: T.text2 },
  statusPillTxtActive: { color: T.okTxt, fontWeight: '700' },

  saveBtn:      { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt:   { fontSize: 15, fontWeight: '700', color: T.white },

  cancelBookingBtn:{ marginTop: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: T.redBg, borderWidth: 1, borderColor: T.redBd, alignItems: 'center' },
  cancelBookingTxt:{ fontSize: 14, fontWeight: '700', color: T.redTxt },

  closeBtn:     { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  closeTxt:     { fontSize: 14, color: T.text3, fontWeight: '600' },
});

const sb = StyleSheet.create({
  panel:        { width: 270, flex: 1, backgroundColor: T.surface, paddingTop: 60, paddingBottom: 40, borderRightWidth: 1, borderRightColor: T.border, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 4, height: 0 }, elevation: 8 },
  userSection:  { alignItems: 'center', paddingBottom: 20, paddingHorizontal: 24 },
  bigAvatar:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bigAvatarTxt: { fontSize: 26, fontWeight: '800', color: T.white },
  sbName:       { fontSize: 17, fontWeight: '800', color: T.text, textAlign: 'center' },
  sbRole:       { fontSize: 12, color: T.text3, marginTop: 4, textAlign: 'center' },
  divider:      { height: 1, backgroundColor: T.border, marginBottom: 16, marginHorizontal: 24 },
  pastHdr:      { fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8, marginHorizontal: 24 },
  pastScroll:   { flex: 1, marginBottom: 8 },
  pastRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: T.border },
  pastDate:     { fontSize: 10, fontWeight: '700', color: T.text3, width: 34 },
  pastCustomer: { fontSize: 12, fontWeight: '700', color: T.text },
  pastSlot:     { fontSize: 10, color: T.text3, marginTop: 1 },
  pastStatus:   { fontSize: 10, fontWeight: '700' },
  signOutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, marginTop: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)', backgroundColor: 'rgba(239,68,68,0.06)' },
  signOutIcon:  { fontSize: 18, color: T.redTxt },
  signOutTxt:   { fontSize: 15, fontWeight: '700', color: T.redTxt },
});
