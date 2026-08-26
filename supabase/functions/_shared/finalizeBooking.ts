// @ts-nocheck
// supabase/functions/_shared/finalizeBooking.ts
//
// Shared by verify-razorpay-payment (client-called, right after Checkout
// succeeds) and razorpay-webhook (Razorpay-called, independent of the
// client) — both need to do the exact same thing once a payment is
// confirmed paid, and must not double-run it if both happen to fire for
// the same payment (client verify + webhook racing, or a retried webhook).

// Sentinel written to booking_requests.payment_screenshot_url for a row
// created BEFORE payment as a placeholder (see
// bookingRequestService.ts:getOrCreatePendingPaymentRequest). Must match
// that literal exactly — it's how we tell "this is an instant-book
// customer request awaiting its Razorpay payment" apart from a cash/QR
// request genuinely awaiting manual owner approval.
const AWAITING_PAYMENT_SENTINEL = 'awaiting_payment';

/**
 * Runs once a razorpay_payments row has been confirmed 'paid' (caller is
 * responsible for that — and for the idempotency guard that ensures this
 * only gets called once per payment). Finalizes whatever it's attached to:
 *
 * - booking_id set            → an existing booking's remaining amount was
 *                                paid off; mark it paid/Completed.
 * - booking_request_id set,
 *   placeholder sentinel       → a new instant-book customer request created
 *                                pre-payment; approve it and create the
 *                                Confirmed booking row now that payment is
 *                                verified. Falls back to manual review if the
 *                                slot got taken in a race.
 * - booking_request_id set,
 *   not the sentinel           → some other caller attached a request before
 *                                payment without going through the instant-
 *                                book placeholder path; preserve the old,
 *                                conservative behavior (mark paid, leave for
 *                                manual approval) rather than assume intent.
 * - neither set                → a brand-new booking whose client died before
 *                                it ever created a booking_requests row.
 *                                Nothing to attach to — razorpay_payments is
 *                                already marked 'paid' by the caller, which is
 *                                the most we can do; needs manual reconciliation.
 */
export async function finalizeBooking(
  supabase: any,
  paymentRecord: {
    booking_request_id: string | null;
    booking_id:          string | null;
  },
  razorpayPaymentId: string,
): Promise<void> {
  if (paymentRecord.booking_id) {
    await supabase
      .from('bookings')
      .update({ paid: true, status: 'Completed' })
      .eq('id', paymentRecord.booking_id);
    return;
  }

  if (!paymentRecord.booking_request_id) return;

  const { data: reqRow } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('id', paymentRecord.booking_request_id)
    .maybeSingle();

  if (!reqRow) return;

  if (reqRow.payment_screenshot_url !== AWAITING_PAYMENT_SENTINEL) {
    // Not our instant-book placeholder — preserve prior behavior.
    await supabase
      .from('booking_requests')
      .update({
        payment_method:         'razorpay',
        payment_screenshot_url: `rzp_verified:${razorpayPaymentId}`,
        status:                 'pending',
      })
      .eq('id', paymentRecord.booking_request_id);
    return;
  }

  // Conditional update — if this loses the race (client verify + webhook
  // both got here), 0 rows match and we skip the insert below entirely.
  const { data: claimed } = await supabase
    .from('booking_requests')
    .update({
      status:                 'approved',
      payment_screenshot_url: `rzp_verified:${razorpayPaymentId}`,
    })
    .eq('id', reqRow.id)
    .eq('status', 'pending')
    .eq('payment_screenshot_url', AWAITING_PAYMENT_SENTINEL)
    .select('id');

  if (!claimed || claimed.length === 0) return; // someone else already finalized this

  const { error: bookErr } = await supabase
    .from('bookings')
    .insert({
      customer:            reqRow.customer_name,
      phone:                reqRow.phone,
      slot:                 reqRow.slot_label,
      turf:                 reqRow.turf,
      field:                reqRow.turf,
      booking_date:         reqRow.booking_date,
      status:               'Confirmed',
      amount:               reqRow.final_amount ?? 0,
      paid:                 false,
      advance_amount:       reqRow.advance_amount,
      sport:                reqRow.sport,
      customer_id:          reqRow.customer_id,
      created_by:           reqRow.created_by,
      booking_source_role:  reqRow.booking_source_role,
    });

  if (bookErr) {
    // Slot was taken in the race between order-creation and payment
    // completing. Payment is real and already marked paid — revert to
    // 'pending' (now carrying the rzp_verified marker, not the awaiting-
    // payment sentinel) so it surfaces in Pending Approvals for manual
    // resolution instead of vanishing silently.
    await supabase
      .from('booking_requests')
      .update({ status: 'pending' })
      .eq('id', reqRow.id);
  }
}
