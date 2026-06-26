import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateOrderParams {
  amountPaise:        number;      // amount in paise (₹1 = 100 paise)
  bookingRequestId?:  string;
  bookingId?:         string;
  currency?:          string;
  notes?:             Record<string, string>;
}

export interface CreateOrderResult {
  orderId:    string;
  amount:     number;
  currency:   string;
  keyId:      string;
  error?:     string;
}

export interface VerifyPaymentParams {
  razorpayOrderId:    string;
  razorpayPaymentId:  string;
  razorpaySignature:  string;
}

export interface VerifyPaymentResult {
  success:           boolean;
  alreadyPaid?:      boolean;
  bookingRequestId?: string;
  bookingId?:        string;
  error?:            string;
}

// ── Get Supabase session token for authenticated Edge Function calls ────────

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Get Edge Function base URL ─────────────────────────────────────────────

function edgeFunctionUrl(name: string): string {
  // EXPO_PUBLIC_SUPABASE_URL is your project URL e.g. https://xxxxxxxxxxx.supabase.co
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/functions/v1/${name}`;
}

// ── Create Razorpay order (calls backend Edge Function) ────────────────────

export async function createRazorpayOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const token = await getAuthToken();
  if (!token) return { orderId: '', amount: 0, currency: 'INR', keyId: '', error: 'Not authenticated.' };

  try {
    const response = await fetch(edgeFunctionUrl('create-razorpay-order'), {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount_paise:       params.amountPaise,
        booking_request_id: params.bookingRequestId,
        booking_id:         params.bookingId,
        currency:           params.currency ?? 'INR',
        notes:              params.notes ?? {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { orderId: '', amount: 0, currency: 'INR', keyId: '', error: data.error ?? 'Order creation failed.' };
    }

    return {
      orderId:  data.order_id,
      amount:   data.amount,
      currency: data.currency,
      keyId:    data.key_id,
    };

  } catch (err: any) {
    return { orderId: '', amount: 0, currency: 'INR', keyId: '', error: err?.message ?? 'Network error.' };
  }
}

// ── Verify payment (calls backend Edge Function) ───────────────────────────

export async function verifyRazorpayPayment(
  params: VerifyPaymentParams,
): Promise<VerifyPaymentResult> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated.' };

  try {
    const response = await fetch(edgeFunctionUrl('verify-razorpay-payment'), {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        razorpay_order_id:   params.razorpayOrderId,
        razorpay_payment_id: params.razorpayPaymentId,
        razorpay_signature:  params.razorpaySignature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Verification failed.' };
    }

    return {
      success:           true,
      alreadyPaid:       data.already_paid ?? false,
      bookingRequestId:  data.booking_request_id,
      bookingId:         data.booking_id,
    };

  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error during verification.' };
  }
}