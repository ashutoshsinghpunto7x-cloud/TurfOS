import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Easing, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

const GRAD: [string, string, string] = ['#6B47E8', '#7B5CF6', '#4FA8F0'];

/* ─── Dot grid ─────────────────────────────────────────────────────────── */
function DotGrid() {
  const rows = 4, cols = 5;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={{
                width: 3, height: 3, borderRadius: 1.5,
                backgroundColor: 'rgba(110,80,210,0.12)',
                margin: 6,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─── Purple orb (layered circles → soft glow without blur library) ───── */
function Orb() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{
        position: 'absolute', right: -60, top: -10,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(140,100,230,0.05)',
      }} />
      <View style={{
        position: 'absolute', right: -48, top: 2,
        width: 175, height: 175, borderRadius: 88,
        backgroundColor: 'rgba(140,100,230,0.07)',
      }} />
      <View style={{
        position: 'absolute', right: -36, top: 14,
        width: 150, height: 150, borderRadius: 75,
        backgroundColor: 'rgba(140,100,230,0.09)',
      }} />
      <View style={{
        position: 'absolute', right: -24, top: 26,
        width: 125, height: 125, borderRadius: 63,
        backgroundColor: 'rgba(140,100,230,0.11)',
      }} />
    </View>
  );
}

/* ─── Wave SVG ──────────────────────────────────────────────────────────── */
function Wave() {
  return (
    <Svg
      width={W} height={72}
      viewBox={`0 0 ${W} 72`}
      style={{ marginTop: -2, display: 'flex' }}
      preserveAspectRatio="none"
    >
      {/* Back-wave (lighter lavender layer) */}
      <Path
        d={`M0 28 C${W*0.15} 5,${W*0.35} 52,${W*0.55} 22 S${W*0.85} -4,${W} 28 L${W} 72 L0 72 Z`}
        fill="rgba(180,160,255,0.30)"
      />
      {/* Front-wave (main gradient colour) */}
      <Path
        d={`M0 44 C${W*0.20} 14,${W*0.40} 62,${W*0.60} 32 S${W*0.82} 8,${W} 44 L${W} 72 L0 72 Z`}
        fill="#6B47E8"
      />
    </Svg>
  );
}

