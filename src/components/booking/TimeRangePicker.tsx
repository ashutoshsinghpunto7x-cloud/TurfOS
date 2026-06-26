import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView,
} from 'react-native';
import { colors, radius } from '../../theme/theme';

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  /** All values are in 24-hour internally */
  startH: number; onStartH: (v: number) => void;
  startM: number; onStartM: (v: number) => void;
  endH:   number; onEndH:   (v: number) => void;
  endM:   number; onEndM:   (v: number) => void;
  minStartH?: number;
  minStartM?: number;
  error?: string | null;
}

// ── 12-hour helpers ────────────────────────────────────────────────────────

function to12(h24: number): { h12: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, period };
}

function to24(h12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return h12 === 12 ? 0  : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

const HOURS_12  = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES_15 = [0, 15, 30, 45];

// ── Time picker modal ──────────────────────────────────────────────────────

interface TimePickerModalProps {
  visible:    boolean;
  label:      string;
  hours24:    number;
  minutes:    number;
  onConfirm:  (h24: number, m: number) => void;
  onCancel:   () => void;
}

function TimePickerModal({ visible, label, hours24, minutes, onConfirm, onCancel }: TimePickerModalProps) {
  const init12 = to12(hours24);
  const [selH12, setSelH12]     = useState(init12.h12);
  const [selM, setSelM]         = useState(minutes);
  const [selPeriod, setPeriod]  = useState<'AM' | 'PM'>(init12.period);

  // Reset when modal opens with new value
  useEffect(() => {
    if (visible) {
      const i = to12(hours24);
      setSelH12(i.h12);
      setSelM(minutes);
      setPeriod(i.period);
    }
  }, [visible, hours24, minutes]);

  const handleConfirm = () => {
    onConfirm(to24(selH12, selPeriod), selM);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={tpm.overlay}>
        <View style={tpm.sheet}>
          <View style={tpm.handle} />
          <Text style={tpm.title}>{label}</Text>

          {/* Hour row */}
          <Text style={tpm.sectionLabel}>Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={tpm.pillRow}>
            {HOURS_12.map((h) => (
              <TouchableOpacity
                key={h}
                style={[tpm.pill, selH12 === h && tpm.pillActive]}
                onPress={() => setSelH12(h)}
              >
                <Text style={[tpm.pillText, selH12 === h && tpm.pillTextActive]}>
                  {String(h).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Minute row */}
          <Text style={tpm.sectionLabel}>Minute</Text>
          <View style={tpm.pillRow}>
            {MINUTES_15.map((m) => (
              <TouchableOpacity
                key={m}
                style={[tpm.pill, selM === m && tpm.pillActive]}
                onPress={() => setSelM(m)}
              >
                <Text style={[tpm.pillText, selM === m && tpm.pillTextActive]}>
                  {String(m).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AM / PM toggle */}
          <Text style={tpm.sectionLabel}>Period</Text>
          <View style={tpm.ampmRow}>
            {(['AM', 'PM'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[tpm.ampmBtn, selPeriod === p && tpm.ampmBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[tpm.ampmText, selPeriod === p && tpm.ampmTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={tpm.preview}>
            <Text style={tpm.previewText}>
              {String(selH12).padStart(2, '0')}:{String(selM).padStart(2, '0')} {selPeriod}
            </Text>
          </View>

          <TouchableOpacity style={tpm.confirmBtn} onPress={handleConfirm}>
            <Text style={tpm.confirmBtnText}>Set Time</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tpm.cancelBtn} onPress={onCancel}>
            <Text style={tpm.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const tpm = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:         { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:          { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 12 },
  pillRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill:           { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface2 },
  pillActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText:       { fontSize: 16, fontWeight: '600', color: colors.text2, fontVariant: ['tabular-nums'] },
  pillTextActive: { color: '#fff', fontWeight: '800' },
  ampmRow:        { flexDirection: 'row', gap: 12 },
  ampmBtn:        { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center' },
  ampmBtnActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  ampmText:       { fontSize: 18, fontWeight: '700', color: colors.text2 },
  ampmTextActive: { color: '#fff' },
  preview:        { backgroundColor: colors.accent2, borderRadius: radius.sm, padding: 14, alignItems: 'center', marginVertical: 16 },
  previewText:    { fontSize: 28, fontWeight: '900', color: colors.accentText, fontVariant: ['tabular-nums'] },
  confirmBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  cancelBtn:      { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:  { fontSize: 14, color: colors.text2, fontWeight: '600' },
});

// ── Main TimeRangePicker ───────────────────────────────────────────────────

export default function TimeRangePicker({
  startH, onStartH, startM, onStartM,
  endH,   onEndH,   endM,   onEndM,
  error,
}: Props) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd]     = useState(false);

  const startLabel = to12(startH);
  const endLabel   = to12(endH);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {/* Start time button */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Start Time</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setShowStart(true)}>
            <Text style={styles.timeBtnText}>
              {String(startLabel.h12).padStart(2, '0')}:{String(startM).padStart(2, '0')}
            </Text>
            <View style={[styles.periodBadge, startLabel.period === 'AM' ? styles.amBadge : styles.pmBadge]}>
              <Text style={styles.periodText}>{startLabel.period}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.arrow}>→</Text>

        {/* End time button */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>End Time</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setShowEnd(true)}>
            <Text style={styles.timeBtnText}>
              {String(endLabel.h12).padStart(2, '0')}:{String(endM).padStart(2, '0')}
            </Text>
            <View style={[styles.periodBadge, endLabel.period === 'AM' ? styles.amBadge : styles.pmBadge]}>
              <Text style={styles.periodText}>{endLabel.period}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠  {error}</Text>
        </View>
      )}

      {/* Start time modal */}
      <TimePickerModal
        visible={showStart}
        label="Select Start Time"
        hours24={startH}
        minutes={startM}
        onConfirm={(h24, m) => {
          onStartH(h24);
          onStartM(m);
          setShowStart(false);
          // Auto-push end time if end <= start
          const startTotal = h24 * 60 + m;
          const endTotal   = endH  * 60 + endM;
          if (endTotal <= startTotal) {
            const newEndTotal = startTotal + 60;
            onEndH(Math.floor(newEndTotal / 60) % 24);
            onEndM(newEndTotal % 60);
          }
        }}
        onCancel={() => setShowStart(false)}
      />

      {/* End time modal */}
      <TimePickerModal
        visible={showEnd}
        label="Select End Time"
        hours24={endH}
        minutes={endM}
        onConfirm={(h24, m) => {
          onEndH(h24);
          onEndM(m);
          setShowEnd(false);
        }}
        onCancel={() => setShowEnd(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { },
  row:          { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12 },
  group:        { alignItems: 'center', flex: 1 },
  groupLabel:   { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  timeBtn:      { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  timeBtnText:  { fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  periodBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  amBadge:      { backgroundColor: colors.infoBg },
  pmBadge:      { backgroundColor: colors.dangerBg },
  periodText:   { fontSize: 13, fontWeight: '700', color: colors.text },
  arrow:        { fontSize: 20, color: colors.text3, paddingBottom: 20 },
  errorBox:     { marginTop: 12, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F5B8B3' },
  errorText:    { fontSize: 13, color: colors.danger, fontWeight: '600' },
});