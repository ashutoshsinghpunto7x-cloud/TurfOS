import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { palette, font, spacing, radius } from '../../theme/theme';

interface Props {
  title:        string;
  subtitle?:    string;
  onBack?:      () => void;
  showBack?:    boolean;
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, subtitle, onBack, showBack = true, rightElement }: Props) {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();

  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={[st.header, { paddingTop: insets.top + 8 }]}>
      {showBack ? (
        <TouchableOpacity style={st.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Text style={st.backIcon}>‹</Text>
        </TouchableOpacity>
      ) : <View style={st.backBtn} />}

      <View style={{ flex: 1 }}>
        <Text style={st.title}>{title}</Text>
        {subtitle && <Text style={st.sub}>{subtitle}</Text>}
      </View>

      <View style={st.right}>{rightElement ?? <View style={st.backBtn} />}</View>
    </View>
  );
}

const st = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,12,20,0.97)', borderBottomWidth: 1, borderBottomColor: palette.borderFaint, paddingHorizontal: spacing.md, paddingBottom: spacing.sm + 2, gap: spacing.xs },
  backBtn: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: palette.glass2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderSubtle },
  backIcon:{ fontSize: 22, color: palette.textPrimary, lineHeight: 28 },
  title:   { fontSize: font.lg, fontWeight: font.bold, color: palette.textPrimary },
  sub:     { fontSize: font.xs, color: palette.textTertiary, marginTop: 1 },
  right:   { width: 38, alignItems: 'flex-end' },
});