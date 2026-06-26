import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store/useStore';
import { fetchPOSItems, fetchRecentTransactions, saveSale, undoSale } from '../services/posService';
import { POSItem, Transaction } from '../types';
import { supabase } from '../lib/supabase';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      '#FAFAFC',
  surface: '#FFFFFF',
  border:  'rgba(0,0,0,0.06)',
  grad0:   '#7C4DFF',
  grad1:   '#8B5CF6',
  grad2:   '#60A5FA',
  text:    '#1A1A1A',
  text2:   '#7B7B8A',
  text3:   '#AEAEBB',
  white:   '#FFFFFF',
  okTxt:   '#10B981',
  okBg:    'rgba(16,185,129,0.09)',
  redTxt:  '#EF4444',
  redBg:   'rgba(239,68,68,0.07)',
  infoBg:  'rgba(59,130,246,0.07)',
  infoTxt: '#3B82F6',
  infoBd:  'rgba(59,130,246,0.20)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// Per-item accent palette cycling
const ACCENTS = [
  { c: '#7C4DFF', bg: 'rgba(124,77,255,0.09)', bd: 'rgba(124,77,255,0.22)' },
  { c: '#3B82F6', bg: 'rgba(59,130,246,0.09)',  bd: 'rgba(59,130,246,0.22)'  },
  { c: '#10B981', bg: 'rgba(16,185,129,0.09)',  bd: 'rgba(16,185,129,0.22)'  },
  { c: '#F97316', bg: 'rgba(249,115,22,0.09)',  bd: 'rgba(249,115,22,0.22)'  },
  { c: '#EC4899', bg: 'rgba(236,72,153,0.09)',  bd: 'rgba(236,72,153,0.22)'  },
  { c: '#F59E0B', bg: 'rgba(245,158,11,0.09)',  bd: 'rgba(245,158,11,0.22)'  },
];

// ─── reduceStock ──────────────────────────────────────────────────────────────
async function reduceStock(lines: { itemId: string; quantity: number }[]): Promise<void> {
  for (const line of lines) {
    await supabase.rpc('reduce_item_stock', { p_item_id: line.itemId, p_quantity: line.quantity });
  }
}

