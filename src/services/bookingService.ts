import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BookingSlot {
  id: string;
  customer: string;
  phone: string;
  slot: string;
  turf: string;
  field: string;
  booking_date: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  amount: number;
  paid: boolean;
  created_by: string | null;
  booking_source_role: 'owner' | 'staff' | 'customer' | null;
  customer_id: string | null;
  sport: string | null;
  advance_amount: number;
}

export interface CreateBookingParams {
  customer: string;
  phone: string;
  slot: string;
  turf: string;
  bookingDate: string;
  status?: 'Confirmed' | 'Pending';
  amount?: number;
  createdBy: string | null;
  bookingSourceRole?: 'owner' | 'staff' | 'customer';
  customerId?: string | null;
  sport?: string | null;
  advanceAmount?: number;
}

export type BookingPeriod = 'today' | 'yesterday' | 'past' | 'upcoming';

export interface PeriodBooking {
  id: string;
  customer: string;
  phone: string;
  slot: string;
  turf: string;
  field: string;
  booking_date: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  amount: number;
  paid: boolean;
  booking_source_role: 'owner' | 'staff' | 'customer' | null;
  sport: string | null;
  advance_amount: number;
}

// ── Sport config ───────────────────────────────────────────────────────────

export interface SportConfig {
  key: string;
  label: string;
  pricePerHour: number;
  available: boolean;
}

export const SPORTS: SportConfig[] = [
  { key: 'Cricket',    label: 'Cricket',     pricePerHour: 1000, available: true  },
  { key: 'Football',   label: 'Football',    pricePerHour: 1000, available: true  },
  { key: 'Badminton',  label: 'Badminton',   pricePerHour: 0,    available: false },
  { key: 'PickleBall', label: 'Pickle Ball', pricePerHour: 0,    available: false },
  { key: 'Volleyball', label: 'Volleyball',  pricePerHour: 0,    available: false },
];

export function getSportConfig(key: string): SportConfig | undefined {
  return SPORTS.find((s) => s.key === key);
}

export function calculatePrice(sportKey: string, durationMinutes: number): number {
  const sport = getSportConfig(sportKey);
  if (!sport || !sport.available) return 0;
  return Math.round((durationMinutes / 60) * sport.pricePerHour);
}

// ── IST helpers ────────────────────────────────────────────────────────────

export function getCurrentISTTime(): { hours: number; minutes: number } {
  const now   = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  const ist   = new Date(istMs);
  return { hours: ist.getHours(), minutes: ist.getMinutes() };
}

export function getNextAvailableISTSlot(): { hours: number; minutes: number } {
  const { hours, minutes } = getCurrentISTTime();
  const next15 = Math.ceil((minutes + 1) / 15) * 15;
  if (next15 >= 60) return { hours: (hours + 1) % 24, minutes: 0 };
  return { hours, minutes: next15 };
}

export function todayISOInIST(): string {
  const now   = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000;
  return new Date(istMs).toISOString().slice(0, 10);
}

// ── 12-hour format helpers ─────────────────────────────────────────────────

