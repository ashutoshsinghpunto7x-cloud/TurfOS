// @ts-ignore
 
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
// react-native-razorpay is a native module — in Expo Go it is undefined.
// We load it defensively so the JS bundle doesn't crash on import.
let RazorpayCheckout: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RazorpayCheckout = require('react-native-razorpay').default ?? require('react-native-razorpay');
} catch (_e) {
  RazorpayCheckout = null;
}
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../services/razorpayService';
import { colors, radius } from '../theme/theme';

// ── Installation required ─────────────────────────────────────────────────
// npx expo install react-native-razorpay
// For managed workflow: this requires expo-dev-client or bare workflow.
// Or use the Razorpay custom tab approach (see fallback below).

interface Props {
  visible:           boolean;
  amountPaise:       number;       // e.g. 20000 for ₹200
  amountLabel:       string;       // e.g. "₹200 (Advance)"
  bookingRequestId?: string;
  bookingId?:        string;
  customerName:      string;
  customerEmail?:    string;
  customerPhone:     string;
  description:       string;
  onSuccess:         (paymentId: string) => void;
  onFailure:         (error: string) => void;
  onCancel:          () => void;
  onClose:           () => void;
}

type PaymentState =
  | 'idle'
  | 'creating_order'
  | 'payment_open'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'cancelled';

