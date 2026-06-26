import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { useStore } from '../store/useStore';
import { SportConfig, calculatePrice } from '../services/bookingService';
import {
  submitBookingRequest, upsertCustomerPhone, fetchCustomerPhone,
  fetchOnlineApprovalMode,
} from '../services/bookingRequestService';
import { releaseSlotHold } from '../services/holdService';
import {
  validateCoupon, incrementCouponUses, markSentCouponUsed,
  Coupon, SentCoupon,
} from '../services/couponService';
import { uploadFileToSupabase, mimeFromUri } from '../utils/uploadHelper';
import SportsDropdown from '../components/booking/SportsDropdown';
import RazorpayPaymentSheet from '../components/RazorpayPaymentSheet';

const QR_SOURCE = require('../../assets/payment_qr.png');

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#FAFAFC',
  surface: '#FFFFFF',
  grad0:   '#7C4DFF',
  grad1:   '#8B5CF6',
  grad2:   '#60A5FA',
  text:    '#1A1A1A',
  text2:   '#7B7B8A',
  text3:   '#AEAEBB',
  white:   '#FFFFFF',
  border:  'rgba(0,0,0,0.06)',
  purple:  '#7C4DFF',
  purpleBg:'rgba(124,77,255,0.09)',
  purpleBd:'rgba(124,77,255,0.20)',
  green:   '#10B981',
  greenBg: 'rgba(16,185,129,0.09)',
  greenBd: 'rgba(16,185,129,0.22)',
  red:     '#EF4444',
  redBg:   'rgba(239,68,68,0.07)',
  redBd:   'rgba(239,68,68,0.18)',
  blue:    '#3B82F6',
  blueBg:  'rgba(59,130,246,0.09)',
  blueBd:  'rgba(59,130,246,0.22)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

export interface BookingRequestModalProps {
  visible:           boolean;
  onClose:           () => void;
  onSuccess:         (autoBooked?: boolean) => void;
  holdId:            string | null;
  bookingDate:       string;
  turf:              string;
  slotLabel:         string;
  durationMinutes:   number;
  bookingSourceRole: 'owner' | 'staff' | 'customer';
  prefillName?:      string;
  prefillPhone?:     string;
}

