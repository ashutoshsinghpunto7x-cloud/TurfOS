import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert, TextInput,
  KeyboardAvoidingView, Platform, Animated, Easing,
  ScrollView as RNScrollView, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useStore } from '../store/useStore';
import { useBookingScreen } from '../hooks/useBookingScreen';
import SlotHoldBanner      from '../components/booking/SlotHoldBanner';
import BookingRequestModal from './BookingRequestModal';
import { getCurrentISTTime } from '../services/bookingService';
import { StaffStackParamList } from '../navigation/StaffNavigator';

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const DEFAULT_TURF = 'Turf A';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       '#FAFAFC',
  surface:  '#FFFFFF',
  glass:    'rgba(255,255,255,0.72)',
  grad0:    '#7C4DFF',
  grad1:    '#8B5CF6',
  grad2:    '#60A5FA',
  text:     '#1A1A1A',
  text2:    '#7B7B8A',
  text3:    '#AEAEBB',
  textDis:  '#C8C8D0',
  white:    '#FFFFFF',
  bookedBg: 'rgba(16,185,129,0.10)',
  bookedBd: 'rgba(16,185,129,0.25)',
  bookedTxt:'#059669',
  errBg:    '#FFF5F5',
  errBd:    '#FECDD3',
  errTxt:   '#E11D48',
  okTxt:    '#10B981',
  border:   'rgba(0,0,0,0.06)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function next4Days() {
  return Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
}
function fmtDow(d: Date, i: number) {
  return i === 0 ? 'TODAY' : d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
}
function fmtMon(d: Date) { return d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(); }

function isSlotExpired(slotLabel: string): boolean {
  const [, endStr] = slotLabel.split('–');
  if (!endStr) return false;
  const [eh, em] = endStr.trim().split(':').map(Number);
  const { hours, minutes } = getCurrentISTTime();
  return hours * 60 + minutes >= eh * 60 + em;
}
function to12h(h24: number) { return { h12: h24 % 12 === 0 ? 12 : h24 % 12, per: (h24 < 12 ? 'AM' : 'PM') as 'AM' | 'PM' }; }
function to24h(h12: number, per: 'AM' | 'PM') { if (per === 'AM') return h12 === 12 ? 0 : h12; return h12 === 12 ? 12 : h12 + 12; }

const HOURS_12  = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ALL_MINS  = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS   = ['AM', 'PM'];
const DURATIONS = [
  { label: '30 m', mins: 30 }, { label: '1 hr', mins: 60 },
  { label: '1.5h', mins: 90 }, { label: '2 hr', mins: 120 }, { label: '3 hr', mins: 180 },
];

// ─── Drum Picker ──────────────────────────────────────────────────────────────
const DRUM_H = 46;

function Drum({ items, selected, onSelect, width = 76 }: {
  items: (string | number)[]; selected: string | number;
  onSelect: (v: string | number) => void; width?: number;
}) {
  const ref      = useRef<RNScrollView>(null);
  const dragging = useRef(false);
  const [internal, setInternal] = useState(selected);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx >= 0) setTimeout(() => ref.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 80);
  }, []);

  useEffect(() => {
    if (!dragging.current && selected !== internal) {
      setInternal(selected);
      const idx = items.indexOf(selected);
      // Use animated:false so programmatic jumps don't fire onMomentumScrollEnd
      // which would call onSelect with the wrong handler after mode switch
      if (idx >= 0) ref.current?.scrollTo({ y: idx * DRUM_H, animated: false });
    }
  }, [selected]);

  const snap = (y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / DRUM_H)));
    const val = items[idx];
    if (val !== undefined) { setInternal(val); if (val !== selected) onSelect(val); else ref.current?.scrollTo({ y: idx * DRUM_H, animated: true }); }
  };

  return (
    <View style={{ width, height: DRUM_H * 3, overflow: 'hidden' }}>
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: DRUM_H, left: 4, right: 4, height: DRUM_H, borderRadius: 13, zIndex: 0, shadowColor: T.grad0, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.26, shadowRadius: 10, elevation: 5 }}
        pointerEvents="none" />
      <LinearGradient colors={[T.bg, 'rgba(250,250,252,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DRUM_H, zIndex: 2 }} pointerEvents="none" />
      <LinearGradient colors={['rgba(250,250,252,0)', T.bg]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: DRUM_H, zIndex: 2 }} pointerEvents="none" />
      <RNScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={DRUM_H}
        decelerationRate="fast" nestedScrollEnabled
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => { dragging.current = false; snap(e.nativeEvent.contentOffset.y); }}
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) > 0.1) return; dragging.current = false; snap(e.nativeEvent.contentOffset.y); }}
        scrollEventThrottle={16} contentContainerStyle={{ paddingVertical: DRUM_H }}>
        {items.map((item, i) => {
          const isSel = item === internal;
          return (
            <View key={String(item) + i} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Text style={{ fontSize: isSel ? 24 : 16, fontWeight: isSel ? '800' : '500', color: isSel ? T.white : T.textDis, fontVariant: ['tabular-nums'], letterSpacing: isSel ? -0.5 : 0 }}>
                {typeof item === 'number' ? String(item).padStart(2, '0') : item}
              </Text>
            </View>
          );
        })}
      </RNScrollView>
    </View>
  );
}

