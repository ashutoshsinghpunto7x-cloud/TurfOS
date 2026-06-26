import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

const IS_WEB = Platform.OS === 'web';
import {
  fetchBookingsForDate, fetchCurrentBooking, fetchBookingsEndingSoon,
  subscribeToBookings, BookingSlot, getCurrentISTTime,
  getNextAvailableISTSlot, buildSlotLabel, todayISOInIST, slotToMinutes,
  parseSlotRange,
} from '../services/bookingService';
import { acquireSlotHold, fetchActiveHoldsForDate } from '../services/holdService';

// ── Notifications ────────────────────────────────────────────────────────────

async function registerForPushNotifications(): Promise<void> {
  if (IS_WEB) return; // expo-notifications has no web push support in this setup
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
      shouldShowBanner: true, shouldShowList: true,
    }),
  });
}

async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (IS_WEB) {
    // Browser fallback: native Notification API if granted
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') new Notification(title, { body });
        else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') new Notification(title, { body });
        }
      }
    } catch {}
    return;
  }
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HoldState {
  holdId: string | null; queuePos: number; expiresAt: Date | null;
}

export interface SlotConflict {
  type: 'booked' | 'held'; message: string;
}

export interface ActiveHoldInfo {
  slotLabel: string; queueCount: number; expiresAt: string;
}

export interface BookingScreenState {
  selectedDate:           Date;
  setSelectedDate:        (d: Date) => void;
  bookings:               BookingSlot[];
  loadingSlots:           boolean;
  loadBookings:           () => Promise<void>;
  currentBooking:         BookingSlot | null;
  startH:  number;       setStartH:  (v: number) => void;
  startM:  number;       setStartM:  (v: number) => void;
  endH:    number;       setEndH:    (v: number) => void;
  endM:    number;       setEndM:    (v: number) => void;
  timeError:              string | null;
  slotConflict:           SlotConflict | null;
  holdState:              HoldState;
  requestModalOpen:       boolean;
  setRequestModalOpen:    (v: boolean) => void;
  activeHolds:            ActiveHoldInfo[];
  durationMinutes:        number;
  slotLabel:              string;
  handleOpenRequestModal: (userId: string) => Promise<void>;
  acquiringHold:          boolean;
  minStartH:              number;
  minStartM:              number;
}

const DEFAULT_TURF    = 'Turf A';
const WARNING_POLL_MS = 60_000;
const HOLD_POLL_MS    = 15_000;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear()
    && d.getMonth()    === t.getMonth()
    && d.getDate()     === t.getDate();
}

function buildTodayStartTime(): { sh: number; sm: number } {
  const { hours, minutes } = getNextAvailableISTSlot();
  // next 15-min boundary, no clamping — 24/7 so any hour is valid
  return { sh: hours % 24, sm: minutes };
}

// Normalize a [start, end] pair so end > start, handling cross-midnight wrap
function normEnd(s: number, e: number): number {
  return e > s ? e : e + 1440;
}

// Returns true if two time intervals overlap, correctly handling cross-midnight slots
function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  const ne1 = normEnd(s1, e1);
  const ne2 = normEnd(s2, e2);
  // Direct overlap
  if (s1 < ne2 && ne1 > s2) return true;
  // One interval is in "next-day" territory — shift s2 by 1440 and recheck
  if (s1 < ne2 + 1440 && ne1 > s2 + 1440) return true;
  if (s1 + 1440 < ne2 && ne1 + 1440 > s2) return true;
  return false;
}

