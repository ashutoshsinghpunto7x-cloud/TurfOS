import { supabase } from '../lib/supabase';
import { auditBookingConfirm } from './bookingService';

// Sentinel written to payment_screenshot_url for a booking_request row
// created BEFORE payment, as a placeholder for the Razorpay instant-book
// flow (see getOrCreatePendingPaymentRequest below). Must match the literal
// used in supabase/functions/_shared/finalizeBooking.ts exactly — that's
// how the server tells "awaiting its Razorpay payment" apart from a
// cash/QR request genuinely awaiting manual owner approval.
const AWAITING_PAYMENT_SENTINEL = 'awaiting_payment';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BookingRequest {
  id:                      string;
  customer_id:             string | null;
  customer_name:           string;
  phone:                   string;
  booking_date:            string;
  turf:                    string;
  slot_label:              string;
  sport:                   string;
  advance_amount:          number;
  final_amount:            number | null;
  payment_method:          string;
  payment_screenshot_url:  string | null;
  status:                  'pending' | 'approved' | 'rejected' | 'auto_approved';
  booking_source_role:     string | null;
  created_by:              string | null;
  created_at:              string;
}

export interface SubmitBookingRequestParams {
  customerId:        string | null;
  customerName:      string;
  phone:             string;
  bookingDate:       string;
  turf:              string;
  slotLabel:         string;
  sport:             string;
  paymentMethod:     string;
  screenshotUrl:     string | null;
  bookingSourceRole: string;
  createdBy:         string | null;
  advanceAmount?:    number;
  finalAmount?:      number;
}

function toRequest(row: any): BookingRequest {
  return {
    id:                     row.id,
    customer_id:            row.customer_id ?? null,
    customer_name:          row.customer_name,
    phone:                  row.phone ?? '',
    booking_date:           row.booking_date,
    turf:                   row.turf,
    slot_label:             row.slot_label,
    sport:                  row.sport,
    advance_amount:         Number(row.advance_amount ?? 200),
    final_amount:           row.final_amount != null ? Number(row.final_amount) : null,
    payment_method:         row.payment_method,
    payment_screenshot_url: row.payment_screenshot_url ?? null,
    status:                 row.status,
    booking_source_role:    row.booking_source_role ?? null,
    created_by:             row.created_by ?? null,
    created_at:             row.created_at,
  };
}

// ── Pending count ──────────────────────────────────────────────────────────

// `.neq('payment_screenshot_url', X)` would silently exclude every row where
// that column is NULL (SQL: NULL != X is NULL, not true) — that's most cash
// requests, so it can't be used here. `.or(...)` explicitly keeps NULLs in.
const NOT_AWAITING_PAYMENT_FILTER =
  `payment_screenshot_url.is.null,payment_screenshot_url.neq.${AWAITING_PAYMENT_SENTINEL}`;

export async function fetchPendingCount(): Promise<number> {
  const { count } = await supabase
    .from('booking_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(NOT_AWAITING_PAYMENT_FILTER);
  return count ?? 0;
}

// ── Fetch requests (owner + staff) ─────────────────────────────────────────

export async function fetchPendingRequests(): Promise<{
  requests: BookingRequest[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('status', 'pending')
    .or(NOT_AWAITING_PAYMENT_FILTER)
    .order('created_at', { ascending: true });
  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []).map(toRequest), error: null };
}

export async function fetchAllRequests(limit = 60): Promise<{
  requests: BookingRequest[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []).map(toRequest), error: null };
}

// ── Fetch customer's own requests (limited fields — no staff/admin internals) ─

