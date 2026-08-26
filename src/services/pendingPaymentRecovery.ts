import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBookingRequestStatus } from './bookingRequestService';

// ── Crash/reload recovery for the customer Razorpay flow ────────────────────
//
// The Razorpay payment state (pendingRequestId, etc.) lives only in React
// state inside BookingRequestModal. On web, if the browser tab crashes or
// gets killed by the OS right after a successful charge (a known Chrome-on-
// Android failure mode when the checkout flow hands off to a UPI/banking
// app and back), that state is gone — the customer is left staring at a
// blank/crashed page with no idea whether they were charged.
//
// The backend already has a safety net: a booking_request row is created
// BEFORE charging, and the Razorpay webhook finalizes it server-side even
// if the client never comes back. This module is the client-side half —
// persist the pending request id to disk right before opening checkout, and
// check it back on the next app boot so the customer gets a real answer
// ("your booking was confirmed" / "still processing") instead of silence.

const STORAGE_KEY = 'pending_payment_request_v1';

export interface PendingPaymentRecord {
  id:          string;
  bookingDate: string;
  turf:        string;
  slotLabel:   string;
  savedAt:     number;
}

export async function savePendingPayment(record: Omit<PendingPaymentRecord, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...record, savedAt: Date.now() }));
  } catch {
    // Best-effort — if storage isn't available, recovery just won't run. The
    // webhook still finalizes the booking server-side regardless.
  }
}

export async function clearPendingPayment(): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
}

// Checks for a leftover pending payment from a previous session and resolves
// its outcome. Call once at app boot. Returns null if there's nothing to
// recover. Always clears the stored record — a 'pending' outcome is a
// legitimate settled state (awaiting manual review / webhook) that we only
// want to surface once, not re-poll forever.
export async function recoverPendingPayment(): Promise<{
  record: PendingPaymentRecord;
  status: 'approved' | 'pending' | 'rejected' | 'unknown';
} | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let record: PendingPaymentRecord;
  try {
    record = JSON.parse(raw);
  } catch {
    await clearPendingPayment();
    return null;
  }

  // Stale beyond a day — not worth surfacing, the webhook/manual review
  // window has long since passed either way.
  if (Date.now() - (record.savedAt ?? 0) > 24 * 60 * 60 * 1000) {
    await clearPendingPayment();
    return null;
  }

  const status = await fetchBookingRequestStatus(record.id);
  await clearPendingPayment();
  return { record, status };
}