export function to12HourDisplay(hours24: number, minutes: number): string {
  const period = hours24 < 12 ? 'AM' : 'PM';
  const h12    = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function buildSlotLabel(
  startH: number, startM: number,
  endH:   number, endM:   number,
): string {
  return `${to12HourDisplay(startH, startM)}–${to12HourDisplay(endH, endM)}`;
}

export function slotToMinutes(slot: string): number {
  const ampm = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const h24 = slot.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
  return 0;
}

export function parseSlotRange(slotRange: string): { startM: number; endM: number } | null {
  const sep = slotRange.includes('–') ? '–' : '-';
  const idx = slotRange.indexOf(sep);
  if (idx < 0) return null;
  const startStr = slotRange.slice(0, idx).trim();
  const endStr   = slotRange.slice(idx + sep.length).trim();
  return { startM: slotToMinutes(startStr), endM: slotToMinutes(endStr) };
}

export function minutesToSlot(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function expandSlotRange(slotRange: string): string[] {
  const parsed = parseSlotRange(slotRange);
  if (!parsed) return [];
  const result: string[] = [];
  const { startM, endM } = parsed;
  // Normalize cross-midnight: if end <= start, end wraps into next day
  const endNorm = endM > startM ? endM : endM + 1440;
  let cur = startM;
  while (cur < endNorm) { result.push(minutesToSlot(cur % 1440)); cur += 30; }
  return result;
}

export function generateAllSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

export function buildBookedSet(bookings: BookingSlot[]): Set<string> {
  const booked = new Set<string>();
  bookings.forEach((b) => expandSlotRange(b.slot).forEach((s) => booked.add(s)));
  return booked;
}

// ── Row mappers ────────────────────────────────────────────────────────────

function toBookingSlot(row: any): BookingSlot {
  return {
    id:                  row.id,
    customer:            row.customer,
    phone:               row.phone ?? '',
    slot:                row.slot,
    turf:                row.turf ?? row.field ?? 'Turf A',
    field:               row.field ?? row.turf ?? 'Turf A',
    booking_date:        row.booking_date,
    status:              row.status,
    amount:              Number(row.amount ?? 0),
    paid:                Boolean(row.paid),
    created_by:          row.created_by ?? null,
    booking_source_role: row.booking_source_role ?? null,
    customer_id:         row.customer_id ?? null,
    sport:               row.sport ?? null,
    advance_amount:      Number(row.advance_amount ?? 0),
  };
}

function periodBookingFromRow(row: any): PeriodBooking {
  return {
    id:                  row.id,
    customer:            row.customer,
    phone:               row.phone ?? '',
    slot:                row.slot,
    turf:                row.turf ?? row.field ?? 'Turf A',
    field:               row.field ?? row.turf ?? 'Turf A',
    booking_date:        row.booking_date,
    status:              row.status,
    amount:              Number(row.amount ?? 0),
    paid:                Boolean(row.paid),
    booking_source_role: row.booking_source_role ?? null,
    sport:               row.sport ?? null,
    advance_amount:      Number(row.advance_amount ?? 0),
  };
}

// ── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchBookingsForDate(params: {
  date: string; turf: string;
}): Promise<{ bookings: BookingSlot[]; error: string | null }> {
  // Compute the previous calendar date to catch cross-midnight slots
  const d = new Date(params.date + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [{ data, error }, { data: prevData }] = await Promise.all([
    supabase.from('bookings').select('*')
      .eq('booking_date', params.date)
      .eq('turf', params.turf)
      .neq('status', 'Cancelled')
      .order('slot'),
    supabase.from('bookings').select('*')
      .eq('booking_date', prevDate)
      .eq('turf', params.turf)
      .neq('status', 'Cancelled'),
  ]);

  if (error) return { bookings: [], error: error.message };

  // Cross-midnight: previous day's slots that end AFTER midnight but before 6 AM
  // endM===0 means the slot ends exactly at midnight (not into today) — exclude it
  const crossMidnight = (prevData ?? []).filter((row: any) => {
    const parsed = parseSlotRange(row.slot);
    return parsed !== null && parsed.endM > 0 && parsed.endM < 6 * 60;
  });

  return { bookings: [...(data ?? []), ...crossMidnight].map(toBookingSlot), error: null };
}

export async function fetchCurrentBooking(turf: string): Promise<{
  booking: BookingSlot | null; error: string | null;
}> {
  const today              = todayISOInIST();
  const { hours, minutes } = getCurrentISTTime();
  const nowMinutes         = hours * 60 + minutes;

  const { data, error } = await supabase
    .from('bookings').select('*')
    .eq('booking_date', today).eq('turf', turf)
    .eq('status', 'Confirmed').order('slot');

  if (error) return { booking: null, error: error.message };

  const active = (data ?? []).find((row: any) => {
    const parsed = parseSlotRange(row.slot);
    if (!parsed) return false;
    const endNorm = parsed.endM > parsed.startM ? parsed.endM : parsed.endM + 1440;
    const nowNorm = nowMinutes >= parsed.startM ? nowMinutes : nowMinutes + 1440;
    return nowNorm >= parsed.startM && nowNorm < endNorm;
  });

  return { booking: active ? toBookingSlot(active) : null, error: null };
}

export async function fetchBookingsEndingSoon(turf: string, withinMinutes = 6): Promise<{
  bookings: BookingSlot[]; error: string | null;
}> {
  const today              = todayISOInIST();
  const { hours, minutes } = getCurrentISTTime();
  const nowMinutes         = hours * 60 + minutes;

  const { data, error } = await supabase
    .from('bookings').select('*')
    .eq('booking_date', today).eq('turf', turf).eq('status', 'Confirmed');

  if (error) return { bookings: [], error: error.message };

  const endingSoon = (data ?? []).filter((row: any) => {
    const parsed = parseSlotRange(row.slot);
    if (!parsed) return false;
    const endNorm = parsed.endM > parsed.startM ? parsed.endM : parsed.endM + 1440;
    const nowNorm = nowMinutes >= parsed.startM ? nowMinutes : nowMinutes + 1440;
    const diff = endNorm - nowNorm;
    return diff > 0 && diff <= withinMinutes;
  });

  return { bookings: endingSoon.map(toBookingSlot), error: null };
}

export async function createBooking(params: CreateBookingParams): Promise<{
  booking: BookingSlot | null; error: string | null;
}> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer:            params.customer.trim(),
      phone:               params.phone?.trim() ?? '',
      slot:                params.slot,
      turf:                params.turf,
      field:               params.turf,
      booking_date:        params.bookingDate,
      status:              params.status ?? 'Confirmed',
      amount:              params.amount ?? 0,
      paid:                false,
      advance_amount:      params.advanceAmount ?? 0,
      sport:               params.sport ?? null,
      customer_id:         params.customerId ?? null,
      created_by:          params.createdBy,
      booking_source_role: params.bookingSourceRole ?? 'owner',
    })
    .select().single();

  if (error) {
    if (error.code === '23505') return { booking: null, error: 'SLOT_TAKEN' };
    return { booking: null, error: error.message };
  }
  return { booking: toBookingSlot(data), error: null };
}

