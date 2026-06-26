import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BookingSlot, getCurrentISTTime } from '../../services/bookingService';
import { colors, radius } from '../../theme/theme';

interface Props {
  booking:         BookingSlot;
  onPressPOS?:     () => void;
  onPressInvoice:  () => void;
  onPressGenBill?: () => void;
  isExpired:       boolean;
  role:            'owner' | 'staff' | 'customer';
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

/**
 * Parse end time from slot label.
 * Handles both formats:
 *   24h: "09:00–11:00"
 *   12h: "09:00 AM–11:00 PM"  or  "09:00 AM–11:00PM"
 * Returns total minutes from midnight, or null if unparseable.
 */
function parseSlotEndMinutes(slotLabel: string): number | null {
  if (!slotLabel) return null;

  // Split on en-dash or regular dash
  const sep = slotLabel.includes('–') ? '–' : '-';
  const parts = slotLabel.split(sep);
  if (parts.length < 2) return null;

  const endStr = parts[parts.length - 1].trim();

  // Try 12-hour format: "11:00 PM" or "11:00PM"
  const ampm12 = endStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm12) {
    let h = parseInt(ampm12[1], 10);
    const m = parseInt(ampm12[2], 10);
    const period = ampm12[3].toUpperCase();
    if (isNaN(h) || isNaN(m)) return null;
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }

  // Try 24-hour format: "11:00"
  const h24 = endStr.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  return null;
}

function firstName(fullName: string): string {
  return (fullName ?? '').trim().split(' ')[0] || fullName;
}

export default function CurrentBookingBlock({
  booking, onPressPOS, onPressInvoice, isExpired, role,
}: Props) {
  const [secsLeft, setSecsLeft] = useState<number>(0);
  const [parseFailed, setParseFailed] = useState(false);

  useEffect(() => {
    const endM = parseSlotEndMinutes(booking.slot);
    if (endM === null) {
      setParseFailed(true);
      return;
    }
    setParseFailed(false);

    const update = () => {
      const { hours, minutes } = getCurrentISTTime();
      const now    = new Date();
      const nowM   = hours * 60 + minutes;
      let diffM    = endM - nowM;

      // Handle overnight: if end is before now in minutes, it wraps past midnight
      if (diffM < 0) diffM += 1440;

      const secs = Math.max(0, diffM * 60 - now.getSeconds());
      setSecsLeft(secs);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [booking.slot]);

  const minsLeft = Math.floor(secsLeft / 60);
  const secsPart = secsLeft % 60;
  const isWarning = !isExpired && minsLeft < 6 && !parseFailed;

  // Safe display
  let timeDisplay: string;
  if (parseFailed) {
    timeDisplay = 'Time unknown';
  } else if (isExpired) {
    timeDisplay = 'Slot ended';
  } else if (secsLeft === 0 && minsLeft === 0) {
    timeDisplay = 'Ending now';
  } else {
    timeDisplay = `${pad(minsLeft)}:${pad(secsPart)} left`;
  }

  const name  = firstName(booking.customer ?? '');
  const sport = booking.sport ?? '';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>Current Booking</Text>

      <View style={[
        styles.block,
        isExpired   ? styles.blockExpired  :
        isWarning   ? styles.blockWarning  :
                      styles.blockActive,
      ]}>
        {/* Left — info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.customerName} numberOfLines={1}>{name}</Text>
            {!!sport && (
              <View style={styles.sportChip}>
                <Text style={styles.sportChipText}>{sport}</Text>
              </View>
            )}
          </View>

          <Text style={styles.slotTime}>{booking.slot}</Text>

          {/* Timer / expired */}
          {isExpired ? (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredText}>Slot ended</Text>
            </View>
          ) : (
            <View style={[styles.timerBadge, isWarning && styles.timerBadgeWarn]}>
              <Text style={[styles.timerText, isWarning && styles.timerTextWarn]}>
                {isWarning ? '⚠ ' : '⏱ '}{timeDisplay}
              </Text>
            </View>
          )}
        </View>

        {/* Right — action buttons */}
        <View style={styles.actions}>
          {role !== 'customer' && !!onPressPOS && (
            <TouchableOpacity style={styles.posBtn} onPress={onPressPOS}>
              <Text style={styles.posBtnText}>🛒 POS</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.invoiceBtn} onPress={onPressInvoice}>
            <Text style={styles.invoiceBtnText}>🧾 Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:          { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  block:            { marginHorizontal: 20, marginBottom: 10, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2 },
  blockActive:      { borderColor: colors.accent,  backgroundColor: colors.accent2  },
  blockWarning:     { borderColor: colors.warn,    backgroundColor: colors.warnBg   },
  blockExpired:     { borderColor: colors.text3,   backgroundColor: colors.surface2 },
  info:             { flex: 1, gap: 4 },
  nameRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  customerName:     { fontSize: 15, fontWeight: '800', color: colors.text },
  sportChip:        { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  sportChipText:    { fontSize: 10, fontWeight: '700', color: '#fff' },
  slotTime:         { fontSize: 12, color: colors.text2, fontVariant: ['tabular-nums'], fontWeight: '500' },
  timerBadge:       { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  timerBadgeWarn:   { backgroundColor: colors.warn },
  timerText:        { fontSize: 11, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  timerTextWarn:    { color: '#fff' },
  expiredBadge:     { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.text3 },
  expiredText:      { fontSize: 11, fontWeight: '600', color: colors.text3 },
  actions:          { flexDirection: 'column', gap: 6, marginLeft: 10 },
  posBtn:           { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  posBtnText:       { fontSize: 12, fontWeight: '700', color: '#fff' },
  invoiceBtn:       { backgroundColor: colors.dark, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  invoiceBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
});