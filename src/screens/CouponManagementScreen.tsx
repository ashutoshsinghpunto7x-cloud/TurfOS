import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchCoupons, createCoupon, toggleCoupon, deleteCoupon, Coupon,
} from '../services/couponService';
import { useStore } from '../store/useStore';
import { colors, radius } from '../theme/theme';

export default function CouponManagementScreen() {
  const { profile } = useStore();
  const [coupons, setCoupons]   = useState<Coupon[]>([]);
  const [loading, setLoading]   = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [code, setCode]                   = useState('');
  const [discountType, setDiscountType]   = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minAmount, setMinAmount]         = useState('0');
  const [maxUses, setMaxUses]             = useState('');
  const [validUntil, setValidUntil]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { coupons: fetched } = await fetchCoupons();
    setCoupons(fetched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setCode(''); setDiscountType('percent'); setDiscountValue('');
    setMinAmount('0'); setMaxUses(''); setValidUntil('');
  };

  const handleCreate = async () => {
    if (!code.trim()) { Alert.alert('Required', 'Enter a coupon code.'); return; }
    const val = parseFloat(discountValue);
    if (!val || val <= 0) { Alert.alert('Required', 'Enter a valid discount value.'); return; }
    if (discountType === 'percent' && val > 100) { Alert.alert('Invalid', 'Percent cannot exceed 100.'); return; }

    setSaving(true);
    const { coupon, error } = await createCoupon({
      code:             code.trim(),
      discountType,
      discountValue:    val,
      minBookingAmount: parseFloat(minAmount) || 0,
      maxUses:          maxUses ? parseInt(maxUses) : null,
      validFrom:        new Date().toISOString().slice(0, 10),
      validUntil:       validUntil.trim() || null,
      createdBy:        profile?.id ?? null,
    });
    setSaving(false);

    if (error) { Alert.alert('Error', error); return; }
    setCoupons((prev) => [coupon!, ...prev]);
    setAddModal(false);
    resetForm();
  };

  const handleToggle = async (coupon: Coupon) => {
    const { error } = await toggleCoupon(coupon.id, !coupon.is_active);
    if (error) { Alert.alert('Error', error); return; }
    setCoupons((prev) => prev.map((c) =>
      c.id === coupon.id ? { ...c, is_active: !c.is_active } : c,
    ));
  };

  const handleDelete = (coupon: Coupon) => {
    Alert.alert('Delete Coupon', `Delete code "${coupon.code}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await deleteCoupon(coupon.id);
          if (error) { Alert.alert('Error', error); return; }
          setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Coupon Codes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : coupons.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🏷️</Text>
          <Text style={styles.emptyText}>No coupons yet. Tap + New to create one.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {coupons.map((c) => (
            <View key={c.id} style={styles.couponCard}>
              <View style={styles.couponTop}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{c.code}</Text>
                </View>
                <View style={styles.couponRight}>
                  <Text style={styles.discountText}>
                    {c.discount_type === 'percent'
                      ? `${c.discount_value}% off`
                      : `₹${c.discount_value} off`}
                  </Text>
                  <Switch
                    value={c.is_active}
                    onValueChange={() => handleToggle(c)}
                    trackColor={{ true: colors.accent }}
                  />
                </View>
              </View>
              <View style={styles.couponMeta}>
                {c.min_booking_amount > 0 && (
                  <Text style={styles.metaText}>Min ₹{c.min_booking_amount}</Text>
                )}
                {c.max_uses !== null && (
                  <Text style={styles.metaText}>{c.uses_count}/{c.max_uses} used</Text>
                )}
                {c.valid_until && (
                  <Text style={styles.metaText}>Expires {c.valid_until}</Text>
                )}
                {!c.is_active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.deleteRow} onPress={() => handleDelete(c)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create coupon modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Coupon</Text>

            <Text style={styles.fieldLabel}>Coupon Code *</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="e.g. PLAY20"
              placeholderTextColor={colors.text3}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Discount Type *</Text>
            <View style={styles.typeRow}>
              {(['percent', 'fixed'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, discountType === t && styles.typeBtnActive]}
                  onPress={() => setDiscountType(t)}
                >
                  <Text style={[styles.typeBtnText, discountType === t && { color: '#fff' }]}>
                    {t === 'percent' ? '% Percentage' : '₹ Fixed Amount'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              {discountType === 'percent' ? 'Discount % *' : 'Discount Amount (₹) *'}
            </Text>
            <TextInput
              style={styles.input}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 200'}
              placeholderTextColor={colors.text3}
            />

            <Text style={styles.fieldLabel}>Minimum Booking Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={minAmount}
              onChangeText={setMinAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.text3}
            />

            <Text style={styles.fieldLabel}>Max Uses (leave blank for unlimited)</Text>
            <TextInput
              style={styles.input}
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
              placeholder="Unlimited"
              placeholderTextColor={colors.text3}
            />

            <Text style={styles.fieldLabel}>Valid Until (YYYY-MM-DD, optional)</Text>
            <TextInput
              style={styles.input}
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="No expiry"
              placeholderTextColor={colors.text3}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Create Coupon</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddModal(false); resetForm(); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bg },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:          { fontSize: 18, fontWeight: '700', color: colors.text },
  addBtn:         { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyIcon:      { fontSize: 36 },
  emptyText:      { fontSize: 14, color: colors.text2, textAlign: 'center' },
  couponCard:     { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginTop: 12, padding: 16 },
  couponTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  codeBox:        { backgroundColor: colors.accent2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  codeText:       { fontSize: 16, fontWeight: '800', color: colors.accentText, letterSpacing: 1 },
  couponRight:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  discountText:   { fontSize: 15, fontWeight: '700', color: colors.text },
  couponMeta:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaText:       { fontSize: 12, color: colors.text3, fontWeight: '500' },
  inactiveBadge:  { backgroundColor: colors.dangerBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '600', color: colors.danger },
  deleteRow:      { alignItems: 'flex-end' },
  deleteText:     { fontSize: 13, color: colors.danger, fontWeight: '600' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHandle:    { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input:          { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text },
  typeRow:        { flexDirection: 'row', gap: 10 },
  typeBtn:        { flex: 1, paddingVertical: 11, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center' },
  typeBtnActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  typeBtnText:    { fontSize: 13, fontWeight: '600', color: colors.text2 },
  confirmBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn:      { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:  { fontSize: 14, color: colors.text2, fontWeight: '600' },
});