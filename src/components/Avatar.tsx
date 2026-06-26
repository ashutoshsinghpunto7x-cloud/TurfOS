import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme/theme';

const palettes = [
  { bg: colors.accent2, text: colors.accentText },
  { bg: colors.infoBg,  text: colors.info        },
  { bg: colors.warnBg,  text: colors.warn         },
  { bg: colors.dangerBg,text: colors.danger       },
];

interface Props { initials: string; size?: number; index?: number; }

export default function Avatar({ initials, size = 40, index = 0 }: Props) {
  const palette = palettes[index % palettes.length];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text, fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});