// ── Cancel booking — with audit record ─────────────────────────────────────
// Works even if slot has already started. Keeps record in DB.

export async function cancelBooking(
  bookingId: string,
  params: { changedBy: string; changedByRole: string; reason?: string; oldSlot?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Cancelled' })
    .eq('id', bookingId);

  if (error) return { error: error.message };

  // Audit record
  await supabase.from('booking_edits').insert({
    booking_id:      bookingId,
    action:          'cancel',
    old_slot:        params.oldSlot ?? null,
    new_slot:        null,
    changed_by:      params.changedBy,
    changed_by_role: params.changedByRole,
    reason:          params.reason ?? 'Cancelled by ' + params.changedByRole,
  });

  return { error: null };
}

// ── Edit booking time — with conflict check + audit ────────────────────────

export interface EditBookingTimeParams {
  bookingId:      string;
  newSlot:        string;   // new full slot label e.g. "09:00 AM–12:00 PM"
  bookingDate:    string;
  turf:           string;
  changedBy:      string;
  changedByRole:  string;
  oldSlot:        string;
  reason?:        string;
}

export interface EditBookingTimeResult {
  error:            string | null;
  conflictMessage?: string;
}

export async function editBookingTime(
  params: EditBookingTimeParams,
): Promise<EditBookingTimeResult> {
  const newParsed = parseSlotRange(params.newSlot);
  if (!newParsed) return { error: 'Invalid slot format.' };

  // Fetch all non-cancelled bookings for that date/turf EXCEPT this booking
  const { data: others, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, slot, status')
    .eq('booking_date', params.bookingDate)
    .eq('turf', params.turf)
    .neq('status', 'Cancelled')
    .neq('id', params.bookingId);

  if (fetchErr) return { error: fetchErr.message };

  // Check for overlap (cross-midnight aware)
  const normEnd = (s: number, e: number) => (e > s ? e : e + 1440);
  const slotsOverlap = (s1: number, e1: number, s2: number, e2: number) => {
    const ne1 = normEnd(s1, e1); const ne2 = normEnd(s2, e2);
    return (s1 < ne2 && ne1 > s2) || (s1 < ne2 + 1440 && ne1 > s2 + 1440) || (s1 + 1440 < ne2 && ne1 + 1440 > s2);
  };

  for (const other of others ?? []) {
    const otherParsed = parseSlotRange(other.slot);
    if (!otherParsed) continue;

    const overlaps = slotsOverlap(
      newParsed.startM, newParsed.endM, otherParsed.startM, otherParsed.endM,
    );

    if (overlaps) {
      const isExtensionBlocked = newParsed.startM === parseSlotRange(params.oldSlot)?.startM;
      const msg = isExtensionBlocked
        ? `Cannot extend — next booking exists at ${other.slot}`
        : `Slot already booked (${other.slot})`;
      return { error: 'CONFLICT', conflictMessage: msg };
    }
  }

  // Update slot
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ slot: params.newSlot })
    .eq('id', params.bookingId);

  if (updateErr) return { error: updateErr.message };

  // Audit record
  await supabase.from('booking_edits').insert({
    booking_id:      params.bookingId,
    action:          'time_edit',
    old_slot:        params.oldSlot,
    new_slot:        params.newSlot,
    changed_by:      params.changedBy,
    changed_by_role: params.changedByRole,
    reason:          params.reason ?? 'Time edited by ' + params.changedByRole,
  });

  return { error: null };
}

