import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import {
  fetchInventoryItems, fetchRestockHistory,
  addInventoryItem, editInventoryItem, softDeleteItem, adjustStock,
} from '../services/inventoryService';
import { DBInventoryItem, DBRestockRecord } from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      '#FAFAFC',
  surface: '#FFFFFF',
  glass:   'rgba(255,255,255,0.72)',
  grad0:   '#7C4DFF',
  grad1:   '#8B5CF6',
  grad2:   '#60A5FA',
  text:    '#1A1A1A',
  text2:   '#7B7B8A',
  text3:   '#AEAEBB',
  white:   '#FFFFFF',
  border:  'rgba(0,0,0,0.06)',
  okTxt:   '#10B981',
  okBg:    'rgba(16,185,129,0.10)',
  redTxt:  '#EF4444',
  redBg:   'rgba(239,68,68,0.08)',
  warnTxt: '#D97706',
  warnBg:  'rgba(251,191,36,0.10)',
  warnBd:  'rgba(251,191,36,0.24)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

const STOCK_FILTERS = ['All', 'Low Stock', 'In Stock'] as const;
type StockFilter = typeof STOCK_FILTERS[number];

const blankForm = {
  name: '', emoji: '📦', price: '', costPrice: '',
  category: '', unit: 'pcs', stock: '0',
  minStock: '', maxStock: '', isSellable: true,
};

