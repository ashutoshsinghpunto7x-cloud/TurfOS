import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Coupon {
  id:                   string;
  code:                 string;
  discount_type:        'percent' | 'fixed';
  discount_value:       number;
  min_booking_amount:   number;
  max_uses:             number | null;
  uses_count:           number;
  valid_from:           string;
  valid_until:          string | null;
  is_active:            boolean;
  created_by:           string | null;
  created_at:           string;
}

export interface SentCoupon {
  id:             string;     // unique per sent instance
  coupon_id:      string;
  customer_id:    string;
  customer_name:  string;
  code:           string;
  discount_type:  'percent' | 'fixed';
  discount_value: number;
  is_used:        boolean;
  used_at:        string | null;
  sent_at:        string;
  is_read:        boolean;
}

export interface CouponValidation {
  valid:          boolean;
  coupon:         Coupon | null;
  sentCoupon:     SentCoupon | null;   // if validating from sent_coupons
  discountAmount: number;
  finalAmount:    number;
  message:        string;
}

function toCoupon(row: any): Coupon {
  return {
    id:                 row.id,
    code:               row.code,
    discount_type:      row.discount_type,
    discount_value:     Number(row.discount_value),
    min_booking_amount: Number(row.min_booking_amount ?? 0),
    max_uses:           row.max_uses != null ? Number(row.max_uses) : null,
    uses_count:         Number(row.uses_count ?? 0),
    valid_from:         row.valid_from,
    valid_until:        row.valid_until ?? null,
    is_active:          Boolean(row.is_active),
    created_by:         row.created_by ?? null,
    created_at:         row.created_at,
  };
}

function toSentCoupon(row: any): SentCoupon {
  return {
    id:             row.id,
    coupon_id:      row.coupon_id,
    customer_id:    row.customer_id,
    customer_name:  row.customer_name ?? '',
    code:           row.code,
    discount_type:  row.discount_type,
    discount_value: Number(row.discount_value),
    is_used:        Boolean(row.is_used),
    used_at:        row.used_at ?? null,
    sent_at:        row.sent_at,
    is_read:        Boolean(row.is_read),
  };
}

// ── Validate coupon code ───────────────────────────────────────────────────
// First checks sent_coupons (customer-specific unique instance),
// then falls back to checking global coupons table.

export async function validateCoupon(params: {
  code:          string;
  bookingAmount: number;
  customerId?:   string;
}): Promise<CouponValidation> {
  const code = params.code.trim().toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Check sent_coupons first (unique per customer)
  if (params.customerId) {
    const { data: sentRows } = await supabase
      .from('sent_coupons')
      .select('*')
      .eq('code', code)
      .eq('customer_id', params.customerId)
      .eq('is_used', false);

    const sentRow = (sentRows ?? [])[0];
    if (sentRow) {
      const sc   = toSentCoupon(sentRow);
      // Check parent coupon validity
      const { data: parentData } = await supabase
        .from('coupons').select('*').eq('id', sc.coupon_id).single();

      if (parentData) {
        const parent = toCoupon(parentData);
        if (!parent.is_active) {
          return { valid: false, coupon: parent, sentCoupon: sc, discountAmount: 0, finalAmount: params.bookingAmount, message: 'This coupon is no longer active.' };
        }
        if (parent.valid_until && today > parent.valid_until) {
          return { valid: false, coupon: parent, sentCoupon: sc, discountAmount: 0, finalAmount: params.bookingAmount, message: 'Coupon has expired.' };
        }
        if (params.bookingAmount < parent.min_booking_amount) {
          return { valid: false, coupon: parent, sentCoupon: sc, discountAmount: 0, finalAmount: params.bookingAmount, message: `Minimum booking amount ₹${parent.min_booking_amount} required.` };
        }
      }

      let discountAmount = 0;
      if (sc.discount_type === 'percent') {
        discountAmount = Math.round((params.bookingAmount * sc.discount_value) / 100);
      } else {
        discountAmount = Math.min(sc.discount_value, params.bookingAmount);
      }
      const finalAmount = Math.max(0, params.bookingAmount - discountAmount);
      return {
        valid: true, coupon: null, sentCoupon: sc, discountAmount, finalAmount,
        message: sc.discount_type === 'percent'
          ? `✓ ${sc.discount_value}% discount applied! You save ₹${discountAmount}.`
          : `✓ ₹${discountAmount} discount applied!`,
      };
    }
  }

  // 2. Check global coupons table
  const { data, error } = await supabase
    .from('coupons').select('*').eq('code', code).eq('is_active', true).single();

  if (error || !data) {
    return { valid: false, coupon: null, sentCoupon: null, discountAmount: 0, finalAmount: params.bookingAmount, message: 'Invalid coupon code.' };
  }

  const coupon = toCoupon(data);

  if (today < coupon.valid_from) {
    return { valid: false, coupon, sentCoupon: null, discountAmount: 0, finalAmount: params.bookingAmount, message: 'Coupon is not active yet.' };
  }
  if (coupon.valid_until && today > coupon.valid_until) {
    return { valid: false, coupon, sentCoupon: null, discountAmount: 0, finalAmount: params.bookingAmount, message: 'Coupon has expired.' };
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return { valid: false, coupon, sentCoupon: null, discountAmount: 0, finalAmount: params.bookingAmount, message: 'Coupon usage limit reached.' };
  }
  if (params.bookingAmount < coupon.min_booking_amount) {
    return { valid: false, coupon, sentCoupon: null, discountAmount: 0, finalAmount: params.bookingAmount, message: `Minimum booking amount ₹${coupon.min_booking_amount} required.` };
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percent') {
    discountAmount = Math.round((params.bookingAmount * coupon.discount_value) / 100);
  } else {
    discountAmount = Math.min(coupon.discount_value, params.bookingAmount);
  }
  const finalAmount = Math.max(0, params.bookingAmount - discountAmount);

  return {
    valid: true, coupon, sentCoupon: null, discountAmount, finalAmount,
    message: coupon.discount_type === 'percent'
      ? `✓ ${coupon.discount_value}% discount applied! You save ₹${discountAmount}.`
      : `✓ ₹${discountAmount} discount applied!`,
  };
}

