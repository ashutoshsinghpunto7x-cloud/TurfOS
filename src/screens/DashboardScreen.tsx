import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Animated, Easing,
  Alert, Dimensions, Modal, Switch, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Circle, Line, Defs,
  LinearGradient as SvgGrad, Stop,
} from 'react-native-svg';
import {
  Menu, Search, Bell, Calendar, Users, IndianRupee,
  Package, Trophy, BarChart2, Tag, ClipboardList, UserCheck,
  Settings, ChevronDown, TrendingUp, AlertCircle, ArrowUpRight,
} from 'lucide-react-native';
import { useStore } from '../store/useStore';
import { signOut } from '../services/authService';
import { fetchDashboardMetrics, DashboardMetrics } from '../services/dashboardService';
import { fetchPendingCount } from '../services/bookingRequestService';
import { supabase } from '../lib/supabase';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:         '#FAFAFC',
  surface:    '#FFFFFF',
  border:     'rgba(0,0,0,0.06)',
  borderMid:  'rgba(0,0,0,0.10)',
  grad0:      '#7C4DFF',
  grad1:      '#8B5CF6',
  grad2:      '#60A5FA',
  purple:     '#7C4DFF',
  purple15:   'rgba(124,77,255,0.10)',
  purple30:   'rgba(124,77,255,0.20)',
  purple60:   'rgba(124,77,255,0.50)',
  purpleLine: 'rgba(124,77,255,0.85)',
  text:       '#1A1A1A',
  text2:      '#7B7B8A',
  text3:      '#AEAEBB',
  white:      '#FFFFFF',
  red:        '#EF4444',
  redBg:      'rgba(239,68,68,0.07)',
  redBd:      'rgba(239,68,68,0.20)',
  orange:     '#F97316',
  orangeSf:   'rgba(249,115,22,0.10)',
  blue:       '#3B82F6',
  blueSf:     'rgba(59,130,246,0.10)',
  teal:       '#14B8A6',
  tealSf:     'rgba(20,184,166,0.10)',
  amber:      '#F59E0B',
  amberSf:    'rgba(245,158,11,0.10)',
  green:      '#10B981',
  greenSf:    'rgba(16,185,129,0.10)',
  pink:       '#EC4899',
  pinkSf:     'rgba(236,72,153,0.10)',
};
const GRAD: [string, string, string] = [T.grad0, T.grad1, T.grad2];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function buildBezier(pts: { x: number; y: number }[]): string {
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const cp = ((pts[i - 1].x + pts[i].x) / 2).toFixed(2);
    d += ` C ${cp} ${pts[i - 1].y.toFixed(2)} ${cp} ${pts[i].y.toFixed(2)} ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  }
  return d;
}

// ─── SparkLine ────────────────────────────────────────────────────────────────
function SparkLine({ data, w, h = 52, lineColor = T.purpleLine }: { data: number[]; w: number; h?: number; lineColor?: string }) {
  const safeData = data.length >= 2 ? data : [0, 0, 0, 0, 0, 0, 0];
  const max      = Math.max(...safeData, 1);
  const pad      = 6;
  const pts      = safeData.map((v, i) => ({
    x: (i / (safeData.length - 1)) * w,
    y: pad + (1 - v / max) * (h - pad * 2),
  }));
  const line = buildBezier(pts);
  const last = pts[pts.length - 1];
  let fill = line;
  fill += ` L ${last.x.toFixed(2)} ${h} L ${pts[0].x.toFixed(2)} ${h} Z`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGrad id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={T.purple} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={T.purple} stopOpacity="0.00" />
        </SvgGrad>
      </Defs>
      <Path d={fill} fill="url(#sparkFill)" />
      <Path d={line} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={5}   fill={T.surface} />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={T.purple} />
    </Svg>
  );
}

// ─── SparkLine (red variant for pending) ─────────────────────────────────────
function SparkLineRed({ data, w, h = 48 }: { data: number[]; w: number; h?: number }) {
  const safeData = data.length >= 2 ? data : [0, 1, 0, 1, 2, 1, 2];
  const max      = Math.max(...safeData, 1);
  const pad      = 6;
  const pts      = safeData.map((v, i) => ({
    x: (i / (safeData.length - 1)) * w,
    y: pad + (1 - v / max) * (h - pad * 2),
  }));
  const line = buildBezier(pts);
  const last = pts[pts.length - 1];
  let fill = line;
  fill += ` L ${last.x.toFixed(2)} ${h} L ${pts[0].x.toFixed(2)} ${h} Z`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGrad id="redFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={T.red} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={T.red} stopOpacity="0.00" />
        </SvgGrad>
      </Defs>
      <Path d={fill} fill="url(#redFill)" />
      <Path d={line} fill="none" stroke={T.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Weekly Line Chart ────────────────────────────────────────────────────────
const Y_VALS  = [100000, 75000, 50000, 25000, 0];
const CHART_H = 148;
const Y_W     = 44;

function WeekChart({ data, labels, onDayPress }: {
  data: number[]; labels: string[]; onDayPress?: (i: number) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [JSON.stringify(data)]);

  const chartW = SW - 32 - 32 - Y_W;
  const max    = Math.max(...data, 1);
  const pts    = data.map((v, i) => ({ x: (i / (data.length - 1)) * chartW, y: (1 - v / max) * CHART_H }));
  const line   = buildBezier(pts);
  const last   = pts[pts.length - 1];
  let fillPath = line;
  fillPath += ` L ${last.x.toFixed(2)} ${CHART_H} L ${pts[0].x.toFixed(2)} ${CHART_H} Z`;

  return (
    <Animated.View style={{ opacity: fadeAnim, marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Svg width={chartW} height={CHART_H}>
            <Defs>
              <SvgGrad id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%"   stopColor={T.purple} stopOpacity="0.18" />
                <Stop offset="85%"  stopColor={T.purple} stopOpacity="0.02" />
                <Stop offset="100%" stopColor={T.purple} stopOpacity="0.00" />
              </SvgGrad>
            </Defs>
            {Y_VALS.map((_, i) => {
              const y = (i / (Y_VALS.length - 1)) * CHART_H;
              return <Line key={i} x1={0} y1={y} x2={chartW} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} strokeDasharray="5 7" />;
            })}
            <Path d={fillPath} fill="url(#chartFill)" />
            <Path d={line} fill="none" stroke={T.purple} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((pt, i) => (
              <React.Fragment key={i}>
                <Circle cx={pt.x} cy={pt.y} r={5.5} fill={T.surface}  onPress={() => onDayPress?.(i)} />
                <Circle cx={pt.x} cy={pt.y} r={3.5} fill={T.purple}   onPress={() => onDayPress?.(i)} />
              </React.Fragment>
            ))}
          </Svg>
        </View>
        <View style={wc.yAxis}>
          {Y_VALS.map((v) => (
            <Text key={v} style={wc.yLbl}>{v === 0 ? '0' : v >= 1000 ? `${v / 1000}k` : v}</Text>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', width: chartW, marginTop: 10 }}>
        {labels.map((l, i) => <Text key={i} style={[wc.xLbl, { flex: 1 }]}>{l}</Text>)}
      </View>
    </Animated.View>
  );
}

const wc = StyleSheet.create({
  yAxis: { width: Y_W, justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: 6, height: CHART_H },
  yLbl:  { fontSize: 10, color: T.text3, fontWeight: '500', letterSpacing: 0.2 },
  xLbl:  { textAlign: 'center', fontSize: 10, color: T.text3, fontWeight: '500', letterSpacing: 0.1 },
});

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, tint, label, value, trend, sub, onPress }: {
  icon: React.ReactNode; tint: string; label: string;
  value: string; trend?: string; sub: string; onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={1}>
      <Animated.View style={[mc.card, { transform: [{ scale }] }]}>
        <View style={[mc.iconWrap, { backgroundColor: tint }]}>{icon}</View>
        <Text style={mc.label} numberOfLines={2}>{label}</Text>
        <Text style={mc.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {trend !== undefined && (
          <View style={mc.trendRow}>
            <ArrowUpRight size={10} color={T.green} />
            <Text style={mc.trendTxt}>{trend}</Text>
          </View>
        )}
        <Text style={mc.sub} numberOfLines={1}>{sub}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const METRIC_W = (SW - 32 - 24) / 4;
const mc = StyleSheet.create({
  card:     { width: METRIC_W, backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 12, gap: 4, shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label:    { fontSize: 8.5, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.7, lineHeight: 11 },
  value:    { fontSize: 24, fontWeight: '900', color: T.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendTxt: { fontSize: 10, color: T.green, fontWeight: '700' },
  sub:      { fontSize: 9, color: T.text3, marginTop: 0 },
});

// ─── Action Card ──────────────────────────────────────────────────────────────
const ACTION_W = (SW - 32) / 5;

function ActionCard({ icon, tint, label, onPress }: {
  icon: React.ReactNode; tint: string; label: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={{ width: ACTION_W, alignItems: 'center', paddingVertical: 10 }}
      onPress={onPress} activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start()}
    >
      <Animated.View style={{ alignItems: 'center', gap: 7, transform: [{ scale }] }}>
        <View style={[ac.iconWrap, { backgroundColor: tint }]}>{icon}</View>
        <Text style={ac.label} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  iconWrap: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 10.5, fontWeight: '600', color: T.text2, textAlign: 'center', letterSpacing: 0.1 },
});

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ visible, onClose, ownerId, navigation, onSignOut }: {
  visible: boolean; onClose: () => void; ownerId: string; navigation: any; onSignOut: () => void;
}) {
  const [staffAllowed, setStaffAllowed] = useState(true);
  const [approvalMode, setApprovalMode] = useState(true);
  const [loaded,   setLoaded]           = useState(false);
  const [updating, setUpdating]         = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !ownerId) return;
    supabase.from('owner_settings')
      .select('allow_staff_requests, online_approval_mode')
      .eq('owner_id', ownerId).single()
      .then(({ data }) => {
        if (data) {
          setStaffAllowed((data as any).allow_staff_requests !== false);
          setApprovalMode((data as any).online_approval_mode !== false);
        }
        setLoaded(true);
      });
  }, [ownerId, visible]);

  const toggle = async (key: 'allow_staff_requests' | 'online_approval_mode', val: boolean) => {
    setUpdating(key);
    if (key === 'allow_staff_requests') setStaffAllowed(val); else setApprovalMode(val);
    await supabase.from('owner_settings').upsert({ owner_id: ownerId, [key]: val, updated_at: new Date().toISOString() });
    setUpdating(null);
  };

  const navTo = (route: string) => { onClose(); setTimeout(() => navigation.navigate(route), 220); };

  const TOGGLES = [
    { key: 'online_approval_mode' as const, label: 'Online Payment Approval', sub: approvalMode ? 'Manual review required' : 'Instant booking', val: approvalMode },
    { key: 'allow_staff_requests' as const, label: 'Staff / Owner Registration', sub: staffAllowed ? 'Requests accepted' : 'Disabled', val: staffAllowed },
  ];

  const NAV_ITEMS = [
    { icon: '📋', label: 'Pending Approvals', route: 'PendingApprovals' },
    { icon: '👥', label: 'Customers',         route: 'Customers' },
    { icon: '🏷️', label: 'Coupon Codes',      route: 'Coupons' },
    { icon: '🏆', label: 'Tournaments',       route: 'Tournaments' },
    { icon: '📊', label: 'Reports',           route: 'Reports' },
    { icon: '⚙️', label: 'Settings',          route: 'Settings' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sm.overlay}>
          <TouchableWithoutFeedback>
            <View style={sm.sheet}>
              <View style={sm.handle} />
              <Text style={sm.title}>Menu</Text>

              <View style={sm.group}>
                {TOGGLES.map(({ key, label, sub, val }) => (
                  <View key={key} style={sm.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={sm.toggleLabel}>{label}</Text>
                      <Text style={sm.toggleSub}>{loaded ? sub : '…'}</Text>
                    </View>
                    {updating === key || !loaded
                      ? <ActivityIndicator color={T.purple} size="small" />
                      : <Switch value={val} onValueChange={v => toggle(key, v)} trackColor={{ true: T.purple }} thumbColor={T.white} />
                    }
                  </View>
                ))}
              </View>

              <View style={sm.group}>
                {NAV_ITEMS.map(({ icon, label, route }, idx) => (
                  <TouchableOpacity
                    key={route}
                    style={[sm.navItem, idx === NAV_ITEMS.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => navTo(route)}
                  >
                    <View style={sm.navIcon}><Text>{icon}</Text></View>
                    <Text style={sm.navLabel}>{label}</Text>
                    <Text style={sm.navArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={sm.signOutRow} onPress={onSignOut}>
                <View style={[sm.navIcon, { backgroundColor: 'rgba(239,68,68,0.10)' }]}><Text>🚪</Text></View>
                <Text style={sm.signOutLabel}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={sm.closeBtn} onPress={onClose}>
                <Text style={sm.closeTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(26,26,26,0.50)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: T.border, borderBottomWidth: 0, padding: 20, paddingBottom: 44 },
  handle:      { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:       { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 14 },
  group:       { marginBottom: 12, backgroundColor: T.bg, borderRadius: 16, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: T.text },
  toggleSub:   { fontSize: 11, color: T.text3, marginTop: 2 },
  navItem:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  navIcon:     { width: 32, height: 32, borderRadius: 9, backgroundColor: T.border, alignItems: 'center', justifyContent: 'center' },
  navLabel:    { flex: 1, fontSize: 13, fontWeight: '500', color: T.text2 },
  navArrow:    { fontSize: 18, color: T.text3 },
  signOutRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: T.redBg, borderRadius: 14, borderWidth: 1, borderColor: T.redBd, marginBottom: 12 },
  signOutLabel:{ fontSize: 13, fontWeight: '700', color: T.red },
  closeBtn:    { paddingVertical: 13, alignItems: 'center', backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  closeTxt:    { fontSize: 13, color: T.text3, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation              = useNavigation<any>();
  const { profile, setProfile } = useStore();
  const insets                  = useSafeAreaInsets();

  const [metrics, setMetrics]           = useState<DashboardMetrics | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError]               = useState<string | null>(null);
  const [menuOpen, setMenuOpen]         = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [{ metrics: m, error: e }, count] = await Promise.all([
      fetchDashboardMetrics(),
      fetchPendingCount(),
    ]);
    setMetrics(m); setError(e); setPendingCount(count);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => {
    const ch = supabase.channel('db:booking_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => {
        fetchPendingCount().then(setPendingCount);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ch = supabase.channel('db:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `booking_date=eq.${today}` }, () => {
        fetchDashboardMetrics().then(({ metrics: m, error: e }) => {
          if (m) setMetrics(m); if (e) setError(e);
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSignOut = () => {
    setMenuOpen(false);
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); setProfile(null); } },
    ]);
  };

  const firstName = (profile?.full_name ?? 'Owner').split(' ')[0];
  const initials  = (profile?.full_name ?? 'A').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const today     = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={T.purple} size="large" />
      </View>
    );
  }

  const m            = metrics!;
  const totalRevenue = (m.todayBookingRevenue ?? 0) + (m.todayPOSRevenue ?? 0);
  const avgOrder     = m.todayBookings.length > 0 ? Math.round(totalRevenue / m.todayBookings.length) : 0;
  const weekLabels   = m.weekLabels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const HERO_GAP   = 10;
  const REV_CARD_W = Math.round((SW - 32 - HERO_GAP) * 0.58);
  const SPARK_W    = REV_CARD_W - 28;

  const ACTIONS = [
    { icon: <Calendar      size={22} color={T.blue}   />, tint: T.blueSf,   label: 'Bookings',    route: 'Calendar' },
    { icon: <Users         size={22} color={T.purple} />, tint: T.purple15,  label: 'Customers',   route: 'Customers' },
    { icon: <Trophy        size={22} color={T.amber}  />, tint: T.amberSf,  label: 'Tournaments', route: 'Tournaments' },
    { icon: <Package       size={22} color={T.teal}   />, tint: T.tealSf,   label: 'Inventory',   route: 'Inventory' },
    { icon: <BarChart2     size={22} color={T.pink}   />, tint: T.pinkSf,   label: 'Reports',     route: 'Reports' },
    { icon: <Tag           size={22} color={T.orange} />, tint: T.orangeSf, label: 'Coupons',     route: 'Coupons' },
    { icon: <ClipboardList size={22} color={T.blue}   />, tint: T.blueSf,   label: 'Approvals',   route: 'PendingApprovals' },
    { icon: <UserCheck     size={22} color={T.teal}   />, tint: T.tealSf,   label: 'Staff',       route: 'Customers' },
    { icon: <Settings      size={22} color={T.text3}  />, tint: 'rgba(100,116,139,0.10)', label: 'Settings', route: 'Settings' },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={s.hBtn} activeOpacity={0.7}>
          <Menu size={20} color={T.text} />
        </TouchableOpacity>

        <View style={s.headerMid}>
          <Text style={s.brand}>PLAYBOX</Text>
          <View style={s.nameRow}>
            <Text style={s.ownerName}>{firstName}</Text>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
              <Text style={s.avatarTxt}>{initials[0]}</Text>
            </LinearGradient>
          </View>
          <Text style={s.dateText}>{today}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.hBtn} activeOpacity={0.7}>
            <Search size={18} color={T.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={() => navigation.navigate('PendingApprovals')} activeOpacity={0.7}>
            <Bell size={18} color={T.text} />
            {pendingCount > 0 && <View style={s.notifDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scroll ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.purple} colors={[T.purple]} />}
      >
        {error && (
          <View style={s.errBanner}>
            <Text style={s.errTxt}>⚠  Could not load all data — pull to retry</Text>
          </View>
        )}

        {/* ── Hero row ── */}
        <View style={s.heroRow}>

          {/* Revenue card */}
          <View style={[s.revCard, { flex: 58 }]}>
            <LinearGradient colors={[`rgba(124,77,255,0.04)`, T.surface]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={s.revTop}>
              <Text style={s.eyebrow}>TODAY'S REVENUE</Text>
              <View style={s.revIcon}>
                <IndianRupee size={14} color={T.purple} strokeWidth={2.5} />
              </View>
            </View>
            <Text style={s.revAmt}>{fmt(totalRevenue)}</Text>
            <View style={{ marginTop: 8, marginHorizontal: -2 }}>
              <SparkLine data={m.weekRevenue} w={SPARK_W} h={52} />
            </View>
            <View style={s.revSubRow}>
              <View style={s.revSubDot} />
              <Text style={s.revSub}>Bookings {fmt(m.todayBookingRevenue ?? 0)}</Text>
              <Text style={s.revSubSep}>·</Text>
              <Text style={s.revSub}>POS {fmt(m.todayPOSRevenue ?? 0)}</Text>
            </View>
          </View>

          {/* Pending card */}
          <TouchableOpacity
            style={[s.pendCard, pendingCount > 0 && { borderColor: T.redBd }]}
            onPress={() => navigation.navigate('PendingApprovals')}
            activeOpacity={0.8}
          >
            {pendingCount > 0 && <LinearGradient colors={[`rgba(239,68,68,0.05)`, T.surface]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />}
            <View style={s.pendTop}>
              <Text style={s.eyebrow}>PENDING</Text>
              <View style={[s.pendIcon, pendingCount > 0 && { backgroundColor: T.redBg }]}>
                <AlertCircle size={13} color={pendingCount > 0 ? T.red : T.text3} strokeWidth={2.5} />
              </View>
            </View>
            <Text style={[s.pendCount, pendingCount > 0 && { color: T.red }]}>{pendingCount}</Text>
            <View style={s.pendReviewRow}>
              <Text style={[s.pendReview, pendingCount > 0 && { color: T.red }]}>Review</Text>
              <Text style={[s.pendReview, pendingCount > 0 && { color: T.red }]}> ›</Text>
            </View>
            <View style={{ marginTop: 6, marginHorizontal: -2 }}>
              <SparkLineRed data={[pendingCount, pendingCount + 1, pendingCount, pendingCount + 2, pendingCount + 1, pendingCount + 2, pendingCount]} w={(SW - 32 - HERO_GAP) * 0.42 - 28} h={38} />
            </View>
          </TouchableOpacity>

        </View>

        {/* ── Key Metrics ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Key Metrics</Text>
          <TouchableOpacity style={s.pill} activeOpacity={0.7}>
            <Text style={s.pillTxt}>Today</Text>
            <ChevronDown size={12} color={T.text3} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 2 }}>
          <MetricCard icon={<Calendar    size={19} color={T.blue}   />} tint={T.blueSf}   label="TOTAL BOOKINGS"  value={String(m.todayBookings.length)} trend="0%" sub="vs yesterday" onPress={() => navigation.navigate('Calendar')} />
          <MetricCard icon={<Users       size={19} color={T.purple} />} tint={T.purple15}  label="TOTAL CUSTOMERS" value={String(m.todayBookings.length)} trend="0%" sub="vs yesterday" />
          <MetricCard icon={<IndianRupee size={19} color={T.amber}  />} tint={T.amberSf}  label="AVG ORDER VALUE" value={avgOrder > 0 ? fmt(avgOrder) : '₹0'} trend="0%" sub="vs yesterday" />
          <MetricCard icon={<Package     size={19} color={T.teal}   />} tint={T.tealSf}   label="TOTAL ITEMS"     value={String(m.totalInventoryItems ?? 0)} trend="0%" sub="In Inventory" onPress={() => navigation.navigate('Inventory')} />
        </ScrollView>

        {/* ── Revenue Chart ── */}
        <View style={s.chartCard}>
          <View style={s.chartHdr}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.chartIconWrap}>
                <TrendingUp size={16} color={T.purple} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={s.chartTitle}>Revenue This Week</Text>
                <Text style={s.chartSub}>Overview of daily revenue</Text>
              </View>
            </View>
            <TouchableOpacity style={s.pill} activeOpacity={0.7}>
              <Text style={s.pillTxt}>This Week</Text>
              <ChevronDown size={12} color={T.text3} />
            </TouchableOpacity>
          </View>
          <WeekChart
            data={m.weekRevenue}
            labels={weekLabels}
            onDayPress={(i) => {
              const d = new Date();
              d.setDate(d.getDate() - (m.weekRevenue.length - 1 - i));
              navigation.navigate('DayBookings', { isoDate: d.toISOString().slice(0, 10), label: weekLabels[i] });
            }}
          />
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={s.viewAll}>View All ›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.actionsWrap}>
          <View style={s.actionsRow}>
            {ACTIONS.slice(0, 5).map(a => <ActionCard key={a.label} {...a} onPress={() => navigation.navigate(a.route)} />)}
          </View>
          <View style={s.actionsRow}>
            {ACTIONS.slice(5).map(a => <ActionCard key={a.label} {...a} onPress={() => navigation.navigate(a.route)} />)}
          </View>
        </View>
      </ScrollView>

      <SettingsModal visible={menuOpen} onClose={() => setMenuOpen(false)} ownerId={profile?.id ?? ''} navigation={navigation} onSignOut={handleSignOut} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.surface },
  hBtn:        { width: 38, height: 38, borderRadius: 12, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  headerMid:   { flex: 1 },
  brand:       { fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 3.5, textTransform: 'uppercase', marginBottom: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ownerName:   { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  avatar:      { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 10, fontWeight: '900', color: T.white },
  dateText:    { fontSize: 11, color: T.text3, marginTop: 1 },
  notifDot:    { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: T.surface },

  scroll:      { paddingTop: 16, gap: 16 },
  errBanner:   { marginHorizontal: 16, backgroundColor: T.redBg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: T.redBd },
  errTxt:      { fontSize: 12, color: T.red, fontWeight: '500' },

  eyebrow:     { fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 1.8, textTransform: 'uppercase' },

  heroRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },

  revCard:     { backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(124,77,255,0.22)', padding: 14, overflow: 'hidden', shadowColor: 'rgba(124,77,255,0.12)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 3 },
  revTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  revIcon:     { width: 30, height: 30, borderRadius: 9, backgroundColor: T.purple15, borderWidth: 1, borderColor: T.purple30, alignItems: 'center', justifyContent: 'center' },
  revAmt:      { fontSize: 34, fontWeight: '900', color: T.text, letterSpacing: -1, fontVariant: ['tabular-nums'], marginTop: 2 },
  revSubRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  revSubDot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.purple60 },
  revSub:      { fontSize: 10, color: T.text3, fontWeight: '500' },
  revSubSep:   { fontSize: 10, color: T.text3 },

  pendCard:    { flex: 42, backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 14, overflow: 'hidden', shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  pendTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pendIcon:    { width: 28, height: 28, borderRadius: 8, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  pendCount:   { fontSize: 44, fontWeight: '900', color: T.text, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  pendReviewRow:{ flexDirection: 'row', alignItems: 'center' },
  pendReview:  { fontSize: 12, color: T.text3, fontWeight: '600' },

  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  sectionTitle:{ fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.border },
  pillTxt:     { fontSize: 12, color: T.text3, fontWeight: '600' },
  viewAll:     { fontSize: 13, color: T.blue, fontWeight: '700' },

  chartCard:   { marginHorizontal: 16, backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 16, shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  chartHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartIconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.purple15, borderWidth: 1, borderColor: T.purple30, alignItems: 'center', justifyContent: 'center' },
  chartTitle:  { fontSize: 14, fontWeight: '700', color: T.text, letterSpacing: -0.2 },
  chartSub:    { fontSize: 10, color: T.text3, marginTop: 2 },

  actionsWrap: { gap: 0, paddingHorizontal: 8 },
  actionsRow:  { flexDirection: 'row' },
});
