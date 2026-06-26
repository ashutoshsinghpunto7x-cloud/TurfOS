import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/theme';

interface Props {
  queuePos:    number;   // 1 = active holder, 2+ = waiting
  expiresAt:   Date;
}

export default function SlotHoldBanner({ queuePos, expiresAt }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  if (queuePos === 1) {
    return (
      <View style={[styles.banner, styles.bannerActive]}>
        <Text style={styles.iconText}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleActive}>Slot held for you</Text>
          <Text style={styles.subActive}>Complete booking in {timeStr}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerWaiting]}>
      <Text style={styles.iconText}>⏳</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.titleWaiting}>Under Process</Text>
        <Text style={styles.subWaiting}>
          {queuePos - 1} {queuePos - 1 === 1 ? 'person' : 'people'} ahead  ·  ~{timeStr} remaining
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.sm, padding: 12, marginHorizontal: 20, marginVertical: 8, borderWidth: 1 },
  bannerActive:  { backgroundColor: colors.accent2,  borderColor: colors.accent  },
  bannerWaiting: { backgroundColor: colors.warnBg,   borderColor: '#F5D4A8'      },
  iconText:      { fontSize: 20 },
  titleActive:   { fontSize: 14, fontWeight: '700', color: colors.accentText },
  subActive:     { fontSize: 12, color: colors.accentText, opacity: 0.8, marginTop: 2, fontVariant: ['tabular-nums'] },
  titleWaiting:  { fontSize: 14, fontWeight: '700', color: colors.warn },
  subWaiting:    { fontSize: 12, color: colors.warn, opacity: 0.85, marginTop: 2, fontVariant: ['tabular-nums'] },
});