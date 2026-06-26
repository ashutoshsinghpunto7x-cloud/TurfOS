import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SPORTS, SportConfig } from '../../services/bookingService';
import { colors, radius } from '../../theme/theme';

interface Props {
  selected:   SportConfig | null;
  onSelect:   (s: SportConfig) => void;
}

export default function SportSelector({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {SPORTS.map((sport) => {
        const isSelected  = selected?.key === sport.key;
        const isAvailable = sport.available;

        return (
          <TouchableOpacity
            key={sport.key}
            style={[
              styles.card,
              isSelected   && styles.cardSelected,
              !isAvailable && styles.cardDisabled,
            ]}
            onPress={() => isAvailable && onSelect(sport)}
            activeOpacity={isAvailable ? 0.75 : 1}
          >
            {!isAvailable && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}
            <Text style={[styles.sportLabel, !isAvailable && styles.sportLabelDisabled]}>
              {sport.label}
            </Text>
            {isAvailable && (
              <Text style={[styles.priceLabel, isSelected && { color: colors.accentText }]}>
                ₹{sport.pricePerHour}/hr
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width:           '47%',
    backgroundColor: colors.surface2,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    padding:         14,
    position:        'relative',
    minHeight:       68,
    justifyContent:  'center',
  },
  cardSelected:      { backgroundColor: colors.accent2, borderColor: colors.accent },
  cardDisabled:      { opacity: 0.55 },
  comingSoonBadge: {
    position:        'absolute',
    top:             6,
    right:           6,
    backgroundColor: colors.surface,
    borderRadius:    8,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  comingSoonText:    { fontSize: 9, fontWeight: '700', color: colors.text3, textTransform: 'uppercase' },
  sportLabel:        { fontSize: 15, fontWeight: '700', color: colors.text },
  sportLabelDisabled:{ color: colors.text3 },
  priceLabel:        { fontSize: 12, color: colors.text3, marginTop: 4 , fontWeight: '500' },
});