import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ScreenHeader from '../components/ui/ScreenHeader';
import { palette, radius, font, spacing, shadow } from '../theme/theme';

const SETTINGS = [
  {
    key:     'online_approval_mode' as const,
    icon:    '💳',
    title:   'Online Payment Approval',
    onDesc:  'Owner reviews each online payment before confirming booking',
    offDesc: 'Slot booked instantly after payment. Screenshot saved for audit.',
    onLabel: 'Approval Required',
    offLabel:'Instant Booking',
    tint:    palette.accentSoft,
    tintBorder: palette.borderAccent,
  },
  {
    key:     'allow_staff_requests' as const,
    icon:    '👥',
    title:   'Staff/Owner Registrations',
    onDesc:  'New staff/owner account requests are accepted',
    offDesc: 'No new staff/owner requests accepted. Customer signup unaffected.',
    onLabel: 'Allowed',
    offLabel:'Blocked',
    tint:    palette.violetSoft,
    tintBorder: palette.borderViolet,
  },
];

export default function SettingsScreen() {
  const { profile } = useStore();
  const [settings, setSettings] = useState({ online_approval_mode: true, allow_staff_requests: true });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase.from('owner_settings').select('allow_staff_requests, online_approval_mode').eq('owner_id', profile.id).single();
    if (data) setSettings({ allow_staff_requests: (data as any).allow_staff_requests !== false, online_approval_mode: (data as any).online_approval_mode !== false });
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (key: keyof typeof settings, val: boolean) => {
    if (!profile?.id) return;
    setSaving(key);
    setSettings((s) => ({ ...s, [key]: val }));
    const { error } = await supabase.from('owner_settings').upsert({ owner_id: profile.id, [key]: val, updated_at: new Date().toISOString() });
    if (error) { Alert.alert('Error', 'Could not save setting.'); setSettings((s) => ({ ...s, [key]: !val })); }
    setSaving(null);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader title="Settings" subtitle="Owner controls" />
      {loading ? (
        <View style={s.center}><ActivityIndicator color={palette.accent} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <Text style={s.sectionLabel}>Booking & Payment</Text>
          {SETTINGS.map((cfg) => {
            const isOn = settings[cfg.key];
            return (
              <View key={cfg.key} style={[s.card, { borderColor: isOn ? cfg.tintBorder : palette.borderFaint }]}>
                <View style={s.cardTop}>
                  <View style={[s.iconWrap, { backgroundColor: cfg.tint }]}>
                    <Text style={s.iconText}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={s.cardTitle}>{cfg.title}</Text>
                    <View style={[s.statusChip, { backgroundColor: isOn ? cfg.tint : palette.glass2, borderColor: isOn ? cfg.tintBorder : palette.borderFaint }]}>
                      <Text style={[s.statusChipText, { color: isOn ? palette.accentBright : palette.textTertiary }]}>
                        {isOn ? cfg.onLabel : cfg.offLabel}
                      </Text>
                    </View>
                  </View>
                  {saving === cfg.key
                    ? <ActivityIndicator color={palette.accent} size="small" />
                    : <Switch value={isOn} onValueChange={(v) => toggle(cfg.key, v)} trackColor={{ true: palette.accent, false: palette.glass4 }} thumbColor="#fff" />}
                </View>
                <Text style={s.cardDesc}>{isOn ? cfg.onDesc : cfg.offDesc}</Text>
              </View>
            );
          })}

          <View style={s.infoBox}>
            <Text style={s.infoTitle}>📋 How Online Approval works</Text>
            <Text style={s.infoText}>
              {'• '}<Text style={{ fontWeight: font.bold, color: palette.accentBright }}>Approval ON:</Text>{' Customer uploads screenshot → you review → approve → slot confirmed\n'}
              {'• '}<Text style={{ fontWeight: font.bold, color: palette.emeraldBright }}>Approval OFF:</Text>{' Customer uploads screenshot → slot confirmed instantly → screenshot saved for audit'}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: palette.abyss },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:        { padding: spacing.md, paddingBottom: 40, gap: spacing.sm },
  sectionLabel:  { fontSize: font.xs, fontWeight: font.black, color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: font.widest, marginBottom: spacing.xs },
  card:          { backgroundColor: palette.midnight, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, ...shadow.sm, gap: spacing.xs },
  cardTop:       { flexDirection: 'row', alignItems: 'center' },
  iconWrap:      { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconText:      { fontSize: 21 },
  cardTitle:     { fontSize: font.sm, fontWeight: font.bold, color: palette.textPrimary, marginBottom: 4 },
  statusChip:    { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, borderWidth: 1 },
  statusChipText:{ fontSize: font.xs, fontWeight: font.bold },
  cardDesc:      { fontSize: font.xs, color: palette.textTertiary, lineHeight: 18, paddingLeft: 50 },
  infoBox:       { backgroundColor: palette.glass1, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint, gap: spacing.xs },
  infoTitle:     { fontSize: font.sm, fontWeight: font.bold, color: palette.textSecondary },
  infoText:      { fontSize: font.xs, color: palette.textTertiary, lineHeight: 20 },
});