export default function BookingRequestModal({
  visible, onClose, onSuccess,
  holdId, bookingDate, turf, slotLabel, durationMinutes,
  bookingSourceRole, prefillName, prefillPhone,
}: BookingRequestModalProps) {
  const { profile } = useStore();

  const isCustomer   = bookingSourceRole === 'customer';
  const isStaffOwner = bookingSourceRole === 'owner' || bookingSourceRole === 'staff';

  const [name, setName]                 = useState(prefillName ?? '');
  const [phone, setPhone]               = useState(prefillPhone ?? '');
  const [selectedSport, setSelectedSport] = useState<SportConfig | null>(null);
  const [advanceAmtStr, setAdvanceAmtStr] = useState('200');
  const [slotPriceStr, setSlotPriceStr]   = useState('');

  const [payMethod, setPayMethod] = useState<'cash' | 'online' | 'razorpay'>(isCustomer ? 'online' : 'cash');

  const [razorpaySheetVisible, setRazorpaySheetVisible]             = useState(false);
  const [razorpayBookingRequestId, setRazorpayBookingRequestId]     = useState<string | undefined>(undefined);

  const [screenshotUri, setScreenshotUri]   = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState<string>('image/jpeg');
  const [uploading, setUploading]           = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [approvalModeOn, setApprovalModeOn] = useState(true);

  const [couponCode, setCouponCode]           = useState('');
  const [validatingCoupon, setValidating]     = useState(false);
  const [appliedCoupon, setAppliedCoupon]     = useState<Coupon | null>(null);
  const [appliedSentCoupon, setAppliedSentCoupon] = useState<SentCoupon | null>(null);
  const [couponMessage, setCouponMessage]     = useState('');
  const [couponMsgType, setCouponMsgType]     = useState<'success' | 'error' | ''>('');
  const [discountAmount, setDiscountAmount]   = useState(0);

  useEffect(() => {
    if (!visible || !profile?.id) return;
    fetchCustomerPhone(profile.id).then((p) => { if (p) setPhone(p); });
    fetchOnlineApprovalMode().then(setApprovalModeOn);
    if (isCustomer) setPayMethod('online');
  }, [visible, profile?.id, isCustomer]);

  useEffect(() => {
    if (selectedSport) {
      const calc = calculatePrice(selectedSport.key, durationMinutes);
      setSlotPriceStr(String(calc));
    }
  }, [selectedSport, durationMinutes]);

  useEffect(() => {
    if (!visible) {
      setScreenshotUri(null); setSelectedSport(null); setSlotPriceStr('');
      if (isCustomer) setPayMethod('online'); else setPayMethod('cash');
      setRazorpaySheetVisible(false); setRazorpayBookingRequestId(undefined);
      setCouponCode(''); setAppliedCoupon(null); setAppliedSentCoupon(null);
      setCouponMessage(''); setCouponMsgType(''); setDiscountAmount(0);
      setAdvanceAmtStr('200');
    }
  }, [visible, isCustomer]);

  const basePrice    = parseInt(slotPriceStr) || 0;
  const advanceAmt   = parseInt(advanceAmtStr) || 0;
  const finalPrice   = Math.max(0, basePrice - discountAmount);

  const handlePickScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission Required', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setScreenshotUri(asset.uri);
      setScreenshotMime(mimeFromUri(asset.uri));
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) { Alert.alert('Enter Code', 'Please enter a coupon code.'); return; }
    if (!selectedSport)    { Alert.alert('Select Sport', 'Select a sport first.'); return; }
    setValidating(true);
    const result = await validateCoupon({ code: couponCode.trim(), bookingAmount: basePrice, customerId: profile?.id });
    setValidating(false);
    if (result.valid) {
      setAppliedCoupon(result.coupon); setAppliedSentCoupon(result.sentCoupon);
      setDiscountAmount(result.discountAmount); setCouponMessage(result.message); setCouponMsgType('success');
    } else {
      setAppliedCoupon(null); setAppliedSentCoupon(null); setDiscountAmount(0);
      setCouponMessage(result.message); setCouponMsgType('error');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null); setAppliedSentCoupon(null);
    setDiscountAmount(0); setCouponCode(''); setCouponMessage(''); setCouponMsgType('');
  };

  const handleClose = async () => {
    if (holdId) await releaseSlotHold(holdId);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim())   { Alert.alert('Required', 'Enter customer name.'); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { Alert.alert('Required', 'Phone number must be exactly 10 digits.'); return; }
    if (!selectedSport) { Alert.alert('Required', 'Select a sport.'); return; }
    if (isCustomer && payMethod === 'online' && !screenshotUri) {
      Alert.alert('Required', 'Please upload your payment screenshot.'); return;
    }
    if (payMethod === 'online' && !screenshotUri && isStaffOwner) {
      Alert.alert('Required', 'Please upload the payment screenshot.'); return;
    }

    setSubmitting(true);
    let screenshotUrl: string | null = null;

    if (screenshotUri && profile?.id && payMethod === 'online') {
      setUploading(true);
      const mime = screenshotMime;
      const ext  = mime.split('/')[1] ?? 'jpg';
      const path = `${profile!.id}/${Date.now()}.${ext}`;
      const { url, error: uploadError } = await uploadFileToSupabase({
        fileUri: screenshotUri!, bucket: 'payment-screenshots',
        path, mimeType: mime, upsert: false,
      });
      setUploading(false);
      if (uploadError || !url) {
        Alert.alert('Upload Failed', uploadError ?? 'Could not upload screenshot.');
        setSubmitting(false); return;
      }
      screenshotUrl = url;
    }

    if (profile?.id) await upsertCustomerPhone(profile.id, phone.trim());

    const { request, autoBooked, error } = await submitBookingRequest({
      customerId:        isCustomer ? (profile?.id ?? null) : null,
      customerName:      name.trim(),
      phone:             phone.trim(),
      bookingDate, turf, slotLabel,
      sport:             selectedSport!.key,
      paymentMethod:     payMethod,
      screenshotUrl,
      bookingSourceRole,
      createdBy:         profile?.id ?? null,
      advanceAmount:     advanceAmt,
    });

    setSubmitting(false);

    if (error) {
      if (error.includes('approval')) {
        Alert.alert('Booking Submitted', 'Your booking will be confirmed after owner review.');
        if (appliedSentCoupon) await markSentCouponUsed(appliedSentCoupon.id);
        else if (appliedCoupon) await incrementCouponUses(appliedCoupon.id);
        if (holdId) await releaseSlotHold(holdId);
        onSuccess(false); return;
      }
      Alert.alert('Error', error); return;
    }

    if (!request) { Alert.alert('Error', 'Could not submit request.'); return; }

    if (appliedSentCoupon) await markSentCouponUsed(appliedSentCoupon.id);
    else if (appliedCoupon) await incrementCouponUses(appliedCoupon.id);
    if (holdId) await releaseSlotHold(holdId);

    if (payMethod === 'razorpay') {
      setRazorpayBookingRequestId(request.id);
      setRazorpaySheetVisible(true);
      setSubmitting(false); return;
    }

    onSuccess(autoBooked);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <ScrollView
          contentContainerStyle={s.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.handle} />
          <Text style={s.title}>Booking Request</Text>

          {/* Slot summary */}
          <LinearGradient colors={[T.purpleBg, 'rgba(124,77,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.summaryBox}>
            <View style={s.summaryRow}><Text style={s.summaryTxt}>{bookingDate}</Text></View>
            <View style={s.summaryRow}><Text style={s.summaryTxt}>{slotLabel}</Text></View>
            <View style={s.summaryRow}><Text style={s.summaryTxt}>{turf}</Text></View>
          </LinearGradient>

          {isCustomer && (
            <View style={s.instantBanner}>
              <Text style={s.instantTxt}>⚡  Instant Booking — Confirmed immediately after upload.</Text>
            </View>
          )}

          <Text style={s.fieldLabel}>Full Name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName}
            placeholder="Enter customer's full name" placeholderTextColor={T.text3} autoCapitalize="words" />

          <Text style={s.fieldLabel}>Phone Number *</Text>
          <TextInput style={s.input} value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number" placeholderTextColor={T.text3}
            keyboardType="number-pad" maxLength={10} />

          {/* Sport */}
          <Text style={s.fieldLabel}>Select Sport *</Text>
          <SportsDropdown
            selected={selectedSport}
            onSelect={(sport) => { setSelectedSport(sport); if (appliedCoupon || appliedSentCoupon) removeCoupon(); }}
          />

          {/* Price breakdown — editable */}
          {selectedSport && (
            <View style={s.priceCard}>
              {/* Slot price (editable) */}
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Slot Price</Text>
                <View style={s.priceEditWrap}>
                  <Text style={s.rupee}>₹</Text>
                  <TextInput
                    style={[s.priceInput, (appliedCoupon || appliedSentCoupon) && s.strikeInput]}
                    value={slotPriceStr}
                    onChangeText={setSlotPriceStr}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                </View>
              </View>

              {(appliedCoupon || appliedSentCoupon) && (
                <>
                  <View style={[s.priceRow, { marginTop: 4 }]}>
                    <Text style={[s.priceLabel, { color: T.purple }]}>Coupon Discount</Text>
                    <Text style={[s.priceVal, { color: T.purple }]}>− ₹{discountAmount}</Text>
                  </View>
                  <View style={[s.priceRow, { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 }]}>
                    <Text style={[s.priceLabel, { fontWeight: '700', color: T.text }]}>Final Price</Text>
                    <Text style={[s.priceVal, { color: T.purple, fontWeight: '800' }]}>₹{finalPrice}</Text>
                  </View>
                </>
              )}

              {/* Advance amount (editable) */}
              <View style={[s.priceRow, s.advanceRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.advanceLabel}>Advance Required</Text>
                  <Text style={s.advanceSub}>Collected upfront from customer</Text>
                </View>
                <View style={s.priceEditWrap}>
                  <Text style={[s.rupee, { color: T.green }]}>₹</Text>
                  <TextInput
                    style={[s.priceInput, { color: T.green, minWidth: 54 }]}
                    value={advanceAmtStr}
                    onChangeText={setAdvanceAmtStr}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>
          )}

          {/* Coupon */}
          {selectedSport && (
            <>
              <Text style={s.fieldLabel}>Coupon Code (optional)</Text>
              {!(appliedCoupon || appliedSentCoupon) ? (
                <View style={s.couponRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={couponCode}
                    onChangeText={(t) => setCouponCode(t.toUpperCase())}
                    placeholder="Enter coupon code"
                    placeholderTextColor={T.text3}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[s.applyBtn, validatingCoupon && { opacity: 0.7 }]}
                    onPress={handleApplyCoupon} disabled={validatingCoupon}
                  >
                    {validatingCoupon
                      ? <ActivityIndicator color={T.white} size="small" />
                      : <Text style={s.applyBtnTxt}>Apply</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.appliedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.appliedCode}>{appliedCoupon?.code ?? appliedSentCoupon?.code}</Text>
                    <Text style={s.appliedDisc}>
                      {(appliedCoupon ?? appliedSentCoupon)?.discount_type === 'percent'
                        ? `${(appliedCoupon ?? appliedSentCoupon)?.discount_value}% off`
                        : `₹${(appliedCoupon ?? appliedSentCoupon)?.discount_value} off`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={removeCoupon}>
                    <Text style={s.removeCouponTxt}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!!couponMessage && (
                <View style={[s.couponMsg, couponMsgType === 'success' ? s.couponMsgOk : s.couponMsgErr]}>
                  <Text style={[s.couponMsgTxt, { color: couponMsgType === 'success' ? T.green : T.red }]}>
                    {couponMessage}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Payment method */}
          <Text style={s.fieldLabel}>Payment Method</Text>
          {isCustomer ? (
            <View style={[s.methodBtn, s.methodBtnActive]}>
              <Text style={[s.methodTxt, { color: T.purple }]}>📲  Online Payment Only</Text>
            </View>
          ) : (
            <View style={s.methodRow}>
              {(['cash', 'online'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.methodBtn, payMethod === m && s.methodBtnActive]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[s.methodTxt, payMethod === m && s.methodTxtActive]}>
                    {m === 'cash' ? '💵  Cash' : '📲  Online'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Online payment section */}
          {payMethod === 'online' && (
            <View style={s.onlineSection}>
              {!isCustomer && !approvalModeOn && (
                <View style={s.instantBanner}>
                  <Text style={s.instantTxt}>⚡  Instant Booking — Confirmed immediately after payment.</Text>
                </View>
              )}
              <View style={s.qrBox}>
                <Text style={s.qrLabel}>Scan to Pay ₹{advanceAmt} Advance</Text>
                <Image source={QR_SOURCE} style={s.qrImage} resizeMode="contain" />
                <Text style={s.qrUpi}>UPI ID: paytm.s1yynpn@pty</Text>
                <Text style={s.qrNote}>Pay exactly ₹{advanceAmt}. Screenshot required.</Text>
              </View>
              <TouchableOpacity style={[s.uploadBtn, screenshotUri && s.uploadBtnDone]} onPress={handlePickScreenshot}>
                <Text style={[s.uploadTxt, screenshotUri && { color: T.green }]}>
                  {screenshotUri ? '✓  Screenshot selected — tap to change' : '📷  Upload Payment Screenshot *'}
                </Text>
              </TouchableOpacity>
              {screenshotUri && (
                <Image source={{ uri: screenshotUri }} style={s.screenshotPreview} resizeMode="cover" />
              )}
              {uploading && (
                <View style={s.uploadingRow}>
                  <ActivityIndicator color={T.purple} size="small" />
                  <Text style={s.uploadingTxt}>Uploading screenshot…</Text>
                </View>
              )}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={{ marginTop: 20, opacity: (submitting || uploading) ? 0.7 : 1 }}
            onPress={handleSubmit} disabled={submitting || uploading} activeOpacity={0.88}
          >
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitBtn}>
              {submitting || uploading
                ? <ActivityIndicator color={T.white} />
                : <Text style={s.submitTxt}>{isCustomer ? '⚡ Book Slot Instantly' : 'Submit Booking Request'}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={handleClose} disabled={submitting}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <RazorpayPaymentSheet
        visible={razorpaySheetVisible}
        amountPaise={advanceAmt * 100}
        amountLabel={`₹${advanceAmt} (Advance)`}
        bookingRequestId={razorpayBookingRequestId}
        customerName={name}
        customerPhone={phone}
        description={`${slotLabel} • ${turf} • ${bookingDate}`}
        onSuccess={(_paymentId) => { setRazorpaySheetVisible(false); onSuccess(true); }}
        onFailure={(_error) => {}}
        onCancel={() => { setRazorpaySheetVisible(false); }}
        onClose={() => { setRazorpaySheetVisible(false); }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 52, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0 },
  handle:       { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: '800', color: T.text, marginBottom: 16, letterSpacing: -0.3 },

  summaryBox:   { borderRadius: 16, padding: 14, marginBottom: 14, gap: 6, borderWidth: 1, borderColor: T.purpleBd },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon:  { fontSize: 14, width: 22 },
  summaryTxt:   { fontSize: 14, fontWeight: '600', color: T.text },

  instantBanner:{ backgroundColor: T.greenBg, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.greenBd },
  instantTxt:   { fontSize: 13, fontWeight: '600', color: T.green, textAlign: 'center' },

  fieldLabel:   { fontSize: 11, fontWeight: '800', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  input:        { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: T.text },

  priceCard:    { backgroundColor: T.bg, borderRadius: 14, padding: 14, marginTop: 14, gap: 4, borderWidth: 1, borderColor: T.border },
  priceRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  priceLabel:   { fontSize: 14, color: T.text2 },
  priceVal:     { fontSize: 14, fontWeight: '700', color: T.text },
  priceEditWrap:{ flexDirection: 'row', alignItems: 'center', gap: 2 },
  rupee:        { fontSize: 14, fontWeight: '700', color: T.text },
  priceInput:   { fontSize: 15, fontWeight: '700', color: T.text, minWidth: 60, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: T.border, paddingVertical: 2 },
  strikeInput:  { textDecorationLine: 'line-through', color: T.text3 },
  advanceRow:   { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, marginTop: 4 },
  advanceLabel: { fontSize: 13, fontWeight: '700', color: T.green },
  advanceSub:   { fontSize: 11, color: T.text3, marginTop: 2 },

  couponRow:    { flexDirection: 'row', gap: 8 },
  applyBtn:     { backgroundColor: T.purple, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, justifyContent: 'center', alignItems: 'center' },
  applyBtnTxt:  { color: T.white, fontSize: 14, fontWeight: '700' },
  appliedRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.purpleBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.purpleBd },
  appliedCode:  { fontSize: 15, fontWeight: '800', color: T.purple },
  appliedDisc:  { fontSize: 12, color: T.text3, marginTop: 2 },
  removeCouponTxt:{ fontSize: 13, fontWeight: '600', color: T.red },
  couponMsg:    { borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1 },
  couponMsgOk:  { backgroundColor: T.greenBg, borderColor: T.greenBd },
  couponMsgErr: { backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.18)' },
  couponMsgTxt: { fontSize: 13, fontWeight: '600' },

  methodRow:    { flexDirection: 'row', gap: 10 },
  methodBtn:    { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, alignItems: 'center' },
  methodBtnActive:{ backgroundColor: T.purpleBg, borderColor: T.purpleBd },
  methodTxt:    { fontSize: 14, fontWeight: '600', color: T.text2 },
  methodTxtActive:{ color: T.purple },

  onlineSection:{ marginTop: 14, gap: 12 },
  qrBox:        { backgroundColor: T.surface, borderRadius: 16, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: T.purpleBd, shadowColor: T.purple, shadowOpacity: 0.10, shadowRadius: 12, elevation: 3 },
  qrLabel:      { fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 4 },
  qrImage:      { width: 200, height: 200 },
  qrUpi:        { fontSize: 13, fontWeight: '700', color: T.text, letterSpacing: 0.3 },
  qrNote:       { fontSize: 11, color: T.text3, textAlign: 'center' },
  uploadBtn:    { backgroundColor: T.blueBg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: T.blueBd },
  uploadBtnDone:{ backgroundColor: T.greenBg, borderColor: T.greenBd },
  uploadTxt:    { fontSize: 14, fontWeight: '600', color: T.blue },
  screenshotPreview:{ width: '100%', height: 160, borderRadius: 12, backgroundColor: T.bg },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  uploadingTxt: { fontSize: 13, color: T.text3 },

  submitBtn:    { borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: T.purple, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  submitTxt:    { fontSize: 16, fontWeight: '800', color: T.white },
  cancelBtn:    { paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  cancelTxt:    { fontSize: 14, color: T.text3, fontWeight: '600' },
});
