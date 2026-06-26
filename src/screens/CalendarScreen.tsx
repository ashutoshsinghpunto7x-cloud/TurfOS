import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert,
  KeyboardAvoidingView, Platform, Animated, Easing,
  ScrollView as RNScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { useStore } from '../store/useStore';
import { useBookingScreen } from '../hooks/useBookingScreen';
import CurrentBookingBlock from '../components/booking/CurrentBookingBlock';
import SlotHoldBanner      from '../components/booking/SlotHoldBanner';
import BookingRequestModal from './BookingRequestModal';
import { getCurrentISTTime } from '../services/bookingService';

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
  bookedBg: '#FFF0F3',
  bookedBd: '#FFD4DD',
  bookedTxt:'#FF5A76',
  errBg:    '#FFF5F5',
  errBd:    '#FECDD3',
  errTxt:   '#E11D48',
  okTxt:    '#10B981',
  border:   'rgba(0,0,0,0.06)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISO(d: Date): string { return d.toISOString().slice(0, 10); }
function next4Days(): Date[] {
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
}
function fmtDow(d: Date, i: number) {
  if (i === 0) return 'TODAY';
  return d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
}
function fmtMon(d: Date) {
  return d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
}
function isSlotExpired(slotLabel: string): boolean {
  const [, endStr] = slotLabel.split('–');
  if (!endStr) return false;
  const [eh, em] = endStr.trim().split(':').map(Number);
  const { hours, minutes } = getCurrentISTTime();
  return hours * 60 + minutes >= eh * 60 + em;
}
function to12h(h24: number): { h12: number; per: 'AM' | 'PM' } {
  return { h12: h24 % 12 === 0 ? 12 : h24 % 12, per: h24 < 12 ? 'AM' : 'PM' };
}
function to24h(h12: number, per: 'AM' | 'PM'): number {
  if (per === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

// ─── Time constants ───────────────────────────────────────────────────────────
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ALL_MINS = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS  = ['AM', 'PM'];
const DURATIONS = [
  { label: '30 m',  mins: 30  },
  { label: '1 hr',  mins: 60  },
  { label: '1.5hr', mins: 90  },
  { label: '2 hr',  mins: 120 },
  { label: '3 hr',  mins: 180 },
];

// ─── Drum Picker ──────────────────────────────────────────────────────────────
const DRUM_H   = 52;
const DRUM_VIS = 3;
const DRUM_PAD = 1;

function Drum({ items, selected, onSelect, width = 82 }: {
  items: (string | number)[]; selected: string | number;
  onSelect: (v: string | number) => void; width?: number;
}) {
  const scrollRef = useRef<RNScrollView>(null);
  const dragging  = useRef(false);
  const [internal, setInternal] = useState(selected);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx >= 0) setTimeout(() => scrollRef.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 80);
  }, []);

  useEffect(() => {
    if (!dragging.current && selected !== internal) {
      setInternal(selected);
      const idx = items.indexOf(selected);
      if (idx >= 0) scrollRef.current?.scrollTo({ y: idx * DRUM_H, animated: true });
    }
  }, [selected]);

  const snap = (y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / DRUM_H)));
    const val = items[idx];
    if (val !== undefined) {
      setInternal(val);
      if (val !== selected) onSelect(val);
      else scrollRef.current?.scrollTo({ y: idx * DRUM_H, animated: true });
    }
  };

  return (
    <View style={{ width, height: DRUM_H * DRUM_VIS, overflow: 'hidden' }}>
      <LinearGradient
        colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute', top: DRUM_H * DRUM_PAD,
          left: 6, right: 6, height: DRUM_H, borderRadius: 14, zIndex: 0,
          shadowColor: T.grad0, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
        }}
        pointerEvents="none"
      />
      <LinearGradient colors={[T.bg, 'rgba(250,250,252,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DRUM_H * DRUM_PAD, zIndex: 2 }}
        pointerEvents="none" />
      <LinearGradient colors={['rgba(250,250,252,0)', T.bg]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: DRUM_H * DRUM_PAD, zIndex: 2 }}
        pointerEvents="none" />
      <RNScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_H} decelerationRate="fast" nestedScrollEnabled
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          dragging.current = false; snap(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) > 0.1) return;
          dragging.current = false; snap(e.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: DRUM_H * DRUM_PAD }}
      >
        {items.map((item, i) => {
          const isSel = item === internal;
          return (
            <View key={String(item) + i} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Text style={{
                fontSize: isSel ? 26 : 17, fontWeight: isSel ? '800' : '500',
                color: isSel ? T.white : T.textDis, fontVariant: ['tabular-nums'],
                letterSpacing: isSel ? -0.5 : 0,
              }}>
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
function DateCard({ date, label, isSelected, onPress }: {
  date: Date; label: string; isSelected: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    onPress();
  };
  if (isSelected) {
    return (
      <Animated.View style={[dc.wrap, { transform: [{ scale }] }]}>
        <TouchableOpacity onPress={press} activeOpacity={1}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={[dc.card, dc.cardSel]}>
            <Text style={dc.dowSel}>{label}</Text>
            <Text style={dc.numSel}>{date.getDate()}</Text>
            <Text style={dc.monSel}>{fmtMon(date)}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }
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
  wrap:    { flex: 1 },
  card:    { paddingVertical: 10, borderRadius: 18, backgroundColor: T.surface, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.07)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  cardSel: { borderWidth: 0 },
  dow:     { fontSize: 8,  fontWeight: '700', color: T.text2, letterSpacing: 0.5 },
  dowSel:  { fontSize: 8,  fontWeight: '700', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.5 },
  num:     { fontSize: 20, fontWeight: '800', color: T.text },
  numSel:  { fontSize: 20, fontWeight: '800', color: T.white },
  mon:     { fontSize: 8,  fontWeight: '600', color: T.text3 },
  monSel:  { fontSize: 8,  fontWeight: '600', color: 'rgba(255,255,255,0.70)' },
});

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ backgroundColor: T.glass, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', shadowColor: T.grad0, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 }, style]}>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const navigation  = useNavigation();
  const { profile } = useStore();
  const days        = next4Days();

  const screen = useBookingScreen(profile?.id ?? null, 'owner', null);

  const [calModal, setCalModal] = useState(false);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const initStart = to12h(screen.startH);
  const [startH12, setStartH12] = useState<number>(initStart.h12);
  const [startMin, setStartMin] = useState<number>(Math.round(screen.startM / 5) * 5 % 60);
  const [startPer, setStartPer] = useState<'AM' | 'PM'>(initStart.per);
  const [durMins,  setDurMins]  = useState<number>(60);

  const dateAnim = useRef(new Animated.Value(0)).current;
  const timeAnim = useRef(new Animated.Value(0)).current;
  const durAnim  = useRef(new Animated.Value(0)).current;
  const btnAnim  = useRef(new Animated.Value(0)).current;
  const btnFloat = useRef(new Animated.Value(0)).current;

  const applyEnd = useCallback((h24: number, m: number, dur: number) => {
    const total = h24 * 60 + m + dur;
    screen.setEndH(Math.floor(total / 60) % 24);
    screen.setEndM(total % 60);
  }, [screen]);

  const handleStartH12 = (v: string | number) => {
    const h = v as number; setStartH12(h);
    const h24 = to24h(h, startPer); screen.setStartH(h24);
    applyEnd(h24, startMin, durMins);
  };
  const handleStartMin = (v: string | number) => {
    const m = v as number; setStartMin(m); screen.setStartM(m);
    applyEnd(to24h(startH12, startPer), m, durMins);
  };
  const handleStartPer = (v: string | number) => {
    const per = v as 'AM' | 'PM'; setStartPer(per);
    const h24 = to24h(startH12, per); screen.setStartH(h24);
    applyEnd(h24, startMin, durMins);
  };
  const handleDuration = (dur: number) => {
    setDurMins(dur);
    applyEnd(to24h(startH12, startPer), startMin, dur);
  };

  useEffect(() => {
    applyEnd(to24h(initStart.h12, initStart.per), screen.startM, 60);

    const stagger = (anim: Animated.Value, delay: number) =>
      Animated.timing(anim, { toValue: 1, duration: 500, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });

    Animated.parallel([
      stagger(dateAnim, 0),
      stagger(timeAnim, 100),
      stagger(durAnim,  200),
      stagger(btnAnim,  300),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(btnFloat, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(btnFloat, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const btnTranslate = btnFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  const calDaysInMonth   = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDay      = new Date(calYear, calMonth, 1).getDay();
  const calMonthLabel    = new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const currentMonthYear = screen.selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.headerTitle}>Calendar</Text>
              <Text style={s.headerSub}>Admin · Playbox, Lucknow</Text>
            </View>
            <TouchableOpacity onPress={() => setCalModal(true)} activeOpacity={0.82}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.calBadge}>
                <Text style={s.calBadgeMon}>{selMonth}</Text>
                <Text style={s.calBadgeDay}>{selDay}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <RNScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Date Strip */}
            <Animated.View style={{ opacity: dateAnim, transform: [{ translateY: dateAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={s.calRow}>
                <Text style={s.calLabel}>Calendar</Text>
                <TouchableOpacity onPress={() => setCalModal(true)} activeOpacity={0.8}>
                  <Text style={s.monthPicker}>{currentMonthYear}  ▾</Text>
                </TouchableOpacity>
              </View>
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

              {/* Already Booked */}
              <View style={s.sectionRow}>
                <View style={s.sectionDot} />
                <Text style={s.sectionLabel}>ALREADY BOOKED</Text>
              </View>
              <View style={s.bookedWrap}>
                {screen.loadingSlots ? (
                  <ActivityIndicator size="small" color={T.grad0} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
                ) : screen.bookings.length === 0 && screen.activeHolds.length === 0 ? (
                  <View style={s.bookedEmpty}>
                    <Text style={s.bookedEmptyIcon}>✓</Text>
                    <Text style={s.bookedEmptyTxt}>All slots available</Text>
                  </View>
                ) : (
                  <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {screen.bookings.map((b, i) => (
                      <View key={`b-${b.id}-${i}`} style={s.bookedChip}>
                        <Text style={s.bookedChipTxt}>{b.slot}</Text>
                      </View>
                    ))}
                    {screen.activeHolds.map((h, i) => (
                      <View key={`h-${h.slotLabel}-${i}`} style={s.holdChip}>
                        <Text style={s.holdChipTxt}>⏳ {h.slotLabel}</Text>
                      </View>
                    ))}
                  </RNScrollView>
                )}
              </View>

              {/* Current Booking (owner) */}
              {screen.currentBooking && (
                <View style={{ marginBottom: 12 }}>
                  <CurrentBookingBlock
                    booking={screen.currentBooking}
                    isExpired={expired}
                    role="owner"
                    onPressPOS={() => (navigation as any).navigate('POS', { bookingId: screen.currentBooking!.id, bookingCustomer: screen.currentBooking!.customer })}
                    onPressInvoice={() => (navigation as any).navigate('Bill', { bookingId: screen.currentBooking!.id })}
                  />
                </View>
              )}

              {/* Hold banners */}
              {screen.holdState.holdId && screen.holdState.expiresAt && (
                <View style={{ marginBottom: 8 }}>
                  <SlotHoldBanner queuePos={screen.holdState.queuePos} expiresAt={screen.holdState.expiresAt} />
                </View>
              )}
              {!screen.holdState.holdId && (() => {
                const hold = screen.activeHolds.find((h) => h.slotLabel === screen.slotLabel);
                if (!hold) return null;
                return (
                  <View style={{ marginBottom: 8 }}>
                    <SlotHoldBanner queuePos={hold.queueCount + 1} expiresAt={new Date(hold.expiresAt)} />
                  </View>
                );
              })()}
            </Animated.View>

            {/* Time Picker */}
            <Animated.View style={{ opacity: timeAnim, transform: [{ translateY: timeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={s.sectionRow}>
                <View style={s.sectionDot} />
                <Text style={s.sectionLabel}>SELECT TIME</Text>
              </View>
              <GlassCard style={s.drumCard}>
                <View style={s.drumHdrRow}>
                  <Text style={[s.drumHdr, { flex: 3, textAlign: 'center' }]}>HOUR</Text>
                  <View style={{ width: 28 }} />
                  <Text style={[s.drumHdr, { flex: 3, textAlign: 'center' }]}>MIN</Text>
                  <Text style={[s.drumHdr, { flex: 2, textAlign: 'center' }]}>AM/PM</Text>
                </View>
                <View style={s.drumRow}>
                  <View style={{ flex: 3, alignItems: 'center' }}>
                    <Drum items={HOURS_12} selected={startH12} onSelect={handleStartH12} width={82} />
                  </View>
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <Text style={s.colon}>:</Text>
                  </View>
                  <View style={{ flex: 3, alignItems: 'center' }}>
                    <Drum items={ALL_MINS} selected={startMin} onSelect={handleStartMin} width={82} />
                  </View>
                  <View style={{ flex: 2, alignItems: 'center' }}>
                    <Drum items={PERIODS} selected={startPer} onSelect={handleStartPer} width={64} />
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* Duration */}
            <Animated.View style={{ opacity: durAnim, transform: [{ translateY: durAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={s.sectionRow}>
                <View style={s.sectionDot} />
                <Text style={s.sectionLabel}>DURATION</Text>
              </View>
              <View style={s.durRow}>
                {DURATIONS.map(({ label, mins }) => {
                  const isSel = durMins === mins;
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
            </Animated.View>

            {/* Error */}
            {hasError && (
              <View style={s.errBanner}>
                <Text style={s.errIcon}>⚠</Text>
                <Text style={s.errTxt}>{screen.slotConflict?.message ?? screen.timeError}</Text>
              </View>
            )}

            {/* Continue Button */}
            {!hasError && screen.durationMinutes > 0 && (
              <Animated.View style={{
                opacity: btnAnim,
                transform: [
                  { translateY: btnTranslate },
                  { translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                ],
              }}>
                <TouchableOpacity
                  onPress={() => profile?.id && screen.handleOpenRequestModal(profile.id)}
                  disabled={screen.acquiringHold}
                  activeOpacity={0.88}
                  style={[s.contBtnWrap, screen.acquiringHold && { opacity: 0.65 }]}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.contBtn}>
                    {screen.acquiringHold
                      ? <ActivityIndicator color="#fff" />
                      : <><Text style={s.contBtnTxt}>Continue</Text><Text style={s.contBtnArrow}> →</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Bookings list */}
            {screen.bookings.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <View style={s.sectionRow}>
                  <View style={s.sectionDot} />
                  <Text style={s.sectionLabel}>TODAY'S BOOKINGS ({screen.bookings.length})</Text>
                </View>
                <GlassCard style={{ overflow: 'hidden' }}>
                  {screen.bookings.map((b, i) => (
                    <View key={b.id} style={[s.bookRow, i < screen.bookings.length - 1 && s.bookRowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.bookName}>{b.customer.split(' ')[0]}{b.sport ? `  ·  ${b.sport}` : ''}</Text>
                        <Text style={s.bookSlot}>{b.slot}</Text>
                      </View>
                      <View style={[s.statusChip, {
                        backgroundColor: b.status === 'Confirmed' ? 'rgba(124,77,255,0.10)'
                          : b.status === 'Completed' ? 'rgba(16,185,129,0.10)' : 'rgba(251,191,36,0.10)',
                      }]}>
                        <Text style={[s.statusTxt, {
                          color: b.status === 'Confirmed' ? T.grad0
                            : b.status === 'Completed' ? T.okTxt : '#D97706',
                        }]}>{b.status}</Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}

            <View style={{ height: 40 }} />
          </RNScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Booking Modal */}
      <BookingRequestModal
        visible={screen.requestModalOpen}
        onClose={() => screen.setRequestModalOpen(false)}
        onSuccess={() => {
          screen.setRequestModalOpen(false);
          screen.loadBookings();
          Alert.alert('✓ Request Submitted', 'Booking request sent for approval.');
        }}
        holdId={screen.holdState.holdId}
        bookingDate={toISO(screen.selectedDate)}
        turf={DEFAULT_TURF}
        slotLabel={screen.slotLabel}
        durationMinutes={screen.durationMinutes}
        bookingSourceRole="owner"
        prefillName={profile?.full_name}
      />

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
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <Text key={d} style={s.calDayHdr}>{d}</Text>
              ))}
            </View>
            <View style={s.calGrid}>
              {Array.from({ length: calFirstDay }, (_, i) => <View key={`e${i}`} style={s.calCell} />)}
              {Array.from({ length: calDaysInMonth }, (_, i) => {
                const day  = i + 1;
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
  root:        { flex: 1, backgroundColor: T.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.bg },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 11, color: T.text2, marginTop: 2 },
  calBadge:    { width: 44, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 1 },
  calBadgeMon: { fontSize: 8,  fontWeight: '800', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.8 },
  calBadgeDay: { fontSize: 22, fontWeight: '900', color: T.white, lineHeight: 26 },

  scroll:      { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 },
  sectionDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: T.grad0 },
  sectionLabel:{ fontSize: 9.5, fontWeight: '800', color: T.text2, letterSpacing: 2.2, textTransform: 'uppercase' },

  calRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calLabel:    { fontSize: 17, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  monthPicker: { fontSize: 14, fontWeight: '700', color: T.grad0 },

  dateStrip:   { flexDirection: 'row', gap: 7, marginBottom: 4 },
  moreBtn:     { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'center' },
  moreBadge:   { width: 38, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1 },
  moreBadgeMon:{ fontSize: 7, fontWeight: '800', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.5 },
  moreBadgeDay:{ fontSize: 16, fontWeight: '900', color: T.white },
  moreLabel:   { fontSize: 8,  fontWeight: '600', color: T.text2 },

  bookedWrap:     { minHeight: 34, marginBottom: 2 },
  bookedEmpty:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  bookedEmptyIcon:{ fontSize: 13, color: T.okTxt, fontWeight: '700' },
  bookedEmptyTxt: { fontSize: 12, color: T.okTxt, fontWeight: '600' },
  bookedChip:     { backgroundColor: T.bookedBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: T.bookedBd },
  bookedChipTxt:  { fontSize: 11, fontWeight: '700', color: T.bookedTxt },
  holdChip:       { backgroundColor: 'rgba(251,191,36,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)' },
  holdChipTxt:    { fontSize: 11, fontWeight: '700', color: '#D97706' },

  drumCard:    { padding: 12, paddingVertical: 16 },
  drumHdrRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 },
  drumHdr:     { fontSize: 8.5, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 1.8 },
  drumRow:     { flexDirection: 'row', alignItems: 'center' },
  colon:       { fontSize: 28, fontWeight: '200', color: T.textDis, textAlign: 'center', marginBottom: 4 },

  durRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durPill:     { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 50, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  durPillSel:  { borderRadius: 50, shadowColor: T.grad0, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  durTxt:      { fontSize: 13, fontWeight: '600', color: T.text2 },
  durTxtSel:   { fontSize: 13, fontWeight: '700', color: T.white, paddingHorizontal: 16, paddingVertical: 9 },

  errBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: T.errBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.errBd },
  errIcon:     { fontSize: 14, color: T.errTxt },
  errTxt:      { flex: 1, fontSize: 12, fontWeight: '600', color: T.errTxt },

  contBtnWrap: { marginTop: 20, borderRadius: 20, overflow: 'hidden', shadowColor: T.grad0, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.30, shadowRadius: 24, elevation: 8 },
  contBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20 },
  contBtnTxt:  { fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 0.2 },
  contBtnArrow:{ fontSize: 18, fontWeight: '800', color: T.white },

  bookRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  bookRowBorder:  { borderBottomWidth: 1, borderBottomColor: T.border },
  bookName:       { fontSize: 14, fontWeight: '600', color: T.text },
  bookSlot:       { fontSize: 12, color: T.text2, marginTop: 2 },
  statusChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:      { fontSize: 11, fontWeight: '700' },

  calOverlay:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.55)', justifyContent: 'flex-end' },
  calSheet:    { backgroundColor: T.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  calHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 20 },
  calTitle:    { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 20, textAlign: 'center' },
  calMonthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  calNavBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  calNavTxt:   { fontSize: 22, color: T.text, fontWeight: '600' },
  calMonthTxt: { fontSize: 15, fontWeight: '700', color: T.text },
  calDayHdrs:  { flexDirection: 'row', marginBottom: 10 },
  calDayHdr:   { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: T.text2 },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:     { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 50 },
  calSelBg:    { ...StyleSheet.absoluteFillObject, borderRadius: 50 },
  calDayTxt:   { fontSize: 14, fontWeight: '500', color: T.text, zIndex: 1 },
  calCancel:   { marginTop: 20, paddingVertical: 15, alignItems: 'center', backgroundColor: T.bg, borderRadius: 16, borderWidth: 1, borderColor: T.border },
  calCancelTxt:{ fontSize: 14, fontWeight: '700', color: T.text2 },
});
