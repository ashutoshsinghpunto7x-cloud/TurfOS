import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { colors, radius, font, spacing } from '../theme/theme';
import { fetchAttendanceForDate, StaffAttendanceStatus } from '../services/attendanceService';
import { todayISOInIST } from '../services/bookingService';

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function StaffRow({ item }: { item: StaffAttendanceStatus }) {
  return (
    <View style={s.row}>
      <View style={[s.statusDot, item.present ? s.statusDotPresent : s.statusDotAbsent]} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{item.fullName}</Text>
        {item.present && <Text style={s.time}>Marked at {fmtTime(item.markedAt)}</Text>}
      </View>
      <Text style={[s.badge, item.present ? s.badgePresent : s.badgeAbsent]}>
        {item.present ? 'Present' : 'Not marked'}
      </Text>
    </View>
  );
}

export default function AttendanceScreen() {
  const navigation = useNavigation();
  const today = todayISOInIST();

  const [date, setDate]         = useState(today);
  const [records, setRecords]   = useState<StaffAttendanceStatus[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const { records: r } = await fetchAttendanceForDate(d);
    setRecords(r);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(date); }, [load, date]));

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const presentCount = records.filter(r => r.present).length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} hitSlop={12}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.title}>Attendance</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.dateRow}>
        <TouchableOpacity style={s.navBtn} onPress={() => setDate(d => shiftDate(d, -1))} hitSlop={10}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.dateLabel}>{dateLabel}</Text>
          {date !== today && (
            <TouchableOpacity onPress={() => setDate(today)}>
              <Text style={s.todayLink}>Jump to today</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.navBtn, date >= today && s.navBtnDisabled]}
          onPress={() => date < today && setDate(d => shiftDate(d, 1))}
          disabled={date >= today}
          hitSlop={10}
        >
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.summary}>{presentCount} of {records.length} staff present</Text>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : records.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🧍</Text>
          <Text style={s.emptyText}>No staff members found</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.staffId}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => <StaffRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuIcon: { fontSize: 22, color: colors.text },
  title:    { fontSize: font.lg, fontWeight: font.bold, color: colors.text },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  navBtn:         { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.cardGlass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.35 },
  navArrow:       { fontSize: 20, color: colors.text, fontWeight: '600' },
  dateLabel:      { fontSize: font.md, fontWeight: font.bold, color: colors.text },
  todayLink:      { fontSize: font.xs, color: colors.accentText, fontWeight: font.semibold, marginTop: 2 },

  summary: { fontSize: font.sm, color: colors.text3, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  listContent: { padding: spacing.md, paddingTop: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.xs,
  },
  statusDot:        { width: 10, height: 10, borderRadius: 5 },
  statusDotPresent: { backgroundColor: colors.successText },
  statusDotAbsent:  { backgroundColor: colors.text4 },
  name:             { fontSize: font.md, fontWeight: font.semibold, color: colors.text },
  time:             { fontSize: font.xs, color: colors.text3, marginTop: 2 },
  badge:            { fontSize: font.xs, fontWeight: font.bold },
  badgePresent:     { color: colors.successText },
  badgeAbsent:      { color: colors.text3 },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: font.md, color: colors.text2, fontWeight: font.semibold },
});
