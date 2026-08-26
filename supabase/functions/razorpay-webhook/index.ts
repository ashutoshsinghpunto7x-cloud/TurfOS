// @ts-nocheck
// supabase/functions/razorpay-webhook/index.ts
//
// Server-side safety net for Razorpay payments. The client-driven flow
// (create-razorpay-order → Checkout → verify-razorpay-payment) depends on
// the browser/app staying alive until the verify call completes. On mobile
// web that's not guaranteed — switching to a UPI app to authorize payment
// backgrounds the tab, and the OS can kill its renderer to reclaim memory.
// If that happens, Razorpay still captures the money but the client-side
// verify call (and any booking creation that depends on it) never runs.
//
// This webhook is called directly by Razorpay's servers — independent of
// the customer's browser — whenever a payment is captured or fails, so we
// always end up with an accurate `razorpay_payments.status`, even if the
// client died mid-flow.
//
// ── Setup (do this after deploying) ─────────────────────────────────────
// 1. Razorpay Dashboard → Settings → Webhooks → Add New Webhook
//      URL:    https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
//      Events: payment.captured, payment.failed
//      Secret: generate one and save it — this is RAZORPAY_WEBHOOK_SECRET
//              (different from RAZORPAY_KEY_SECRET; never reuse it).
// 2. Supabase secrets:
//      npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_from_step_1
// 3. This function must be deployed with JWT verification OFF — Razorpay
//    doesn't send a Supabase auth token, only its own HMAC signature
//    (verified below). See supabase/config.toml in this repo, or deploy
//    with: npx supabase functions deploy razorpay-webhook --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'https://deno.land/std@0.168.0/node/crypto.ts';
import { finalizeBooking } from '../_shared/finalizeBooking.ts';

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // ── 1. Verify the webhook signature against the RAW body ──────────────
    // Must use the raw text, not a re-serialized JSON.stringify(parsed) —
    // any whitespace/key-order difference would break the HMAC match.
    const rawBody   = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature.' }), { status: 400 });
    }

    const expectedSignature = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuf = new TextEncoder().encode(signature);
    const expBuf = new TextEncoder().encode(expectedSignature);
    const validSignature =
      sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

    if (!validSignature) {
      console.error('Webhook signature mismatch — possible spoofed request.');
      return new Response(JSON.stringify({ error: 'Invalid signature.' }), { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 2. Only handle payment events we care about ────────────────────────
    if (event.event !== 'payment.captured' && event.event !== 'payment.failed') {
      // Ack anything else so Razorpay stops retrying it — we just don't act on it.
      return new Response(JSON.stringify({ received: true, ignored: event.event }), { status: 200 });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) {
      return new Response(JSON.stringify({ error: 'Malformed payload.' }), { status: 400 });
    }

    // ── 3. Find our internal order record ──────────────────────────────────
    const { data: paymentRecord, error: fetchErr } = await supabase
      .from('razorpay_payments')
      .select('*')
      .eq('razorpay_order_id', payment.order_id)
      .maybeSingle();

    if (fetchErr || !paymentRecord) {
      // We got a webhook for an order we have no record of — log it but
      // still 200 so Razorpay doesn't hammer retries for something we can
      // never resolve from our side.
      console.error(`No razorpay_payments row for order ${payment.order_id}`);
      return new Response(JSON.stringify({ received: true, unmatched: true }), { status: 200 });
    }

    const pr = paymentRecord as any;

    // ── 4. Idempotency — already finalized by the client's verify call? ────
    if (pr.status === 'paid' || pr.status === 'failed') {
      return new Response(JSON.stringify({ received: true, already_final: true }), { status: 200 });
    }

    // ── 5. payment.failed → just record it, nothing to book ────────────────
    if (event.event === 'payment.failed') {
      await supabase
        .from('razorpay_payments')
        .update({
          status:            'failed',
          error_code:        payment.error_code ?? 'WEBHOOK_FAILED',
          error_description: payment.error_description ?? 'Payment failed (reported via webhook).',
          updated_at:        new Date().toISOString(),
        })
        .eq('razorpay_order_id', payment.order_id)
        .eq('status', 'created'); // don't clobber a state the client already resolved

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── 6. payment.captured → double-check amount, then mark paid ──────────
    if (payment.amount !== pr.amount_paise) {
      await supabase
        .from('razorpay_payments')
        .update({ status: 'failed', error_code: 'AMOUNT_MISMATCH', updated_at: new Date().toISOString() })
        .eq('razorpay_order_id', payment.order_id)
        .eq('status', 'created');

      console.error(`Webhook amount mismatch for order ${payment.order_id}: expected ${pr.amount_paise}, got ${payment.amount}`);
      return new Response(JSON.stringify({ received: true, mismatch: true }), { status: 200 });
    }

    // Guard on status = 'created' so a client verify call landing at the same
    // moment can't double-run the booking-side effects below.
    const { data: updatedRows, error: updateErr } = await supabase
      .from('razorpay_payments')
      .update({
        razorpay_payment_id: payment.id,
        status:              'paid',
        verified_at:         new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      })
      .eq('razorpay_order_id', payment.order_id)
      .eq('status', 'created')
      .select('id');

    if (updateErr) throw updateErr;

    if (!updatedRows || updatedRows.length === 0) {
      // Client's verify call won the race — it already handled booking-side effects.
      return new Response(JSON.stringify({ received: true, already_final: true }), { status: 200 });
    }

    // ── 7. Finalize whatever this payment is attached to ────────────────────
    // Shared with verify-razorpay-payment — see finalizeBooking for what each
    // case does. Booking requests created via the instant-book placeholder
    // (BookingRequestModal creates it BEFORE opening Checkout) get approved
    // and their booking row created right here, even if the client's own tab
    // died before it could call verify-razorpay-payment itself. A payment
    // with neither booking_request_id nor booking_id (some other/older
    // caller) ends up correctly marked 'paid' here regardless, so it's never
    // silently lost — it just needs manual reconciliation.
    await finalizeBooking(supabase, pr, payment.id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in razorpay-webhook:', err);
    // 500 so Razorpay retries — this path is a bug/outage, not a bad request.
    return new Response(JSON.stringify({ error: 'Internal server error.' }), { status: 500 });
  }
});
