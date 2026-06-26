import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { POSItem, CartItem } from '../../types';
import { colors, radius, shadow } from '../../theme/theme';

interface Props {
  item: POSItem;
  cartEntry?: CartItem;
  onPress: () => void;
}

export default function POSItemCard({ item, cartEntry, onPress }: Props) {
  const inCart  = !!cartEntry;
  const qty     = cartEntry?.qty ?? 0;
  const isLow   = item.stock <= 10;
  const outOfStock = item.stock === 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        inCart && styles.cardActive,
        outOfStock && styles.cardDisabled,
        shadow.sm,
      ]}
      onPress={onPress}
      disabled={outOfStock}
      activeOpacity={0.75}
    >
      {/* Quantity badge */}
      {inCart && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{qty}</Text>
        </View>
      )}

      {/* Emoji icon */}
      <Text style={styles.emoji}>{item.emoji}</Text>

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

      {/* Price */}
      <Text style={styles.price}>₹{item.price}</Text>

      {/* Status chips */}
      {outOfStock ? (
        <View style={[styles.chip, styles.chipOut]}>
          <Text style={styles.chipOutText}>Out of stock</Text>
        </View>
      ) : isLow ? (
        <View style={[styles.chip, styles.chipLow]}>
          <Text style={styles.chipLowText}>Low: {item.stock}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 12,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    minHeight: 110,
    justifyContent: 'center',
  },
  cardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  emoji: {
    fontSize: 30,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    maxWidth: '100%',
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  chipLow: {
    backgroundColor: '#FFF3CD',
  },
  chipLowText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.warn,
  },
  chipOut: {
    backgroundColor: '#FDECEA',
  },
  chipOutText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.danger,
  },
});
