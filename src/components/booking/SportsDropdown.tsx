import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { SPORTS, SportConfig } from '../../services/bookingService';

const T = {
  bg: '#FAFAFC', surface: '#FFFFFF', text: '#1A1A1A', text2: '#7B7B8A',
  text3: '#AEAEBB', border: 'rgba(0,0,0,0.06)', purple: '#7C4DFF',
  purpleBg: 'rgba(124,77,255,0.09)', purpleBd: 'rgba(124,77,255,0.20)',
  white: '#FFFFFF',
};

interface Props {
  selected:   SportConfig | null;
  onSelect:   (sport: SportConfig) => void;
  disabled?:  boolean;
}

export default function SportsDropdown({ selected, onSelect, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  const availableSports = SPORTS.filter((s) => s.available);
  const comingSoon      = SPORTS.filter((s) => !s.available);

  return (
    <>
      <TouchableOpacity
        style={[st.trigger, disabled && st.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.75}
      >
        {selected ? (
          <View style={st.triggerFilled}>
            <Text style={st.triggerSelectedText}>{selected.label}</Text>
            <Text style={st.triggerPrice}>₹{selected.pricePerHour}/hr</Text>
          </View>
        ) : (
          <Text style={st.triggerPlaceholder}>Select a sport…</Text>
        )}
        <Text style={st.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={st.dropdown}>
            <Text style={st.dropdownTitle}>Select Sport</Text>

            {/* Available sports */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableSports.map((sport) => {
                const isSelected = selected?.key === sport.key;
                return (
                  <TouchableOpacity
                    key={sport.key}
                    style={[st.option, isSelected && st.optionSelected]}
                    onPress={() => { onSelect(sport); setOpen(false); }}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[st.optionLabel, isSelected && st.optionLabelSelected]}>
                        {sport.label}
                      </Text>
                      <Text style={[st.optionPrice, isSelected && { color: T.purple }]}>
                        ₹{sport.pricePerHour}/hr
                      </Text>
                    </View>
                    {isSelected && <Text style={st.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* Coming soon sports (non-selectable) */}
              {comingSoon.length > 0 && (
                <>
                  <View style={st.divider} />
                  <Text style={st.comingSoonLabel}>Coming Soon</Text>
                  {comingSoon.map((sport) => (
                    <View key={sport.key} style={[st.option, st.optionDisabled]}>
                      <Text style={st.optionLabelDisabled}>{sport.label}</Text>
                      <View style={st.soonChip}>
                        <Text style={st.soonChipText}>Soon</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={st.closeBtn} onPress={() => setOpen(false)}>
              <Text style={st.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  trigger:               { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  triggerDisabled:       { opacity: 0.5 },
  triggerFilled:         { flex: 1 },
  triggerSelectedText:   { fontSize: 15, fontWeight: '700', color: T.text },
  triggerPrice:          { fontSize: 12, color: T.text3, marginTop: 2 },
  triggerPlaceholder:    { fontSize: 15, color: T.text3, flex: 1 },
  chevron:               { fontSize: 12, color: T.text3, marginLeft: 8 },
  overlay:               { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  dropdown:              { backgroundColor: T.surface, borderRadius: 20, padding: 20, maxHeight: 440, borderWidth: 1, borderColor: T.border },
  dropdownTitle:         { fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 14 },
  option:                { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionSelected:        { backgroundColor: T.purpleBg, borderWidth: 1, borderColor: T.purpleBd },
  optionDisabled:        { opacity: 0.45 },
  optionLabel:           { fontSize: 15, fontWeight: '600', color: T.text },
  optionLabelSelected:   { color: T.purple, fontWeight: '700' },
  optionLabelDisabled:   { fontSize: 15, color: T.text3 },
  optionPrice:           { fontSize: 12, color: T.text3, marginTop: 2 },
  checkmark:             { fontSize: 16, color: T.purple, fontWeight: '800' },
  divider:               { height: 1, backgroundColor: T.border, marginVertical: 10 },
  comingSoonLabel:       { fontSize: 11, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  soonChip:              { backgroundColor: T.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.border },
  soonChipText:          { fontSize: 10, fontWeight: '700', color: T.text3 },
  closeBtn:              { marginTop: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: T.bg, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  closeBtnText:          { fontSize: 14, fontWeight: '600', color: T.text2 },
});