import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookingStatus } from '../types';
import { colors, radius } from '../theme/theme';

const chipConfig: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  Confirmed: { bg: colors.accent2, text: colors.accentText, label: 'Confirmed' },
  Pending:   { bg: colors.warnBg,  text: colors.warn,       label: 'Pending'   },
  Completed: { bg: colors.infoBg,  text: colors.info,       label: 'Completed' },
  Cancelled: { bg: colors.dangerBg,text: colors.danger,     label: 'Cancelled' },
};

export default function StatusChip({ status }: { status: BookingStatus }) {
  const cfg = chipConfig[status];
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '600' },
});