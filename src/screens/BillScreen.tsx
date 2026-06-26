import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert,
  TextInput, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { fetchBillData, finalizeBill, editPOSLineItem, removePOSLineItem, BillData, BillLineItem } from '../services/billingService';
import { useStore } from '../store/useStore';

const T = {
  bg: '#FAFAFC', surface: '#FFFFFF', grad0: '#7C4DFF', grad1: '#8B5CF6', grad2: '#60A5FA',
  text: '#1A1A1A', text2: '#7B7B8A', text3: '#AEAEBB',
  border: 'rgba(0,0,0,0.06)', borderStrong: 'rgba(0,0,0,0.12)',
  purple: '#7C4DFF', purpleBg: 'rgba(124,77,255,0.09)', purpleBd: 'rgba(124,77,255,0.20)',
  green: '#10B981', greenBg: 'rgba(16,185,129,0.10)', greenBd: 'rgba(16,185,129,0.25)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.08)',
  white: '#FFFFFF',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

function safeNum(v: any, d = 0): number { const n = Number(v); return isNaN(n) ? d : n; }

function recalcBill(bill: BillData, items: BillLineItem[]): BillData {
  const posTotal   = items.reduce((s, i) => s + safeNum(i.lineTotal), 0);
  const grandTotal = safeNum(bill.remainingSlot) + posTotal;
  return { ...bill, posItems: items, posTotal, grandTotal };
}

function Div({ thick }: { thick?: boolean }) {
  return (
    <View style={{
      height: thick ? 1.5 : 1,
      backgroundColor: thick ? T.borderStrong : T.border,
      marginVertical: 6,
    }} />
  );
}

export default function BillScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const { profile } = useStore();
  const { bookingId } = (route.params as { bookingId: string }) ?? {};
  const role        = profile?.role ?? 'customer';
  const canEdit     = role === 'owner' || role === 'admin' || role === 'staff';
  const canFinalize = canEdit;

  const [bill, setBill]               = useState<BillData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [finalizing, setFinalizing]   = useState(false);
  const [editModal, setEditModal]     = useState(false);
  const [editingItem, setEditingItem] = useState<BillLineItem | null>(null);
  const [editQty, setEditQty]         = useState('');
  const [savingEdit, setSavingEdit]   = useState(false);

  const loadBill = useCallback(async () => {
    if (!bookingId) { setError('No booking ID.'); setLoading(false); return; }
    const { bill: b, error: e } = await fetchBillData(bookingId);
    setBill(b); setError(e);
  }, [bookingId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadBill().finally(() => setLoading(false));
  }, [loadBill]));

  const handleFinalize = () => {
    Alert.alert('Finalize Bill', 'Confirm and save the final bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setFinalizing(true);
        const { error: e } = await finalizeBill(bookingId);
        setFinalizing(false);
        if (e) { Alert.alert('Error', e); return; }
        await loadBill();
        Alert.alert('Bill Finalized', 'Bill saved and marked paid.');
      }},
    ]);
  };

  const openEdit = (item: BillLineItem) => {
    setEditingItem({ ...item });
    setEditQty(String(item.quantity));
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !bill) return;
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty < 0) { Alert.alert('Invalid', 'Enter valid quantity (0 to remove).'); return; }

    setSavingEdit(true);

    // Snapshot for revert on error
    const snapshot = { ...bill, posItems: bill.posItems.map(i => ({ ...i })) };

    if (qty === 0) {
      // ── Remove item ──────────────────────────────────────────────────────
      const optimistic = recalcBill(bill, bill.posItems.filter(i => i.transactionItemId !== editingItem.transactionItemId));
      setBill(optimistic);           // apply immediately — grand total updates now
      setEditModal(false);
      setEditingItem(null);

      const { error: e } = await removePOSLineItem({
        transactionItemId: editingItem.transactionItemId,
        transactionId:     editingItem.transactionId,
      });
      if (e) {
        setBill(snapshot);           // revert only on DB error
        Alert.alert('Error', e);
      }
      // success → keep the optimistic state; no re-fetch that could overwrite

    } else {
      // ── Edit quantity ────────────────────────────────────────────────────
      const newLineTotal = qty * safeNum(editingItem.unitPrice);
      const optimistic = recalcBill(
        bill,
        bill.posItems.map(i =>
          i.transactionItemId === editingItem.transactionItemId
            ? { ...i, quantity: qty, lineTotal: newLineTotal }
            : i,
        ),
      );
      setBill(optimistic);           // apply immediately — qty, line total, POS total, grand total all update now
      setEditModal(false);
      setEditingItem(null);

      const { error: e } = await editPOSLineItem({
        transactionItemId: editingItem.transactionItemId,
        transactionId:     editingItem.transactionId,
        inventoryItemId:   editingItem.inventoryItemId,
        newQuantity:       qty,
        unitPrice:         editingItem.unitPrice,
        originalQuantity:  editingItem.quantity,
      });
      if (e) {
        setBill(snapshot);           // revert only on DB error
        Alert.alert('Error', e);
      }
      // success → keep the optimistic state; no re-fetch that could overwrite
    }

    setSavingEdit(false);
  };

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Invoice</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.center}><ActivityIndicator color={T.purple} size="large" /></View>
    </SafeAreaView>
  );

  if (error || !bill) return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Invoice</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.center}><Text style={s.errTxt}>{error ?? 'Invoice not found.'}</Text></View>
    </SafeAreaView>
  );

  const fmtDate = (() => {
    try { return new Date(bill.bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return bill.bookingDate; }
  })();
  const n = (v: number) => isNaN(v) ? 0 : v;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{bill.isFinalized ? 'Invoice ✓' : 'Invoice'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {bill.isFinalized && (
          <View style={s.finalizedBanner}>
            <Text style={s.finalizedText}>✓ Bill finalized and paid</Text>
          </View>
        )}

        {/* Invoice card */}
        <View style={s.invoiceCard}>
          {/* Purple gradient header */}
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.invoiceHdr}>
            <Text style={s.brandName}>PLAYBOX</Text>
            <Text style={s.turfName}>{bill.turfName}</Text>
            <View style={s.invoiceTag}><Text style={s.invoiceTagText}>INVOICE</Text></View>
          </LinearGradient>

          <View style={s.invoiceBody}>
            {/* Customer */}
            <Text style={s.sectionLabel}>Customer</Text>
            {[{ l: 'Name', v: bill.customerName || '—' }, { l: 'Phone', v: bill.phone || '—' }].map((r) => (
              <View key={r.l} style={s.infoRow}>
                <Text style={s.infoLabel}>{r.l}</Text>
                <Text style={s.infoVal}>{r.v}</Text>
              </View>
            ))}

            <Div />

            {/* Booking */}
            <Text style={s.sectionLabel}>Booking</Text>
            {[{ l: 'Date', v: fmtDate }, { l: 'Sport', v: bill.sport || '—' }, { l: 'Slot', v: bill.slotLabel || '—' }].map((r) => (
              <View key={r.l} style={s.infoRow}>
                <Text style={s.infoLabel}>{r.l}</Text>
                <Text style={s.infoVal}>{r.v}</Text>
              </View>
            ))}

            <Div />

            {/* Slot charges */}
            <Text style={s.sectionLabel}>Slot Charges</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Slot Total</Text>
              <Text style={s.infoVal}>₹{n(bill.slotTotal)}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Advance Paid</Text>
              <Text style={[s.infoVal, { color: T.green }]}>− ₹{n(bill.advanceAmount)}</Text>
            </View>
            <View style={[s.infoRow, s.subtotalRow]}>
              <Text style={s.subtotalLabel}>Remaining</Text>
              <Text style={s.subtotalVal}>₹{n(bill.remainingSlot)}</Text>
            </View>

            {/* POS items */}
            {bill.posItems.length > 0 && (
              <>
                <Div />
                <View style={s.posSectionHdr}>
                  <Text style={s.sectionLabel}>Canteen / POS</Text>
                  {canEdit && !bill.isFinalized && <Text style={s.editHint}>Tap item to edit</Text>}
                </View>
                <View style={s.posColHdr}>
                  <Text style={[s.posHdrCell, { flex: 2, textAlign: 'left' }]}>Item</Text>
                  <Text style={s.posHdrCell}>Qty</Text>
                  <Text style={s.posHdrCell}>Rate</Text>
                  <Text style={s.posHdrCell}>Total</Text>
                </View>
                {bill.posItems.map((item, idx) => {
                  const lt = safeNum(item.lineTotal, safeNum(item.quantity) * safeNum(item.unitPrice));
                  const editable = canEdit && !bill.isFinalized;
                  return (
                    <TouchableOpacity
                      key={`pi-${item.transactionItemId}-${idx}`}
                      style={[s.posRow, editable && s.posRowTappable]}
                      onPress={() => editable && openEdit(item)}
                      activeOpacity={editable ? 0.6 : 1}
                      disabled={!editable}
                    >
                      <View style={[s.posCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Text style={s.posName} numberOfLines={1}>{item.name}</Text>
                        {editable && <Text style={s.pencil}>✎</Text>}
                      </View>
                      <Text style={[s.posCell, { textAlign: 'center', fontWeight: '700' }]}>{item.quantity}</Text>
                      <Text style={s.posCell}>₹{item.unitPrice}</Text>
                      <Text style={[s.posCell, { fontWeight: '700', color: T.text }]}>₹{lt}</Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={[s.infoRow, s.subtotalRow]}>
                  <Text style={s.subtotalLabel}>POS Total</Text>
                  <Text style={s.subtotalVal}>₹{n(bill.posTotal)}</Text>
                </View>
              </>
            )}

            <Div thick />

            {/* Grand total */}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Grand Total</Text>
              <Text style={s.grandVal}>₹{n(bill.grandTotal)}</Text>
            </View>

            <Div />

            <Text style={s.footNote}>
              Thank you for visiting Playbox!{'\n'}
              Advance of ₹{n(bill.advanceAmount)} is non-refundable.
            </Text>
          </View>
        </View>

        {canFinalize && !bill.isFinalized && (
          <TouchableOpacity
            style={[s.finalizeWrap, finalizing && { opacity: 0.7 }]}
            onPress={handleFinalize}
            disabled={finalizing}
            activeOpacity={0.85}
          >
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.finalizeBtn}>
              {finalizing
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.finalizeBtnText}>Finalize Bill</Text>}
            </LinearGradient>
          </TouchableOpacity>
        )}
        {!canFinalize && (
          <View style={s.readOnlyNote}>
            <Text style={s.readOnlyText}>Contact turf to finalize payment.</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            {editingItem && (
              <>
                <Text style={s.modalTitle}>Edit Item</Text>
                <Text style={s.editItemName}>{editingItem.name}</Text>
                <Text style={s.editItemPrice}>₹{editingItem.unitPrice} per unit</Text>
                <View style={s.qtyRow}>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => setEditQty(String(Math.max(0, safeNum(parseFloat(editQty)) - 1)))}
                  >
                    <Text style={s.qtyBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.qtyInput}
                    value={editQty}
                    onChangeText={(t) => setEditQty(t.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    textAlign="center"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => setEditQty(String(safeNum(parseFloat(editQty)) + 1))}
                  >
                    <Text style={s.qtyBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
                {(() => {
                  const qty = safeNum(parseFloat(editQty));
                  const removing = qty === 0;
                  return (
                    <View style={[s.previewBox, removing && s.previewBoxRemove]}>
                      <Text style={[s.previewText, removing && { color: T.red }]}>
                        {removing
                          ? 'Item will be removed'
                          : `Qty ${qty} × ₹${safeNum(editingItem.unitPrice)} = ₹${qty * safeNum(editingItem.unitPrice)}`}
                      </Text>
                    </View>
                  );
                })()}
                <TouchableOpacity
                  style={[s.saveEditWrap, savingEdit && { opacity: 0.7 }]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveEditBtn}>
                    {savingEdit
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.saveEditTxt}>Save Changes</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelEditBtn} onPress={() => { setEditModal(false); setEditingItem(null); }}>
                  <Text style={s.cancelEditTxt}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: T.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errTxt:           { fontSize: 14, color: T.red, textAlign: 'center', padding: 20 },

  hdr:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn:          { width: 38, height: 38, backgroundColor: T.bg, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  backTxt:          { fontSize: 22, color: T.text, lineHeight: 28 },
  hdrTitle:         { fontSize: 16, fontWeight: '800', color: T.text },

  scroll:           { padding: 16, paddingBottom: 48 },

  finalizedBanner:  { backgroundColor: T.greenBg, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.greenBd, alignItems: 'center' },
  finalizedText:    { fontSize: 14, fontWeight: '700', color: T.green },

  invoiceCard:      { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },

  invoiceHdr:       { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 6 },
  brandName:        { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  turfName:         { fontSize: 12, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5 },
  invoiceTag:       { backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  invoiceTagText:   { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 2 },

  invoiceBody:      { padding: 20, gap: 6 },
  sectionLabel:     { fontSize: 10, fontWeight: '900', color: T.text3, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, marginTop: 4 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  infoLabel:        { fontSize: 13, color: T.text2 },
  infoVal:          { fontSize: 13, fontWeight: '700', color: T.text, textAlign: 'right' },

  subtotalRow:      { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 },
  subtotalLabel:    { fontSize: 14, fontWeight: '800', color: T.text },
  subtotalVal:      { fontSize: 16, fontWeight: '800', color: T.purple },

  posSectionHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editHint:         { fontSize: 11, color: T.purple, fontWeight: '600' },
  posColHdr:        { flexDirection: 'row', paddingVertical: 4 },
  posHdrCell:       { width: 56, fontSize: 10, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  posRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  posRowTappable:   { backgroundColor: T.purpleBg, borderRadius: 8, paddingHorizontal: 4 },
  posCell:          { width: 56, fontSize: 13, color: T.text2, textAlign: 'center' },
  posName:          { fontSize: 13, color: T.text2 },
  pencil:           { fontSize: 11, color: T.purple },

  grandRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  grandLabel:       { fontSize: 18, fontWeight: '800', color: T.text },
  grandVal:         { fontSize: 28, fontWeight: '900', color: T.purple },

  footNote:         { fontSize: 11, color: T.text3, textAlign: 'center', lineHeight: 18, paddingBottom: 4 },

  finalizeWrap:     { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  finalizeBtn:      { paddingVertical: 16, alignItems: 'center' },
  finalizeBtnText:  { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  readOnlyNote:     { backgroundColor: T.purpleBg, borderRadius: 12, marginTop: 16, padding: 12, borderWidth: 1, borderColor: T.purpleBd, alignItems: 'center' },
  readOnlyText:     { fontSize: 13, color: T.purple, fontWeight: '600' },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  modalHandle:      { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 4 },
  editItemName:     { fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 2 },
  editItemPrice:    { fontSize: 13, color: T.text3, marginBottom: 20 },

  qtyRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
  qtyBtn:           { width: 52, height: 52, borderRadius: 26, backgroundColor: T.purple, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt:        { fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 34 },
  qtyInput:         { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.borderStrong, borderRadius: 12, paddingVertical: 8, fontSize: 28, fontWeight: '900', color: T.text, width: 100, textAlign: 'center' },

  previewBox:       { backgroundColor: T.purpleBg, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: T.purpleBd },
  previewBoxRemove: { backgroundColor: T.redBg, borderColor: 'rgba(239,68,68,0.25)' },
  previewText:      { fontSize: 13, fontWeight: '700', color: T.purple, textAlign: 'center' },

  saveEditWrap:     { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  saveEditBtn:      { paddingVertical: 14, alignItems: 'center' },
  saveEditTxt:      { fontSize: 15, fontWeight: '700', color: '#fff' },

  cancelEditBtn:    { paddingVertical: 10, alignItems: 'center' },
  cancelEditTxt:    { fontSize: 13, color: T.text3, fontWeight: '600' },
});
