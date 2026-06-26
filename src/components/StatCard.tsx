import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../theme/theme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  dotColor?: string;
}

export default function StatCard({ label, value, sub, dotColor }: Props) {
  return (
    <View style={[styles.card, shadow.sm]}>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    position: 'absolute',
    top: 14,
    right: 14,
  },
  label: { fontSize: 11, color: colors.text3, fontWeight: '500', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  sub: { fontSize: 10, color: colors.text3, marginTop: 2 },
});