import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
}

export interface CustomerBooking {
  id: string;
  slot: string;
  turf: string;
  field: string;
  booking_date: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  amount: number;
  paid: boolean;
  customer: string;
}

export interface CustomerPayment {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  provider: string;
  payment_type: string;
  created_at: string;
}

export interface CustomerCreditEntry {
  id: string;
  item: string;
  amount: number;
  entry_type: 'credit' | 'debit';
  note: string;
  entry_date: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function toCustomerBooking(row: any): CustomerBooking {
  return {
    id:           row.id,
    slot:         row.slot,
    turf:         row.turf ?? row.field ?? 'Turf A',
    field:        row.field ?? row.turf ?? 'Turf A',
    booking_date: row.booking_date,
    status:       row.status,
    amount:       Number(row.amount ?? 0),
    paid:         Boolean(row.paid),
    customer:     row.customer,
  };
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function fetchCustomerProfile(userId: string): Promise<{
  profile: CustomerProfile | null;
  error: string | null;
}> {
  const { data: authUser } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', userId)
    .single();

  if (error || !data) return { profile: null, error: error?.message ?? 'Profile not found.' };

  return {
    profile: {
      id:        data.id,
      full_name: data.full_name ?? '',
      email:     data.email ?? authUser.user?.email ?? '',
      role:      data.role,
    },
    error: null,
  };
}

export async function updateCustomerProfile(params: {
  userId: string;
  fullName: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: params.fullName.trim() })
    .eq('id', params.userId);

  return { error: error?.message ?? null };
}

// ── Bookings ───────────────────────────────────────────────────────────────
// Fetches bookings where customer_id = current user.
// Falls back to customer name match if customer_id not set (legacy data).

export async function fetchCustomerBookings(userId: string): Promise<{
  upcoming: CustomerBooking[];
  past: CustomerBooking[];
  error: string | null;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('bookings')
    .select('id, slot, turf, field, booking_date, status, amount, paid, customer')
    .eq('customer_id', userId)
    .order('booking_date', { ascending: false });

  if (error) return { upcoming: [], past: [], error: error.message };

  const all = (data ?? []).map(toCustomerBooking);
  const upcoming = all.filter(
    (b) => b.booking_date >= today && b.status !== 'Cancelled',
  ).sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  const past = all.filter(
    (b) => b.booking_date < today || b.status === 'Cancelled' || b.status === 'Completed',
  );

  return { upcoming, past, error: null };
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function fetchCustomerPayments(userId: string): Promise<{
  payments: CustomerPayment[];
  error: string | null;
}> {
  // Join through bookings to scope to this customer's payments
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, booking_id, amount, status, provider, payment_type, created_at,
      bookings!inner ( customer_id )
    `)
    .eq('bookings.customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { payments: [], error: error.message };

  const payments: CustomerPayment[] = (data ?? []).map((r: any) => ({
    id:           r.id,
    booking_id:   r.booking_id,
    amount:       Number(r.amount),
    status:       r.status,
    provider:     r.provider,
    payment_type: r.payment_type,
    created_at:   r.created_at,
  }));

  return { payments, error: null };
}

// ── Credit ─────────────────────────────────────────────────────────────────
// Scoped to customer name (credit_ledger stores customer as text field).
// Requires the profile's full_name to match the customer field in ledger.

export async function fetchCustomerCredit(customerName: string): Promise<{
  entries: CustomerCreditEntry[];
  outstanding: number;
  error: string | null;
}> {
  if (!customerName.trim()) return { entries: [], outstanding: 0, error: null };

  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, item, amount, entry_type, note, entry_date')
    .eq('customer', customerName.trim())
    .order('entry_date', { ascending: false })
    .limit(20);

  if (error) return { entries: [], outstanding: 0, error: error.message };

  const entries: CustomerCreditEntry[] = (data ?? []).map((r: any) => ({
    id:         r.id,
    item:       r.item,
    amount:     Number(r.amount),
    entry_type: r.entry_type,
    note:       r.note ?? '',
    entry_date: r.entry_date,
  }));

  const outstanding = entries.reduce((sum, e) => {
    return e.entry_type === 'credit' ? sum + e.amount : sum - e.amount;
  }, 0);

  return { entries, outstanding: Math.max(0, outstanding), error: null };
}

// ── Cancel booking ─────────────────────────────────────────────────────────

export async function cancelCustomerBooking(bookingId: string, userId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Cancelled' })
    .eq('id', bookingId)
    .eq('customer_id', userId);   // RLS + application-level guard

  return { error: error?.message ?? null };
}