export default function InventoryScreen() {
  const { profile } = useStore();

  const [items, setItems]               = useState<DBInventoryItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [stockFilter, setStockFilter]   = useState<StockFilter>('All');

  const [restockModal, setRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DBInventoryItem | null>(null);
  const [adjustQty, setAdjustQty]       = useState('');
  const [adjustNote, setAdjustNote]     = useState('');
  const [adjustMode, setAdjustMode]     = useState<'add' | 'reduce'>('add');
  const [restockHistory, setRestockHistory] = useState<DBRestockRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingRestock, setSavingRestock]   = useState(false);

  const [itemModal, setItemModal]     = useState(false);
  const [editingItem, setEditingItem] = useState<DBInventoryItem | null>(null);
  const [form, setForm]               = useState(blankForm);
  const [savingItem, setSavingItem]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { items: fetched, error } = await fetchInventoryItems();
    if (error) Alert.alert('Load Error', error);
    else setItems(fetched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((i) => {
    if (stockFilter === 'Low Stock') return i.stock <= i.min_stock;
    if (stockFilter === 'In Stock')  return i.stock > i.min_stock;
    return true;
  });

  const lowCount = items.filter((i) => i.stock <= i.min_stock).length;

  const fillColor = (item: DBInventoryItem): string => {
    const pct = item.max_stock > 0 ? item.stock / item.max_stock : 0;
    if (pct <= 0.15 || item.stock <= item.min_stock) return T.redTxt;
    if (pct <= 0.40) return T.warnTxt;
    return T.okTxt;
  };

  const fillPct = (item: DBInventoryItem): number =>
    item.max_stock > 0 ? Math.min(Math.round((item.stock / item.max_stock) * 100), 100) : 0;

  const openRestock = async (item: DBInventoryItem) => {
    setSelectedItem(item);
    setAdjustQty('');
    setAdjustNote('');
    setAdjustMode('add');
    setRestockModal(true);
    setLoadingHistory(true);
    const { records } = await fetchRestockHistory(item.id);
    setRestockHistory(records);
    setLoadingHistory(false);
  };

  const handleAdjust = async () => {
    const qty = parseFloat(adjustQty);
    if (!qty || qty <= 0) { Alert.alert('Invalid Quantity', 'Enter a positive number.'); return; }
    if (!selectedItem) return;
    const delta = adjustMode === 'reduce' ? -qty : qty;
    if (adjustMode === 'reduce' && selectedItem.stock - qty < 0) {
      Alert.alert('Cannot Reduce', `Only ${selectedItem.stock} ${selectedItem.unit} in stock.`);
      return;
    }
    setSavingRestock(true);
    const { updatedItem, error } = await adjustStock({
      item: selectedItem, delta, note: adjustNote, createdBy: profile?.id ?? null,
    });
    setSavingRestock(false);
    if (error || !updatedItem) { Alert.alert('Error', error ?? 'Could not update stock.'); return; }
    setItems((prev) => prev.map((i) => i.id === updatedItem.id ? updatedItem : i));
    setRestockModal(false);
  };

  const openAddModal = () => { setEditingItem(null); setForm(blankForm); setItemModal(true); };

  const openEditModal = (item: DBInventoryItem) => {
    setEditingItem(item);
    setForm({
      name: item.name, emoji: item.emoji,
      price: String(item.price), costPrice: String(item.cost_price),
      category: item.category, unit: item.unit,
      stock: String(item.stock), minStock: String(item.min_stock),
      maxStock: String(item.max_stock), isSellable: item.is_sellable,
    });
    setItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!form.name.trim()) { Alert.alert('Missing Field', 'Item name is required.'); return; }
    const price    = parseFloat(form.price) || 0;
    const minStock = parseFloat(form.minStock) || 0;
    const maxStock = parseFloat(form.maxStock) || 100;
    setSavingItem(true);

    if (editingItem) {
      const { item, error } = await editInventoryItem({
        id: editingItem.id, name: form.name, emoji: form.emoji,
        price, costPrice: parseFloat(form.costPrice) || 0,
        category: form.category, unit: form.unit,
        stock: editingItem.stock, minStock, maxStock, isSellable: form.isSellable,
      });
      setSavingItem(false);
      if (error || !item) { Alert.alert('Error', error ?? 'Could not update item.'); return; }
      setItems((prev) => prev.map((i) => i.id === item.id ? item : i));
    } else {
      const { item, error } = await addInventoryItem({
        name: form.name, emoji: form.emoji, price,
        costPrice: parseFloat(form.costPrice) || 0,
        category: form.category, unit: form.unit,
        stock: parseFloat(form.stock) || 0, minStock, maxStock,
        isSellable: form.isSellable,
      });
      setSavingItem(false);
      if (error || !item) { Alert.alert('Error', error ?? 'Could not add item.'); return; }
      setItems((prev) => [...prev, item].sort((a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      ));
    }
    setItemModal(false);
  };

  const handleDelete = (item: DBInventoryItem) => {
    Alert.alert('Remove Item', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await softDeleteItem(item.id);
          if (error) { Alert.alert('Error', error); return; }
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Inventory</Text>
            <Text style={s.headerSub}>
              {items.length} items{lowCount > 0 ? `  ·  ⚠ ${lowCount} low stock` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={openAddModal} activeOpacity={0.85}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addBtn}>
              <Text style={s.addBtnTxt}>+ Item</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Low stock banner ── */}
        {lowCount > 0 && (
          <View style={s.alertBanner}>
            <Text style={s.alertTxt}>⚠️  {lowCount} item{lowCount > 1 ? 's' : ''} at or below minimum stock</Text>
          </View>
        )}

        {/* ── Filter pills ── */}
        <View style={s.pillWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pillScroll} bounces={false}>
            {STOCK_FILTERS.map((f) => (
              f === stockFilter ? (
                <TouchableOpacity key={f} onPress={() => setStockFilter(f)} activeOpacity={0.85}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pillActive}>
                    <Text style={s.pillActiveTxt}>{f}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={f} style={s.pill} onPress={() => setStockFilter(f)} activeOpacity={0.75}>
                  <Text style={s.pillTxt}>{f}</Text>
                </TouchableOpacity>
              )
            ))}
          </ScrollView>
        </View>

        {/* ── List ── */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.grad0} size="large" />
            <Text style={s.loadingTxt}>Loading inventory…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => `inv-${i.id}`}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>
                  {stockFilter !== 'All' ? `No items match "${stockFilter}".` : 'No inventory items yet.'}
                </Text>
                {stockFilter === 'All' && (
                  <TouchableOpacity onPress={openAddModal} activeOpacity={0.85} style={{ marginTop: 14 }}>
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyAddBtn}>
                      <Text style={s.addBtnTxt}>+ Add First Item</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const isLow  = item.stock <= item.min_stock;
              const pct    = fillPct(item);
              const color  = fillColor(item);
              const isOut  = item.stock === 0;
              return (
                <View style={[s.invCard, isLow && { borderColor: 'rgba(239,68,68,0.20)', backgroundColor: T.redBg }]}>
                  {/* Left icon */}
                  <View style={[s.invIcon, { backgroundColor: isLow ? 'rgba(239,68,68,0.08)' : 'rgba(124,77,255,0.08)' }]}>
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    {!item.is_sellable && <View style={s.noPosDot} />}
                  </View>

                  {/* Body */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={s.invTopRow}>
                      <Text style={s.invName} numberOfLines={1}>{item.name}</Text>
                      <Text style={[s.invStock, { color }]}>
                        {isOut ? 'Out' : `${item.stock} ${item.unit}`}
                      </Text>
                    </View>
                    <Text style={s.invMeta} numberOfLines={1}>
                      {item.category || 'Uncategorised'}{'  ·  Min: '}{item.min_stock} {item.unit}{'  ·  ₹'}{item.price}
                    </Text>
                    {/* Progress bar */}
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={{ fontSize: 9, color: T.text3, marginTop: 3 }}>{pct}% capacity</Text>
                  </View>

                  {/* Actions */}
                  <View style={s.actionCol}>
                    <TouchableOpacity style={s.restockBtn} onPress={() => openRestock(item)} activeOpacity={0.8}>
                      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.restockBtnGrad}>
                        <Text style={s.restockBtnTxt}>±</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEditModal(item)} activeOpacity={0.8}>
                      <Text style={s.editBtnTxt}>✎</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>

      {/* ── Adjust Stock Modal ── */}
      <Modal visible={restockModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            {selectedItem && (
              <>
                <View style={s.restockItemHdr}>
                  <View style={s.restockEmoji}><Text style={{ fontSize: 28 }}>{selectedItem.emoji}</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.modalTitle}>{selectedItem.name}</Text>
                    <Text style={s.modalSub}>Current: {selectedItem.stock} {selectedItem.unit}</Text>
                  </View>
                </View>

                {/* Mode toggle */}
                <View style={s.modeToggle}>
                  <TouchableOpacity
                    style={[s.modeBtn, adjustMode === 'add' && s.modeBtnActive]}
                    onPress={() => setAdjustMode('add')} activeOpacity={0.8}
                  >
                    {adjustMode === 'add' ? (
                      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    ) : null}
                    <Text style={[s.modeBtnTxt, adjustMode === 'add' && s.modeBtnTxtActive]}>+ Add Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modeBtn, adjustMode === 'reduce' && s.modeBtnReduce]}
                    onPress={() => setAdjustMode('reduce')} activeOpacity={0.8}
                  >
                    <Text style={[s.modeBtnTxt, adjustMode === 'reduce' && s.modeBtnTxtReduce]}>− Reduce / Correct</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.fieldLabel}>{adjustMode === 'add' ? 'Quantity to Add' : 'Quantity to Remove'} *</Text>
                <TextInput
                  style={[s.input, adjustMode === 'reduce' && s.inputReduce]}
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  keyboardType="decimal-pad"
                  placeholder={`e.g. 5 ${selectedItem.unit}`}
                  placeholderTextColor={T.text3}
                />

                {parseFloat(adjustQty) > 0 && (
                  <View style={[s.previewRow, adjustMode === 'reduce' && s.previewRowReduce]}>
                    <Text style={[s.previewLbl, adjustMode === 'reduce' && { color: T.redTxt }]}>New stock</Text>
                    <Text style={[s.previewVal, adjustMode === 'reduce' && { color: T.redTxt }]}>
                      {Math.max(0, adjustMode === 'add'
                        ? selectedItem.stock + parseFloat(adjustQty)
                        : selectedItem.stock - parseFloat(adjustQty)
                      ).toFixed(adjustQty.includes('.') ? 2 : 0)}{' '}{selectedItem.unit}
                    </Text>
                  </View>
                )}

                <Text style={s.fieldLabel}>{adjustMode === 'add' ? 'Note (optional)' : 'Reason *'}</Text>
                <TextInput
                  style={s.input}
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                  placeholder={adjustMode === 'add' ? 'e.g. Supplier delivery' : 'e.g. Entry mistake'}
                  placeholderTextColor={T.text3}
                />

                {loadingHistory ? (
                  <ActivityIndicator color={T.grad0} style={{ marginBottom: 16 }} />
                ) : restockHistory.length > 0 ? (
                  <View style={s.historyWrap}>
                    <Text style={s.historyTitle}>Recent Adjustments</Text>
                    {restockHistory.slice(0, 4).map((r) => {
                      const isRed = r.quantity_added < 0;
                      return (
                        <View key={r.id} style={s.historyRow}>
                          <Text style={[s.historyMain, isRed && { color: T.redTxt }]}>
                            {isRed ? '' : '+'}{r.quantity_added} {selectedItem.unit}
                          </Text>
                          <Text style={s.historySub}>
                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {r.note ? `  ·  ${r.note}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleAdjust}
                  disabled={savingRestock}
                  style={{ opacity: savingRestock ? 0.7 : 1 }}
                  activeOpacity={0.88}
                >
                  {adjustMode === 'add' ? (
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtn}>
                      {savingRestock ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>Confirm Add</Text>}
                    </LinearGradient>
                  ) : (
                    <View style={[s.confirmBtn, { backgroundColor: T.redTxt }]}>
                      {savingRestock ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>Confirm Correction</Text>}
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setRestockModal(false)} disabled={savingRestock}>
                  <Text style={s.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Item Modal ── */}
      <Modal visible={itemModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView
            contentContainerStyle={s.modalSheetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{editingItem ? 'Edit Item' : 'New Item'}</Text>

            <View style={s.nameEmojiRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.fieldLabel}>Name *</Text>
                <TextInput style={s.input} value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Tea Powder" placeholderTextColor={T.text3} />
              </View>
              <View style={{ width: 72 }}>
                <Text style={s.fieldLabel}>Icon</Text>
                <TextInput style={[s.input, { textAlign: 'center', fontSize: 22 }]}
                  value={form.emoji}
                  onChangeText={(v) => setForm((f) => ({ ...f, emoji: v }))}
                  placeholder="📦" placeholderTextColor={T.text3} />
              </View>
            </View>

            <View style={s.twoCol}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.fieldLabel}>Category</Text>
                <TextInput style={s.input} value={form.category}
                  onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
                  placeholder="Beverages" placeholderTextColor={T.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Unit</Text>
                <TextInput style={s.input} value={form.unit}
                  onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))}
                  placeholder="pcs / kg / L" placeholderTextColor={T.text3} />
              </View>
            </View>

            <View style={s.twoCol}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.fieldLabel}>Sell Price (₹)</Text>
                <TextInput style={s.input} value={form.price}
                  onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Cost Price (₹)</Text>
                <TextInput style={s.input} value={form.costPrice}
                  onChangeText={(v) => setForm((f) => ({ ...f, costPrice: v }))}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.text3} />
              </View>
            </View>

            <View style={s.twoCol}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.fieldLabel}>Min Stock</Text>
                <TextInput style={s.input} value={form.minStock}
                  onChangeText={(v) => setForm((f) => ({ ...f, minStock: v }))}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Max Stock</Text>
                <TextInput style={s.input} value={form.maxStock}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxStock: v }))}
                  keyboardType="decimal-pad" placeholder="100" placeholderTextColor={T.text3} />
              </View>
            </View>

            {!editingItem && (
              <>
                <Text style={s.fieldLabel}>Opening Stock</Text>
                <TextInput style={s.input} value={form.stock}
                  onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.text3} />
              </>
            )}

            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>Show on POS</Text>
                <Text style={s.toggleSub}>Visible to staff on Point of Sale</Text>
              </View>
              <Switch value={form.isSellable}
                onValueChange={(v) => setForm((f) => ({ ...f, isSellable: v }))}
                trackColor={{ true: T.grad0 }} thumbColor={T.white} />
            </View>

            {editingItem && (
              <TouchableOpacity style={s.deleteRow}
                onPress={() => { setItemModal(false); setTimeout(() => handleDelete(editingItem), 300); }}>
                <Text style={s.deleteTxt}>Remove this item…</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSaveItem}
              disabled={savingItem}
              style={{ opacity: savingItem ? 0.7 : 1 }}
              activeOpacity={0.88}
            >
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtn}>
                {savingItem ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>{editingItem ? 'Save Changes' : 'Add Item'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setItemModal(false)} disabled={savingItem}>
              <Text style={s.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bg },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSub:    { fontSize: 11, color: T.text2, marginTop: 2 },
  addBtn:       { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnTxt:    { color: T.white, fontWeight: '800', fontSize: 13 },

  alertBanner:  { marginHorizontal: 14, marginTop: 12, backgroundColor: T.warnBg, borderWidth: 1, borderColor: T.warnBd, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  alertTxt:     { color: T.warnTxt, fontSize: 13, fontWeight: '600' },

  pillWrap:     { backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  pillScroll:   { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  pill:         { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  pillActive:   { height: 34, paddingHorizontal: 16, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pillTxt:      { fontSize: 13, fontWeight: '600', color: T.text2 },
  pillActiveTxt:{ fontSize: 13, fontWeight: '700', color: T.white },

  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:   { fontSize: 13, color: T.text2 },

  listContent:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40, gap: 10 },

  emptyCard:    { margin: 24, backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 40, alignItems: 'center', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  emptyText:    { fontSize: 14, color: T.text2, textAlign: 'center' },
  emptyAddBtn:  { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },

  invCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  invIcon:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  noPosDot:     { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: T.text3 },
  invTopRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  invName:      { fontSize: 14, fontWeight: '700', color: T.text, flex: 1, marginRight: 8 },
  invStock:     { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  invMeta:      { fontSize: 11, color: T.text3, marginBottom: 6 },
  barTrack:     { height: 5, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
  actionCol:    { flexDirection: 'column', gap: 6, marginLeft: 10 },
  restockBtn:   { },
  restockBtnGrad:{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  restockBtnTxt: { fontSize: 18, fontWeight: '800', color: T.white },
  editBtn:      { width: 36, height: 36, backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  editBtnTxt:   { fontSize: 15, color: T.text2 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  modalSheetScroll: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52 },
  modalHandle:  { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 2 },
  modalSub:     { fontSize: 13, color: T.text2, marginBottom: 16 },

  restockItemHdr: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  restockEmoji:   { width: 52, height: 52, backgroundColor: 'rgba(124,77,255,0.08)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  modeToggle:   { flexDirection: 'row', gap: 10, marginBottom: 18 },
  modeBtn:      { flex: 1, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, alignItems: 'center', overflow: 'hidden' },
  modeBtnActive:{ borderColor: T.grad0, backgroundColor: 'transparent' },
  modeBtnReduce:{ borderColor: T.redTxt, backgroundColor: T.redBg },
  modeBtnTxt:   { fontSize: 13, fontWeight: '700', color: T.text2 },
  modeBtnTxtActive: { color: T.white },
  modeBtnTxtReduce: { color: T.redTxt },

  fieldLabel:   { fontSize: 11, fontWeight: '800', color: T.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input:        { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text, marginBottom: 14 },
  inputReduce:  { borderColor: 'rgba(239,68,68,0.30)', backgroundColor: T.redBg },

  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.okBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  previewRowReduce: { backgroundColor: T.redBg },
  previewLbl:   { fontSize: 13, fontWeight: '600', color: T.okTxt },
  previewVal:   { fontSize: 18, fontWeight: '800', color: T.okTxt, fontVariant: ['tabular-nums'] },

  historyWrap:  { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12, marginBottom: 16 },
  historyTitle: { fontSize: 11, fontWeight: '800', color: T.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  historyRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  historyMain:  { fontSize: 13, fontWeight: '700', color: T.grad0 },
  historySub:   { fontSize: 12, color: T.text3 },

  confirmBtn:   { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmBtnTxt:{ color: T.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:    { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnTxt: { fontSize: 14, color: T.text2, fontWeight: '600' },

  nameEmojiRow: { flexDirection: 'row', alignItems: 'flex-end' },
  twoCol:       { flexDirection: 'row' },
  toggleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bg, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 14 },
  toggleLabel:  { fontSize: 14, fontWeight: '600', color: T.text },
  toggleSub:    { fontSize: 11, color: T.text3, marginTop: 2 },
  deleteRow:    { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  deleteTxt:    { fontSize: 13, color: T.redTxt, fontWeight: '600' },
});