// ─── Date label helper ────────────────────────────────────────────────────────
function dateLabel(dateStr: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

// ─── Portrait product card (3-column) ─────────────────────────────────────────
function PortraitCard({ item, idx, inCart, outOfStock, isLow, onPress }: {
  item: POSItem; idx: number; inCart?: { qty: number };
  outOfStock: boolean; isLow: boolean; onPress: () => void;
}) {
  const { c, bg, bd } = ACCENTS[idx % ACCENTS.length];
  const cardW = (SW - 48 - 16) / 3;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={outOfStock ? 1 : 0.82}
      style={[pc.card, { width: cardW, opacity: outOfStock ? 0.45 : 1 },
        !!inCart && { borderColor: c, borderWidth: 1.5, backgroundColor: bg }]}
    >
      {/* Top accent bar */}
      <View style={[pc.topBar, { backgroundColor: c }]} />

      {/* Qty badge */}
      {inCart && (
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pc.qtyBadge}>
          <Text style={pc.qtyBadgeTxt}>{inCart.qty}</Text>
        </LinearGradient>
      )}

      {/* Emoji */}
      <View style={[pc.emojiWrap, { backgroundColor: bg }]}>
        <Text style={pc.emoji}>{item.emoji}</Text>
      </View>

      <Text style={pc.name} numberOfLines={1}>{item.name}</Text>
      <Text style={[pc.price, { color: c }]}>₹{item.price}</Text>

      <View style={[pc.stockBadge, { backgroundColor: bd }]}>
        <Text style={[pc.stockTxt, { color: c }]}>
          {outOfStock ? '✕ Out' : isLow ? `⚠ ${item.stock} left` : `📦 ${item.stock}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  card:      { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, paddingBottom: 12, overflow: 'hidden', position: 'relative', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  topBar:    { height: 3, width: '100%' },
  qtyBadge:  { position: 'absolute', top: 10, left: 10, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, zIndex: 2 },
  qtyBadgeTxt:{ fontSize: 10, fontWeight: '800', color: T.white },
  emojiWrap: { width: 60, height: 60, borderRadius: 14, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 8 },
  emoji:     { fontSize: 30 },
  name:      { fontSize: 12, fontWeight: '700', color: T.text, textAlign: 'center', paddingHorizontal: 6, marginBottom: 2 },
  price:     { fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  stockBadge:{ marginHorizontal: 8, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center' },
  stockTxt:  { fontSize: 9, fontWeight: '700' },
});

// ─── Landscape product card (leftover < 3) ────────────────────────────────────
function LandscapeCard({ item, idx, inCart, outOfStock, isLow, onPress }: {
  item: POSItem; idx: number; inCart?: { qty: number };
  outOfStock: boolean; isLow: boolean; onPress: () => void;
}) {
  const { c, bg } = ACCENTS[idx % ACCENTS.length];
  const cardW = (SW - 40 - 10) / 2;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={outOfStock ? 1 : 0.82}
      style={[lc.card, { width: cardW, opacity: outOfStock ? 0.45 : 1 },
        !!inCart && { borderColor: c, borderWidth: 1.5, backgroundColor: bg }]}
    >
      <View style={[lc.topBar, { backgroundColor: c }]} />
      {inCart && (
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={lc.qtyBadge}>
          <Text style={lc.qtyBadgeTxt}>{inCart.qty}</Text>
        </LinearGradient>
      )}
      <View style={lc.row}>
        <View style={[lc.emojiWrap, { backgroundColor: bg }]}>
          <Text style={lc.emoji}>{item.emoji}</Text>
        </View>
        <View style={lc.info}>
          <Text style={lc.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[lc.price, { color: c }]}>₹{item.price}</Text>
          <View style={[lc.stockBadge, { backgroundColor: bg }]}>
            <Text style={[lc.stockTxt, { color: c }]}>
              {outOfStock ? '✕ Out' : isLow ? `⚠ ${item.stock}` : `📦 ${item.stock} in stock`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const lc = StyleSheet.create({
  card:      { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, overflow: 'hidden', paddingBottom: 14, position: 'relative', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  topBar:    { height: 3, width: '100%' },
  qtyBadge:  { position: 'absolute', top: 10, left: 10, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, zIndex: 2 },
  qtyBadgeTxt:{ fontSize: 10, fontWeight: '800', color: T.white },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 10 },
  emojiWrap: { width: 58, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji:     { fontSize: 30 },
  info:      { flex: 1, gap: 4 },
  name:      { fontSize: 13, fontWeight: '700', color: T.text },
  price:     { fontSize: 15, fontWeight: '800' },
  stockBadge:{ alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  stockTxt:  { fontSize: 10, fontWeight: '700' },
});

// ─── Collapsible transaction row ──────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const [expanded, setExpanded] = useState(false);
  const summary = tx.items.map((x) => x.name).join(', ');
  return (
    <TouchableOpacity
      style={[tr.wrap, tx.undone && { opacity: 0.45 }]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
    >
      <View style={tr.row}>
        <View style={[tr.check, tx.undone && { backgroundColor: T.redBg }]}>
          <Text style={[tr.checkTxt, tx.undone && { color: T.redTxt }]}>{tx.undone ? '✕' : '✓'}</Text>
        </View>
        <View style={tr.emojiBox}>
          <Text style={{ fontSize: 20 }}>{tx.items[0]?.emoji ?? '📦'}</Text>
        </View>
        <View style={tr.info}>
          <Text style={tr.name} numberOfLines={1}>{summary}</Text>
          <Text style={tr.meta}>{tx.time}  ·  {tx.customer}</Text>
        </View>
        <View style={[tr.amtPill, tx.undone && { backgroundColor: T.redBg }]}>
          <Text style={[tr.amtTxt, tx.undone && { color: T.redTxt, textDecorationLine: 'line-through' }]}>₹{tx.total}</Text>
        </View>
        <Text style={tr.chevron}>{expanded ? '∧' : '∨'}</Text>
      </View>

      {expanded && (
        <View style={tr.details}>
          {tx.items.map((item, i) => (
            <View key={i} style={tr.detailRow}>
              <Text style={tr.detailName}>{item.name}  ×{item.qty}</Text>
              <Text style={tr.detailPrice}>₹{item.qty * item.price}</Text>
            </View>
          ))}
          {tx.undone && tx.undoneNote ? (
            <Text style={tr.undoneNote}>⚠ {tx.undoneNote}</Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}
const tr = StyleSheet.create({
  wrap:     { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, overflow: 'hidden', shadowColor: 'rgba(0,0,0,0.04)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  check:    { width: 34, height: 34, borderRadius: 17, backgroundColor: T.okBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkTxt: { fontSize: 14, color: T.okTxt, fontWeight: '700' },
  emojiBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:     { flex: 1 },
  name:     { fontSize: 13, fontWeight: '600', color: T.text },
  meta:     { fontSize: 11, color: T.text3, marginTop: 2 },
  amtPill:  { backgroundColor: T.okBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  amtTxt:   { fontSize: 13, fontWeight: '700', color: T.okTxt },
  chevron:  { fontSize: 11, color: T.text3, fontWeight: '700', paddingLeft: 4 },
  details:  { borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  detailRow:{ flexDirection: 'row', justifyContent: 'space-between' },
  detailName:{ fontSize: 13, color: T.text2 },
  detailPrice:{ fontSize: 13, fontWeight: '700', color: T.text },
  undoneNote:{ fontSize: 11, color: T.redTxt, marginTop: 4, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function POSScreen() {
  const { profile }  = useStore();
  const navigation   = useNavigation<any>();
  const route        = useRoute();
  const insets       = useSafeAreaInsets();

  const routeParams = (route.params as { bookingId?: string; bookingCustomer?: string }) ?? {};
  const linkedBookingId       = routeParams.bookingId       ?? null;
  const linkedBookingCustomer = routeParams.bookingCustomer ?? null;

  const [items, setItems]               = useState<POSItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cart, setCart]                 = useState<Record<string, { posItem: POSItem; qty: number }>>({});
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingTx, setLoadingTx]       = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [lastTxId, setLastTxId]         = useState<string | null>(null);
  const [showUndo, setShowUndo]         = useState(false);
  const [undoTimer, setUndoTimer]       = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    const { items: fetched, error } = await fetchPOSItems();
    if (error) Alert.alert('Load Error', error);
    else setItems(fetched);
    setLoadingItems(false);
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    const { transactions: fetched } = await fetchRecentTransactions(20);
    setTransactions(fetched);
    setLoadingTx(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadItems(); loadTransactions();
  }, [loadItems, loadTransactions]));

  const addToCart = (item: POSItem) => {
    if (item.stock <= 0) { Alert.alert('Out of Stock', `${item.name} is out of stock.`); return; }
    setCart((prev) => {
      const existing = prev[item.id];
      const newQty   = (existing?.qty ?? 0) + 1;
      if (newQty > item.stock) { Alert.alert('Insufficient Stock', `Only ${item.stock} ${item.name} available.`); return prev; }
      return { ...prev, [item.id]: { posItem: item, qty: newQty } };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.qty <= 1) { const n = { ...prev }; delete n[itemId]; return n; }
      return { ...prev, [itemId]: { ...existing, qty: existing.qty - 1 } };
    });
  };

  const clearCart = () => setCart({});

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, c) => sum + c.qty * c.posItem.price, 0);
  const cartCount = cartItems.reduce((sum, c) => sum + c.qty, 0);

  const handleConfirmSale = async () => {
    setSaving(true);
    const lines = cartItems.map((c) => ({
      itemId: c.posItem.id, itemName: c.posItem.name,
      quantity: c.qty, unitPrice: c.posItem.price,
    }));
    const { transaction, error } = await saveSale({
      customer: linkedBookingCustomer ?? 'Walk-in',
      lines, createdBy: profile?.id ?? null, bookingId: linkedBookingId,
    });
    if (error || !transaction) {
      setSaving(false);
      Alert.alert('Sale Failed', error ?? 'Could not save transaction.');
      return;
    }
    await reduceStock(lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })));
    setTransactions((prev) => [transaction, ...prev]);
    clearCart();
    setConfirmModal(false);
    setSaving(false);
    await loadItems();
    setLastTxId(transaction.id);
    setShowUndo(true);
    const timer = setTimeout(() => { setShowUndo(false); setLastTxId(null); }, 5000);
    setUndoTimer(timer);
  };

  const handleUndo = async () => {
    if (!lastTxId) return;
    if (undoTimer) clearTimeout(undoTimer);
    setShowUndo(false);
    const { error } = await undoSale(lastTxId, 'Undone by owner');
    if (error) { Alert.alert('Undo Failed', error); return; }
    setTransactions((prev) => prev.map((t) => t.id === lastTxId ? { ...t, undone: true, undoneNote: 'Undone by owner' } : t));
    setLastTxId(null);
    await loadItems();
  };

  // Portrait rows (chunks of 3) + landscape leftover
  const portraitRows: POSItem[][] = [];
  const landscapeItems: POSItem[] = [];
  const portraitCount = Math.floor(items.length / 3) * 3;
  for (let i = 0; i < portraitCount; i += 3) portraitRows.push(items.slice(i, i + 3));
  items.slice(portraitCount).forEach((it) => landscapeItems.push(it));

  // Group transactions by date
  const txGroups: { label: string; items: Transaction[] }[] = [];
  transactions.slice(0, 20).forEach((tx) => {
    const lbl = dateLabel(tx.date);
    const last = txGroups[txGroups.length - 1];
    if (last && last.label === lbl) last.items.push(tx);
    else txGroups.push({ label: lbl, items: [tx] });
  });

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Sales</Text>
            <Text style={s.headerSub}>Point of sale</Text>
          </View>
          <TouchableOpacity style={s.invBtn} onPress={() => navigation.navigate('Inventory')} activeOpacity={0.8}>
            <Text style={s.invBtnTxt}>📦 Inventory</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, { paddingBottom: cartCount > 0 ? 160 : 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Linked booking banner */}
          {linkedBookingCustomer && (
            <View style={s.linkedBanner}>
              <Text style={s.linkedBannerTxt}>📎  Linked to: {linkedBookingCustomer}</Text>
            </View>
          )}

          {/* ── Products ── */}
          <View style={s.sectionHdr}>
            <Text style={s.sectionTitle}>🏷  Products</Text>
          </View>

          {loadingItems ? (
            <View style={s.loadingWrap}><ActivityIndicator color={T.grad0} size="large" /></View>
          ) : (
            <View style={s.productsWrap}>
              {portraitRows.map((row, ri) => (
                <View key={`row-${ri}`} style={s.portraitRow}>
                  {row.map((item, ci) => {
                    const gIdx = ri * 3 + ci;
                    return (
                      <PortraitCard
                        key={item.id} item={item} idx={gIdx}
                        inCart={cart[item.id]}
                        outOfStock={item.stock <= 0}
                        isLow={item.stock > 0 && item.stock <= 5}
                        onPress={() => item.stock > 0 && addToCart(item)}
                      />
                    );
                  })}
                </View>
              ))}
              {landscapeItems.length > 0 && (
                <View style={s.landscapeRow}>
                  {landscapeItems.map((item, ci) => (
                    <LandscapeCard
                      key={item.id} item={item} idx={portraitCount + ci}
                      inCart={cart[item.id]}
                      outOfStock={item.stock <= 0}
                      isLow={item.stock > 0 && item.stock <= 5}
                      onPress={() => item.stock > 0 && addToCart(item)}
                    />
                  ))}
                </View>
              )}
              {items.length === 0 && (
                <View style={s.emptyWrap}><Text style={s.emptyTxt}>No products yet.</Text></View>
              )}
            </View>
          )}

          {/* ── Recent Sales ── */}
          <View style={s.sectionHdr}>
            <Text style={s.sectionTitle}>📈  Recent Sales</Text>
          </View>

          <View style={s.salesList}>
            {loadingTx ? (
              <ActivityIndicator color={T.grad0} style={{ marginVertical: 20 }} />
            ) : txGroups.length === 0 ? (
              <View style={s.emptyWrap}><Text style={s.emptyTxt}>No sales yet.</Text></View>
            ) : (
              txGroups.map((group) => (
                <View key={group.label} style={{ gap: 8 }}>
                  <View style={s.dateDivider}>
                    <View style={s.dateLine} />
                    <Text style={s.dateLbl}>{group.label}</Text>
                    <View style={s.dateLine} />
                  </View>
                  {group.items.map((tx, i) => (
                    <TxRow key={`${tx.id}-${i}`} tx={tx} />
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* ── Cart footer ── */}
        {cartCount > 0 && (
          <View style={[s.cartFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.cartTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cartCountLbl}>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</Text>
                <View style={s.cartItemsList}>
                  {cartItems.map((c) => (
                    <View key={c.posItem.id} style={s.cartItem}>
                      <Text style={s.cartItemTxt}>{c.posItem.emoji} {c.posItem.name} ×{c.qty}</Text>
                      <TouchableOpacity onPress={() => removeFromCart(c.posItem.id)}>
                        <Text style={s.cartRemove}>−</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={s.cartTotal}>₹{cartTotal}</Text>
            </View>
            <View style={s.cartActions}>
              <TouchableOpacity style={s.clearBtn} onPress={clearCart} activeOpacity={0.8}>
                <Text style={s.clearBtnTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setConfirmModal(true)} activeOpacity={0.88}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.chargeBtn}>
                  <Text style={s.chargeBtnTxt}>Charge  ₹{cartTotal}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Undo toast ── */}
        {showUndo && (
          <View style={s.toast}>
            <Text style={s.toastTxt}>✓  Sale recorded</Text>
            <TouchableOpacity onPress={handleUndo}>
              <Text style={s.undoTxt}>UNDO</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* ── Confirm modal ── */}
      <Modal visible={confirmModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Confirm Sale</Text>
            <Text style={s.modalSub}>{linkedBookingCustomer ? `Linked to: ${linkedBookingCustomer}` : 'Walk-in sale'}</Text>
            {cartItems.map((c) => (
              <View key={c.posItem.id} style={s.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalItemName}>{c.posItem.emoji}  {c.posItem.name}</Text>
                  <Text style={s.modalItemMeta}>₹{c.posItem.price} × {c.qty}</Text>
                </View>
                <Text style={s.modalItemPrice}>₹{c.qty * c.posItem.price}</Text>
              </View>
            ))}
            <View style={s.modalDivider} />
            <View style={s.modalRow}>
              <Text style={s.modalTotalLbl}>Total</Text>
              <Text style={s.modalTotal}>₹{cartTotal}</Text>
            </View>
            <TouchableOpacity onPress={handleConfirmSale} disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }} activeOpacity={0.88}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmBtn}>
                {saving ? <ActivityIndicator color={T.white} /> : <Text style={s.confirmBtnTxt}>Confirm &amp; Record</Text>}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bg },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 22, color: T.text, fontWeight: '400', marginTop: -2 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSub:    { fontSize: 11, color: T.text3, marginTop: 1 },
  invBtn:       { backgroundColor: T.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.border },
  invBtnTxt:    { fontSize: 12, fontWeight: '700', color: T.text2 },

  scroll:       { paddingTop: 12 },

  linkedBanner: { marginHorizontal: 16, marginBottom: 8, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.infoBg, borderRadius: 12, borderWidth: 1, borderColor: T.infoBd },
  linkedBannerTxt:{ fontSize: 13, fontWeight: '600', color: T.infoTxt },

  sectionHdr:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: T.text },

  loadingWrap:  { paddingVertical: 40, alignItems: 'center' },
  emptyWrap:    { paddingVertical: 24, alignItems: 'center' },
  emptyTxt:     { fontSize: 13, color: T.text3 },

  productsWrap: { gap: 10, marginHorizontal: 16, marginBottom: 24 },
  portraitRow:  { flexDirection: 'row', gap: 8 },
  landscapeRow: { flexDirection: 'row', gap: 10 },

  salesList:    { marginHorizontal: 16, gap: 16, marginBottom: 8 },

  dateDivider:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateLine:     { flex: 1, height: 1, backgroundColor: T.border },
  dateLbl:      { fontSize: 11, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Cart footer
  cartFooter:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 16, paddingTop: 14, shadowColor: 'rgba(0,0,0,0.10)', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 },
  cartTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cartCountLbl: { fontSize: 11, fontWeight: '700', color: T.text3, marginBottom: 4 },
  cartItemsList:{ gap: 4 },
  cartItem:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartItemTxt:  { fontSize: 13, color: T.text },
  cartRemove:   { fontSize: 18, color: T.redTxt, fontWeight: '700', paddingHorizontal: 4 },
  cartTotal:    { fontSize: 26, fontWeight: '900', color: T.text, fontVariant: ['tabular-nums'] },
  cartActions:  { flexDirection: 'row', gap: 10 },
  clearBtn:     { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, alignItems: 'center' },
  clearBtnTxt:  { fontSize: 14, fontWeight: '700', color: T.text2 },
  chargeBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  chargeBtnTxt: { color: T.white, fontSize: 15, fontWeight: '800' },

  toast:        { position: 'absolute', bottom: 100, left: 16, right: 16, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: T.border, shadowColor: 'rgba(0,0,0,0.12)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  toastTxt:     { color: T.text, fontSize: 13, fontWeight: '600' },
  undoTxt:      { color: T.grad0, fontSize: 13, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: T.border },
  modalHandle:  { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 2 },
  modalSub:     { fontSize: 13, color: T.text3, marginBottom: 16 },
  modalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  modalItemName:{ fontSize: 14, fontWeight: '600', color: T.text },
  modalItemMeta:{ fontSize: 12, color: T.text3, marginTop: 2 },
  modalItemPrice:{ fontSize: 14, fontWeight: '700', color: T.text },
  modalDivider: { height: 1, backgroundColor: T.border, marginVertical: 8 },
  modalTotalLbl:{ fontSize: 16, fontWeight: '700', color: T.text },
  modalTotal:   { fontSize: 22, fontWeight: '900', color: T.text, fontVariant: ['tabular-nums'] },
  confirmBtn:   { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  confirmBtnTxt:{ color: T.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:    { paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  cancelBtnTxt: { fontSize: 14, color: T.text3, fontWeight: '600' },
});