// ─── Animated Date Card ───────────────────────────────────────────────────────
function DateCard({ date, label, isSelected, onPress }: { date: Date; label: string; isSelected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    onPress();
  };
  if (isSelected) return (
    <Animated.View style={[dc.wrap, { transform: [{ scale }] }]}>
      <TouchableOpacity onPress={press} activeOpacity={1}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={[dc.card, { borderWidth: 0 }]}>
          <Text style={[dc.dow, { color: 'rgba(255,255,255,0.80)' }]}>{label}</Text>
          <Text style={[dc.num, { color: T.white }]}>{date.getDate()}</Text>
          <Text style={[dc.mon, { color: 'rgba(255,255,255,0.70)' }]}>{fmtMon(date)}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
  return (
    <Animated.View style={[dc.wrap, { transform: [{ scale }] }]}>
      <TouchableOpacity onPress={press} activeOpacity={0.82} style={dc.card}>
        <Text style={dc.dow}>{label}</Text>
        <Text style={dc.num}>{date.getDate()}</Text>
        <Text style={dc.mon}>{fmtMon(date)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const dc = StyleSheet.create({
  wrap: { flex: 1 },
  card: { paddingVertical: 8, borderRadius: 16, backgroundColor: T.surface, alignItems: 'center', gap: 1, borderWidth: 1, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  dow:  { fontSize: 7.5, fontWeight: '700', color: T.text2, letterSpacing: 0.5 },
  num:  { fontSize: 18,  fontWeight: '800', color: T.text },
  mon:  { fontSize: 7.5, fontWeight: '600', color: T.text3 },
});

// ─── Inline Current Booking Card ──────────────────────────────────────────────
function CurrentBookingCard({ booking, expired, onPressPOS, onPressInvoice }: {
  booking: { id: string; customer: string; slot: string; sport?: string };
  expired: boolean;
  onPressPOS: () => void;
  onPressInvoice: () => void;
}) {
  return (
    <LinearGradient colors={expired ? ['#374151', '#4B5563'] : GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cb.card}>
      <View style={cb.left}>
        <View style={cb.pill}>
          <Text style={cb.pillTxt}>{expired ? 'Expired' : '● Active'}</Text>
        </View>
        <Text style={cb.name} numberOfLines={1}>{booking.customer}</Text>
        <Text style={cb.slot}>{booking.slot}{booking.sport ? `  ·  ${booking.sport}` : ''}</Text>
      </View>
      <View style={cb.actions}>
        <TouchableOpacity style={cb.actionBtn} onPress={onPressPOS} activeOpacity={0.8}>
          <Text style={cb.actionTxt}>POS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[cb.actionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={onPressInvoice} activeOpacity={0.8}>
          <Text style={cb.actionTxt}>Invoice</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
const cb = StyleSheet.create({
  card:      { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: T.grad0, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 6 },
  left:      { flex: 1, gap: 2 },
  pill:      { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2 },
  pillTxt:   { fontSize: 10, fontWeight: '700', color: T.white, letterSpacing: 0.3 },
  name:      { fontSize: 15, fontWeight: '800', color: T.white },
  slot:      { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  actions:   { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  actionTxt: { fontSize: 12, fontWeight: '700', color: T.white },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StaffBookingScreen() {
  const navigation  = useNavigation<Nav>();
  const { profile } = useStore();
  const days        = next4Days();
  const screen      = useBookingScreen(profile?.id ?? null, 'staff', null);

  const [calModal, setCalModal] = useState(false);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [custName,  setCustName]  = useState(profile?.full_name ?? '');
  const [custPhone, setCustPhone] = useState('');

  // ── Slot detail modal ───────────────────────────────────────────────────────
  const [chipDetail, setChipDetail] = useState<{
    id: string; slot: string; customer: string; phone: string | null;
    turf: string; sport: string | null; amount: number; status: string;
  } | null>(null);
  const [chipLoading, setChipLoading]       = useState(false);
  const [editSlotTxt, setEditSlotTxt]       = useState('');
  const [editChipCustomer, setEditChipCustomer] = useState('');
  const [editChipPhone, setEditChipPhone]   = useState('');
  const [editChipAmount, setEditChipAmount] = useState('');
  const [editChipStatus, setEditChipStatus] = useState('');
  const [savingSlot, setSavingSlot]         = useState(false);

  const openChipDetail = async (id: string) => {
    setChipLoading(true);
    setChipDetail(null);
    const { data } = await supabase
      .from('bookings')
      .select('id, slot, customer, phone, turf, sport, amount, status')
      .eq('id', id)
      .single();
    if (data) {
      setChipDetail({
        id: data.id, slot: data.slot ?? '', customer: data.customer ?? '—',
        phone: data.phone ?? null, turf: data.turf ?? 'Turf A',
        sport: data.sport ?? null, amount: Number(data.amount ?? 0),
        status: data.status,
      });
      setEditSlotTxt(data.slot ?? '');
      setEditChipCustomer(data.customer ?? '');
      setEditChipPhone(data.phone ?? '');
      setEditChipAmount(String(data.amount ?? 0));
      setEditChipStatus(data.status ?? 'Confirmed');
    }
    setChipLoading(false);
  };

  const handleSaveChipDetails = async () => {
    if (!chipDetail) return;
    setSavingSlot(true);
    await supabase.from('bookings').update({
      slot:     editSlotTxt.trim(),
      customer: editChipCustomer.trim(),
      phone:    editChipPhone.trim(),
      amount:   Number(editChipAmount) || 0,
      status:   editChipStatus,
    }).eq('id', chipDetail.id);
    setSavingSlot(false);
    setChipDetail(null);
    screen.loadBookings();
  };

  const handleCancelChipBooking = async () => {
    if (!chipDetail) return;
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
        await supabase.from('bookings').update({ status: 'Cancelled' }).eq('id', chipDetail.id);
        setChipDetail(null);
        screen.loadBookings();
      }},
    ]);
  };

  const initStart = to12h(screen.startH);
  const [startH12, setStartH12] = useState<number>(initStart.h12);
  const [startMin, setStartMin] = useState<number>(Math.round(screen.startM / 5) * 5 % 60);
  const [startPer, setStartPer] = useState<'AM' | 'PM'>(initStart.per);
  const [endTimeMode, setEndTimeMode] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set initial end = start + 1 hr
    const h24 = to24h(initStart.h12, initStart.per);
    const total = h24 * 60 + screen.startM + 60;
    screen.setEndH(Math.floor(total / 60) % 24);
    screen.setEndM(total % 60);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  // Start handlers — only change start, never touch end
  const handleStartH12 = (v: string | number) => { const h = v as number; setStartH12(h); screen.setStartH(to24h(h, startPer)); };
  const handleStartMin = (v: string | number) => { const m = v as number; setStartMin(m); screen.setStartM(m); };
  const handleStartPer = (v: string | number) => { const per = v as 'AM' | 'PM'; setStartPer(per); screen.setStartH(to24h(startH12, per)); };

  // Duration pills — set end = start + duration
  const handleDuration = (dur: number) => {
    const total = to24h(startH12, startPer) * 60 + startMin + dur;
    screen.setEndH(Math.floor(total / 60) % 24);
    screen.setEndM(total % 60);
  };

  // End display comes directly from hook state — independent of start
  const endDisp12     = to12h(screen.endH);
  const endMinDisplay = screen.endM;

  // Derive active duration pill from actual start/end difference
  const startTotalM = to24h(startH12, startPer) * 60 + startMin;
  const endTotalM   = screen.endH * 60 + screen.endM;
  const computedDur = endTotalM >= startTotalM
    ? endTotalM - startTotalM
    : endTotalM + 1440 - startTotalM;

  // End handlers — set end directly, never touch start
  const handleEndH12 = (v: string | number) => { screen.setEndH(to24h(v as number, endDisp12.per)); };
  const handleEndMin = (v: string | number) => { screen.setEndM(v as number); };
  const handleEndPer = (v: string | number) => { screen.setEndH(to24h(endDisp12.h12, v as 'AM' | 'PM')); };

  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDay    = new Date(calYear, calMonth, 1).getDay();
  const calMonthLabel  = new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const handleCalSelect = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return;
    screen.setSelectedDate(d); setCalModal(false);
  };

  const hasError = !!(screen.slotConflict || screen.timeError);
  const expired  = screen.currentBooking ? isSlotExpired(screen.currentBooking.slot) : false;
  const selMonth = screen.selectedDate.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
  const selDay   = screen.selectedDate.getDate();

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

            {/* ── Header ── */}
            <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
                <Text style={s.backArrow}>←</Text>
              </TouchableOpacity>
              <View style={s.headerMid}>
                <Text style={s.headerTitle}>Book a Slot</Text>
                <Text style={s.headerSub}>Staff · {profile?.full_name?.split(' ')[0] ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setCalModal(true)} activeOpacity={0.82}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.calBadge}>
                  <Text style={s.calBadgeMon}>{selMonth}</Text>
                  <Text style={s.calBadgeDay}>{selDay}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ── Scrollable body (keyboard-safe) ── */}
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >

            {/* ── Date Strip ── */}
            <View style={s.dateStrip}>
              {days.map((d, i) => (
                <DateCard key={toISO(d)} date={d} label={fmtDow(d, i)}
                  isSelected={toISO(d) === toISO(screen.selectedDate)}
                  onPress={() => screen.setSelectedDate(d)} />
              ))}
              <TouchableOpacity style={s.moreBtn} onPress={() => setCalModal(true)} activeOpacity={0.8}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.moreBadge}>
                  <Text style={s.moreBadgeMon}>{selMonth}</Text>
                  <Text style={s.moreBadgeDay}>{selDay}</Text>
                </LinearGradient>
                <Text style={s.moreLabel}>More</Text>
              </TouchableOpacity>
            </View>

            {/* ── Current Booking ── */}
            {screen.currentBooking && (
              <View style={s.px}>
                <CurrentBookingCard
                  booking={screen.currentBooking}
                  expired={expired}
                  onPressPOS={() => navigation.navigate('StaffSales', { bookingId: screen.currentBooking!.id, bookingCustomer: screen.currentBooking!.customer } as any)}
                  onPressInvoice={() => navigation.navigate('Bill', { bookingId: screen.currentBooking!.id } as any)}
                />
              </View>
            )}

            {/* ── Booked chips ── */}
            {screen.loadingSlots ? (
              <View style={s.chipRow}><ActivityIndicator size="small" color={T.grad0} /></View>
            ) : screen.bookings.length === 0 && screen.activeHolds.length === 0 ? (
              <View style={s.chipRow}>
                <View style={s.allClear}><Text style={s.allClearTxt}>✓  All slots available</Text></View>
              </View>
            ) : (
              <View style={s.chipBlock}>
                <Text style={s.chipLabel}>Booked:</Text>
                <View style={s.chipWrap}>
                  {screen.bookings.map((b, i) => (
                    <TouchableOpacity
                      key={`b-${b.id}-${i}`}
                      style={s.bookedChip}
                      activeOpacity={0.75}
                      onPress={() => openChipDetail(b.id)}
                    >
                      <Text style={s.bookedChipTxt}>{b.slot}</Text>
                    </TouchableOpacity>
                  ))}
                  {screen.activeHolds.map((h, i) => (
                    <View key={`h-${i}`} style={s.holdChip}><Text style={s.holdChipTxt}>⏳ {h.slotLabel}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Hold banner ── */}
            {screen.holdState.holdId && screen.holdState.expiresAt && (
              <View style={s.px}><SlotHoldBanner queuePos={screen.holdState.queuePos} expiresAt={screen.holdState.expiresAt} /></View>
            )}
            {!screen.holdState.holdId && (() => {
              const hold = screen.activeHolds.find((h) => h.slotLabel === screen.slotLabel);
              if (!hold) return null;
              return <View style={s.px}><SlotHoldBanner queuePos={hold.queueCount + 1} expiresAt={new Date(hold.expiresAt)} /></View>;
            })()}

            {/* ── Time Picker ── */}
            <View style={s.sectionRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionLabel}>{endTimeMode ? 'END TIME' : 'START TIME'}</Text>
              <View style={s.timeToggleWrap}>
                <TouchableOpacity style={[s.timePill, !endTimeMode && s.timePillActive]} onPress={() => setEndTimeMode(false)} activeOpacity={0.8}>
                  <Text style={[s.timePillTxt, !endTimeMode && s.timePillTxtActive]}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.timePill, endTimeMode && s.timePillActive]} onPress={() => setEndTimeMode(true)} activeOpacity={0.8}>
                  <Text style={[s.timePillTxt, endTimeMode && s.timePillTxtActive]}>End</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[s.px, { marginBottom: 0 }]}>
              <View style={s.drumCard}>
                <View style={s.drumHdrRow}>
                  <Text style={[s.drumHdr, { flex: 3, textAlign: 'center' }]}>HOUR</Text>
                  <View style={{ width: 24 }} />
                  <Text style={[s.drumHdr, { flex: 3, textAlign: 'center' }]}>MIN</Text>
                  <Text style={[s.drumHdr, { flex: 2, textAlign: 'center' }]}>AM/PM</Text>
                </View>
                <View style={s.drumRow}>
                  <View style={{ flex: 3, alignItems: 'center' }}>
                    <Drum items={HOURS_12} selected={endTimeMode ? endDisp12.h12 : startH12} onSelect={endTimeMode ? handleEndH12 : handleStartH12} width={76} />
                  </View>
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <Text style={s.colon}>:</Text>
                  </View>
                  <View style={{ flex: 3, alignItems: 'center' }}>
                    <Drum items={ALL_MINS} selected={endTimeMode ? endMinDisplay : startMin} onSelect={endTimeMode ? handleEndMin : handleStartMin} width={76} />
                  </View>
                  <View style={{ flex: 2, alignItems: 'center' }}>
                    <Drum items={PERIODS} selected={endTimeMode ? endDisp12.per : startPer} onSelect={endTimeMode ? handleEndPer : handleStartPer} width={60} />
                  </View>
                </View>
              </View>
            </View>

            {/* ── Duration ── */}
            <View style={s.sectionRow}>
              <View style={s.sectionDot} /><Text style={s.sectionLabel}>DURATION</Text>
            </View>
            <View style={s.durRow}>
              {DURATIONS.map(({ label, mins }) => {
                const isSel = computedDur === mins;
                return isSel ? (
                  <LinearGradient key={mins} colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.durPillSel}>
                    <TouchableOpacity onPress={() => handleDuration(mins)} activeOpacity={0.8}>
                      <Text style={s.durTxtSel}>{label}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity key={mins} style={s.durPill} onPress={() => handleDuration(mins)} activeOpacity={0.75}>
                    <Text style={s.durTxt}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Customer Info ── (lines 508–530 — uncomment to re-enable name/phone fields)
            <View style={s.sectionRow}>
              <View style={s.sectionDot} /><Text style={s.sectionLabel}>CUSTOMER</Text>
            </View>
            <View style={[s.px, { gap: 8, marginBottom: 4 }]}>
              <TextInput
                style={s.infoInput}
                value={custName}
                onChangeText={setCustName}
                placeholder="Customer name"
                placeholderTextColor={T.text3}
                autoCapitalize="words"
              />
              <TextInput
                style={s.infoInput}
                value={custPhone}
                onChangeText={(t) => setCustPhone(t.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit phone number"
                placeholderTextColor={T.text3}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            */}

            {/* ── Error ── */}
            {hasError && (
              <View style={[s.px, { marginTop: 8 }]}>
                <View style={s.errBanner}>
                  <Text style={s.errIcon}>⚠</Text>
                  <Text style={s.errTxt}>{screen.slotConflict?.message ?? screen.timeError}</Text>
                </View>
              </View>
            )}

            </ScrollView>

            {/* ── Continue Button — fixed at bottom, outside scroll ── */}
            {!hasError && screen.durationMinutes > 0 && (
              <View style={s.contWrap}>
                <TouchableOpacity
                  onPress={() => profile?.id && screen.handleOpenRequestModal(profile.id)}
                  disabled={screen.acquiringHold}
                  activeOpacity={0.88}
                  style={{ opacity: screen.acquiringHold ? 0.65 : 1 }}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.contBtn}>
                    {screen.acquiringHold
                      ? <ActivityIndicator color="#fff" />
                      : <><Text style={s.contBtnTxt}>Continue</Text><Text style={s.contBtnArrow}> →</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Booking Modal */}
      <BookingRequestModal
        visible={screen.requestModalOpen}
        onClose={() => screen.setRequestModalOpen(false)}
        onSuccess={(autoBooked) => {
          screen.setRequestModalOpen(false);
          screen.loadBookings();
          Alert.alert(
            autoBooked ? '✓ Booking Confirmed' : '✓ Request Submitted',
            autoBooked ? 'Slot booked and confirmed successfully.' : 'Booking request sent to the owner for approval.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }}
        holdId={screen.holdState.holdId}
        bookingDate={toISO(screen.selectedDate)}
        turf={DEFAULT_TURF}
        slotLabel={screen.slotLabel}
        durationMinutes={screen.durationMinutes}
        bookingSourceRole="staff"
        prefillName={custName || profile?.full_name}
        prefillPhone={custPhone}
      />

      {/* Slot Detail Modal */}
      <Modal visible={!!chipDetail || chipLoading} transparent animationType="slide">
        <KeyboardAvoidingView
          style={sd.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setChipDetail(null)} />
          <ScrollView
            style={sd.sheetScroll}
            contentContainerStyle={sd.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={sd.handle} />
            {chipLoading ? (
              <ActivityIndicator color={T.grad0} style={{ marginVertical: 30 }} />
            ) : chipDetail ? (
              <>
                <View style={sd.modalHdr}>
                  <View style={{ flex: 1 }}>
                    <Text style={sd.modalTitle}>Edit Booking</Text>
                    <Text style={sd.modalSub}>{chipDetail.turf}{chipDetail.sport ? `  ·  ${chipDetail.sport}` : ''}</Text>
                  </View>
                </View>

                {([
                  { label: 'Slot Time', val: editSlotTxt,       set: setEditSlotTxt,       kb: 'default',    cap: 'none' },
                  { label: 'Customer',  val: editChipCustomer,  set: setEditChipCustomer,  kb: 'default',    cap: 'words' },
                  { label: 'Phone',     val: editChipPhone,     set: setEditChipPhone,     kb: 'phone-pad',  cap: 'none' },
                  { label: 'Amount (₹)',val: editChipAmount,    set: setEditChipAmount,    kb: 'number-pad', cap: 'none' },
                ] as const).map((f) => (
                  <View key={f.label} style={sd.fieldBlock}>
                    <Text style={sd.fieldLbl}>{f.label}</Text>
                    <TextInput
                      style={sd.fieldInput}
                      value={f.val}
                      onChangeText={f.set as (v: string) => void}
                      placeholderTextColor={T.text3}
                      keyboardType={f.kb as any}
                      autoCapitalize={f.cap as any}
                    />
                  </View>
                ))}

                <View style={sd.fieldBlock}>
                  <Text style={sd.fieldLbl}>Status</Text>
                  <View style={sd.statusRow}>
                    {['Confirmed', 'Pending', 'Cancelled'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[sd.statusPill, editChipStatus === st && sd.statusPillActive]}
                        onPress={() => setEditChipStatus(st)}
                      >
                        <Text style={[sd.statusPillTxt, editChipStatus === st && sd.statusPillTxtActive]}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity onPress={handleSaveChipDetails} disabled={savingSlot} style={{ opacity: savingSlot ? 0.7 : 1, marginTop: 16 }}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sd.saveBtn}>
                    <Text style={sd.saveBtnTxt}>{savingSlot ? 'Saving…' : '✓  Save Changes'}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={sd.cancelBookingBtn} onPress={handleCancelChipBooking}>
                  <Text style={sd.cancelBookingTxt}>✕  Cancel Booking</Text>
                </TouchableOpacity>

                <TouchableOpacity style={sd.closeBtn} onPress={() => setChipDetail(null)}>
                  <Text style={sd.closeTxt}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={calModal} transparent animationType="fade">
        <View style={s.calOverlay}>
          <View style={s.calSheet}>
            <View style={s.calHandle} />
            <Text style={s.calTitle}>Pick a Date</Text>
            <View style={s.calMonthRow}>
              <TouchableOpacity style={s.calNavBtn} activeOpacity={0.8}
                onPress={() => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1)}>
                <Text style={s.calNavTxt}>‹</Text>
              </TouchableOpacity>
              <Text style={s.calMonthTxt}>{calMonthLabel}</Text>
              <TouchableOpacity style={s.calNavBtn} activeOpacity={0.8}
                onPress={() => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1)}>
                <Text style={s.calNavTxt}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={s.calDayHdrs}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <Text key={d} style={s.calDayHdr}>{d}</Text>)}
            </View>
            <View style={s.calGrid}>
              {Array.from({ length: calFirstDay }, (_, i) => <View key={`e${i}`} style={s.calCell} />)}
              {Array.from({ length: calDaysInMonth }, (_, i) => {
                const day = i + 1;
                const date = new Date(calYear, calMonth, day);
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const isSel  = toISO(date) === toISO(screen.selectedDate);
                return (
                  <TouchableOpacity key={day} style={[s.calCell, isPast && { opacity: 0.28 }]}
                    onPress={() => !isPast && handleCalSelect(day)} disabled={isPast} activeOpacity={0.75}>
                    {isSel && <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.calSelBg} />}
                    <Text style={[s.calDayTxt, isSel && { color: T.white, fontWeight: '700' }]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={s.calCancel} onPress={() => setCalModal(false)} activeOpacity={0.8}>
              <Text style={s.calCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: T.bg },
  px:         { paddingHorizontal: 20, marginBottom: 10 },

  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border, gap: 12 },
  backBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  backArrow:  { fontSize: 18, color: T.text, lineHeight: 22 },
  headerMid:  { flex: 1, alignItems: 'center' },
  headerTitle:{ fontSize: 16, fontWeight: '700', color: T.text, letterSpacing: -0.2 },
  headerSub:  { fontSize: 11, color: T.text2, marginTop: 1 },
  calBadge:   { width: 42, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 1 },
  calBadgeMon:{ fontSize: 7.5, fontWeight: '800', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.8 },
  calBadgeDay:{ fontSize: 20, fontWeight: '900', color: T.white, lineHeight: 24 },

  dateStrip:  { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  moreBtn:    { flex: 1, alignItems: 'center', gap: 3, justifyContent: 'center' },
  moreBadge:  { width: 34, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 0 },
  moreBadgeMon:{ fontSize: 6.5, fontWeight: '800', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.5 },
  moreBadgeDay:{ fontSize: 14, fontWeight: '900', color: T.white },
  moreLabel:  { fontSize: 7.5, fontWeight: '600', color: T.text2 },

  chipRow:      { height: 34, paddingHorizontal: 20, marginBottom: 8, justifyContent: 'center' },
  chipBlock:    { paddingHorizontal: 20, marginBottom: 10 },
  chipLabel:    { fontSize: 11, fontWeight: '800', color: T.text2, marginBottom: 8, letterSpacing: 0.3 },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allClear:     { flexDirection: 'row', alignItems: 'center' },
  allClearTxt:  { fontSize: 11, fontWeight: '600', color: T.okTxt },
  bookedChip:   { backgroundColor: T.bookedBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: T.bookedBd },
  bookedChipTxt:{ fontSize: 12, fontWeight: '700', color: T.bookedTxt },
  holdChip:     { backgroundColor: 'rgba(251,191,36,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)' },
  holdChipTxt:  { fontSize: 12, fontWeight: '700', color: '#D97706' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  sectionDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.grad0 },
  sectionLabel:{ fontSize: 9, fontWeight: '800', color: T.text2, letterSpacing: 2, textTransform: 'uppercase', flex: 1 },
  timeToggleWrap:{ flexDirection: 'row', backgroundColor: T.bg, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 2, gap: 2 },
  timePill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18 },
  timePillActive:{ backgroundColor: T.grad0 },
  timePillTxt: { fontSize: 10, fontWeight: '700', color: T.text2 },
  timePillTxtActive:{ color: T.white },

  drumCard:   { backgroundColor: T.glass, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', padding: 10, shadowColor: T.grad0, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 4 },
  drumHdrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, paddingHorizontal: 2 },
  drumHdr:    { fontSize: 8, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 1.5 },
  drumRow:    { flexDirection: 'row', alignItems: 'center' },
  colon:      { fontSize: 24, fontWeight: '200', color: T.textDis, textAlign: 'center', marginBottom: 4 },

  infoInput:  { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: T.text },
  durRow:     { flexDirection: 'row', gap: 7, paddingHorizontal: 20, flexWrap: 'wrap' },
  durPill:    { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 50, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.04)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  durPillSel: { borderRadius: 50, shadowColor: T.grad0, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 4 },
  durTxt:     { fontSize: 12, fontWeight: '600', color: T.text2 },
  durTxtSel:  { fontSize: 12, fontWeight: '700', color: T.white, paddingHorizontal: 13, paddingVertical: 7 },

  errBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.errBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.errBd },
  errIcon:    { fontSize: 13, color: T.errTxt },
  errTxt:     { flex: 1, fontSize: 12, fontWeight: '600', color: T.errTxt },

  contWrap:   { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12 },
  contBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, borderRadius: 18, shadowColor: T.grad0, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 7 },
  contBtnTxt: { fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 0.2 },
  contBtnArrow:{ fontSize: 18, fontWeight: '800', color: T.white },

  calOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.55)', justifyContent: 'flex-end' },
  calSheet:   { backgroundColor: T.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  calHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 20 },
  calTitle:   { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 20, textAlign: 'center' },
  calMonthRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  calNavBtn:  { width: 38, height: 38, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  calNavTxt:  { fontSize: 22, color: T.text, fontWeight: '600' },
  calMonthTxt:{ fontSize: 15, fontWeight: '700', color: T.text },
  calDayHdrs: { flexDirection: 'row', marginBottom: 10 },
  calDayHdr:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: T.text2 },
  calGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:    { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 50 },
  calSelBg:   { ...StyleSheet.absoluteFillObject, borderRadius: 50 },
  calDayTxt:  { fontSize: 14, fontWeight: '500', color: T.text, zIndex: 1 },
  calCancel:  { marginTop: 20, paddingVertical: 15, alignItems: 'center', backgroundColor: T.bg, borderRadius: 16, borderWidth: 1, borderColor: T.border },
  calCancelTxt:{ fontSize: 14, fontWeight: '700', color: T.text2 },
});

const sd = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheetScroll:      { flexGrow: 0 },
  sheet:            { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle:           { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHdr:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:       { fontSize: 20, fontWeight: '800', color: T.text },
  modalSub:         { fontSize: 12, color: T.text3, marginTop: 3 },
  fieldBlock:       { marginBottom: 12 },
  fieldLbl:         { fontSize: 11, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput:       { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text },
  statusRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusPill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  statusPillActive: { backgroundColor: T.bookedBg, borderColor: T.bookedBd },
  statusPillTxt:    { fontSize: 13, fontWeight: '600', color: T.text2 },
  statusPillTxtActive: { color: T.bookedTxt, fontWeight: '700' },
  saveBtn:          { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt:       { fontSize: 15, fontWeight: '700', color: T.white },
  cancelBookingBtn: { marginTop: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', alignItems: 'center' },
  cancelBookingTxt: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  closeBtn:         { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  closeTxt:         { fontSize: 14, color: T.text3, fontWeight: '600' },
});
