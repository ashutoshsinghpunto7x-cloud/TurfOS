import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { saveUserRole, AppRole } from '../services/authService';
import { getProfileByUserId } from '../services/authService';
import { useStore } from '../store/useStore';
import { colors, radius } from '../theme/theme';

const ROLES: { key: AppRole; label: string; icon: string }[] = [
  { key: 'owner',    label: 'Owner',    icon: '👑' },
  { key: 'staff',    label: 'Staff',    icon: '🧑‍💼' },
  { key: 'customer', label: 'Customer', icon: '👤' },
];

export default function CompleteProfileScreen() {
  const { setProfile } = useStore();
  const [selected, setSelected] = useState<AppRole | null>(null);
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!selected) {
      Alert.alert('Select Role', 'Please select your role to continue.');
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    setSaving(true);
    const { error } = await saveUserRole(data.session.user.id, selected);
    if (error) {
      Alert.alert('Error', error);
      setSaving(false);
      return;
    }

    const profile = await getProfileByUserId(data.session.user.id);
    setSaving(false);
    if (profile) {
      useStore.setState({ profileMissing: false });
      setProfile(profile);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <Text style={styles.title}>One more step</Text>
        <Text style={styles.sub}>
          We could not find your profile. Please select your role to continue.
        </Text>

        <View style={styles.roleList}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleCard, selected === r.key && styles.roleCardActive]}
              onPress={() => setSelected(r.key)}
            >
              <Text style={styles.roleIcon}>{r.icon}</Text>
              <Text style={[styles.roleLabel, selected === r.key && { color: colors.accentText }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bg },
  inner:          { flex: 1, padding: 28, justifyContent: 'center' },
  title:          { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sub:            { fontSize: 15, color: colors.text2, lineHeight: 22, marginBottom: 32 },
  roleList:       { gap: 14, marginBottom: 32 },
  roleCard:       { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 20 },
  roleCardActive: { backgroundColor: colors.accent2, borderColor: colors.accent, borderWidth: 2 },
  roleIcon:       { fontSize: 28 },
  roleLabel:      { fontSize: 18, fontWeight: '700', color: colors.text },
  saveBtn:        { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:    { fontSize: 17, fontWeight: '800', color: '#fff' },
});