function detectSlotConflict(
  startTotal: number, endTotal: number,
  bookings: BookingSlot[], activeHolds: ActiveHoldInfo[],
): SlotConflict | null {
  for (const b of bookings) {
    const parsed = parseSlotRange(b.slot);
    if (!parsed) continue;
    if (intervalsOverlap(startTotal, endTotal, parsed.startM, parsed.endM)) {
      return { type: 'booked', message: `Slot already booked (${b.slot})` };
    }
  }
  for (const h of activeHolds) {
    const parsed = parseSlotRange(h.slotLabel);
    if (!parsed) continue;
    if (intervalsOverlap(startTotal, endTotal, parsed.startM, parsed.endM)) {
      return {
        type: 'held',
        message: `Slot under process (${h.slotLabel})${h.queueCount > 1 ? ` — ${h.queueCount - 1} ahead` : ''}`,
      };
    }
  }
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBookingScreen(
  profileId:         string | null,
  bookingSourceRole: 'owner' | 'staff' | 'customer',
  customerId?:       string | null,
): BookingScreenState {

  const [selectedDate, setSelectedDateRaw] = useState<Date>(new Date());
  const [bookings, setBookings]             = useState<BookingSlot[]>([]);
  const [currentBooking, setCurrentBooking] = useState<BookingSlot | null>(null);
  const [loadingSlots, setLoadingSlots]     = useState(false);
  const [activeHolds, setActiveHolds]       = useState<ActiveHoldInfo[]>([]);
  const [acquiringHold, setAcquiringHold]  = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [holdState, setHoldState] = useState<HoldState>({
    holdId: null, queuePos: 0, expiresAt: null,
  });
  const warnedIds = useRef<Set<string>>(new Set());

  // ── Min time (today only, 24/7) ───────────────────────────────────────────

  const getMinStart = (d: Date) => isToday(d)
    ? buildTodayStartTime()
    : { sh: 0, sm: 0 };    // 24/7: future dates start from midnight

  const [minStartH, setMinStartH] = useState(() => getMinStart(new Date()).sh);
  const [minStartM, setMinStartM] = useState(() => getMinStart(new Date()).sm);

  // ── Time state ────────────────────────────────────────────────────────────

  const initForDate = (d: Date) => {
    if (isToday(d)) {
      const { sh, sm } = buildTodayStartTime();
      const totalM     = sh * 60 + sm + 60;
      return { sh, sm, eh: Math.floor(totalM / 60) % 24, em: totalM % 60 };
    }
    return { sh: 6, sm: 0, eh: 7, em: 0 };  // default for future dates
  };

  const init = initForDate(new Date());
  const [startH, setStartH] = useState(init.sh);
  const [startM, setStartM] = useState(init.sm);
  const [endH,   setEndH]   = useState(init.eh);
  const [endM,   setEndM]   = useState(init.em);

  const setSelectedDate = useCallback((d: Date) => {
    setSelectedDateRaw(d);
    const { sh, sm } = getMinStart(d);
    setMinStartH(sh); setMinStartM(sm);
    const { sh: sh2, sm: sm2, eh, em } = initForDate(d);
    setStartH(sh2); setStartM(sm2); setEndH(eh); setEndM(em);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const loadHoldsOnly = useCallback(async () => {
    const holds = await fetchActiveHoldsForDate({
      bookingDate: toISO(selectedDate), turf: DEFAULT_TURF,
    });
    setActiveHolds(holds);
  }, [selectedDate]);

  const loadBookings = useCallback(async () => {
    setLoadingSlots(true);
    const [bookingsRes, holdsRes, currentRes] = await Promise.all([
      fetchBookingsForDate({ date: toISO(selectedDate), turf: DEFAULT_TURF }),
      fetchActiveHoldsForDate({ bookingDate: toISO(selectedDate), turf: DEFAULT_TURF }),
      isToday(selectedDate)
        ? fetchCurrentBooking(DEFAULT_TURF)
        : Promise.resolve({ booking: null, error: null }),
    ]);
    setBookings(bookingsRes.bookings);
    setActiveHolds(holdsRes);
    setCurrentBooking(currentRes.booking);
    setLoadingSlots(false);
  }, [selectedDate]);

  useEffect(() => {
    loadBookings();
    const unsubBookings = subscribeToBookings({
      date: toISO(selectedDate), turf: DEFAULT_TURF, onUpdate: loadBookings,
    });
    const holdsChannel = supabase
      .channel(`slot_holds:${toISO(selectedDate)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'slot_holds',
        filter: `booking_date=eq.${toISO(selectedDate)}`,
      }, () => loadHoldsOnly())
      .subscribe();
    const holdPoll = setInterval(loadHoldsOnly, HOLD_POLL_MS);
    return () => {
      unsubBookings();
      supabase.removeChannel(holdsChannel);
      clearInterval(holdPoll);
    };
  }, [loadBookings, loadHoldsOnly, selectedDate]);

  // ── 5-min warning ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (bookingSourceRole === 'customer') return;
    registerForPushNotifications();
    const poll = async () => {
      if (!isToday(selectedDate)) return;
      const { bookings: endingSoon } = await fetchBookingsEndingSoon(DEFAULT_TURF, 6);
      for (const b of endingSoon) {
        if (warnedIds.current.has(b.id)) continue;
        warnedIds.current.add(b.id);
        const msg = `${b.customer}'s ${b.sport ?? 'booking'} (${b.slot}) ends in ~5 minutes.`;
        Alert.alert('⏰ Slot Ending Soon', msg, [{ text: 'OK' }]);
        await sendLocalNotification('⏰ Slot Ending Soon', msg);
      }
    };
    poll();
    const interval = setInterval(poll, WARNING_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedDate, bookingSourceRole]);

  // ── Validation ────────────────────────────────────────────────────────────

  const startTotalM    = startH * 60 + startM;
  const endTotalM      = endH   * 60 + endM;
  // Handle overnight: if end <= start, treat as next-day (add 24h)
  const durationMinutes = endTotalM > startTotalM
    ? endTotalM - startTotalM
    : endTotalM + 1440 - startTotalM;

  const slotLabel = buildSlotLabel(startH, startM, endH, endM);

  let timeError: string | null = null;
  if (durationMinutes <= 0) {
    timeError = 'End time must be after start time.';
  } else if (isToday(selectedDate)) {
    const { hours, minutes } = getCurrentISTTime();
    if (startTotalM <= hours * 60 + minutes) {
      timeError = 'Start time must be in the future.';
    }
  }

  const slotConflict: SlotConflict | null =
    !timeError && durationMinutes > 0
      ? detectSlotConflict(startTotalM, endTotalM, bookings, activeHolds)
      : null;

  // ── Acquire hold ──────────────────────────────────────────────────────────

  const handleOpenRequestModal = async (userId: string) => {
    if (timeError) { Alert.alert('Invalid Time', timeError); return; }
    if (!userId)   { Alert.alert('Error', 'You must be signed in.'); return; }

    const [freshBookingsRes, freshHolds] = await Promise.all([
      fetchBookingsForDate({ date: toISO(selectedDate), turf: DEFAULT_TURF }),
      fetchActiveHoldsForDate({ bookingDate: toISO(selectedDate), turf: DEFAULT_TURF }),
    ]);
    setBookings(freshBookingsRes.bookings);
    setActiveHolds(freshHolds);

    const conflict = detectSlotConflict(
      startTotalM, endTotalM, freshBookingsRes.bookings, freshHolds,
    );
    if (conflict) {
      Alert.alert(
        conflict.type === 'booked' ? '🚫 Slot Already Booked' : '⏳ Slot Under Process',
        conflict.message,
      );
      return;
    }

    setAcquiringHold(true);
    const result = await acquireSlotHold({
      bookingDate: toISO(selectedDate), turf: DEFAULT_TURF,
      slotLabel, userId,
    });
    setAcquiringHold(false);

    if (result.error) { Alert.alert('Hold Failed', result.error); return; }

    setHoldState({ holdId: result.holdId, queuePos: result.queuePos, expiresAt: result.expiresAt });
    setRequestModalOpen(true);
    loadBookings();
  };

  return {
    selectedDate, setSelectedDate,
    bookings, loadingSlots, loadBookings,
    currentBooking,
    startH, setStartH, startM, setStartM,
    endH, setEndH, endM, setEndM,
    timeError, slotConflict,
    holdState, requestModalOpen, setRequestModalOpen,
    activeHolds, durationMinutes, slotLabel,
    handleOpenRequestModal, acquiringHold,
    minStartH, minStartM,
  };
}