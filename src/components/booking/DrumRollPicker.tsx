import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { colors } from '../../theme/theme';

interface Props {
  items:       number[];
  selected:    number;
  onSelect:    (value: number) => void;
  label?:      string;
  width?:      number;
  formatItem?: (v: number) => string;
}

const ITEM_H  = 46;
const VISIBLE = 5;   // odd number so selected is centered
const PAD     = Math.floor(VISIBLE / 2);

export default function DrumRollPicker({
  items, selected, onSelect, label, width = 80, formatItem,
}: Props) {
  const ref = useRef<ScrollView>(null);
  const fmt = formatItem ?? ((v: number) => String(v).padStart(2, '0'));

  const isDragging = useRef(false);
  const [internalSelected, setInternalSelected] = useState(selected);

  // Sync internal state and scroll when 'selected' prop changes from parent
  useEffect(() => {
    if (!isDragging.current && selected !== internalSelected) {
      setInternalSelected(selected);
      const idx = items.indexOf(selected);
      if (idx >= 0 && ref.current) {
        setTimeout(() => {
          ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
        }, 50);
      }
    }
  }, [selected, items]);

  // Ensure scroll is correct when 'items' change (e.g. min/max constraints)
  useEffect(() => {
    if (!isDragging.current) {
      const idx = items.indexOf(selected);
      const safeIdx = idx >= 0 ? idx : 0;
      setTimeout(() => {
        ref.current?.scrollTo({ y: safeIdx * ITEM_H, animated: false });
      }, 10);
    }
  }, [items]);

  const handleScrollEnd = useCallback(
    (y: number) => {
      const idx = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const newValue = items[clamped];
      if (newValue !== undefined && newValue !== selected) {
        setInternalSelected(newValue);
        onSelect(newValue);
      } else {
        // Snap back to current if no change
        ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
      }
    },
    [items, selected, onSelect],
  );

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    handleScrollEnd(e.nativeEvent.contentOffset.y);
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // If there is velocity, momentum scroll will handle it
    if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) > 0.1) return;
    isDragging.current = false;
    handleScrollEnd(e.nativeEvent.contentOffset.y);
  };

  const onScrollBeginDrag = () => {
    isDragging.current = true;
  };

  return (
    <View style={[styles.wrapper, { width }]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.pickerContainer, { height: ITEM_H * VISIBLE, width }]}>
        {/* Selection highlight box */}
        <View style={[styles.highlight, { top: ITEM_H * PAD, height: ITEM_H }]} pointerEvents="none" />

        {/* Fades */}
        <View style={[styles.fade, styles.fadeTop, { height: ITEM_H * PAD }]} pointerEvents="none" />
        <View style={[styles.fade, styles.fadeBottom, { height: ITEM_H * PAD }]} pointerEvents="none" />

        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          snapToAlignment="center"
          decelerationRate="fast"
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          contentContainerStyle={{ paddingVertical: ITEM_H * PAD }}
        >
          {items.map((item, index) => {
            const isSelected = item === internalSelected;
            return (
              <View key={`${item}-${index}`} style={[styles.item, { height: ITEM_H }]}>
                <Text style={[
                  styles.itemText,
                  isSelected ? styles.itemTextActive : styles.itemTextInactive
                ]}>
                  {fmt(item)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  pickerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 0,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },
  fadeTop: {
    top: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  fadeBottom: {
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  itemTextActive: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 24,
  },
  itemTextInactive: {
    color: colors.text3,
    fontWeight: '500',
  },
});