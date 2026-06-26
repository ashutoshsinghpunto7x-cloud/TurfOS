import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useStore } from '../store/useStore';
import {
  fetchCreditEntries,
  fetchCustomerCreditSummaries,
  fetchCreditCustomerNames,
  fetchSelectableItems,
  addCreditEntry,
} from '../services/creditService';
import {
  DBCreditEntry,
  CreditCustomerSummary,
  CreditEntryType,
} from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: '#FAFAFC', surface: '#FFFFFF',
  grad0: '#7C4DFF', grad1: '#8B5CF6', grad2: '#60A5FA',
  text: '#1A1A1A', text2: '#7B7B8A', text3: '#AEAEBB',
  border: 'rgba(0,0,0,0.06)', borderStrong: 'rgba(0,0,0,0.12)',
  purple: '#7C4DFF', purpleBg: 'rgba(124,77,255,0.09)', purpleBd: 'rgba(124,77,255,0.20)',
  green: '#10B981', greenBg: 'rgba(16,185,129,0.10)', greenBd: 'rgba(16,185,129,0.25)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.08)', redBd: 'rgba(239,68,68,0.20)',
  white: '#FFFFFF',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Select sheet ───────────────────────────────────────────────────────────────
interface SelectSheetProps<T> {
  visible: boolean;
  title: string;
  items: T[];
  keyExtractor: (item: T) => string;
  labelExtractor: (item: T) => string;
  subLabelExtractor?: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
}

function SelectSheet<T>({
  visible, title, items, keyExtractor, labelExtractor,
  subLabelExtractor, onSelect, onClose,
}: SelectSheetProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ss.overlay}>
        <View style={ss.sheet}>
          <View style={ss.handle} />
          <Text style={ss.title}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={ss.row} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
                <Text style={ss.rowLabel}>{labelExtractor(item)}</Text>
                {subLabelExtractor && <Text style={ss.rowSub}>{subLabelExtractor(item)}</Text>}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: T.border }} />}
          />
          <TouchableOpacity style={ss.cancelBtn} onPress={onClose}>
            <Text style={ss.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: T.border },
  handle:    { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:     { fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 12 },
  row:       { paddingVertical: 14, paddingHorizontal: 4 },
  rowLabel:  { fontSize: 15, fontWeight: '600', color: T.text },
  rowSub:    { fontSize: 12, color: T.text3, marginTop: 2 },
  cancelBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  cancelText:{ fontSize: 14, fontWeight: '600', color: T.text2 },
});

// ─── Main screen ────────────────────────────────────────────────────────────────
type ViewMode = 'ledger' | 'customers';

