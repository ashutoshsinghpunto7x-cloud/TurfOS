import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal,
} from 'react-native';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../services/razorpayService';
import { colors, radius } from '../theme/theme';

// ── Razorpay Checkout.js loader (web only) ───────────────────────────────────
// Loads https://checkout.razorpay.com/v1/checkout.js once and caches the promise.
let checkoutPromise: Promise<boolean> | null = null;

function loadRazorpayCheckout(): Promise<boolean> {
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => { checkoutPromise = null; resolve(false); };
    document.body.appendChild(script);
  });
  return checkoutPromise;
}

interface Props {
  visible:           boolean;
  amountPaise:       number;
  amountLabel:       string;
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
  const [state, setState]       = useState<PaymentState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    if (visible) { setState('idle'); setErrorMsg(''); }
  }, [visible]);

  const handlePayNow = async () => {
    if (state !== 'idle' && state !== 'failed' && state !== 'cancelled') return;

    setState('creating_order');

    const ok = await loadRazorpayCheckout();
    if (!ok) {
      const msg = 'Could not load Razorpay Checkout. Check your internet connection.';
      setErrorMsg(msg); setState('failed'); onFailure(msg);
      return;
    }

    const orderResult = await createRazorpayOrder({
      amountPaise, bookingRequestId, bookingId,
      notes: { description, customer: customerName, phone: customerPhone },
    });

    if (orderResult.error || !orderResult.orderId) {
      console.log('[Razorpay-web] createOrder failed:', orderResult);
      const msg = orderResult.error ?? 'Could not create payment order.';
      setErrorMsg(msg); setState('failed'); onFailure(msg);
      return;
    }
    if (!orderResult.keyId) {
      const msg = 'Razorpay key_id missing from server response.';
      setErrorMsg(msg); setState('failed'); onFailure(msg);
      return;
    }

    setState('payment_open');

    const cleanPhone = (customerPhone ?? '').replace(/\D/g, '').slice(-10);

    const options = {
      key:         orderResult.keyId,
      amount:      orderResult.amount,
      currency:    orderResult.currency,
      order_id:    orderResult.orderId,
      name:        'Playbox',
      description,
      prefill: {
        name:    customerName || 'Customer',
        email:   customerEmail || 'customer@playbox.app',
        contact: cleanPhone,
      },
      theme: { color: '#7c3aed' },
      modal: {
        ondismiss: () => {
          setState('cancelled');
          onCancel();
        },
      },
      handler: async (response: any) => {
        setState('verifying');
        const verifyResult = await verifyRazorpayPayment({
          razorpayOrderId:   response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        if (!verifyResult.success) {
          const msg = verifyResult.error ?? 'Payment verification failed.';
          setErrorMsg(msg); setState('failed'); onFailure(msg);
          return;
        }
        setState('success');
        onSuccess(response.razorpay_payment_id);
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        console.log('[Razorpay-web] payment.failed:', resp);
        const msg = resp?.error?.description ?? 'Payment failed. Please try again.';
        setErrorMsg(msg); setState('failed'); onFailure(msg);
      });
      rzp.open();
    } catch (err: any) {
      const msg = err?.message ?? 'Could not open Razorpay checkout.';
      setErrorMsg(msg); setState('failed'); onFailure(msg);
    }
  };

  const isProcessing = state === 'creating_order' || state === 'payment_open' || state === 'verifying';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <Text style={s.title}>Secure Payment</Text>
          <Text style={s.subtitle}>Powered by Razorpay</Text>

          <View style={s.amountBox}>
            <Text style={s.amountLabel}>Amount to Pay</Text>
            <Text style={s.amountValue}>{amountLabel}</Text>
          </View>

          <Text style={s.desc}>{description}</Text>

          {state === 'idle' && (
            <TouchableOpacity style={s.payBtn} onPress={handlePayNow} activeOpacity={0.85}>
              <Text style={s.payBtnText}>🔒  Pay Now with Razorpay</Text>
            </TouchableOpacity>
          )}

          {(state === 'creating_order' || state === 'payment_open') && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.loadingText}>
                {state === 'creating_order' ? 'Creating secure payment order…' : 'Razorpay window is open…'}
              </Text>
            </View>
          )}

          {state === 'verifying' && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.loadingText}>Verifying payment…</Text>
            </View>
          )}

          {state === 'success' && (
            <View style={s.successBox}>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.successTitle}>Payment Successful!</Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {state === 'failed' && (
            <View style={s.errorBox}>
              <Text style={s.errorIcon}>✗</Text>
              <Text style={s.errorTitle}>Payment Failed</Text>
              <Text style={s.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handlePayNow}>
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
              <Text style={s.errorMsg}>You closed the payment window.</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handlePayNow}>
                <Text style={s.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isProcessing && state !== 'success' && (
            <Text style={s.securityNote}>
              🔒 Secured by Razorpay. Your payment details never touch our servers.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, maxWidth: 480, width: '100%', alignSelf: 'center' },
  handle:         { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:          { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 2 },
  subtitle:       { fontSize: 12, color: colors.text3, marginBottom: 20 },
  amountBox:      { backgroundColor: colors.accent2, borderRadius: radius.md, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.accent },
  amountLabel:    { fontSize: 11, fontWeight: '700', color: colors.accentText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  amountValue:    { fontSize: 28, fontWeight: '900', color: colors.accentText },
  desc:           { fontSize: 13, color: colors.text2, marginBottom: 20, lineHeight: 18 },
  payBtn:         { backgroundColor: '#7c3aed', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  payBtnText:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  loadingBox:     { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText:    { fontSize: 15, fontWeight: '600', color: colors.text },
  successBox:     { alignItems: 'center', gap: 10, paddingVertical: 20 },
  successIcon:    { fontSize: 52, color: '#34d399', fontWeight: '900' },
  successTitle:   { fontSize: 20, fontWeight: '800', color: colors.text },
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
