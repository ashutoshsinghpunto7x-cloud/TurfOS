// @ts-nocheck
// supabase/functions/razorpay-callback/index.ts
//
// Browser-POST redirect target for Razorpay Checkout's `callback_url` option
// (see RazorpayPaymentSheet.web.tsx). Unlike verify-razorpay-payment (called
// by our own authenticated fetch from inside the SPA) this is invoked by a
// plain HTML form POST that the USER'S BROWSER submits after Checkout
// completes — there is no Supabase auth header available here, and crucially
// no reliance on the SPA's in-memory JS state having survived. That's the
// whole point: on mobile web, switching to a UPI app to authorize payment
// backgrounds the tab, and the OS/browser can kill its renderer to reclaim
// memory. The old handler-callback flow depended on that same JS context
// staying alive to show "Payment Successful" — if it didn't, the user saw
// nothing. This fires via a fresh top-level navigation instead, so it still
// works even if the tab's JS state was wiped.
//
// Security: no bearer token is possible here, so trust comes entirely from
// the HMAC signature (order_id|payment_id, same check as verify-razorpay-
// payment) — never from anything else in the POST body. This function only
// finalizes the exact payment/order that signature proves was actually
// paid. The redirect back to the app carries nothing but a booking_request
// id to look up — the app always re-reads real status from the DB itself
// (fetchBookingRequestStatus), so nothing in the URL is ever trusted either.
//
// ── Setup ────────────────────────────────────────────────────────────────
// Deploy with JWT verification OFF (see supabase/config.toml):
//   npx supabase functions deploy razorpay-callback --no-verify-jwt
// Set the app's public URL so we know where to redirect back to:
//   npx supabase secrets set FRONTEND_URL=https://playboxturf.vercel.app

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';
import { finalizeBooking } from '../_shared/finalizeBooking.ts';

const RAZORPAY_KEY_SECRET  = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL         = (Deno.env.get('FRONTEND_URL') ?? 'https://playboxturf.vercel.app').replace(/\/$/, '');

function redirectHome(params: Record<string, string>): Response {
  const url = new URL(FRONTEND_URL + '/');
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    // A stray GET (someone opens the function URL directly) — just go home.
    return redirectHome({});
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const form = await req.formData();
    const razorpay_order_id   = String(form.get('razorpay_order_id')   ?? '');
    const razorpay_payment_id = String(form.get('razorpay_payment_id') ?? '');
    const razorpay_signature  = String(form.get('razorpay_signature')  ?? '');

    if (!razorpay_order_id) {
      return redirectHome({ rzp_note: 'missing_order' });
    }

    const { data: paymentRecord } = await supabase
      .from('razorpay_payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (!paymentRecord) {
      console.error(`razorpay-callback: no razorpay_payments row for order ${razorpay_order_id}`);
      return redirectHome({ rzp_note: 'not_found' });
    }

    const pr = paymentRecord as any;
    const checkId = pr.booking_request_id ?? pr.booking_id ?? '';

    // Already finalized — by the client's own verify call, the webhook, or a
    // duplicate delivery of this same callback. Nothing left to do; just
    // send the app back to look up the (already-settled) status.
    if (pr.status === 'paid' || pr.status === 'failed') {
      return redirectHome({ rzp_check: checkId });
    }

    if (!razorpay_payment_id || !razorpay_signature) {
      // Checkout only includes these on a genuinely completed payment — their
      // absence means this POST isn't reporting a successful charge (e.g. a
      // cancelled/failed attempt that still redirected). Nothing to finalize.
      return redirectHome({ rzp_check: checkId });
    }

    const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error(`razorpay-callback: signature mismatch for order ${razorpay_order_id}`);
      await supabase
        .from('razorpay_payments')
        .update({ status: 'failed', error_code: 'SIGNATURE_MISMATCH', updated_at: new Date().toISOString() })
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('status', 'created');
      return redirectHome({ rzp_check: checkId });
    }

    // Conditional update — if the client's own verify call or the webhook
    // already won this race, this matches zero rows and finalizeBooking is
    // skipped entirely rather than re-run.
    const { data: updatedRows, error: updateErr } = await supabase
      .from('razorpay_payments')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status:      'paid',
        verified_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('status', 'created')
      .select('id');

    if (updateErr) throw updateErr;

    if (updatedRows && updatedRows.length > 0) {
      await finalizeBooking(supabase, pr, razorpay_payment_id);
    }

    return redirectHome({ rzp_check: checkId });

  } catch (err) {
    console.error('Unexpected error in razorpay-callback:', err);
    // Still send the user home — the app's own status check, and the
    // webhook as an independent backstop, can resolve the real outcome.
    return redirectHome({ rzp_note: 'error' });
  }
});
