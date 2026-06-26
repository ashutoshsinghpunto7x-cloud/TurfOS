import { supabase } from '../lib/supabase';

// ── return types ───────────────────────────────────────────────────────────

export interface TodayBookingSummary {
  id: string;
  customer: string;
  phone: string;
  slot: string;
  field: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  amount: number;
  paid: boolean;
}

export interface RecentActivityItem {
  id: string;
  type: 'sale';
  label: string;
  sub: string;
  amount: number;
  undone: boolean;
  timestamp: string;
}

export interface DashboardMetrics {
  // revenue
  todayBookingRevenue: number;
  yesterdayBookingRevenue: number;
  todayPOSRevenue: number;
  weekRevenue: number[];     // last 7 calendar days, index 0 = oldest
  weekLabels: string[];

  // bookings
  todayBookings: TodayBookingSummary[];
  pendingCount: number;

  // credit
  outstandingCredit: number;

  // stock
  lowStockCount: number;
  totalInventoryItems: number;

  // recent activity
  recentActivity: RecentActivityItem[];
}

// ── date helpers ───────────────────────────────────────────────────────────

function todayISO(): string  { return new Date().toISOString().slice(0, 10); }
function yesterdayISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nDaysAgoISO(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function shortDay(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
}

// ── main fetch ─────────────────────────────────────────────────────────────

export async function fetchDashboardMetrics(): Promise<{
  metrics: DashboardMetrics | null;
  error: string | null;
}> {
  const today     = todayISO();
  const yesterday = yesterdayISO();

  const [
    todayBookingsRes,
    creditRes,
    inventoryRes,
    recentSalesRes,
    weekBookingsRes,
    weekPOSRes,
  ] = await Promise.all([

    // 1. Today's bookings
    supabase
      .from('bookings')
      .select('id, customer, phone, slot, field, status, amount, paid')
      .eq('booking_date', today)
      .order('slot'),

    // 2. Credit ledger — outstanding balance
    supabase
      .from('credit_ledger')
      .select('amount, entry_type'),

    // 3. Inventory — low stock count
    supabase
      .from('inventory_items')
      .select('stock, min_stock')
      .eq('is_active', true),

    // 4. Recent POS transactions — for activity feed
    supabase
      .from('pos_transactions')
      .select(`
        id, customer, total, status, created_at,
        pos_transaction_items ( item_name )
      `)
      .order('created_at', { ascending: false })
      .limit(15),

    // 5. Last 7 days of bookings (paid) — for bar chart
    supabase
      .from('bookings')
      .select('booking_date, amount, paid')
      .gte('booking_date', nDaysAgoISO(6))
      .lte('booking_date', today)
      .neq('status', 'Cancelled'),

    // 6. Last 7 days of POS sales — fold into bar chart
    supabase
      .from('pos_transactions')
      .select('created_at, total')
      .gte('created_at', nDaysAgoISO(6) + 'T00:00:00.000Z')
      .neq('status', 'undone')
      .order('created_at', { ascending: false }),
  ]);

  // ── today bookings ─────────────────────────────────────────────────────
  const todayBookings: TodayBookingSummary[] = (todayBookingsRes.data ?? []).map((b: any) => ({
    id:       b.id,
    customer: b.customer,
    phone:    b.phone ?? '',
    slot:     b.slot,
    field:    b.field,
    status:   b.status,
    amount:   Number(b.amount ?? 0),
    paid:     Boolean(b.paid),
  }));

  const todayBookingRevenue = todayBookings
    .filter((b) => b.paid)
    .reduce((sum, b) => sum + b.amount, 0);

  const pendingCount = todayBookings.filter((b) => b.status === 'Pending').length;

  // ── yesterday booking revenue (for comparison) ─────────────────────────
  // Re-use weekBookingsRes data to avoid an extra query
  const yesterdayBookingRevenue = (weekBookingsRes.data ?? [])
    .filter((b: any) => b.booking_date === yesterday && b.paid)
    .reduce((sum: number, b: any) => sum + Number(b.amount ?? 0), 0);

  // ── credit outstanding ─────────────────────────────────────────────────
  const creditRows: { amount: number; entry_type: string }[] = creditRes.data ?? [];
  const outstandingCredit = Math.max(
    0,
    creditRows.reduce((sum, r) => {
      const amt = Number(r.amount);
      return r.entry_type === 'credit' ? sum + amt : sum - amt;
    }, 0),
  );

  // ── low stock ──────────────────────────────────────────────────────────
  const inventoryRows: { stock: number; min_stock: number }[] = inventoryRes.data ?? [];
  const lowStockCount = inventoryRows.filter(
    (i) => Number(i.stock) <= Number(i.min_stock),
  ).length;
  const totalInventoryItems = inventoryRows.length;

  // ── recent activity ────────────────────────────────────────────────────
  const recentActivity: RecentActivityItem[] = (recentSalesRes.data ?? []).map((tx: any) => {
    const names: string[] = (tx.pos_transaction_items ?? [])
      .map((li: any) => li.item_name as string)
      .slice(0, 3);
    const time = new Date(tx.created_at).toTimeString().slice(0, 5);
    const txDate = (tx.created_at as string).slice(0, 10);
    const dateLabel = txDate === today ? 'Today' : txDate === yesterday ? 'Yesterday' : txDate;
    return {
      id:        tx.id,
      type:      'sale',
      label:     names.join(', ') || 'Sale',
      sub:       `${time}  ·  ${tx.customer}  ·  ${dateLabel}`,
      amount:    Number(tx.total),
      undone:    tx.status === 'undone',
      timestamp: tx.created_at,
    };
  });

  // ── today POS revenue (from recentSalesRes — most recent date) ─────────
  const todayPOSRevenue = (recentSalesRes.data ?? [])
    .filter((tx: any) =>
      (tx.created_at as string).slice(0, 10) === today && tx.status !== 'undone',
    )
    .reduce((sum: number, tx: any) => sum + Number(tx.total), 0);

  // ── week revenue bar chart (bookings + POS combined per day) ──────────
  const dayMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) dayMap[nDaysAgoISO(i)] = 0;

  // Paid bookings per day
  (weekBookingsRes.data ?? []).forEach((b: any) => {
    const key = b.booking_date as string;
    if (key in dayMap && b.paid) dayMap[key] += Number(b.amount ?? 0);
  });

  // POS sales per day
  (weekPOSRes.data ?? []).forEach((tx: any) => {
    const key = (tx.created_at as string).slice(0, 10);
    if (key in dayMap) dayMap[key] += Number(tx.total ?? 0);
  });

  const sortedDays = Object.keys(dayMap).sort();
  const weekRevenue = sortedDays.map((d) => dayMap[d]);
  const weekLabels  = sortedDays.map((d) => shortDay(d));

  const firstError =
    todayBookingsRes.error?.message ??
    creditRes.error?.message        ??
    inventoryRes.error?.message     ??
    null;

  return {
    metrics: {
      todayBookingRevenue,
      yesterdayBookingRevenue,
      todayPOSRevenue,
      weekRevenue,
      weekLabels,
      todayBookings,
      pendingCount,
      outstandingCredit,
      lowStockCount,
      totalInventoryItems,
      recentActivity,
    },
    error: firstError,
  };
}