export default function CreditScreen() {
  const { profile } = useStore();

  const [entries, setEntries]             = useState<DBCreditEntry[]>([]);
  const [summaries, setSummaries]         = useState<CreditCustomerSummary[]>([]);
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [selectableItems, setSelectableItems] = useState<{ id: string; name: string; emoji: string; price: number }[]>([]);
  const [loading, setLoading]             = useState(true);
  const [viewMode, setViewMode]           = useState<ViewMode>('ledger');

  const [addModal, setAddModal]           = useState(false);
  const [entryType, setEntryType]         = useState<CreditEntryType>('credit');
  const [selCustomer, setSelCustomer]     = useState('');
  const [selItem, setSelItem]             = useState<{ id: string; name: string; emoji: string; price: number } | null>(null);
  const [quantity, setQuantity]           = useState('1');
  const [unitPrice, setUnitPrice]         = useState('');
  const [note, setNote]                   = useState('');
  const [saving, setSaving]               = useState(false);

  const [showCustomerSheet, setShowCustomerSheet] = useState(false);
  const [showItemSheet, setShowItemSheet]         = useState(false);

  const [paySheet, setPaySheet]           = useState(false);
  const [payCustomer, setPayCustomer]     = useState<CreditCustomerSummary | null>(null);
  const [payType, setPayType]             = useState<'paid_full' | 'paid_partial' | 'more_credit'>('paid_full');
  const [payAmount, setPayAmount]         = useState('');
  const [payNote, setPayNote]             = useState('');
  const [payingSave, setPayingSave]       = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [entriesRes, summariesRes, namesRes, itemsRes] = await Promise.all([
      fetchCreditEntries(),
      fetchCustomerCreditSummaries(),
      fetchCreditCustomerNames(),
      fetchSelectableItems(),
    ]);
    setEntries(entriesRes.entries);
    setSummaries(summariesRes.summaries);
    setCustomerNames(namesRes.names);
    setSelectableItems(itemsRes.items);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const totalCredit    = entries.filter((e) => e.entry_type === 'credit').reduce((s, e) => s + e.total, 0);
  const totalCollected = entries.filter((e) => e.entry_type === 'debit').reduce((s, e) => s + e.total, 0);
  const outstanding    = Math.max(0, totalCredit - totalCollected);

  const openAddModal = () => {
    setEntryType('credit'); setSelCustomer(''); setSelItem(null);
    setQuantity('1'); setUnitPrice(''); setNote(''); setAddModal(true);
  };

  const handleItemSelect = (item: typeof selectableItems[0]) => {
    setSelItem(item); setUnitPrice(String(item.price));
  };

  const handleOpenPaySheet = (summary: CreditCustomerSummary) => {
    setPayCustomer(summary); setPayType('paid_full');
    setPayAmount(String(Math.round(summary.outstanding))); setPayNote(''); setPaySheet(true);
  };

  const handleSavePayment = async () => {
    if (!payCustomer) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    const et: 'credit' | 'debit' = payType === 'more_credit' ? 'credit' : 'debit';
    let n = payNote.trim();
    if (!n) n = payType === 'paid_full' ? 'Full payment received' : payType === 'paid_partial' ? 'Partial payment received' : 'Additional credit added';
    setPayingSave(true);
    const { entry, error } = await addCreditEntry({
      customer: payCustomer.customer, itemId: '',
      itemName: payType === 'more_credit' ? 'Credit adjustment' : 'Payment received',
      quantity: 1, unitPrice: amt, entryType: et, note: n, createdBy: profile?.id ?? null,
    });
    setPayingSave(false);
    if (error || !entry) { Alert.alert('Error', error ?? 'Could not save.'); return; }
    setPaySheet(false); setPayCustomer(null);
    await loadAll();
  };

  const handleSave = async () => {
    if (!selCustomer.trim()) { Alert.alert('Missing Field', 'Please select a customer.'); return; }
    if (!selItem) { Alert.alert('Missing Field', 'Please select an item.'); return; }
    const qty = parseFloat(quantity); const price = parseFloat(unitPrice);
    if (!qty || qty <= 0) { Alert.alert('Invalid Quantity', 'Enter a valid quantity.'); return; }
    if (!price || price <= 0) { Alert.alert('Invalid Price', 'Enter a valid unit price.'); return; }
    setSaving(true);
    const { entry, error } = await addCreditEntry({
      customer: selCustomer.trim(), itemId: selItem.id, itemName: selItem.name,
      quantity: qty, unitPrice: price, entryType, note: note.trim(), createdBy: profile?.id ?? null,
    });
    setSaving(false);
    if (error || !entry) { Alert.alert('Error', error ?? 'Could not save entry.'); return; }
    setEntries((prev) => [entry, ...prev]);
    setAddModal(false);
    fetchCustomerCreditSummaries().then((r) => { if (!r.error) setSummaries(r.summaries); });
  };

  const computedTotal = parseFloat(quantity || '0') * parseFloat(unitPrice || '0');

  if (loading) return (
    <SafeAreaView style={c.safe}>
      <View style={c.hdr}>
        <Text style={c.hdrTitle}>Credit Ledger</Text>
      </View>
      <View style={c.center}>
        <ActivityIndicator color={T.purple} size="large" />
        <Text style={c.loadTxt}>Loading ledger…</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={c.safe}>
      {/* Header */}
      <View style={c.hdr}>
        <Text style={c.hdrTitle}>Credit Ledger</Text>
        <TouchableOpacity onPress={openAddModal} activeOpacity={0.85}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={c.addBtn}>
            <Text style={c.addBtnTxt}>+ Entry</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={c.summaryRow}>
        <View style={[c.summaryCard, { borderColor: T.redBd, backgroundColor: T.redBg }]}>
          <Text style={c.summaryLabel}>Outstanding</Text>
          <Text style={[c.summaryVal, { color: T.red }]}>₹{outstanding.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[c.summaryCard, { borderColor: T.greenBd, backgroundColor: T.greenBg }]}>
          <Text style={c.summaryLabel}>Collected</Text>
          <Text style={[c.summaryVal, { color: T.green }]}>₹{totalCollected.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Toggle */}
      <View style={c.toggleWrap}>
        {(['ledger', 'customers'] as ViewMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[c.toggleBtn, viewMode === m && c.toggleBtnActive]}
            onPress={() => setViewMode(m)}
            activeOpacity={0.8}
          >
            {viewMode === m
              ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={c.toggleGrad}>
                  <Text style={c.toggleTxtActive}>{m === 'ledger' ? 'All Entries' : 'By Customer'}</Text>
                </LinearGradient>
              : <Text style={c.toggleTxt}>{m === 'ledger' ? 'All Entries' : 'By Customer'}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Ledger view ── */}
      {viewMode === 'ledger' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={c.listContent}>
          {entries.length === 0 ? (
            <View style={c.emptyCard}>
              <Text style={c.emptyTxt}>No credit entries yet.{'\n'}Tap + Entry to add one.</Text>
            </View>
          ) : entries.map((entry, i) => {
            const isCredit = entry.entry_type === 'credit';
            const openPayForEntry = () => {
              const match = summaries.find((s) => s.customer === entry.customer);
              if (match) { handleOpenPaySheet(match); return; }
              const ce = entries.filter((e) => e.customer === entry.customer);
              handleOpenPaySheet({
                customer: entry.customer,
                total_credit: ce.filter((e) => e.entry_type === 'credit').reduce((s, e) => s + e.total, 0),
                total_paid:   ce.filter((e) => e.entry_type === 'debit').reduce((s, e) => s + e.total, 0),
                outstanding:  Math.max(0, ce.filter((e) => e.entry_type === 'credit').reduce((s, e) => s + e.total, 0) - ce.filter((e) => e.entry_type === 'debit').reduce((s, e) => s + e.total, 0)),
                entry_count:  ce.length,
                last_activity: '',
              });
            };
            return (
              <TouchableOpacity key={entry.id} style={[c.entryCard, i === 0 && { marginTop: 4 }]} onPress={openPayForEntry} activeOpacity={0.75}>
                <View style={[c.entryIcon, { backgroundColor: isCredit ? T.redBg : T.greenBg, borderColor: isCredit ? T.redBd : T.greenBd }]}>
                  <Text style={[c.entryIconTxt, { color: isCredit ? T.red : T.green }]}>{isCredit ? '↑' : '↓'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={c.entryCustomer}>{entry.customer}</Text>
                  <Text style={c.entrySub}>{entry.item}{entry.quantity !== 1 ? ` ×${entry.quantity}` : ''}{'  ·  '}{entry.entry_date}</Text>
                  {entry.note ? <Text style={c.entryNote}>{entry.note}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[c.entryAmt, { color: isCredit ? T.red : T.green }]}>{isCredit ? '−' : '+'}₹{entry.total}</Text>
                  <Text style={c.entryRate}>@₹{entry.unit_price}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Customer summary view ── */}
      {viewMode === 'customers' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={c.listContent}>
          {summaries.length === 0 ? (
            <View style={c.emptyCard}>
              <Text style={c.emptyTxt}>No outstanding credit at the moment.</Text>
            </View>
          ) : summaries.map((s) => (
            <TouchableOpacity key={s.customer} style={c.custCard} onPress={() => handleOpenPaySheet(s)} activeOpacity={0.75}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={c.custAvatar}>
                <Text style={c.custAvatarTxt}>{s.customer.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={c.custName}>{s.customer}</Text>
                <Text style={c.custSub}>{s.entry_count} entr{s.entry_count === 1 ? 'y' : 'ies'}  ·  Collected ₹{s.total_paid.toLocaleString('en-IN')}</Text>
                <Text style={c.custTapHint}>Tap to update payment →</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={c.custOutstanding}>₹{s.outstanding.toLocaleString('en-IN')}</Text>
                <Text style={c.custOutstandingLbl}>outstanding</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Add Entry Modal ── */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={m.overlay}>
          <ScrollView contentContainerStyle={m.sheet} keyboardShouldPersistTaps="handled">
            <View style={m.handle} />
            <Text style={m.title}>New Credit Entry</Text>

            <Text style={m.lbl}>Type</Text>
            <View style={m.typeRow}>
              {(['credit', 'debit'] as CreditEntryType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[m.typeBtn, entryType === t && m.typeBtnActive]}
                  onPress={() => setEntryType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.typeTxt, entryType === t && m.typeTxtActive]}>
                    {t === 'credit' ? '↑ Add Credit' : '↓ Record Payment'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.lbl}>Customer</Text>
            <TouchableOpacity style={m.selectField} onPress={() => customerNames.length > 0 && setShowCustomerSheet(true)}>
              <Text style={[m.selectTxt, !selCustomer && { color: T.text3 }]}>{selCustomer || 'Select customer…'}</Text>
              <Text style={m.chevron}>›</Text>
            </TouchableOpacity>
            <TextInput style={[m.input, { marginTop: 6 }]} value={selCustomer} onChangeText={setSelCustomer}
              placeholder="Or type customer name" placeholderTextColor={T.text3} />

            <Text style={m.lbl}>Item *</Text>
            <TouchableOpacity style={m.selectField} onPress={() => setShowItemSheet(true)}>
              <Text style={[m.selectTxt, !selItem && { color: T.text3 }]}>
                {selItem ? `${selItem.emoji}  ${selItem.name}` : 'Select item from inventory…'}
              </Text>
              <Text style={m.chevron}>›</Text>
            </TouchableOpacity>

            <Text style={m.lbl}>Quantity</Text>
            <TextInput style={m.input} value={quantity} onChangeText={setQuantity}
              keyboardType="decimal-pad" placeholder="1" placeholderTextColor={T.text3} />

            <Text style={m.lbl}>Unit Price (₹)</Text>
            <TextInput style={m.input} value={unitPrice} onChangeText={setUnitPrice}
              keyboardType="decimal-pad" placeholder="Auto-filled from item" placeholderTextColor={T.text3} />

            {computedTotal > 0 && (
              <View style={m.totalPreview}>
                <Text style={m.totalLbl}>Total</Text>
                <Text style={m.totalVal}>₹{computedTotal.toFixed(2)}</Text>
              </View>
            )}

            <Text style={m.lbl}>Note (optional)</Text>
            <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]} value={note}
              onChangeText={setNote} placeholder="e.g. Match booking, advance, etc."
              placeholderTextColor={T.text3} multiline />

            <TouchableOpacity style={[m.saveWrap, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.saveBtn}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.saveTxt}>Save Entry</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => setAddModal(false)} disabled={saving}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Payment update sheet ── */}
      <Modal visible={paySheet} transparent animationType="slide">
        <View style={m.overlay}>
          <ScrollView contentContainerStyle={m.sheet} keyboardShouldPersistTaps="handled">
            <View style={m.handle} />
            <Text style={m.title}>Update Payment</Text>
            {payCustomer && (
              <Text style={m.paySub}>{payCustomer.customer}  ·  Outstanding ₹{payCustomer.outstanding.toLocaleString('en-IN')}</Text>
            )}

            <Text style={m.lbl}>Action</Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {([
                { key: 'paid_full',    label: '✓ Paid Full',       sub: 'Mark full outstanding as received' },
                { key: 'paid_partial', label: '◑ Paid Partial',    sub: 'Record a partial payment' },
                { key: 'more_credit',  label: '↑ Add More Credit', sub: 'Customer took more on credit' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[m.payOpt, payType === opt.key && m.payOptActive]}
                  onPress={() => {
                    setPayType(opt.key);
                    if (opt.key === 'paid_full' && payCustomer) setPayAmount(String(Math.round(payCustomer.outstanding)));
                    else if (opt.key !== 'paid_full') setPayAmount('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[m.payOptLbl, payType === opt.key && { color: T.purple }]}>{opt.label}</Text>
                  <Text style={[m.payOptSub, payType === opt.key && { color: T.purple }]}>{opt.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.lbl}>Amount (₹)</Text>
            <TextInput style={m.input} value={payAmount} onChangeText={setPayAmount}
              keyboardType="decimal-pad" placeholder="Enter amount" placeholderTextColor={T.text3}
              editable={payType !== 'paid_full'} />

            <Text style={m.lbl}>Note (optional)</Text>
            <TextInput style={m.input} value={payNote} onChangeText={setPayNote}
              placeholder="e.g. Cash, UPI, etc." placeholderTextColor={T.text3} />

            <TouchableOpacity style={[m.saveWrap, payingSave && { opacity: 0.7 }]} onPress={handleSavePayment} disabled={payingSave} activeOpacity={0.85}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.saveBtn}>
                {payingSave ? <ActivityIndicator color="#fff" /> : <Text style={m.saveTxt}>Save Update</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => setPaySheet(false)} disabled={payingSave}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <SelectSheet visible={showCustomerSheet} title="Select Customer"
        items={customerNames} keyExtractor={(n) => n} labelExtractor={(n) => n}
        onSelect={(n) => setSelCustomer(n)} onClose={() => setShowCustomerSheet(false)} />

      <SelectSheet visible={showItemSheet} title="Select Item"
        items={selectableItems} keyExtractor={(i) => i.id}
        labelExtractor={(i) => `${i.emoji}  ${i.name}`}
        subLabelExtractor={(i) => `₹${i.price} per unit`}
        onSelect={handleItemSelect} onClose={() => setShowItemSheet(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: T.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt: { fontSize: 13, color: T.text3 },

  hdr:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  hdrTitle: { fontSize: 20, fontWeight: '800', color: T.text },
  addBtn:   { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnTxt:{ color: T.white, fontWeight: '700', fontSize: 13 },

  summaryRow:  { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  summaryCard: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 14 },
  summaryLabel:{ fontSize: 11, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryVal:  { fontSize: 24, fontWeight: '900', marginTop: 4 },

  toggleWrap:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: T.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: T.border },
  toggleBtn:      { flex: 1, borderRadius: 11, overflow: 'hidden' },
  toggleBtnActive:{ },
  toggleGrad:     { paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  toggleTxtActive:{ fontSize: 13, fontWeight: '700', color: T.white },
  toggleTxt:      { fontSize: 13, fontWeight: '600', color: T.text3, paddingVertical: 10, textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },

  emptyCard: { backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 36, alignItems: 'center', marginTop: 8 },
  emptyTxt:  { fontSize: 13, color: T.text3, textAlign: 'center', lineHeight: 20 },

  // Ledger entries
  entryCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: T.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.border },
  entryIcon:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  entryIconTxt:  { fontSize: 17, fontWeight: '800' },
  entryCustomer: { fontSize: 14, fontWeight: '700', color: T.text },
  entrySub:      { fontSize: 11, color: T.text3, marginTop: 2 },
  entryNote:     { fontSize: 11, color: T.text3, marginTop: 2, fontStyle: 'italic' },
  entryAmt:      { fontSize: 16, fontWeight: '800' },
  entryRate:     { fontSize: 11, color: T.text3, marginTop: 2 },

  // Customer summary
  custCard:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.border },
  custAvatar:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  custAvatarTxt:      { fontSize: 15, fontWeight: '800', color: T.white },
  custName:           { fontSize: 15, fontWeight: '700', color: T.text },
  custSub:            { fontSize: 11, color: T.text3, marginTop: 2 },
  custTapHint:        { fontSize: 11, fontWeight: '600', color: T.purple, marginTop: 3 },
  custOutstanding:    { fontSize: 17, fontWeight: '900', color: T.red },
  custOutstandingLbl: { fontSize: 10, color: T.text3, marginTop: 1 },
});

const m = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle:      { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:       { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 6 },
  paySub:      { fontSize: 13, color: T.text2, marginBottom: 16 },
  lbl:         { fontSize: 10, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },

  typeRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn:     { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.border, alignItems: 'center', backgroundColor: T.bg },
  typeBtnActive:{ backgroundColor: T.purpleBg, borderColor: T.purpleBd },
  typeTxt:     { fontSize: 13, fontWeight: '600', color: T.text2 },
  typeTxtActive:{ color: T.purple, fontWeight: '700' },

  selectField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  selectTxt:   { fontSize: 15, color: T.text, flex: 1 },
  chevron:     { fontSize: 18, color: T.text3 },
  input:       { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: T.text, marginBottom: 14 },

  totalPreview:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.purpleBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: T.purpleBd },
  totalLbl:    { fontSize: 13, fontWeight: '700', color: T.purple },
  totalVal:    { fontSize: 18, fontWeight: '900', color: T.purple },

  saveWrap:    { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  saveBtn:     { paddingVertical: 15, alignItems: 'center' },
  saveTxt:     { color: T.white, fontSize: 15, fontWeight: '700' },
  cancelBtn:   { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelTxt:   { fontSize: 14, color: T.text3, fontWeight: '600' },

  payOpt:      { backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 14 },
  payOptActive:{ backgroundColor: T.purpleBg, borderColor: T.purpleBd },
  payOptLbl:   { fontSize: 14, fontWeight: '700', color: T.text },
  payOptSub:   { fontSize: 12, color: T.text3, marginTop: 2 },
});