// ── Mark sent coupon as used ───────────────────────────────────────────────

export async function markSentCouponUsed(sentCouponId: string): Promise<void> {
  await supabase
    .from('sent_coupons')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', sentCouponId);
}

// ── Increment global coupon uses ───────────────────────────────────────────

export async function incrementCouponUses(couponId: string): Promise<void> {
  await supabase.rpc('increment_coupon_uses', { p_coupon_id: couponId });
}

// ── Fetch all coupons (owner) ──────────────────────────────────────────────

export async function fetchCoupons(): Promise<{ coupons: Coupon[]; error: string | null }> {
  const { data, error } = await supabase
    .from('coupons').select('*').order('created_at', { ascending: false });
  if (error) return { coupons: [], error: error.message };
  return { coupons: (data ?? []).map(toCoupon), error: null };
}

// ── Create coupon ──────────────────────────────────────────────────────────

export interface CreateCouponParams {
  code: string; discountType: 'percent' | 'fixed'; discountValue: number;
  minBookingAmount: number; maxUses: number | null; validFrom: string;
  validUntil: string | null; createdBy: string | null;
}

export async function createCoupon(params: CreateCouponParams): Promise<{
  coupon: Coupon | null; error: string | null;
}> {
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code:               params.code.trim().toUpperCase(),
      discount_type:      params.discountType,
      discount_value:     params.discountValue,
      min_booking_amount: params.minBookingAmount,
      max_uses:           params.maxUses,
      valid_from:         params.validFrom,
      valid_until:        params.validUntil,
      is_active:          true,
      created_by:         params.createdBy,
    })
    .select().single();

  if (error || !data) {
    const msg = error?.code === '23505' ? 'Coupon code already exists.' : (error?.message ?? 'Could not create coupon.');
    return { coupon: null, error: msg };
  }
  return { coupon: toCoupon(data), error: null };
}

// ── Send coupon to customer (creates unique sent_coupon instance) ──────────

export async function sendCouponToCustomer(params: {
  coupon:        Coupon;
  customerId:    string;
  customerName:  string;
  sentBy:        string;
}): Promise<{ sentCoupon: SentCoupon | null; error: string | null }> {
  const { data, error } = await supabase
    .from('sent_coupons')
    .insert({
      coupon_id:      params.coupon.id,
      customer_id:    params.customerId,
      customer_name:  params.customerName,
      code:           params.coupon.code,
      discount_type:  params.coupon.discount_type,
      discount_value: params.coupon.discount_value,
      is_used:        false,
      sent_by:        params.sentBy,
      is_read:        false,
    })
    .select().single();

  if (error || !data) {
    return { sentCoupon: null, error: error?.message ?? 'Could not send coupon.' };
  }
  return { sentCoupon: toSentCoupon(data), error: null };
}

// ── Fetch sent coupons for customer ───────────────────────────────────────

export async function fetchCustomerSentCoupons(customerId: string): Promise<{
  sentCoupons: SentCoupon[]; unreadCount: number; error: string | null;
}> {
  const { data, error } = await supabase
    .from('sent_coupons')
    .select('*')
    .eq('customer_id', customerId)
    .order('sent_at', { ascending: false });

  if (error) return { sentCoupons: [], unreadCount: 0, error: error.message };

  const sentCoupons = (data ?? []).map(toSentCoupon);
  const unreadCount = sentCoupons.filter((c) => !c.is_read && !c.is_used).length;
  return { sentCoupons, unreadCount, error: null };
}

// ── Mark coupon as read ────────────────────────────────────────────────────

export async function markCouponRead(sentCouponId: string): Promise<void> {
  await supabase.from('sent_coupons').update({ is_read: true }).eq('id', sentCouponId);
}

// ── Toggle coupon / delete ────────────────────────────────────────────────

export async function toggleCoupon(couponId: string, isActive: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('coupons').update({ is_active: isActive }).eq('id', couponId);
  return { error: error?.message ?? null };
}

export async function deleteCoupon(couponId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  return { error: error?.message ?? null };
}

// ── Assign/remove V badge ──────────────────────────────────────────────────

export async function assignVBadge(customerId: string, assignedBy: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('customer_badges').upsert({
    customer_id: customerId, badge_type: 'V', assigned_by: assignedBy,
    assigned_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

export async function removeVBadge(customerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('customer_badges')
    .delete().eq('customer_id', customerId).eq('badge_type', 'V');
  return { error: error?.message ?? null };
}

export async function fetchCustomerBadge(customerId: string): Promise<'V' | 'A' | null> {
  const { data } = await supabase.from('customer_badges')
    .select('badge_type').eq('customer_id', customerId).single();
  return (data?.badge_type as 'V' | 'A' | null) ?? null;
}