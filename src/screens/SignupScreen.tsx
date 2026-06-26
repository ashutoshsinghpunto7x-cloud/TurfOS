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
import { signUpCustomer } from '../services/authService';

// NOTE: Staff and owners sign up here just like customers.
// They get role 'customer' initially.
// The turf owner then promotes their role via the Customers screen.

const T = {
  bg: '#F5F3FF', surface: '#FFFFFF',
  purple: '#7C4DFF', purpleBg: 'rgba(124,77,255,0.09)', purpleBd: 'rgba(124,77,255,0.22)',
  text: '#1A1A1A', text2: '#7B7B8A', text3: '#AEAEBB',
  border: 'rgba(0,0,0,0.08)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.08)', redBd: 'rgba(239,68,68,0.22)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.08)', greenBd: 'rgba(22,163,74,0.22)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.08)', amberBd: 'rgba(217,119,6,0.22)',
  white: '#FFFFFF',
};
const GRAD: [string, string, string] = ['#7C4DFF', '#8B5CF6', '#60A5FA'];

type Step = 'details' | 'role';
type Role = 'customer' | 'staff' | 'owner';

const ROLES: { key: Role; icon: string; label: string; sub: string; note?: string; accent: string; accentBg: string; accentBd: string }[] = [
  {
    key: 'customer', icon: '👤', label: 'Customer',
    sub: 'Book slots, view bookings, manage payments',
    accent: T.purple, accentBg: T.purpleBg, accentBd: T.purpleBd,
  },
  {
    key: 'staff', icon: '🧑‍💼', label: 'Staff',
    sub: 'Manage turf operations, confirm bookings',
    note: 'You will sign up as a regular user. The turf owner will promote your role to Staff.',
    accent: T.green, accentBg: T.greenBg, accentBd: T.greenBd,
  },
  {
    key: 'owner', icon: '👑', label: 'Turf Owner',
    sub: 'Full management access — bookings, staff, reports',
    note: 'You will sign up as a regular user. Contact the platform admin to set your role to Owner.',
    accent: T.amber, accentBg: T.amberBg, accentBd: T.amberBd,
  },
];

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

