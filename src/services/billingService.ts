import { supabase } from '../lib/supabase';
import { getSportConfig } from './bookingService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BillLineItem {
  transactionItemId:  string;   // pos_transaction_items.id  (for edit/delete)
  transactionId:      string;   // pos_transactions.id
  inventoryItemId:    string;   // inventory_items.id  (for stock RPC) — KEY FIX
  name:               string;
  quantity:           number;
  unitPrice:          number;
  lineTotal:          number;
}

export interface BillData {
  bookingId:     string;
  customerName:  string;
  phone:         string;
  sport:         string;
  slotLabel:     string;
  bookingDate:   string;
  turfName:      string;
  slotTotal:     number;
  advanceAmount: number;
  remainingSlot: number;
  posItems:      BillLineItem[];
  posTotal:      number;
  grandTotal:    number;
  isFinalized:   boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) || v === null || v === undefined || v === '' ? fallback : n;
}

function parseTimeToMinutes(s: string): number | null {
  const trimmed = (s ?? '').trim();
  // 12h: "11:00 PM"
  const am = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (am) {
    let h = parseInt(am[1], 10);
    const m = parseInt(am[2], 10);
    if (am[3].toUpperCase() === 'AM' && h === 12) h = 0;
    if (am[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  }
  // 24h: "11:00"
  const h24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  }
  return null;
}

function slotDurationMinutes(slotLabel: string): number {
  const sep = slotLabel?.includes('–') ? '–' : '-';
  const idx = slotLabel?.indexOf(sep) ?? -1;
  if (idx < 0) return 0;
  const sM = parseTimeToMinutes(slotLabel.slice(0, idx));
  const eM = parseTimeToMinutes(slotLabel.slice(idx + sep.length));
  if (sM === null || eM === null) return 0;
  return eM >= sM ? eM - sM : eM + 1440 - sM;
}

async function resolvePhone(phone: string, customerId: string | null): Promise<string> {
  if ((phone ?? '').trim()) return phone.trim();
  if (!customerId) return '';
  const { data } = await supabase
    .from('customer_contact_details').select('phone').eq('user_id', customerId).single();
  return (data as any)?.phone ?? '';
}

// ── Fetch bill (always live) ───────────────────────────────────────────────

export async function fetchBillData(bookingId: string): Promise<{
  bill: BillData | null; error: string | null;
}> {
  const { data: b, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer, phone, sport, slot, booking_date, amount, advance_amount, customer_id, paid, turf')
    .eq('id', bookingId)
    .single();

  if (bErr || !b) return { bill: null, error: bErr?.message ?? 'Booking not found.' };

  const { data: txData } = await supabase
    .from('pos_transactions')
    .select(`
      id, total, status,
      pos_transaction_items ( id, item_id, item_name, quantity, unit_price, line_total )
    `)
    .eq('booking_id', bookingId)
    .neq('status', 'undone');

  const phone = await resolvePhone(b.phone ?? '', b.customer_id ?? null);

  const sport        = b.sport ?? '';
  const slotLabel    = b.slot  ?? '';
  const durationMins = slotDurationMinutes(slotLabel);
  const sportConfig  = getSportConfig(sport);

  const slotTotal = (sportConfig && sportConfig.available && durationMins > 0)
    ? Math.round((durationMins / 60) * sportConfig.pricePerHour)
    : safeNum(b.amount, 0);

  const advanceAmount = safeNum(b.advance_amount, 0);
  const remainingSlot = Math.max(0, slotTotal - advanceAmount);

  const posItems: BillLineItem[] = [];
  let posTotal = 0;

  for (const tx of txData ?? []) {
    for (const item of (tx.pos_transaction_items ?? []) as any[]) {
      const qty       = safeNum(item.quantity, 0);
      const unitPrice = safeNum(item.unit_price, 0);
      const lineTotal = safeNum(item.line_total, qty * unitPrice);
      posItems.push({
        transactionItemId: item.id,              // ← pos_transaction_items.id
        transactionId:     tx.id,
        inventoryItemId:   item.item_id ?? '',   // ← inventory_items.id (KEY FIX)
        name:              item.item_name ?? '',
        quantity:          qty,
        unitPrice,
        lineTotal,
      });
      posTotal += lineTotal;
    }
  }

  return {
    bill: {
      bookingId,
      customerName: b.customer ?? '',
      phone,
      sport,
      slotLabel,
      bookingDate:   b.booking_date ?? '',
      turfName:      b.turf ?? 'Turf A',
      slotTotal,
      advanceAmount,
      remainingSlot,
      posItems,
      posTotal,
      grandTotal: remainingSlot + posTotal,
      isFinalized: b.paid === true,
    },
    error: null,
  };
}

// ── Edit POS item — with correct inventory sync ────────────────────────────

export async function editPOSLineItem(params: {
  transactionItemId:  string;   // pos_transaction_items.id
  transactionId:      string;
  inventoryItemId:    string;   // inventory_items.id  (for stock RPC)
  newQuantity:        number;
  unitPrice:          number;
  originalQuantity:   number;
}): Promise<{ error: string | null }> {
  const qty          = safeNum(params.newQuantity, 0);
  const price        = safeNum(params.unitPrice, 0);
  const newLineTotal = qty * price;

  // 1. Update the pos_transaction_items row
  const { error: itemErr } = await supabase
    .from('pos_transaction_items')
    .update({ quantity: qty, line_total: newLineTotal })
    .eq('id', params.transactionItemId);       // ← use transactionItemId, NOT inventoryItemId

  if (itemErr) return { error: itemErr.message };

  // 2. Recalculate transaction total (non-fatal — fetchBillData recomputes from items anyway)
  const { data: lines } = await supabase
    .from('pos_transaction_items')
    .select('line_total')
    .eq('transaction_id', params.transactionId);

  if (lines && lines.length > 0) {
    const newTotal = lines.reduce((s: number, l: any) => s + safeNum(l.line_total, 0), 0);
    await supabase.from('pos_transactions').update({ total: newTotal }).eq('id', params.transactionId);
  }

  // 3. Sync inventory stock using the CORRECT inventory_items.id
  const delta = params.originalQuantity - qty;
  if (delta !== 0 && params.inventoryItemId) {
    const fn = delta > 0 ? 'restore_item_stock' : 'reduce_item_stock';
    const { error: rpcErr } = await supabase.rpc(fn, {
      p_item_id:  params.inventoryItemId,
      p_quantity: Math.abs(delta),
    });
    if (rpcErr) console.warn('Stock sync warning:', rpcErr.message);
  }

  return { error: null };
}

// ── Remove POS item — with stock restore ──────────────────────────────────

export async function removePOSLineItem(params: {
  transactionItemId: string;
  transactionId:     string;
}): Promise<{ error: string | null }> {
  // Fetch item details BEFORE deleting (need item_id and quantity for stock restore)
  const { data: itemRow, error: fetchErr } = await supabase
    .from('pos_transaction_items')
    .select('item_id, quantity')
    .eq('id', params.transactionItemId)
    .single();

  if (fetchErr) return { error: fetchErr.message };

  // Delete the row
  const { error: delErr } = await supabase
    .from('pos_transaction_items')
    .delete()
    .eq('id', params.transactionItemId);

  if (delErr) return { error: delErr.message };

  // Recalculate transaction total
  const { data: lines } = await supabase
    .from('pos_transaction_items')
    .select('line_total')
    .eq('transaction_id', params.transactionId);

  const newTotal = (lines ?? []).reduce((s: number, l: any) => s + safeNum(l.line_total, 0), 0);
  await supabase.from('pos_transactions').update({ total: newTotal }).eq('id', params.transactionId);

  // Restore inventory stock
  if (itemRow?.item_id && safeNum(itemRow.quantity) > 0) {
    await supabase.rpc('restore_item_stock', {
      p_item_id:  itemRow.item_id,
      p_quantity: safeNum(itemRow.quantity),
    });
  }

  return { error: null };
}

// ── Finalize ───────────────────────────────────────────────────────────────

export async function finalizeBill(bookingId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('bookings').update({ paid: true, status: 'Completed' }).eq('id', bookingId);
  return { error: error?.message ?? null };
}