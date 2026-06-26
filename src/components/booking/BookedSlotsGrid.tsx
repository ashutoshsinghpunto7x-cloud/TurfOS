import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BookingSlot } from '../../services/bookingService';
import { colors, radius } from '../../theme/theme';

interface HoldInfo {
  slotLabel: string; queueCount: number; expiresAt: string;
}

interface Props {
  bookings:     BookingSlot[];
  loading:      boolean;
  activeHolds?: HoldInfo[];
}

export default function BookedSlotsGrid({ bookings, loading, activeHolds = [] }: Props) {
  const navigation = useNavigation();

  if (loading) return null;

  const hasContent = bookings.length > 0 || activeHolds.length > 0;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>Booked Slots</Text>
      {!hasContent ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No bookings yet</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {bookings.map((b, idx) => (
            // Use compound key: id + index to guarantee uniqueness even if DB returns duplicate rows
            <TouchableOpacity
              key={`booked-${b.id}-${idx}`}
              style={styles.card}
              onPress={() => (navigation as any).navigate('BookingDetail', { bookingId: b.id })}
              activeOpacity={0.75}
            >
              <Text style={styles.cardTime} numberOfLines={1}>{b.slot}</Text>
              <Text style={styles.cardCustomer} numberOfLines={1}>{b.customer.split(' ')[0]}</Text>
              {b.sport ? (
                <View style={styles.sportChip}>
                  <Text style={styles.sportChipText}>{b.sport}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}

          {activeHolds.map((h, idx) => {
            const secsLeft = Math.max(
              0, Math.round((new Date(h.expiresAt).getTime() - Date.now()) / 1000),
            );
            const minsLeft = Math.floor(secsLeft / 60);
            const secsPart = secsLeft % 60;
            return (
              <View key={`hold-${h.slotLabel}-${idx}`} style={styles.heldCard}>
                <Text style={styles.heldTime} numberOfLines={1}>{h.slotLabel}</Text>
                <Text style={styles.heldLabel}>Under Process</Text>
                <Text style={styles.heldTimer}>⏳ {minsLeft}:{String(secsPart).padStart(2, '0')}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_W = 130;
const GAP    = 8;

const styles = StyleSheet.create({
  wrapper:        { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  emptyWrap:      { paddingHorizontal: 20, paddingBottom: 4 },
  emptyText:      { fontSize: 13, color: colors.text3 },
  scrollContent:  { paddingHorizontal: 20, gap: GAP },
  card:           { width: CARD_W, backgroundColor: colors.surface2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 10, gap: 4, justifyContent: 'center' },
  cardTime:       { fontSize: 11, fontWeight: '700', color: colors.text2, fontVariant: ['tabular-nums'] },
  cardCustomer:   { fontSize: 13, fontWeight: '600', color: colors.text },
  sportChip:      { alignSelf: 'flex-start', backgroundColor: colors.accent2, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  sportChipText:  { fontSize: 10, fontWeight: '700', color: colors.accentText },
  heldCard:       { width: CARD_W, backgroundColor: colors.warnBg, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.warn, paddingHorizontal: 10, paddingVertical: 10, gap: 3, justifyContent: 'center' },
  heldTime:       { fontSize: 11, fontWeight: '700', color: colors.warn, fontVariant: ['tabular-nums'] },
  heldLabel:      { fontSize: 11, fontWeight: '700', color: colors.warn },
  heldTimer:      { fontSize: 10, color: colors.warn, fontVariant: ['tabular-nums'] },
});