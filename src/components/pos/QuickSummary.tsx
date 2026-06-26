import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transaction } from '../../types';
import { colors, radius } from '../../theme/theme';

interface Props {
  transactions: Transaction[];
}

export default function QuickSummary({ transactions }: Props) {
  const todayTx = transactions.filter((t) => t.date === 'Today' && !t.undone);
  const revenue  = todayTx.reduce((sum, t) => sum + t.total, 0);
  const itemsSold = todayTx.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.qty, 0), 0);
  const txCount  = todayTx.length;

  const pills: { label: string; value: string; accent: string }[] = [
    { label: 'Sales Today', value: `${txCount}`,        accent: colors.accent   },
    { label: 'Revenue',     value: `₹${revenue}`,       accent: '#1A5BA6'       },
    { label: 'Items Sold',  value: `${itemsSold}`,       accent: '#8B5CF6'       },
  ];

  return (
    <View style={styles.row}>
      {pills.map((p) => (
        <View key={p.label} style={styles.pill}>
          <Text style={[styles.value, { color: p.accent }]}>{p.value}</Text>
          <Text style={styles.label}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text3,
    textAlign: 'center',
  },
});