/* ─── Turf oval decoration ──────────────────────────────────────────────── */
function TurfOvals() {
  const cx = W * 0.42, cy = 52;
  return (
    <Svg width={W} height={104} style={{ position: 'absolute', right: -10, bottom: '22%' }} pointerEvents="none">
      <Ellipse cx={cx} cy={cy} rx={W*0.38} ry={38} stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} fill="none" />
      <Ellipse cx={cx} cy={cy} rx={W*0.26} ry={24} stroke="rgba(255,255,255,0.10)" strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

/* ─── Screen ────────────────────────────────────────────────────────────── */
export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();

  const fadeTop  = useRef(new Animated.Value(0)).current;
  const fadeBot  = useRef(new Animated.Value(0)).current;
  const slideBot = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeTop, {
        toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeBot,  { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideBot, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={s.root}>

      {/* ════════════════════════════════════════════════
          TOP — white/lavender section
      ════════════════════════════════════════════════ */}
      <Animated.View style={[s.top, { paddingTop: insets.top + 20, opacity: fadeTop }]}>

        {/* Purple orb — top right */}
        <Orb />

        {/* Dot grid — top left */}
        <DotGrid />

        <Image
          source={require('../../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />

        {/* PLAY + BOX */}
        <View style={s.brandRow}>
          <Text style={s.brandDark}>PLAY</Text>
          <Text style={s.brandGreen}>BOX</Text>
        </View>

        {/* Tagline */}
        <Text style={s.tagline}>
          RUN YOUR TURF.{'  '}
          <Text style={s.taglineAccent}>SMARTER.</Text>
        </Text>
      </Animated.View>

      {/* ════════════════════════════════════════════════
          WAVE
      ════════════════════════════════════════════════ */}
      <Wave />

      {/* ════════════════════════════════════════════════
          BOTTOM — gradient section
      ════════════════════════════════════════════════ */}
      <LinearGradient
        colors={GRAD}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}
      >
        {/* Turf oval lines decoration */}
        <TurfOvals />

        <Animated.View style={{ opacity: fadeBot, transform: [{ translateY: slideBot }] }}>

          <Text style={s.welcomeTo}>Welcome to</Text>
          <View style={s.botBrandRow}>
            <Text style={s.botBrandWhite}>PLAY</Text>
            <Text style={s.botBrandGreen}>BOX</Text>
          </View>
          <Text style={s.welcomeSub}>
            The all-in-one solution to manage,{'\n'}book and grow your turf business.
          </Text>

          {/* ── Log In ── */}
          <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
            <View style={s.loginIconWrap}>
              <Text style={s.iconEmoji}>👤</Text>
            </View>
            <Text style={s.loginTxt}>Log In</Text>
            <Text style={s.loginArrow}>→</Text>
          </TouchableOpacity>

          {/* ── Sign Up ── */}
          <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup')} activeOpacity={0.85}>
            <View style={s.signupIconWrap}>
              <Text style={s.iconEmoji}>👤</Text>
            </View>
            <Text style={s.signupTxt}>Sign Up</Text>
            <Text style={s.signupArrow}>→</Text>
          </TouchableOpacity>

          <Text style={s.terms}>
            By continuing, you agree to our{' '}
            <Text style={s.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={s.termsLink}>Privacy Policy</Text>.
          </Text>

        </Animated.View>
      </LinearGradient>

    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const TOP_H = H * 0.44;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDE9FF' },

  /* ── Top ── */
  top: {
    height: TOP_H,
    backgroundColor: '#EDE9FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  logo: { width: 148, height: 148 },
  brandRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  brandDark:  { fontSize: 34, fontWeight: '900', color: '#1A1A1A', letterSpacing: 1.5 },
  brandGreen: { fontSize: 34, fontWeight: '900', color: '#6BBF2F', letterSpacing: 1.5 },
  tagline:    { fontSize: 12, fontWeight: '700', color: '#9090A8', letterSpacing: 2.2, marginTop: 6 },
  taglineAccent: { color: '#7C4DFF', fontWeight: '800' },

  /* ── Bottom ── */
  bottom: { flex: 1, paddingHorizontal: 22, paddingTop: 8, justifyContent: 'center' },

  welcomeTo:     { fontSize: 14, color: 'rgba(255,255,255,0.78)', fontWeight: '500', marginBottom: 2 },
  botBrandRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  botBrandWhite: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  botBrandGreen: { fontSize: 42, fontWeight: '900', color: '#A3E635', letterSpacing: 1 },
  welcomeSub:    { fontSize: 14, color: 'rgba(255,255,255,0.70)', lineHeight: 22, marginBottom: 20 },

  /* Log In */
  loginBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 50,
    paddingVertical: 13, paddingHorizontal: 16, marginBottom: 11,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  loginIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(107,71,232,0.12)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  loginTxt:   { flex: 1, fontSize: 16, fontWeight: '700', color: '#6B47E8' },
  loginArrow: { fontSize: 20, color: '#6B47E8', fontWeight: '700' },

  /* Sign Up */
  signupBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 50, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.40)',
    paddingVertical: 13, paddingHorizontal: 16,
    marginBottom: 18, backgroundColor: 'rgba(255,255,255,0.10)',
  },
  signupIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  signupTxt:   { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  signupArrow: { fontSize: 20, color: '#FFFFFF', fontWeight: '700' },

  iconEmoji: { fontSize: 17 },

  /* Terms */
  terms:    { fontSize: 11, color: 'rgba(255,255,255,0.50)', textAlign: 'center', lineHeight: 17 },
  termsLink:{ color: 'rgba(255,255,255,0.80)', fontWeight: '600' },
});
