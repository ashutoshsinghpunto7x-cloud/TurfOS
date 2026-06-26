import { supabase } from '../lib/supabase';
import { DBInventoryItem, DBTransaction, POSItem, Transaction } from '../types';

// ── helpers ────────────────────────────────────────────────────────────────

function toAppItem(row: any): POSItem {
  return {
    id:       row.id,
    name:     row.name,
    emoji:    row.emoji ?? '📦',
    price:    Number(row.price),
    category: row.category,
    stock:    Number(row.stock),
  };
}

function toAppTransaction(row: any): Transaction {
  const date = new Date(row.created_at);
  return {
    id:        row.id,
    customer:  row.customer,
    total:     Number(row.total),
    time:      date.toTimeString().slice(0, 5),
    date:      date.toDateString() === new Date().toDateString()
      ? 'Today'
      : date.toLocaleDateString('en-IN'),
    undone:    row.status === 'undone',
    undoneNote: row.undo_reason ?? undefined,
    items: (row.pos_transaction_items ?? []).map((li: any) => ({
      name:  li.item_name,
      qty:   li.quantity,
      price: Number(li.unit_price),
    })),
  };
}

// ── Fetch sellable items ───────────────────────────────────────────────────

export async function fetchPOSItems(): Promise<{
  items: POSItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('is_sellable', true)
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) return { items: [], error: error.message };
  return { items: (data as DBInventoryItem[]).map(toAppItem), error: null };
}

// ── Fetch recent transactions ──────────────────────────────────────────────

export async function fetchRecentTransactions(limit = 20): Promise<{
  transactions: Transaction[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('pos_transactions')
    .select(`
      id, customer, total, status, undo_reason, created_by, created_at,
      booking_id,
      pos_transaction_items (
        id, transaction_id, item_id, item_name, quantity, unit_price, line_total
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { transactions: [], error: error.message };
  return {
    transactions: (data as DBTransaction[]).map(toAppTransaction),
    error: null,
  };
}

// ── Save sale ──────────────────────────────────────────────────────────────

export interface SaleLineItem {
  itemId:    string;
  itemName:  string;
  quantity:  number;
  unitPrice: number;
}

export async function saveSale(params: {
  customer:   string;
  lines:      SaleLineItem[];
  createdBy:  string | null;
  bookingId?: string | null;   // ← new: link sale to booking
}): Promise<{ transaction: Transaction | null; error: string | null }> {
  const total = params.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice, 0,
  );

  // 1. Insert pos_transactions row
  const { data: txData, error: txError } = await supabase
    .from('pos_transactions')
    .insert({
      customer:   params.customer,
      total,
      status:     'completed',
      created_by: params.createdBy,
      booking_id: params.bookingId ?? null,  // ← store linkage
    })
    .select('id, customer, total, status, undo_reason, created_by, created_at, booking_id')
    .single();

  if (txError || !txData) {
    return {
      transaction: null,
      error: txError?.message ?? 'Failed to save transaction.',
    };
  }

  // 2. Insert line items
  const lineRows = params.lines.map((l) => ({
    transaction_id: txData.id,
    item_id:        l.itemId,
    item_name:      l.itemName,
    quantity:       l.quantity,
    unit_price:     l.unitPrice,
    line_total:     l.quantity * l.unitPrice,
  }));

  const { error: lineError } = await supabase
    .from('pos_transaction_items')
    .insert(lineRows);

  if (lineError) {
    console.warn('pos_transaction_items insert failed:', lineError.message);
  }

  // 3. Re-fetch full row with items
  const { data: fullTx, error: fetchError } = await supabase
    .from('pos_transactions')
    .select(`
      id, customer, total, status, undo_reason, created_by, created_at, booking_id,
      pos_transaction_items (
        id, transaction_id, item_id, item_name, quantity, unit_price, line_total
      )
    `)
    .eq('id', txData.id)
    .single();

  if (fetchError || !fullTx) {
    const fallback: Transaction = {
      id:       txData.id,
      customer: txData.customer,
      total:    Number(txData.total),
      time:     new Date(txData.created_at).toTimeString().slice(0, 5),
      date:     'Today',
      undone:   false,
      items:    params.lines.map((l) => ({
        name: l.itemName, qty: l.quantity, price: l.unitPrice,
      })),
    };
    return { transaction: fallback, error: null };
  }

  return { transaction: toAppTransaction(fullTx as DBTransaction), error: null };
}

// ── Undo sale ──────────────────────────────────────────────────────────────

export async function undoSale(
  transactionId: string,
  reason = 'Undone by owner',
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pos_transactions')
    .update({ status: 'undone', undo_reason: reason })
    .eq('id', transactionId);

  return { error: error?.message ?? null };
}