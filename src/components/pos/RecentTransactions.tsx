import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction } from '../../types';
import { colors, radius } from '../../theme/theme';

interface Props {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: Props) {
  const [expanded, setExpanded] = useState(true);

  const recent = transactions.slice(0, 5);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Recent Transactions</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{transactions.length}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {recent.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No transactions yet today</Text>
            </View>
          ) : (
            recent.map((tx) => (
              <View key={tx.id} style={[styles.row, tx.undone && styles.rowUndone]}>
                {/* Time + customer */}
                <View style={styles.rowLeft}>
                  <Text style={styles.time}>{tx.time}</Text>
                  <Text style={[styles.customer, tx.undone && styles.strikethrough]} numberOfLines={1}>
                    {tx.customer}
                  </Text>
                  <Text style={styles.itemSummary} numberOfLines={1}>
                    {tx.items.map((i) => `${i.name} ×${i.qty}`).join('  ·  ')}
                  </Text>
                </View>

                {/* Total + badge */}
                <View style={styles.rowRight}>
                  <Text style={[styles.total, tx.undone && styles.strikethrough]}>
                    ₹{tx.total}
                  </Text>
                  {tx.undone && (
                    <View style={styles.undoneBadge}>
                      <Text style={styles.undoneText}>Undone</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text2,
  },
  chevron: {
    fontSize: 14,
    color: colors.text3,
  },
  list: {
    paddingVertical: 4,
  },
  emptyRow: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUndone: {
    backgroundColor: '#FAFAFA',
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  time: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text3,
    fontVariant: ['tabular-nums'],
  },
  customer: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemSummary: {
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  total: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: colors.text3,
  },
  undoneBadge: {
    backgroundColor: '#FDECEA',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  undoneText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.danger,
  },
});