export default function RazorpayPaymentSheet({
  visible,
  amountPaise,
  amountLabel,
  bookingRequestId,
  bookingId,
  customerName,
  customerEmail,
  customerPhone,
  description,
  onSuccess,
  onFailure,
  onCancel,
  onClose,
}: Props) {
  const [state, setState]     = useState<PaymentState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Reset when modal reopens
  React.useEffect(() => {
    if (visible) { setState('idle'); setErrorMsg(''); }
  }, [visible]);

  // ── Main payment flow ─────────────────────────────────────────────────────

  const handlePayNow = async () => {
    if (state !== 'idle' && state !== 'failed' && state !== 'cancelled') return;

    // Guard: native module must be linked. Expo Go won't have it.
    if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
      const msg = 'Razorpay native module is not available. Rebuild the app with a custom dev client (expo prebuild + eas build) — Expo Go does not support Razorpay.';
      setErrorMsg(msg);
      setState('failed');
      onFailure(msg);
      return;
    }

    try {
      // Step 1 — Create order on backend
      setState('creating_order');

      const orderResult = await createRazorpayOrder({
        amountPaise,
        bookingRequestId,
        bookingId,
        notes: {
          description,
          customer: customerName,
          phone:    customerPhone,
        },
      });

      if (orderResult.error || !orderResult.orderId) {
        console.log('[Razorpay] createOrder failed:', orderResult);
        const msg = orderResult.error ?? 'Could not create payment order.';
        setErrorMsg(msg);
        setState('failed');
        onFailure(msg);
        return;
      }
      if (!orderResult.keyId) {
        const msg = 'Razorpay key_id missing from server response. Check RAZORPAY_KEY_ID secret in Supabase Edge Functions.';
        console.log('[Razorpay]', msg);
        setErrorMsg(msg);
        setState('failed');
        onFailure(msg);
        return;
      }

      // Step 2 — Open Razorpay checkout
      setState('payment_open');

      // Sanitize phone — Razorpay expects digits only (10-15 chars). Stripping
      // common separators avoids INVALID_REQUEST errors that surface as "Payment failed".
      const cleanPhone = (customerPhone ?? '').replace(/\D/g, '').slice(-10);

      const options: any = {
        description,
        currency:    orderResult.currency,
        key:         orderResult.keyId,
        amount:      String(orderResult.amount), // paise
        order_id:    orderResult.orderId,
        name:        'Playbox',
        prefill: {
          name:    customerName || 'Customer',
          email:   customerEmail || 'customer@playbox.app',
          contact: cleanPhone,
        },
        theme: { color: '#7c3aed' },
      };

      console.log('[Razorpay] opening checkout with', { ...options, key: '[hidden]' });

      let paymentData: any;
      try {
        paymentData = await RazorpayCheckout.open(options);
      } catch (rzpError: any) {
        // Log full error for debugging — Razorpay errors are notoriously opaque
        console.log('[Razorpay] checkout error:', JSON.stringify(rzpError));

        const code = rzpError?.code;
        const description: string =
          rzpError?.description ??
          rzpError?.error?.description ??
          rzpError?.message ??
          '';

        // Cancellation codes vary by platform / SDK version:
        //   Android: code = 0 or 2 ("PAYMENT_CANCELED")
        //   iOS:     code = 2 ("CHECKOUT_CANCELLED") or description contains "cancel"
        const isCancel =
          code === 0 ||
          code === 2 ||
          code === '0' ||
          code === '2' ||
          /cancel/i.test(description);

        if (isCancel) {
          setState('cancelled');
          onCancel();
          return;
        }

        const errMsg = description || `Payment failed (code: ${code ?? 'unknown'}). Please try again.`;
        setErrorMsg(errMsg);
        setState('failed');
        onFailure(errMsg);
        return;
      }

      // Defensive: some SDK versions resolve with empty/partial data on cancel
      if (!paymentData?.razorpay_payment_id || !paymentData?.razorpay_order_id || !paymentData?.razorpay_signature) {
        const errMsg = 'Payment did not complete. Missing payment details from Razorpay.';
        setErrorMsg(errMsg);
        setState('failed');
        onFailure(errMsg);
        return;
      }

      // Step 3 — Verify payment on backend (NEVER trust frontend alone)
      setState('verifying');

      const verifyResult = await verifyRazorpayPayment({
        razorpayOrderId:   paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      if (!verifyResult.success) {
        console.log('[Razorpay] verify failed:', verifyResult);
        const errMsg = verifyResult.error ?? 'Payment verification failed.';
        setErrorMsg(errMsg);
        setState('failed');
        onFailure(errMsg);
        return;
      }

      // Step 4 — Success only after backend verification
      setState('success');
      onSuccess(paymentData.razorpay_payment_id);

    } catch (err: any) {
      const errMsg = err?.message ?? 'An unexpected error occurred.';
      setErrorMsg(errMsg);
      setState('failed');
      onFailure(errMsg);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  const isProcessing = state === 'creating_order' || state === 'payment_open' || state === 'verifying';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <Text style={s.title}>Secure Payment</Text>
          <Text style={s.subtitle}>Powered by Razorpay</Text>

          {/* Amount */}
          <View style={s.amountBox}>
            <Text style={s.amountLabel}>Amount to Pay</Text>
            <Text style={s.amountValue}>{amountLabel}</Text>
          </View>

          {/* Description */}
          <Text style={s.desc}>{description}</Text>

          {/* State-based content */}
          {state === 'idle' && (
            <TouchableOpacity style={s.payBtn} onPress={handlePayNow} activeOpacity={0.85}>
              <Text style={s.payBtnText}>🔒  Pay Now with Razorpay</Text>
            </TouchableOpacity>
          )}

          {state === 'creating_order' && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.loadingText}>Creating secure payment order…</Text>
            </View>
          )}

          {state === 'payment_open' && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.loadingText}>Payment window is open…</Text>
              <Text style={s.loadingSubText}>Complete your payment in the Razorpay window</Text>
            </View>
          )}

          {state === 'verifying' && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.loadingText}>Verifying payment…</Text>
              <Text style={s.loadingSubText}>Please do not close the app</Text>
            </View>
          )}

          {state === 'success' && (
            <View style={s.successBox}>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.successTitle}>Payment Successful!</Text>
              <Text style={s.successSub}>Your payment has been verified and recorded.</Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {(state === 'failed') && (
            <View style={s.errorBox}>
              <Text style={s.errorIcon}>✗</Text>
              <Text style={s.errorTitle}>Payment Failed</Text>
              <Text style={s.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handlePayNow} activeOpacity={0.85}>
                <Text style={s.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {state === 'cancelled' && (
            <View style={s.errorBox}>
              <Text style={s.errorTitle}>Payment Cancelled</Text>
              <Text style={s.errorMsg}>You cancelled the payment.</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handlePayNow} activeOpacity={0.85}>
                <Text style={s.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Security note */}
          {!isProcessing && state !== 'success' && (
            <Text style={s.securityNote}>
              🔒 Secured by Razorpay. Your card/UPI details are never stored on our servers.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  handle:         { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:          { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 2 },
  subtitle:       { fontSize: 12, color: colors.text3, marginBottom: 20 },
  amountBox:      { backgroundColor: colors.accent2, borderRadius: radius.md, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.accent },
  amountLabel:    { fontSize: 11, fontWeight: '700', color: colors.accentText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  amountValue:    { fontSize: 28, fontWeight: '900', color: colors.accentText, fontVariant: ['tabular-nums'] },
  desc:           { fontSize: 13, color: colors.text2, marginBottom: 20, lineHeight: 18 },
  payBtn:         { backgroundColor: '#7c3aed', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', shadowColor: '#7c3aed', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  payBtnText:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  loadingBox:     { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText:    { fontSize: 15, fontWeight: '600', color: colors.text },
  loadingSubText: { fontSize: 12, color: colors.text3, textAlign: 'center' },
  successBox:     { alignItems: 'center', gap: 10, paddingVertical: 20 },
  successIcon:    { fontSize: 52, color: '#34d399', fontWeight: '900' },
  successTitle:   { fontSize: 20, fontWeight: '800', color: colors.text },
  successSub:     { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 18 },
  doneBtn:        { backgroundColor: '#34d399', borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  errorBox:       { alignItems: 'center', gap: 8, paddingVertical: 16 },
  errorIcon:      { fontSize: 40, color: colors.danger },
  errorTitle:     { fontSize: 18, fontWeight: '700', color: colors.text },
  errorMsg:       { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  retryBtn:       { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 32 },
  retryBtnText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn:      { paddingVertical: 10 },
  cancelBtnText:  { fontSize: 14, color: colors.text2, fontWeight: '600' },
  securityNote:   { fontSize: 11, color: colors.text3, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});