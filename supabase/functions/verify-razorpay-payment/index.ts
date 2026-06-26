// @ts-nocheck
// supabase/functions/verify-razorpay-payment/index.ts
// Signature verification happens ONLY here. Frontend never marks payment paid.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const RAZORPAY_KEY_SECRET  = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token    = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse payload ───────────────────────────────────────────────────
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing required payment fields.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Fetch our internal payment record ───────────────────────────────
    const { data: paymentRecord, error: fetchErr } = await supabase
      .from('razorpay_payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (fetchErr || !paymentRecord) {
      return new Response(JSON.stringify({ error: 'Payment record not found.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Idempotency — already verified? ─────────────────────────────────
    if ((paymentRecord as any).status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already verified.', already_paid: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 5. Verify ownership — customer_id must match ───────────────────────
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    const isPrivileged = ['owner', 'admin', 'staff'].includes((profile as any)?.role ?? '');

    if (!isPrivileged && (paymentRecord as any).customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. HMAC-SHA256 signature verification (THE critical security check) ─
    // Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
    const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark as failed in our DB
      await supabase
        .from('razorpay_payments')
        .update({
          status:            'failed',
          error_code:        'SIGNATURE_MISMATCH',
          error_description: 'Payment signature verification failed.',
          updated_at:        new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpay_order_id);

      console.error(`Signature mismatch for order ${razorpay_order_id}`);
      return new Response(JSON.stringify({ error: 'Payment verification failed. Possible tampering.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Fetch payment details from Razorpay to double-check amount ──────
    const rzpCredentials = btoa(`${Deno.env.get('RAZORPAY_KEY_ID')}:${RAZORPAY_KEY_SECRET}`);
    const rzpPaymentResp = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      { headers: { 'Authorization': `Basic ${rzpCredentials}` } },
    );

    if (rzpPaymentResp.ok) {
      const rzpPayment = await rzpPaymentResp.json();

      // Validate amount matches what we expect (tamper check)
      if (rzpPayment.amount !== (paymentRecord as any).amount_paise) {
        await supabase
          .from('razorpay_payments')
          .update({ status: 'failed', error_code: 'AMOUNT_MISMATCH', updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', razorpay_order_id);

        return new Response(JSON.stringify({ error: 'Amount mismatch detected.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 8. All checks passed — mark as paid in our DB ─────────────────────
    const { error: updateErr } = await supabase
      .from('razorpay_payments')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status:      'paid',
        verified_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id);

    if (updateErr) throw updateErr;

    // ── 9. Update booking_request / booking status ─────────────────────────
    const pr = paymentRecord as any;

    if (pr.booking_request_id) {
      // Mark booking request as advance-paid (still needs owner approval for slot confirmation)
      await supabase
        .from('booking_requests')
        .update({
          payment_method:         'razorpay',
          payment_screenshot_url: `rzp_verified:${razorpay_payment_id}`, // sentinel value
          status:                 'pending', // still needs owner to approve
        })
        .eq('id', pr.booking_request_id);
    }

    if (pr.booking_id) {
      // For direct booking payments (remaining amount), mark paid
      await supabase
        .from('bookings')
        .update({
          paid:    true,
          status:  'Completed',
        })
        .eq('id', pr.booking_id);
    }

    // ── 10. Return success ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:            true,
        razorpay_payment_id,
        booking_request_id: pr.booking_request_id,
        booking_id:         pr.booking_id,
        message:            'Payment verified successfully.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('Unexpected error in verify-razorpay-payment:', err);
    return new Response(JSON.stringify({ error: 'Internal server error during verification.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});