export default function SignupScreen() {
  const navigation     = useNavigation<any>();
  const insets         = useSafeAreaInsets();
  const { setProfile } = useStore();

  const [step, setStep]           = useState<Step>('details');
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [role, setRole]           = useState<Role>('customer');
  const [loading, setLoading]     = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const runEntrance = () => {
    fadeAnim.setValue(0); slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { runEntrance(); }, []);

  const handleContinue = () => {
    if (!fullName.trim())             { Alert.alert('Required', 'Enter your full name.'); return; }
    if (!email.trim().includes('@'))  { Alert.alert('Invalid Email', 'Enter a valid email address.'); return; }
    if (password.length < 6)         { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    if (password !== confirmPw)      { Alert.alert('Password Mismatch', 'Passwords do not match.'); return; }
    setStep('role'); runEntrance();
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { profile, error } = await signUpCustomer({
      email:    email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      role:     'customer',
    });
    setLoading(false);

    if (error === 'CONFIRM_EMAIL') {
      Alert.alert(
        '📧 Verify Your Email',
        `A confirmation link was sent to:\n${email.trim().toLowerCase()}\n\nClick the link in your inbox, then sign in.${role !== 'customer' ? `\n\nAfter signing in, contact your turf owner to have your role updated to ${role}.` : ''}`,
        [{ text: 'Go to Sign In', onPress: () => navigation.navigate('Login') }],
      );
      return;
    }
    if (error) { Alert.alert('Signup Failed', error); return; }
    if (!profile) { Alert.alert('Error', 'Could not create your account. Please try again.'); return; }
    if (role !== 'customer') {
      Alert.alert('✓ Account Created!', `Your account was created.\n\nAsk your turf owner to promote your role to ${role} after you sign in.`);
    }
    setProfile(profile);
  };

  const stepTitle = step === 'details' ? 'Create Account' : 'Choose Your Role';

  return (
    <View style={s.root}>
      {/* Gradient header strip */}
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.topStrip, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { if (step === 'role') { setStep('details'); runEntrance(); } else navigation.goBack(); }}
          activeOpacity={0.8}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={s.topTitle}>{stepTitle}</Text>

        {/* Step indicator */}
        <View style={s.stepRow}>
          <View style={[s.stepDot, step === 'details' && s.stepDotActive]} />
          <View style={s.stepLine} />
          <View style={[s.stepDot, step === 'role' && s.stepDotActive]} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            <Text style={s.cardTitle}>{step === 'details' ? 'Your Details' : 'Select Role'}</Text>
            <Text style={s.cardSub}>{step === 'details' ? 'Fill in your information to get started' : 'Choose the role that best describes you'}</Text>

            {step === 'details' ? (
              <View style={s.card}>
                <Field
                  label="Full Name" value={fullName}
                  onChangeText={setFullName} placeholder="Your full name"
                  autoCapitalize="words"
                />
                <Field
                  label="Email Address" value={email}
                  onChangeText={setEmail} placeholder="you@example.com"
                  keyboardType="email-address" autoComplete="email"
                />
                <Field
                  label="Password" value={password}
                  onChangeText={setPassword} placeholder="At least 6 characters"
                  secureTextEntry={!showPw}
                  rightLabel={showPw ? 'Hide' : 'Show'}
                  onRightPress={() => setShowPw(v => !v)}
                />
                <Field
                  label="Confirm Password" value={confirmPw}
                  onChangeText={setConfirmPw} placeholder="Repeat password"
                  secureTextEntry={!showPw}
                  returnKeyType="done" onSubmitEditing={handleContinue}
                />
                <TouchableOpacity style={s.submitWrap} onPress={handleContinue} activeOpacity={0.88}>
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitBtn}>
                    <Text style={s.submitTxt}>Continue →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.card}>
                <View style={s.roleHintBox}>
                  <Text style={s.roleHintTxt}>
                    All users start with a standard account. Staff and owner roles are assigned by the turf owner after sign-in.
                  </Text>
                </View>

                {ROLES.map((r) => {
                  const active = role === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[s.roleCard, active && { backgroundColor: r.accentBg, borderColor: r.accentBd }]}
                      onPress={() => setRole(r.key)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.roleIconWrap, active && { backgroundColor: r.accentBg }]}>
                        <Text style={s.roleIconTxt}>{r.icon}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.roleLabel, active && { color: r.accent }]}>{r.label}</Text>
                        <Text style={s.roleSub}>{r.sub}</Text>
                        {r.note && active && (
                          <View style={[s.roleNote, { backgroundColor: r.amberBg ?? T.amberBg, borderColor: r.accentBd }]}>
                            <Text style={[s.roleNoteTxt, { color: r.accent }]}>ℹ️  {r.note}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[s.checkCircle, active && { backgroundColor: r.accent, borderColor: r.accent }]}>
                        {active && <Text style={s.checkTick}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[s.submitWrap, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit} disabled={loading} activeOpacity={0.88}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.submitTxt}>{role === 'customer' ? '🚀  Create Account' : '📝  Sign Up & Request Role'}</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.signinRow} onPress={() => navigation.navigate('Login')}>
              <Text style={s.signinTxt}>Already have an account?  </Text>
              <Text style={s.signinLink}>Sign In</Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  topStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: T.white, fontWeight: '600', lineHeight: 28 },
  topTitle:  { fontSize: 17, fontWeight: '800', color: T.white },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#FFFFFF', width: 22, borderRadius: 4 },
  stepLine:  { width: 16, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },

  scroll:    { padding: 20 },

  cardTitle: { fontSize: 24, fontWeight: '900', color: T.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: T.text2, marginBottom: 16 },

  card: {
    backgroundColor: T.surface, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: T.border, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },

  submitWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 6 },
  submitBtn:  { paddingVertical: 16, alignItems: 'center' },
  submitTxt:  { fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 0.3 },

  roleHintBox: {
    backgroundColor: T.purpleBg, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: T.purpleBd, marginBottom: 14,
  },
  roleHintTxt: { fontSize: 12, color: T.text2, lineHeight: 18 },

  roleCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: T.bg, borderRadius: 16, borderWidth: 1.5,
    borderColor: T.border, padding: 14, marginBottom: 10,
  },
  roleIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  roleIconTxt:  { fontSize: 22 },
  roleLabel:    { fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 2 },
  roleSub:      { fontSize: 12, color: T.text2, lineHeight: 17 },
  roleNote:     { marginTop: 8, borderRadius: 10, padding: 10, borderWidth: 1 },
  roleNoteTxt:  { fontSize: 11, lineHeight: 16 },
  checkCircle:  { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkTick:    { fontSize: 11, color: T.white, fontWeight: '900' },

  signinRow:  { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  signinTxt:  { fontSize: 14, color: T.text2 },
  signinLink: { fontSize: 14, color: T.purple, fontWeight: '700' },
});
