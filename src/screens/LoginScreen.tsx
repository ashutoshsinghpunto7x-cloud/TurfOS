import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, ScrollView, Animated, Easing, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { signInWithEmail, sendPasswordResetEmail } from '../services/authService';

const T = {
  bg: '#F5F3FF', surface: '#FFFFFF',
  purple: '#7C4DFF', purpleBg: 'rgba(124,77,255,0.09)', purpleBd: 'rgba(124,77,255,0.22)',
  text: '#1A1A1A', text2: '#7B7B8A', text3: '#AEAEBB',
  border: 'rgba(0,0,0,0.08)', borderStrong: 'rgba(0,0,0,0.14)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.08)', redBd: 'rgba(239,68,68,0.22)',
  white: '#FFFFFF',
};
const GRAD: [string, string, string] = ['#7C4DFF', '#8B5CF6', '#60A5FA'];

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType,
  autoCapitalize, returnKeyType, onSubmitEditing, autoComplete, rightLabel, onRightPress,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; secureTextEntry?: boolean; keyboardType?: any;
  autoCapitalize?: any; returnKeyType?: any; onSubmitEditing?: () => void;
  autoComplete?: any; rightLabel?: string; onRightPress?: () => void;
}) {
  return (
    <View style={f.wrap}>
      <View style={f.labelRow}>
        <Text style={f.label}>{label}</Text>
        {rightLabel && (
          <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
            <Text style={f.rightLabel}>{rightLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={f.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.text3}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoComplete={autoComplete}
      />
    </View>
  );
}

const f = StyleSheet.create({
  wrap:      { marginBottom: 14 },
  labelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label:     { fontSize: 12, fontWeight: '700', color: T.text2, letterSpacing: 0.3 },
  rightLabel:{ fontSize: 12, fontWeight: '600', color: T.purple },
  input:     { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: T.text },
});

export default function LoginScreen() {
  const navigation     = useNavigation<any>();
  const insets         = useSafeAreaInsets();
  const { setProfile } = useStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotMode, setForgotMode]     = useState(false);
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    setErrorMsg('');
    const e = email.trim().toLowerCase();
    if (!e)        { setErrorMsg('Please enter your email address.'); return; }
    if (!password) { setErrorMsg('Please enter your password.'); return; }
    setLoading(true);
    const result = await signInWithEmail(e, password);
    setLoading(false);
    if (result.error || !result.profile) {
      setErrorMsg(result.error ?? 'Could not sign in. Please try again.');
      return;
    }
    setProfile(result.profile);
  };

  const handleForgot = async () => {
    const e = forgotEmail.trim().toLowerCase();
    if (!e) { Alert.alert('Required', 'Enter your email address.'); return; }
    setForgotLoading(true);
    const { error } = await sendPasswordResetEmail(e);
    setForgotLoading(false);
    if (error) { Alert.alert('Error', error); return; }
    Alert.alert('Link Sent', `A password reset link was sent to ${e}.\nCheck your inbox (and spam folder).`);
    setForgotMode(false); setForgotEmail('');
  };

  return (
    <View style={s.root}>
      {/* Gradient accent strip at top */}
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.topStrip, { paddingTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>{forgotMode ? 'Reset Password' : 'Sign In'}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {forgotMode ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Reset Password</Text>
                <Text style={s.cardSub}>Enter your email to receive a reset link</Text>
                <Field
                  label="Email Address" value={forgotEmail} onChangeText={setForgotEmail}
                  placeholder="you@example.com" keyboardType="email-address"
                />
                <TouchableOpacity
                  style={[s.submitWrap, forgotLoading && { opacity: 0.7 }]}
                  onPress={handleForgot} disabled={forgotLoading} activeOpacity={0.88}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitBtn}>
                    {forgotLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.submitTxt}>Send Reset Link</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkRow} onPress={() => setForgotMode(false)}>
                  <Text style={s.linkTxt}>← Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.card}>
                <Text style={s.cardTitle}>Welcome back</Text>
                <Text style={s.cardSub}>Sign in to your Turf OS account</Text>

                {!!errorMsg && (
                  <View style={s.errorBox}>
                    <Text style={s.errorTxt}>{errorMsg}</Text>
                  </View>
                )}

                <Field
                  label="Email Address" value={email}
                  onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                  placeholder="you@example.com" keyboardType="email-address"
                  autoComplete="email"
                />

                <Field
                  label="Password" value={showPw ? password : password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                  placeholder="Your password" secureTextEntry={!showPw}
                  returnKeyType="done" onSubmitEditing={handleLogin}
                  autoComplete="password"
                  rightLabel={showPw ? 'Hide' : 'Show'}
                  onRightPress={() => setShowPw((v) => !v)}
                />

                <TouchableOpacity
                  style={s.forgotRow}
                  onPress={() => { setForgotMode(true); setForgotEmail(email.trim()); }}
                >
                  <Text style={s.forgotTxt}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.submitWrap, loading && { opacity: 0.7 }]}
                  onPress={handleLogin} disabled={loading} activeOpacity={0.88}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.submitTxt}>Sign In</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={s.divRow}>
                  <View style={s.divLine} /><Text style={s.divTxt}>or</Text><View style={s.divLine} />
                </View>

                <TouchableOpacity style={s.createBtn} onPress={() => { setErrorMsg(''); navigation.navigate('Signup'); }} activeOpacity={0.8}>
                  <Text style={s.createTxt}>Create Account</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tips */}
            <View style={s.tipBox}>
              <Text style={s.tipTitle}>Having trouble signing in?</Text>
              <Text style={s.tipTxt}>
                1. Complete signup and confirm your email{'\n'}
                2. Click the confirmation link in your inbox{'\n'}
                3. Passwords are case-sensitive — check caps lock
              </Text>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: T.bg },

  topStrip:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: T.white, fontWeight: '600', lineHeight: 28 },
  topTitle:  { fontSize: 17, fontWeight: '800', color: T.white },

  scroll:    { padding: 20 },

  card:      { backgroundColor: T.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { fontSize: 24, fontWeight: '900', color: T.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: T.text2, marginBottom: 20 },

  errorBox:  { backgroundColor: T.redBg, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: T.redBd },
  errorTxt:  { fontSize: 13, color: T.red, lineHeight: 18 },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -6 },
  forgotTxt: { fontSize: 13, color: T.purple, fontWeight: '600' },

  submitWrap:{ borderRadius: 16, overflow: 'hidden', marginTop: 4, marginBottom: 4 },
  submitBtn: { paddingVertical: 16, alignItems: 'center' },
  submitTxt: { fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 0.3 },

  divRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  divLine:   { flex: 1, height: 1, backgroundColor: T.border },
  divTxt:    { fontSize: 12, color: T.text3, fontWeight: '500' },

  createBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: T.purpleBd, backgroundColor: T.purpleBg, alignItems: 'center' },
  createTxt: { fontSize: 15, fontWeight: '700', color: T.purple },

  linkRow:   { paddingTop: 8, alignItems: 'center' },
  linkTxt:   { fontSize: 14, color: T.purple, fontWeight: '600' },

  tipBox:    { backgroundColor: T.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: T.border, gap: 6 },
  tipTitle:  { fontSize: 13, fontWeight: '700', color: T.text2 },
  tipTxt:    { fontSize: 12, color: T.text3, lineHeight: 20 },
});
