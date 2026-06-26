import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { colors, radius, font, spacing, statusConfig } from '../theme/theme';
import { fetchPastBookingsFiltered, PeriodBooking } from '../services/bookingService';

// ── Status filter chips ────────────────────────────────────────────────────

const STATUS_FILTERS = ['All', 'Confirmed', 'Completed', 'Cancelled', 'Pending'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

// ── Lightweight calendar picker ────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean;
  selected: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [year,  setYear]  = useState(selected ? parseInt(selected.slice(0,4)) : today.getFullYear());
  const [month, setMonth] = useState(selected ? parseInt(selected.slice(5,7)) - 1 : today.getMonth());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.calOverlay} onPress={onClose}>
        <Pressable style={s.calBox} onPress={e => e.stopPropagation()}>
          {/* Month nav */}
          <View style={s.calHeader}>
            <TouchableOpacity onPress={prevMonth} hitSlop={12} style={s.calArrow}>
              <Text style={s.calArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calMonthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={12} style={s.calArrow}>
              <Text style={s.calArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.calRow}>
            {DAYS.map(d => (
              <Text key={d} style={s.calDayHead}>{d}</Text>
            ))}
          </View>

          {/* Date grid */}
          <View style={s.calGrid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={s.calCell} />;
              const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSel   = iso === selected;
              const isToday = iso === todayISO;
              const isFuture = iso >= todayISO;
              return (
                <TouchableOpacity
                  key={iso}
                  style={[s.calCell, isSel && s.calCellSel, isToday && !isSel && s.calCellToday]}
                  onPress={() => { if (!isFuture) { onSelect(iso); onClose(); } }}
                  disabled={isFuture}
                >
                  <Text style={[s.calDayNum, isSel && s.calDayNumSel, isFuture && s.calDayFuture]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={s.calClearBtn} onPress={() => { onSelect(''); onClose(); }}>
            <Text style={s.calClearText}>Clear date</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Booking card ───────────────────────────────────────────────────────────

function BookingCard({ item }: { item: PeriodBooking }) {
  const sc = statusConfig[item.status] ?? statusConfig.Confirmed;
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Text style={s.customerName}>{item.customer}</Text>
          <Text style={s.phone}>{item.phone || '—'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[s.statusText, { color: sc.text }]}>{item.status}</Text>
        </View>
      </View>
      <View style={s.cardMeta}>
        <Text style={s.metaItem}>🕐 {item.slot}</Text>
        <Text style={s.metaItem}>🏟 {item.turf}</Text>
        {item.sport ? <Text style={s.metaItem}>⚽ {item.sport}</Text> : null}
      </View>
      <View style={s.cardBottom}>
        <Text style={s.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
        {item.paid
          ? <Text style={s.paid}>✓ Paid</Text>
          : <Text style={s.unpaid}>Unpaid</Text>}
      </View>
    </View>
  );
}

// ── Section header (date group) ────────────────────────────────────────────

function SectionHeader({ date }: { date: string }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionDate}>{label}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function PastBookingsScreen() {
  const navigation = useNavigation();
  const [bookings,     setBookings]     = useState<PeriodBooking[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [dateFilter,   setDateFilter]   = useState<string | null>(null);
  const [calVisible,   setCalVisible]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { bookings: data } = await fetchPastBookingsFiltered({
      date:   dateFilter || undefined,
      status: statusFilter === 'All' ? '' : statusFilter,
    });
    setBookings(data);
    setLoading(false);
  }, [dateFilter, statusFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Group bookings by date for section headers
  const sections = useMemo(() => {
    const map = new Map<string, PeriodBooking[]>();
    for (const b of bookings) {
      const arr = map.get(b.booking_date) ?? [];
      arr.push(b);
      map.set(b.booking_date, arr);
    }
    const result: { date: string; items: PeriodBooking[] }[] = [];
    map.forEach((items, date) => result.push({ date, items }));
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [bookings]);

  // Flatten into a list with section markers
  const flatList = useMemo(() => {
    const rows: ({ type: 'header'; date: string } | { type: 'item'; item: PeriodBooking })[] = [];
    for (const sec of sections) {
      rows.push({ type: 'header', date: sec.date });
      for (const item of sec.items) rows.push({ type: 'item', item });
    }
    return rows;
  }, [sections]);

  const dateLabel = dateFilter
    ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'All dates';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} hitSlop={12}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.title}>Past Bookings</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Date filter button */}
      <View style={s.dateRow}>
        <TouchableOpacity style={[s.dateBtn, dateFilter && s.dateBtnActive]} onPress={() => setCalVisible(true)}>
          <Text style={s.dateBtnIcon}>📅</Text>
          <Text style={[s.dateBtnLabel, dateFilter && s.dateBtnLabelActive]}>{dateLabel}</Text>
          {dateFilter && (
            <TouchableOpacity onPress={() => setDateFilter(null)} hitSlop={8}>
              <Text style={s.dateClear}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        <Text style={s.totalCount}>{bookings.length} bookings</Text>
      </View>

      {/* Status chips */}
      <View style={s.chips}>
        {STATUS_FILTERS.map(sf => {
          const active = sf === statusFilter;
          return (
            <TouchableOpacity
              key={sf}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setStatusFilter(sf)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{sf}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : flatList.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>No bookings found</Text>
          <Text style={s.emptySubtext}>Try changing the date or status filter</Text>
        </View>
      ) : (
        <FlatList
          data={flatList}
          keyExtractor={(row, i) => row.type === 'header' ? `h-${row.date}` : `b-${row.item.id}`}
          contentContainerStyle={s.listContent}
          renderItem={({ item: row }) =>
            row.type === 'header'
              ? <SectionHeader date={row.date} />
              : <BookingCard item={row.item} />
          }
        />
      )}

      <CalendarPicker
        visible={calVisible}
        selected={dateFilter}
        onSelect={iso => setDateFilter(iso || null)}
        onClose={() => setCalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon:    { fontSize: 22, color: colors.text },
  title:       { fontSize: font.lg, fontWeight: font.bold, color: colors.text },

  dateRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  dateBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: colors.cardGlass,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   7,
  },
  dateBtnActive:      { borderColor: colors.accent, backgroundColor: colors.accent2 },
  dateBtnIcon:        { fontSize: 14 },
  dateBtnLabel:       { fontSize: font.sm, color: colors.text2, fontWeight: font.medium },
  dateBtnLabelActive: { color: colors.accentText },
  dateClear:          { fontSize: 12, color: colors.accentText, marginLeft: 2 },
  totalCount:         { fontSize: font.sm, color: colors.text3 },

  chips: {
    flexDirection:    'row',
    gap:              6,
    paddingHorizontal: spacing.lg,
    paddingBottom:    spacing.sm,
    flexWrap:         'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      radius.pill,
    backgroundColor:   colors.cardGlass,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  chipActive:     { backgroundColor: colors.accent2, borderColor: colors.accent },
  chipText:       { fontSize: font.xs, color: colors.text2, fontWeight: font.medium },
  chipTextActive: { color: colors.accentText },

  listContent: { padding: spacing.md, paddingTop: 4 },

  sectionHeader: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: 4,
    marginTop:         spacing.md,
    marginBottom:      4,
  },
  sectionDate: {
    fontSize:      font.xs,
    fontWeight:    font.bold,
    color:         colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.xs,
  },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   6,
  },
  cardLeft:    { flex: 1, marginRight: 8 },
  customerName:{ fontSize: font.md, fontWeight: font.semibold, color: colors.text },
  phone:       { fontSize: font.xs, color: colors.text3, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      radius.pill,
    borderWidth:       1,
  },
  statusText: { fontSize: font.xs, fontWeight: font.bold },

  cardMeta: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginBottom:   6,
  },
  metaItem:  { fontSize: font.xs, color: colors.text2 },

  cardBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      2,
  },
  amount: { fontSize: font.md, fontWeight: font.bold, color: colors.text },
  paid:   { fontSize: font.xs, color: colors.success, fontWeight: font.semibold },
  unpaid: { fontSize: font.xs, color: colors.warning, fontWeight: font.semibold },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontSize: font.md, color: colors.text2, fontWeight: font.semibold },
  emptySubtext:{ fontSize: font.sm, color: colors.text3 },

  // Calendar
  calOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  calBox: {
    backgroundColor: colors.card,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.borderLight,
    padding:         spacing.lg,
    width:           320,
  },
  calHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  calArrow:      { padding: 4 },
  calArrowText:  { fontSize: 24, color: colors.text, lineHeight: 28 },
  calMonthLabel: { fontSize: font.md, fontWeight: font.bold, color: colors.text },

  calRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    marginBottom:   6,
  },
  calDayHead: { width: 36, textAlign: 'center', fontSize: font.xs, color: colors.text3, fontWeight: font.semibold },

  calGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, margin: 2 },
  calCellSel:   { backgroundColor: colors.accent },
  calCellToday: { borderWidth: 1, borderColor: colors.accent },
  calDayNum:    { fontSize: font.sm, color: colors.text, fontWeight: font.medium },
  calDayNumSel: { color: '#fff', fontWeight: font.bold },
  calDayFuture: { color: colors.text4 },

  calClearBtn: {
    marginTop:   spacing.md,
    alignItems:  'center',
    paddingVertical: spacing.xs,
  },
  calClearText:{ fontSize: font.sm, color: colors.accent, fontWeight: font.semibold },
});