export async function fetchCustomerRequests(customerId: string): Promise<{
  requests: BookingRequest[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('id, customer_name, booking_date, turf, slot_label, sport, advance_amount, payment_method, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []).map(toRequest), error: null };
}

// ── Pre-payment placeholder (Razorpay instant-book flow) ────────────────────
// Created BEFORE opening Razorpay Checkout so there's a real row for the
// server (verify-razorpay-payment, or razorpay-webhook if the client dies
// mid-payment) to attach the confirmed payment to and finalize — instead of
// the booking only ever getting created client-side, after the fact, which
// silently loses the booking if the tab dies right after Razorpay charges
// the customer. See supabase/functions/_shared/finalizeBooking.ts.

export interface PendingPaymentRequestParams {
  customerId:        string;
  customerName:      string;
  phone:             string;
  bookingDate:       string;
  turf:              string;
  slotLabel:         string;
  sport:             string;
  advanceAmount:     number;
  finalAmount:       number;
  bookingSourceRole: string;
}

export async function getOrCreatePendingPaymentRequest(
  params: PendingPaymentRequestParams,
): Promise<{ id: string | null; error: string | null }> {
  // Reuse an existing unpaid placeholder for the same customer+slot+date —
  // e.g. the customer closed the modal mid-payment and reopened it — instead
  // of piling up duplicate rows for every attempt.
  const { data: existing } = await supabase
    .from('booking_requests')
    .select('id')
    .eq('customer_id', params.customerId)
    .eq('booking_date', params.bookingDate)
    .eq('turf', params.turf)
    .eq('slot_label', params.slotLabel)
    .eq('payment_method', 'razorpay')
    .eq('payment_screenshot_url', AWAITING_PAYMENT_SENTINEL)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) return { id: (existing as any).id, error: null };

  const { data, error } = await supabase
    .from('booking_requests')
    .insert({
      customer_id:            params.customerId,
      customer_name:          params.customerName,
      phone:                  params.phone,
      booking_date:           params.bookingDate,
      turf:                   params.turf,
      slot_label:             params.slotLabel,
      sport:                  params.sport,
      advance_amount:         params.advanceAmount,
      final_amount:           params.finalAmount,
      payment_method:         'razorpay',
      payment_screenshot_url: AWAITING_PAYMENT_SENTINEL,
      status:                 'pending',
      booking_source_role:    params.bookingSourceRole,
      created_by:             params.customerId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { id: null, error: error?.message ?? 'Could not start booking.' };
  }
  return { id: (data as any).id, error: null };
}

/** Polls the placeholder's final state after a verified payment. The server
 *  (verify-razorpay-payment, in the same request/response as the payment
 *  verification) has normally already resolved this by the time Checkout's
 *  onSuccess fires — this is a light retry only to ride out any brief lag. */
export async function fetchBookingRequestStatus(
  id: string,
): Promise<'approved' | 'pending' | 'rejected' | 'unknown'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase
      .from('booking_requests')
      .select('status, payment_screenshot_url')
      .eq('id', id)
      .maybeSingle();

    const row = data as any;
    if (row && row.payment_screenshot_url !== AWAITING_PAYMENT_SENTINEL) {
      return row.status ?? 'unknown';
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
  }
  return 'unknown';
}

// ── Online approval mode ───────────────────────────────────────────────────

export async function fetchOnlineApprovalMode(): Promise<boolean> {
  const { data } = await supabase
    .from('owner_settings')
    .select('online_approval_mode')
    .limit(1)
    .single();
  if (!data) return true;
  return (data as any).online_approval_mode !== false;
}

// ── Submit booking request ─────────────────────────────────────────────────
// Customer online booking → always auto-books (online only, approval checked)
// Staff/Owner cash/online → approval mode decides

export async function submitBookingRequest(params: SubmitBookingRequestParams): Promise<{
  request:    BookingRequest | null;
  autoBooked: boolean;
  error:      string | null;
}> {
  const advance = params.advanceAmount ?? 0;
  const finalAmount = params.finalAmount ?? 0;

  let autoBook = false;
  // Staff/owner bookings are always instant regardless of payment method or approval mode
  autoBook = true;

  const status = autoBook ? 'approved' : 'pending';

  // Insert booking_request row (ALWAYS — preserves screenshot records)
  const { data: reqData, error: reqErr } = await supabase
    .from('booking_requests')
    .insert({
      customer_id:            params.customerId,
      customer_name:          params.customerName,
      phone:                  params.phone,
      booking_date:           params.bookingDate,
      turf:                   params.turf,
      slot_label:             params.slotLabel,
      sport:                  params.sport,
      advance_amount:         advance,
      payment_method:         params.paymentMethod,
      payment_screenshot_url: params.screenshotUrl,
      status,
      booking_source_role:    params.bookingSourceRole,
      created_by:             params.createdBy,
    })
    .select()
    .single();

  if (reqErr || !reqData) {
    return { request: null, autoBooked: false, error: reqErr?.message ?? 'Could not submit request.' };
  }

  // Auto-book: immediately create bookings row
  if (autoBook) {
    const { error: bookErr } = await supabase
      .from('bookings')
      .insert({
        customer:            params.customerName,
        phone:               params.phone,
        slot:                params.slotLabel,
        turf:                params.turf,
        field:               params.turf,
        booking_date:        params.bookingDate,
        status:              'Confirmed',
        amount:              finalAmount,
        paid:                false,
        advance_amount:      advance,
        sport:               params.sport,
        customer_id:         params.customerId,
        created_by:          params.createdBy,
        booking_source_role: params.bookingSourceRole,
      });

    if (bookErr) {
      // Revert to pending if booking creation failed
      await supabase.from('booking_requests').update({ status: 'pending' }).eq('id', reqData.id);
      return {
        request: toRequest(reqData), autoBooked: false,
        error: 'Booking submitted for approval (auto-booking failed — possible slot conflict).',
      };
    }
  }

  return { request: toRequest(reqData), autoBooked: autoBook, error: null };
}

// ── Approve booking request (owner + staff) ────────────────────────────────

export async function approveBookingRequest(params: {
  request:       BookingRequest;
  reviewerId:    string;
  reviewerRole:  string;
  finalAmount:   number;
}): Promise<{ error: string | null }> {
  const { request, reviewerId, reviewerRole, finalAmount } = params;

  const { error: bookErr } = await supabase
    .from('bookings')
    .insert({
      customer:            request.customer_name,
      phone:               request.phone,
      slot:                request.slot_label,
      turf:                request.turf,
      field:               request.turf,
      booking_date:        request.booking_date,
      status:              'Confirmed',
      amount:              finalAmount,
      paid:                false,
      advance_amount:      request.advance_amount,
      sport:               request.sport,
      customer_id:         request.customer_id,
      created_by:          reviewerId,
      booking_source_role: request.booking_source_role,
    });

  if (bookErr) return { error: bookErr.message };

  const { error: updateErr } = await supabase
    .from('booking_requests')
    .update({ status: 'approved', final_amount: finalAmount })
    .eq('id', request.id);

  if (updateErr) return { error: updateErr.message };

  // Audit
  // We log against the booking_request ID since booking ID is newly created
  await supabase.from('booking_edits').insert({
    action:          'confirm',
    changed_by:      reviewerId,
    changed_by_role: reviewerRole,
    reason:          `Booking approved by ${reviewerRole}`,
  });

  return { error: null };
}

// ── Reject booking request ─────────────────────────────────────────────────

export async function rejectBookingRequest(params: {
  requestId:    string;
  reviewerId:   string;
  reviewerRole?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('booking_requests')
    .update({ status: 'rejected' })
    .eq('id', params.requestId);
  return { error: error?.message ?? null };
}

// ── Customer phone helpers ─────────────────────────────────────────────────

export async function fetchCustomerPhone(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('customer_contact_details').select('phone').eq('user_id', userId).single();
  return (data as any)?.phone ?? null;
}

export async function upsertCustomerPhone(userId: string, phone: string): Promise<void> {
  await supabase.from('customer_contact_details').upsert({
    user_id: userId, phone: phone.trim(), updated_at: new Date().toISOString(),
  });
}