import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useStore } from '../store/useStore';
import { fetchPOSItems, saveSale, undoSale } from '../services/posService';
import { POSItem } from '../types';
import { StaffStackParamList } from '../navigation/StaffNavigator';

interface CartEntry { item: POSItem; qty: number; }
type Nav = NativeStackNavigationProp<StaffStackParamList>;

// ─── Design tokens ────────────────────────────────────────────────────────────
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
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Item tint palette ────────────────────────────────────────────────────────
const TINTS = [
  { bg: 'rgba(124,77,255,0.07)', bd: 'rgba(124,77,255,0.20)', pr: T.grad0 },
  { bg: 'rgba(239,68,68,0.07)',  bd: 'rgba(239,68,68,0.22)',  pr: '#EF4444' },
  { bg: 'rgba(251,191,36,0.08)',bd: 'rgba(251,191,36,0.28)', pr: '#D97706' },
  { bg: 'rgba(96,165,250,0.08)',bd: 'rgba(96,165,250,0.25)', pr: '#3B82F6' },
  { bg: 'rgba(16,185,129,0.07)',bd: 'rgba(16,185,129,0.22)', pr: '#10B981' },
  { bg: 'rgba(249,115,22,0.07)',bd: 'rgba(249,115,22,0.22)', pr: '#EA580C' },
];

