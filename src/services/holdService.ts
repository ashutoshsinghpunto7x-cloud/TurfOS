import { supabase } from '../lib/supabase';

export interface AcquireHoldResult {
  holdId:      string;
  queuePos:    number;
  alreadyHeld: boolean;
  expiresAt:   Date;
  error:       string | null;
}

export interface SlotHoldInfo {
  queuePos:       number;
  expiresAt:      Date;
  secondsLeft:    number;
  isActiveHolder: boolean; // queue_pos === 1
}

const HOLD_SECONDS = 120; // 2 minutes

// ── Acquire hold (calls atomic Postgres function) ──────────────────────────

export async function acquireSlotHold(params: {
  bookingDate: string;   // "YYYY-MM-DD"
  turf:        string;
  slotLabel:   string;   // "09:00–10:30"
  userId:      string;
}): Promise<AcquireHoldResult> {
  const { data, error } = await supabase.rpc('acquire_slot_hold', {
    p_booking_date:  params.bookingDate,
    p_turf:          params.turf,
    p_slot_label:    params.slotLabel,
    p_user_id:       params.userId,
    p_hold_seconds:  HOLD_SECONDS,
  });

  if (error || !data) {
    return { holdId: '', queuePos: 0, alreadyHeld: false, expiresAt: new Date(), error: error?.message ?? 'Hold acquisition failed.' };
  }

  const result = data as { hold_id: string; queue_pos: number; already_held: boolean };
  const expiresAt = new Date(Date.now() + HOLD_SECONDS * 1000);

  return {
    holdId:      result.hold_id,
    queuePos:    result.queue_pos,
    alreadyHeld: result.already_held,
    expiresAt,
    error:       null,
  };
}

// ── Release hold (called when user cancels or booking is confirmed) ────────

export async function releaseSlotHold(holdId: string): Promise<void> {
  await supabase
    .from('slot_holds')
    .delete()
    .eq('id', holdId);
}

// ── Fetch hold info for a slot (to show queue status to waiting users) ─────

export async function fetchSlotHoldInfo(params: {
  bookingDate: string;
  turf:        string;
  slotLabel:   string;
  userId:      string;
}): Promise<SlotHoldInfo | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('slot_holds')
    .select('id, held_by, expires_at, queue_pos')
    .eq('booking_date', params.bookingDate)
    .eq('turf', params.turf)
    .eq('slot_label', params.slotLabel)
    .gt('expires_at', now)
    .order('queue_pos', { ascending: true });

  if (error || !data || data.length === 0) return null;

  // Find this user's position
  const myHold = data.find((h: any) => h.held_by === params.userId);
  if (!myHold) {
    // User is not in queue — return info about how many are ahead
    return {
      queuePos:       data.length + 1,
      expiresAt:      new Date(data[0].expires_at),
      secondsLeft:    Math.max(0, Math.round((new Date(data[0].expires_at).getTime() - Date.now()) / 1000)),
      isActiveHolder: false,
    };
  }

  return {
    queuePos:       myHold.queue_pos,
    expiresAt:      new Date(myHold.expires_at),
    secondsLeft:    Math.max(0, Math.round((new Date(myHold.expires_at).getTime() - Date.now()) / 1000)),
    isActiveHolder: myHold.queue_pos === 1,
  };
}

// ── Fetch active holds for a date+turf (used to mark slots as Under Process) ─

export async function fetchActiveHoldsForDate(params: {
  bookingDate: string;
  turf:        string;
}): Promise<{ slotLabel: string; queueCount: number; expiresAt: string }[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('slot_holds')
    .select('slot_label, expires_at')
    .eq('booking_date', params.bookingDate)
    .eq('turf', params.turf)
    .gt('expires_at', now);

  if (error || !data) return [];

  // Group by slot_label, count
  const map: Record<string, { count: number; expiresAt: string }> = {};
  for (const row of data as any[]) {
    if (!map[row.slot_label]) {
      map[row.slot_label] = { count: 0, expiresAt: row.expires_at };
    }
    map[row.slot_label].count++;
    // Keep the earliest expiry for display
    if (row.expires_at < map[row.slot_label].expiresAt) {
      map[row.slot_label].expiresAt = row.expires_at;
    }
  }

  return Object.entries(map).map(([slotLabel, v]) => ({
    slotLabel,
    queueCount: v.count,
    expiresAt:  v.expiresAt,
  }));
}