// ── Audit log for confirm action ──────────────────────────────────────────

export async function auditBookingConfirm(params: {
  bookingId: string; changedBy: string; changedByRole: string;
}): Promise<void> {
  await supabase.from('booking_edits').insert({
    booking_id:      params.bookingId,
    action:          'confirm',
    changed_by:      params.changedBy,
    changed_by_role: params.changedByRole,
    reason:          'Booking confirmed by ' + params.changedByRole,
  });
}

// ── Period bookings ────────────────────────────────────────────────────────

function isoToday(): string { return new Date().toISOString().slice(0, 10); }
function isoYesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchBookingsByPeriod(period: BookingPeriod): Promise<{
  bookings: PeriodBooking[]; error: string | null;
}> {
  const today     = isoToday();
  const yesterday = isoYesterday();

  let query = supabase.from('bookings')
    .select('id, customer, phone, slot, turf, field, booking_date, status, amount, paid, booking_source_role, sport, advance_amount');

  switch (period) {
    case 'today':     query = query.eq('booking_date', today).order('slot'); break;
    case 'yesterday': query = query.eq('booking_date', yesterday).order('slot'); break;
    case 'past':      query = query.lt('booking_date', yesterday).order('booking_date', { ascending: false }).limit(40); break;
    case 'upcoming':  query = query.gt('booking_date', today).order('booking_date', { ascending: true }).limit(40); break;
  }

  const { data, error } = await query;
  if (error) return { bookings: [], error: error.message };
  return { bookings: (data ?? []).map(periodBookingFromRow), error: null };
}

// ── Past bookings with optional filters ───────────────────────────────────

export async function fetchPastBookingsFiltered(params: {
  date?: string;          // ISO date — if set, fetch only this date
  status?: string;        // 'Confirmed' | 'Completed' | 'Cancelled' | 'Pending' | ''
}): Promise<{ bookings: PeriodBooking[]; error: string | null }> {
  const today = isoToday();

  let query = supabase
    .from('bookings')
    .select('id, customer, phone, slot, turf, field, booking_date, status, amount, paid, booking_source_role, sport, advance_amount');

  if (params.date) {
    query = query.eq('booking_date', params.date);
  } else {
    query = query.lt('booking_date', today);
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  query = query.order('booking_date', { ascending: false }).order('slot').limit(200);

  const { data, error } = await query;
  if (error) return { bookings: [], error: error.message };
  return { bookings: (data ?? []).map(periodBookingFromRow), error: null };
}

// ── Realtime subscriptions ─────────────────────────────────────────────────

export function subscribeToBookings(params: {
  date: string; turf: string; onUpdate: () => void;
}): () => void {
  const channel = supabase
    .channel(`bookings:${params.date}:${params.turf}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bookings',
      filter: `booking_date=eq.${params.date}`,
    }, () => params.onUpdate())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}