export default function StaffSalesScreen() {
  const navigation  = useNavigation<Nav>();
  const { profile } = useStore();
  const route       = useRoute();

  const routeParams         = (route.params as { bookingId?: string; bookingCustomer?: string }) ?? {};
  const linkedBookingId     = routeParams.bookingId       ?? null;
  const linkedBookingCustomer = routeParams.bookingCustomer ?? null;

  const [items,        setItems]        = useState<POSItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart,         setCart]         = useState<Record<string, CartEntry>>({});
  const [confirmModal, setConfirmModal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [lastTxId,     setLastTxId]     = useState<string | null>(null);
  const [showUndo,     setShowUndo]     = useState(false);
  const [undoTimer,    setUndoTimer]    = useState<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoadingItems(true);
      const itemsRes = await fetchPOSItems();
      if (!active) return;
      if (itemsRes.error) Alert.alert('Load Error', itemsRes.error);
      else setItems(itemsRes.items);
      setLoadingItems(false);
    })();
    return () => { active = false; };
  }, []));

  const cartEntries = Object.values(cart);
  const cartTotal   = cartEntries.reduce((s, e) => s + e.qty * e.item.price, 0);
  const cartCount   = cartEntries.reduce((s, e) => s + e.qty, 0);

  const addToCart = (item: POSItem, qty: number) =>
    setCart((prev) => ({ ...prev, [item.id]: prev[item.id] ? { item, qty: prev[item.id].qty + qty } : { item, qty } }));
  const increaseQty = (e: CartEntry) => setCart((prev) => ({ ...prev, [e.item.id]: { ...e, qty: e.qty + 1 } }));
  const decreaseQty = (e: CartEntry) => {
    if (e.qty <= 1) { setCart((prev) => { const n = { ...prev }; delete n[e.item.id]; return n; }); return; }
    setCart((prev) => ({ ...prev, [e.item.id]: { ...e, qty: e.qty - 1 } }));
  };
  const removeFromCart = (id: string) => setCart((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const clearCart = () => setCart({});

  const handleItemTap = (item: POSItem) => {
    if (item.stock <= 0) return;
    addToCart(item, 1);
  };

  const handleConfirmSale = async () => {
    if (cartEntries.length === 0) return;
    setSaving(true);
    const { transaction, error } = await saveSale({
      customer: linkedBookingCustomer ?? 'Walk-in',
      lines: cartEntries.map((e) => ({ itemId: e.item.id, itemName: e.item.name, quantity: e.qty, unitPrice: e.item.price })),
      createdBy: profile?.id ?? null, bookingId: linkedBookingId,
    });
    setSaving(false);
    if (error || !transaction) { Alert.alert('Error', error ?? 'Could not save sale.'); return; }
    clearCart(); setConfirmModal(false);
    setLastTxId(transaction.id); setShowUndo(true);
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(setTimeout(() => { setShowUndo(false); setLastTxId(null); }, 5000));
  };

  const handleUndo = async () => {
    if (!lastTxId) return;
    if (undoTimer) clearTimeout(undoTimer);
    setShowUndo(false);
    const { error } = await undoSale(lastTxId, 'Undone by staff');
    if (error) { Alert.alert('Undo Failed', error); return; }
    setLastTxId(null);
  };

  // Assign tint per item based on index
  const itemTint = (idx: number) => TINTS[idx % TINTS.length];

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.headerTitle}>Sales</Text>
            <Text style={s.headerSub}>Manage items and view sales</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('StaffInventory')} activeOpacity={0.8}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconBtnGrad}>
                <Text style={{ fontSize: 16 }}>📦</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('StaffCredit')} activeOpacity={0.8}>
              <View style={s.iconBtnPlain}>
                <Text style={{ fontSize: 16 }}>💳</Text>
              </View>
            </TouchableOpacity>
            {cartCount > 0 && (
              <TouchableOpacity onPress={() => setConfirmModal(true)} activeOpacity={0.85}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cartBadge}>
                  <Text style={s.cartBadgeTxt}>{cartCount}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Linked booking banner ── */}
        {linkedBookingCustomer && (
          <View style={s.linkedBanner}>
            <Text style={s.linkedBannerTxt}>📎  Linked to: {linkedBookingCustomer}</Text>
          </View>
        )}

        {/* ── Body ── */}
        <View style={{ flex: 1 }}>
          {loadingItems ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={T.grad0} size="large" />
              <Text style={s.loadingTxt}>Loading items…</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              numColumns={3}
              contentContainerStyle={s.grid}
              columnWrapperStyle={{ gap: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={s.sectionHdr}>
                  <Text style={s.sectionIcon}>🏷</Text>
                  <Text style={s.sectionTitle}>Products</Text>
                  <Text style={s.sectionCount}>{items.length} items</Text>
                </View>
              }
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Text style={s.emptyTxt}>No items found.</Text>
                  <Text style={s.emptySub}>Tap 📦 above to add items in Inventory.</Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: 120 }} />}
              renderItem={({ item, index }) => {
                const inCart     = cart[item.id];
                const outOfStock = item.stock <= 0;
                const isLow      = item.stock > 0 && item.stock <= 10;
                const tint       = itemTint(index);
                return (
                  <TouchableOpacity
                    style={[s.itemCard, { backgroundColor: tint.bg, borderColor: inCart ? tint.pr : tint.bd, borderWidth: inCart ? 2 : 1 }, outOfStock && { opacity: 0.38 }]}
                    onPress={() => !outOfStock && handleItemTap(item)}
                    activeOpacity={outOfStock ? 1 : 0.78}
                  >
                    {inCart && (
                      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.qtyBadge}>
                        <Text style={s.qtyBadgeTxt}>{inCart.qty}</Text>
                      </LinearGradient>
                    )}
                    <Text style={s.itemEmoji}>{item.emoji}</Text>
                    <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={[s.itemPrice, { color: tint.pr }]}>₹{item.price}</Text>
                    <View style={[s.stockBadge, { backgroundColor: T.surface }]}>
                      <Text style={{ fontSize: 9, color: tint.pr, fontWeight: '700' }}>
                        {outOfStock ? 'Out' : isLow ? `⚠ ${item.stock}` : item.stock} {!outOfStock ? item.unit ?? '' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* ── Cart strip ── */}
          {cartEntries.length > 0 && (
            <View style={s.cartStrip}>
              <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                {cartEntries.map((entry) => (
                  <View key={entry.item.id} style={s.cartRow}>
                    <Text style={s.cartEmoji}>{entry.item.emoji}</Text>
                    <Text style={s.cartName} numberOfLines={1}>{entry.item.name}</Text>
                    <View style={s.qtyControl}>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => decreaseQty(entry)}>
                        <Text style={s.qtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.qtyNum}>{entry.qty}</Text>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => increaseQty(entry)}>
                        <Text style={s.qtyBtnTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={s.lineTotal}>₹{entry.qty * entry.item.price}</Text>
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeFromCart(entry.item.id)}>
                      <Text style={s.removeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <View style={s.cartFooter}>
                <View>
                  <Text style={s.cartTotalLbl}>Total</Text>
                  <Text style={s.cartTotal}>₹{cartTotal}</Text>
                </View>
                <TouchableOpacity onPress={() => setConfirmModal(true)} activeOpacity={0.88}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.chargeBtn}>
                    <Text style={s.chargeBtnTxt}>Charge  ₹{cartTotal}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ── Undo toast ── */}
      {showUndo && (
        <View style={s.toast}>
          <Text style={s.toastTxt}>✓ Sale recorded</Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text style={s.toastUndo}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Confirm sale modal ── */}
      <Modal visible={confirmModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Confirm Sale</Text>
            {linkedBookingCustomer && (
              <View style={s.linkedBannerModal}>
                <Text style={s.linkedBannerTxt}>📎  {linkedBookingCustomer}</Text>
              </View>
            )}
            {cartEntries.map((e) => (
              <View key={e.item.id} style={s.confirmLine}>
                <Text style={s.confirmLineName}>{e.item.emoji}  {e.item.name}</Text>
                <View style={{ flex: 1 }}><Text style={s.confirmLineMeta}>₹{e.item.price} × {e.qty}</Text></View>
                <Text style={s.confirmLineAmt}>₹{e.qty * e.item.price}</Text>
              </View>
            ))}
            <View style={s.confirmDivider} />
            <View style={s.confirmTotalRow}>
              <Text style={s.confirmTotalLbl}>Total</Text>
              <Text style={s.confirmTotalAmt}>₹{cartTotal}</Text>
            </View>
            <TouchableOpacity onPress={handleConfirmSale} disabled={saving} activeOpacity={0.88}
              style={{ opacity: saving ? 0.7 : 1 }}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtn}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>✓  Confirm &amp; Save</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setConfirmModal(false)} disabled={saving}>
              <Text style={s.cancelBtnTxt}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: T.bg },

  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backArrow:  { fontSize: 18, color: T.text },
  headerTitle:{ fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSub:  { fontSize: 11, color: T.text2, marginTop: 1 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:    { },
  iconBtnGrad:{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconBtnPlain:{ width: 38, height: 38, borderRadius: 19, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  cartBadge:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cartBadgeTxt:{ fontSize: 14, fontWeight: '800', color: T.white },

  linkedBanner:    { backgroundColor: 'rgba(124,77,255,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(124,77,255,0.12)' },
  linkedBannerTxt: { fontSize: 13, fontWeight: '600', color: T.grad0 },
  linkedBannerModal:{ backgroundColor: 'rgba(124,77,255,0.08)', borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(124,77,255,0.16)' },

  loadingWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 13, color: T.text2 },

  grid:       { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },

  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 4 },
  sectionIcon:{ fontSize: 16 },
  sectionTitle:{ fontSize: 16, fontWeight: '800', color: T.text, flex: 1 },
  sectionCount:{ fontSize: 12, color: T.text2, fontWeight: '600' },

  emptyWrap:  { padding: 40, alignItems: 'center', gap: 8 },
  emptyTxt:   { fontSize: 15, fontWeight: '600', color: T.text2 },
  emptySub:   { fontSize: 12, color: T.text3, textAlign: 'center' },

  itemCard:   { flex: 1, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', gap: 5, position: 'relative', shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  qtyBadge:   { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  qtyBadgeTxt:{ fontSize: 11, fontWeight: '800', color: T.white },
  itemEmoji:  { fontSize: 30 },
  itemName:   { fontSize: 11, fontWeight: '700', color: T.text, textAlign: 'center', lineHeight: 14 },
  itemPrice:  { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stockBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2 },

  // Date grouping
  dateLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dateLine:    { flex: 1, height: 1, backgroundColor: T.border },
  dateLabelTxt:{ fontSize: 11, fontWeight: '700', color: T.text3, letterSpacing: 0.5 },

  // Transaction card
  txCard:      { backgroundColor: T.surface, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: T.border, overflow: 'hidden', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  txCardUndone:{ backgroundColor: T.redBg, borderColor: 'rgba(239,68,68,0.18)' },
  txRow:       { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txNames:     { fontSize: 13, fontWeight: '700', color: T.text },
  txMeta:      { fontSize: 11, color: T.text3, marginTop: 2 },
  txAmt:       { fontSize: 14, fontWeight: '800', color: T.grad0, fontVariant: ['tabular-nums'], marginRight: 8 },
  txChevron:   { fontSize: 16, color: T.text3, fontWeight: '700', width: 16, textAlign: 'center' },

  txExpanded:       { borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  txItemRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txItemName:       { fontSize: 13, fontWeight: '600', color: T.text, flex: 1 },
  txItemMeta:       { fontSize: 11, color: T.text3 },
  txItemAmt:        { fontSize: 12, fontWeight: '700', color: T.text, fontVariant: ['tabular-nums'] },
  txExpandedTotal:  { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 },
  txExpandedTotalLbl:{ fontSize: 12, fontWeight: '700', color: T.text2 },
  txExpandedTotalAmt:{ fontSize: 14, fontWeight: '800', color: T.grad0, fontVariant: ['tabular-nums'] },

  // Cart
  cartStrip:  { backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, shadowColor: 'rgba(0,0,0,0.10)', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  cartRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8 },
  cartEmoji:  { fontSize: 18, width: 26 },
  cartName:   { flex: 1, fontSize: 13, fontWeight: '600', color: T.text },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:     { width: 28, height: 28, backgroundColor: T.bg, borderRadius: 8, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt:  { fontSize: 16, fontWeight: '700', color: T.text, lineHeight: 20 },
  qtyNum:     { fontSize: 14, fontWeight: '700', color: T.text, minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  lineTotal:  { fontSize: 13, fontWeight: '700', color: T.text, minWidth: 46, textAlign: 'right', fontVariant: ['tabular-nums'] },
  removeBtn:  { width: 28, height: 28, backgroundColor: T.redBg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  removeBtnTxt:{ fontSize: 12, fontWeight: '700', color: T.redTxt },
  cartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  cartTotalLbl:{ fontSize: 11, color: T.text3, fontWeight: '600' },
  cartTotal:  { fontSize: 22, fontWeight: '800', color: T.text, fontVariant: ['tabular-nums'] },
  chargeBtn:  { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13 },
  chargeBtnTxt:{ fontSize: 15, fontWeight: '800', color: T.white },

  toast:      { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: T.text, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toastTxt:   { color: T.white, fontSize: 13, fontWeight: '600' },
  toastUndo:  { color: '#7BC9A4', fontSize: 13, fontWeight: '800' },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  modalHandle:{ width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 16 },

  pendingEmoji:{ fontSize: 52, textAlign: 'center', marginBottom: 8 },
  pendingName: { fontSize: 22, fontWeight: '800', color: T.text, textAlign: 'center' },
  pendingPrice:{ fontSize: 14, color: T.text2, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  qtyPickerLbl:{ fontSize: 11, fontWeight: '800', color: T.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, textAlign: 'center' },
  qtyGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, justifyContent: 'center' },
  qtyOption:  { width: 80, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qtyOptionTxt:{ fontSize: 26, fontWeight: '800', color: T.white },

  confirmLine:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8 },
  confirmLineName:{ fontSize: 14, fontWeight: '600', color: T.text },
  confirmLineMeta:{ fontSize: 11, color: T.text3, marginTop: 2 },
  confirmLineAmt: { fontSize: 14, fontWeight: '700', color: T.text, fontVariant: ['tabular-nums'] },
  confirmDivider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  confirmTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  confirmTotalLbl:{ fontSize: 15, fontWeight: '700', color: T.text2 },
  confirmTotalAmt:{ fontSize: 28, fontWeight: '900', color: T.text, fontVariant: ['tabular-nums'] },
  confirmBtn:    { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnTxt: { color: T.white, fontSize: 16, fontWeight: '800' },
  cancelBtn:     { paddingVertical: 14, alignItems: 'center' },
  cancelBtnTxt:  { fontSize: 14, color: T.text2, fontWeight: '600' },
});
