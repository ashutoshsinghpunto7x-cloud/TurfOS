import { supabase } from '../lib/supabase';
import { DBInventoryItem, DBRestockRecord } from '../types';

function toAppItem(row: any): DBInventoryItem {
  return {
    id:          row.id,
    name:        row.name,
    emoji:       row.emoji ?? '📦',
    price:       Number(row.price ?? 0),
    category:    row.category ?? 'General',
    stock:       Number(row.stock ?? 0),
    min_stock:   Number(row.min_stock ?? 0),
    max_stock:   Number(row.max_stock ?? 100),
    unit:        row.unit ?? 'pcs',
    is_sellable: Boolean(row.is_sellable),
    is_active:   row.is_active !== false,
    // cost_price may be null if column recently added — default to 0
    cost_price:  Number(row.cost_price ?? 0),
    created_at:  row.created_at,
  };
}

function toRestockRecord(row: any): DBRestockRecord {
  return {
    id:             row.id,
    item_id:        row.item_id,
    item_name:      row.item_name,
    quantity_added: Number(row.quantity_added),
    stock_before:   Number(row.stock_before),
    stock_after:    Number(row.stock_after),
    note:           row.note ?? null,
    created_by:     row.created_by ?? null,
    created_at:     row.created_at,
  };
}

export async function fetchInventoryItems(): Promise<{
  items: DBInventoryItem[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) return { items: [], error: error.message };
  return { items: (data ?? []).map(toAppItem), error: null };
}

export async function fetchRestockHistory(itemId: string): Promise<{
  records: DBRestockRecord[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('restock_records')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { records: [], error: error.message };
  return { records: (data ?? []).map(toRestockRecord), error: null };
}

export interface AddItemParams {
  name: string; emoji: string; price: number; costPrice: number;
  category: string; unit: string; stock: number;
  minStock: number; maxStock: number; isSellable: boolean;
}

export async function addInventoryItem(params: AddItemParams): Promise<{
  item: DBInventoryItem | null; error: string | null;
}> {
  // Build insert payload — only include cost_price if column exists
  // The column is added by migration; using .upsert approach with try/catch
  const payload: any = {
    name:        params.name.trim(),
    emoji:       params.emoji.trim() || '📦',
    price:       params.price,
    category:    params.category.trim() || 'General',
    unit:        params.unit.trim() || 'pcs',
    stock:       params.stock,
    min_stock:   params.minStock,
    max_stock:   params.maxStock,
    is_sellable: params.isSellable,
    is_active:   true,
  };

  // Try to include cost_price — if schema cache doesn't have it, fall back without it
  try {
    payload.cost_price = params.costPrice;
    const { data, error } = await supabase
      .from('inventory_items').insert(payload).select().single();
    if (error) throw error;
    return { item: toAppItem(data), error: null };
  } catch (firstErr: any) {
    if (firstErr?.message?.includes('cost_price')) {
      // Retry without cost_price — schema cache stale
      delete payload.cost_price;
      const { data, error } = await supabase
        .from('inventory_items').insert(payload).select().single();
      if (error || !data) return { item: null, error: error?.message ?? 'Could not add item.' };
      return { item: toAppItem(data), error: null };
    }
    return { item: null, error: firstErr?.message ?? 'Could not add item.' };
  }
}

export interface EditItemParams extends AddItemParams { id: string; }

export async function editInventoryItem(params: EditItemParams): Promise<{
  item: DBInventoryItem | null; error: string | null;
}> {
  const payload: any = {
    name:        params.name.trim(),
    emoji:       params.emoji.trim() || '📦',
    price:       params.price,
    category:    params.category.trim() || 'General',
    unit:        params.unit.trim() || 'pcs',
    min_stock:   params.minStock,
    max_stock:   params.maxStock,
    is_sellable: params.isSellable,
  };

  try {
    payload.cost_price = params.costPrice;
    const { data, error } = await supabase
      .from('inventory_items').update(payload).eq('id', params.id).select().single();
    if (error) throw error;
    return { item: toAppItem(data), error: null };
  } catch (firstErr: any) {
    if (firstErr?.message?.includes('cost_price')) {
      delete payload.cost_price;
      const { data, error } = await supabase
        .from('inventory_items').update(payload).eq('id', params.id).select().single();
      if (error || !data) return { item: null, error: error?.message ?? 'Could not update item.' };
      return { item: toAppItem(data), error: null };
    }
    return { item: null, error: firstErr?.message ?? 'Could not update item.' };
  }
}

export async function softDeleteItem(itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('inventory_items').update({ is_active: false }).eq('id', itemId);
  return { error: error?.message ?? null };
}

export interface AdjustStockParams {
  item: DBInventoryItem; delta: number; note: string; createdBy: string | null;
}

export async function adjustStock(params: AdjustStockParams): Promise<{
  updatedItem: DBInventoryItem | null; error: string | null;
}> {
  const { item, delta, note, createdBy } = params;
  if (delta === 0) return { updatedItem: item, error: null };

  const newStock = item.stock + delta;
  if (newStock < 0) {
    return {
      updatedItem: null,
      error: `Cannot reduce below zero. Current stock is ${item.stock} ${item.unit}.`,
    };
  }

  const { data: updatedData, error: updateError } = await supabase
    .from('inventory_items').update({ stock: newStock }).eq('id', item.id).select().single();

  if (updateError || !updatedData) {
    return { updatedItem: null, error: updateError?.message ?? 'Could not update stock.' };
  }

  await supabase.from('restock_records').insert({
    item_id:        item.id,
    item_name:      item.name,
    quantity_added: delta,
    stock_before:   item.stock,
    stock_after:    newStock,
    note:           note.trim() || (delta > 0 ? 'Stock added' : 'Stock corrected'),
    created_by:     createdBy,
  });

  return { updatedItem: toAppItem(updatedData), error: null };
}

export async function restockItem(params: {
  item: DBInventoryItem; quantityToAdd: number; note: string; createdBy: string | null;
}): Promise<{ updatedItem: DBInventoryItem | null; error: string | null }> {
  return adjustStock({
    item:      params.item,
    delta:     params.quantityToAdd,
    note:      params.note,
    createdBy: params.createdBy,
  });
}