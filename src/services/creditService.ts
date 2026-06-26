import { supabase } from '../lib/supabase';
import { DBCreditEntry, CreditCustomerSummary, CreditEntryType } from '../types';

// ── helpers ────────────────────────────────────────────────────────────────

function toAppEntry(row: any): DBCreditEntry {
  return {
    id:         row.id,
    customer:   row.customer,
    item:       row.item,
    item_id:    row.item_id ?? null,
    quantity:   Number(row.quantity ?? 1),
    unit_price: Number(row.unit_price ?? row.amount ?? 0),
    total:      Number(row.total ?? row.amount ?? 0),
    amount:     Number(row.amount ?? row.total ?? 0),
    entry_type: row.entry_type as CreditEntryType,
    note:       row.note ?? '',
    entry_date: row.entry_date,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
  };
}

function toCustomerSummary(row: any): CreditCustomerSummary {
  return {
    customer:      row.customer,
    total_credit:  Number(row.total_credit ?? 0),
    total_paid:    Number(row.total_paid ?? 0),
    outstanding:   Number(row.outstanding ?? 0),
    entry_count:   Number(row.entry_count ?? 0),
    last_activity: row.last_activity ?? '',
  };
}

// ── fetch APIs ─────────────────────────────────────────────────────────────

export async function fetchCreditEntries() {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { entries: [], error: error.message };
  return { entries: (data ?? []).map(toAppEntry), error: null };
}

export async function fetchEntriesForCustomer(customer: string) {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('customer', customer)
    .order('created_at', { ascending: false });

  if (error) return { entries: [], error: error.message };
  return { entries: (data ?? []).map(toAppEntry), error: null };
}

export async function fetchCustomerCreditSummaries() {
  const { data, error } = await supabase
    .from('customer_credit_summary')
    .select('*')
    .gt('outstanding', 0)
    .order('outstanding', { ascending: false });

  if (error) {
    console.warn('summary view missing:', error.message);
    return { summaries: [], error: error.message };
  }

  return { summaries: (data ?? []).map(toCustomerSummary), error: null };
}

export async function fetchCreditCustomerNames() {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('customer')
    .order('customer');

  if (error) return { names: [], error: error.message };

  const unique = Array.from(
    new Set((data ?? []).map((r: any) => r.customer))
  );

  return { names: unique, error: null };
}

export async function fetchSelectableItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, emoji, price')
    .eq('is_sellable', true)
    .order('name');

  if (error) return { items: [], error: error.message };

  return {
    items: (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      price: Number(r.price),
    })),
    error: null,
  };
}

// ── ADD CREDIT ENTRY (FIXED) ─────────────────────────────────────────────

export interface AddCreditEntryParams {
  customer: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  entryType: CreditEntryType;
  note: string;
  createdBy: string | null;
}

export async function addCreditEntry(params: AddCreditEntryParams) {
  const total = params.quantity * params.unitPrice;

  // 🔥 SAFETY CHECKS (IMPORTANT)
  if (!params.customer) {
    return { entry: null, error: 'Customer is required' };
  }

  const { data, error } = await supabase
    .from('credit_ledger')
    .insert({
      customer: params.customer,
      item: params.itemName,

      // ✅ FIX: NEVER send "" to UUID fields
      item_id: params.itemId || null,

      quantity: params.quantity,
      unit_price: params.unitPrice,
      amount: total,

      entry_type: params.entryType,
      note:
        params.note ||
        (params.entryType === 'credit'
          ? 'Credit added'
          : 'Payment received'),

      entry_date: new Date().toISOString().slice(0, 10),

      // ✅ FIX: NEVER send "" to UUID fields
      created_by: params.createdBy || null,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      entry: null,
      error: error?.message ?? 'Could not save entry.',
    };
  }

  return { entry: toAppEntry(data), error: null };
}