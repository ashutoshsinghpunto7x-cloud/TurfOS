// @ts-nocheck
// supabase/functions/create-razorpay-order/index.ts
// Runs on Deno. Razorpay secret key NEVER leaves this function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Environment variables (set in Supabase dashboard → Edge Functions → Secrets)
// RAZORPAY_KEY_ID      = rzp_test_xxxxxxxxxxxx   (or rzp_live_xxx for production)
// RAZORPAY_KEY_SECRET  = your_secret_key          (NEVER expose this to frontend)
// SUPABASE_URL         = auto-injected by Supabase
// SUPABASE_SERVICE_ROLE_KEY = auto-injected

const RAZORPAY_KEY_ID      = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET  = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the calling user ───────────────────────────────────
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify JWT from frontend
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse and validate request body ─────────────────────────────────
    const body = await req.json();

    const {
      booking_request_id,
      booking_id,
      amount_paise,
      currency = 'INR',
      notes,
    } = body;

    if (
      !amount_paise ||
      typeof amount_paise !== 'number' ||
      amount_paise < 100
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid amount. Minimum 100 paise (₹1).',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── 3. Verify booking belongs to this user (optional for now) ──────────
    if (booking_request_id) {
      const { data: req_row } = await supabase
        .from('booking_requests')
        .select('customer_id, advance_amount, status')
        .eq('id', booking_request_id)
        .single();

      if (!req_row) {
        return new Response(
          JSON.stringify({ error: 'Booking request not found.' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Allow owner/staff to create order for any booking
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isPrivileged = ['owner', 'admin', 'staff'].includes(
        (profile as any)?.role ?? ''
      );

      if (!isPrivileged && (req_row as any).customer_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent double payment
      const { data: existingPaid } = await supabase
        .from('razorpay_payments')
        .select('id, status')
        .eq('booking_request_id', booking_request_id)
        .eq('status', 'paid')
        .maybeSingle();

      if (existingPaid) {
        return new Response(
          JSON.stringify({ error: 'This booking is already paid.' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate amount
      const expectedPaise = Math.round(
        (req_row as any).advance_amount * 100
      );

      if (Math.abs(amount_paise - expectedPaise) > 1) {
        return new Response(
          JSON.stringify({
            error: 'Amount mismatch. Tampering detected.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ── 4. Create Razorpay order ────────────────────────────────────────────

    const receipt = booking_request_id
      ? `breq_${booking_request_id.slice(0, 16)}`
      : booking_id
        ? `book_${booking_id.slice(0, 16)}`
        : `temp_${Date.now()}`;

    const razorpayOrderPayload = {
      amount: amount_paise,
      currency,
      receipt,
      notes: {
        ...notes,
        booking_request_id: booking_request_id ?? '',
        booking_id: booking_id ?? '',
        customer_id: user.id,
        app: 'Playbox',
      },
    };

    const rzpCredentials = btoa(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
    );

    const rzpResponse = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${rzpCredentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(razorpayOrderPayload),
      }
    );

    if (!rzpResponse.ok) {
      const rzpError = await rzpResponse.json();

      console.error('Razorpay order creation failed:', rzpError);

      return new Response(
        JSON.stringify({
          error: 'Failed to create payment order. Please try again.',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const rzpOrder = await rzpResponse.json();

    // ── 5. Store order in DB ────────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from('razorpay_payments')
      .insert({
        booking_request_id: booking_request_id ?? null,
        booking_id: booking_id ?? null,
        customer_id: user.id,
        razorpay_order_id: rzpOrder.id,
        amount_paise,
        currency,
        status: 'created',
      });

    if (dbError) {
      console.error('DB insert error:', dbError);
      // Don't fail payment flow if DB insert fails
    }

    // ── 6. Return order details to frontend ────────────────────────────────
    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: RAZORPAY_KEY_ID,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (err) {
    console.error('Unexpected error in create-razorpay-order:', err);

    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});