import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import {
  fetchTournaments, createTournament, updateTournament, deleteTournament,
  saveTournament,
  Tournament, TournamentFormat,
} from '../services/tournamentService';
import { colors, radius } from '../theme/theme';

const SPORTS = ['Cricket', 'Football', 'Badminton', 'Volleyball'];
const FORMATS: { key: TournamentFormat; label: string; desc: string }[] = [
  { key: 'knockout',              label: 'Knockout',           desc: 'Single elimination — lose and you\'re out' },
  { key: 'round_robin',           label: 'Round Robin',        desc: 'Every team plays each other once' },
  { key: 'round_robin_knockout',  label: 'League + Knockout',  desc: 'Group stage then knockout finals' },
];

const STATUS_COLORS: Record<string, string> = {
  draft:        '#94a3b8',
  registration: '#fbbf24',
  ongoing:      '#34d399',
  completed:    '#7c3aed',
  cancelled:    '#f87171',
};

export default function TournamentsScreen() {
  const navigation  = useNavigation<any>();
  const { profile } = useStore();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading]         = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving]           = useState(false);

  // Create form state
  const [name, setName]                 = useState('');
  const [sport, setSport]               = useState('Cricket');
  const [format, setFormat]             = useState<TournamentFormat>('knockout');
  const [numTeams, setNumTeams]         = useState('8');
  const [oversPerMatch, setOversPerMatch] = useState('10');
  const [entryFee, setEntryFee]         = useState('');
  const [prizePool, setPrizePool]       = useState('');
  const [winnerPrize, setWinnerPrize]   = useState('');
  const [runnerPrize, setRunnerPrize]   = useState('');
  const [bestPrize, setBestPrize]       = useState('');
  const [startDate, setStartDate]       = useState('');
  const [venue, setVenue]               = useState('');
  const [description, setDescription]   = useState('');
  const [rules, setRules]               = useState('');

  const resetForm = () => {
    setName(''); setSport('Cricket'); setFormat('knockout');
    setNumTeams('8'); setOversPerMatch('10'); setEntryFee('');
    setPrizePool(''); setWinnerPrize(''); setRunnerPrize('');
    setBestPrize(''); setStartDate(''); setVenue('');
    setDescription(''); setRules('');
  };

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { tournaments: t } = await fetchTournaments(profile.id);
    setTournaments(t);
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter a tournament name.'); return; }
    const nt = parseInt(numTeams, 10);
    if (isNaN(nt) || nt < 2) { Alert.alert('Invalid', 'Minimum 2 teams required.'); return; }
    if (nt > 64)              { Alert.alert('Invalid', 'Maximum 64 teams allowed.'); return; }

    setSaving(true);
    const { tournament, error } = await createTournament({
      ownerId:         profile!.id,
      name:            name.trim(),
      sport,
      format,
      numTeams:        nt,
      oversPerMatch:   parseInt(oversPerMatch, 10) || 10,
      entryFee:        parseFloat(entryFee) || 0,
      prizePool:       parseFloat(prizePool) || 0,
      winnerPrize:     parseFloat(winnerPrize) || 0,
      runnerUpPrize:   parseFloat(runnerPrize) || 0,
      bestPlayerPrize: parseFloat(bestPrize) || 0,
      customPrizes:    [],
      startDate:       startDate.trim() || null,
      endDate:         null,
      venue:           venue.trim() || null,
      description:     description.trim() || null,
      rules:           rules.trim() || null,
    });
    setSaving(false);

    if (error || !tournament) { Alert.alert('Error', error ?? 'Could not create tournament.'); return; }

    setCreateModal(false);
    resetForm();
    load();
    // Navigate into the new tournament
    navigation.navigate('TournamentDetail', { tournamentId: tournament.id });
  };

  const handleDelete = (t: Tournament) => {
    Alert.alert(
      'Delete Tournament',
      `Delete "${t.name}"? This will remove all teams, fixtures, and match data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteTournament(t.id);
            load();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Tournaments</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setCreateModal(true)}>
          <Text style={s.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : tournaments.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyTitle}>No Tournaments Yet</Text>
          <Text style={s.emptySub}>Create your first tournament to get started</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setCreateModal(true)}>
            <Text style={s.emptyBtnText}>+ Create Tournament</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {tournaments.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={s.card}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
              activeOpacity={0.8}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{t.name}</Text>
                  <Text style={s.cardSub}>{t.sport} · {FORMATS.find((f) => f.key === t.format)?.label} · {t.num_teams} Teams</Text>
                </View>
                <View style={[s.statusChip, { borderColor: STATUS_COLORS[t.status] ?? colors.border }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[t.status] ?? colors.text3 }]}>
                    {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={s.cardMeta}>
                {t.start_date && <Text style={s.metaItem}>📅 {t.start_date}</Text>}
                {t.venue && <Text style={s.metaItem}>📍 {t.venue}</Text>}
                {t.prize_pool > 0 && <Text style={s.metaItem}>🏆 ₹{t.prize_pool} Pool</Text>}
              </View>

              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.manageBtn}
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
                >
                  <Text style={s.manageBtnText}>Manage →</Text>
                </TouchableOpacity>

                {/* Save/Unsave action — owner can make a tournament permanent */}
                {t.status !== 'draft' && (
                  <TouchableOpacity
                    style={[s.saveBtn, t.is_saved && s.saveBtnSaved]}
                    onPress={() => {
                      Alert.alert(
                        t.is_saved ? 'Already Saved' : 'Save Tournament',
                        t.is_saved
                          ? 'This tournament is already saved permanently.'
                          : 'Save this tournament so customers can always see it in history?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Save',
                            onPress: async () => {
                              const { error } = await saveTournament(t.id);
                              if (error) Alert.alert('Error', error);
                              else load();
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={s.saveBtnText}>{t.is_saved ? '✓ Saved' : '💾 Save'}</Text>
                  </TouchableOpacity>
                )}

                {t.status === 'draft' && (
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(t)}>
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create Tournament Modal */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Create Tournament</Text>

            <Text style={s.fieldLabel}>Tournament Name *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="e.g. Playbox Premier League" placeholderTextColor={colors.text3} />

            <Text style={s.fieldLabel}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SPORTS.map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[s.chip, sport === sp && s.chipActive]}
                    onPress={() => setSport(sp)}
                  >
                    <Text style={[s.chipText, sport === sp && s.chipTextActive]}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>Format</Text>
            {FORMATS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[s.formatCard, format === f.key && s.formatCardActive]}
                onPress={() => setFormat(f.key)}
              >
                <Text style={[s.formatLabel, format === f.key && { color: colors.accentText }]}>{f.label}</Text>
                <Text style={s.formatDesc}>{f.desc}</Text>
              </TouchableOpacity>
            ))}

            <View style={s.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Number of Teams</Text>
                <TextInput style={s.input} value={numTeams} onChangeText={setNumTeams}
                  keyboardType="number-pad" placeholder="8" placeholderTextColor={colors.text3} />
              </View>
              {sport === 'Cricket' && (
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.fieldLabel}>Overs/Match</Text>
                  <TextInput style={s.input} value={oversPerMatch} onChangeText={setOversPerMatch}
                    keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.text3} />
                </View>
              )}
            </View>

            <Text style={s.sectionDivider}>Prize Money</Text>
            <View style={s.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Prize Pool (₹)</Text>
                <TextInput style={s.input} value={prizePool} onChangeText={setPrizePool}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.fieldLabel}>Entry Fee (₹)</Text>
                <TextInput style={s.input} value={entryFee} onChangeText={setEntryFee}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
              </View>
            </View>
            <View style={s.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Winner (₹)</Text>
                <TextInput style={s.input} value={winnerPrize} onChangeText={setWinnerPrize}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.fieldLabel}>Runner-up (₹)</Text>
                <TextInput style={s.input} value={runnerPrize} onChangeText={setRunnerPrize}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
              </View>
            </View>
            <Text style={s.fieldLabel}>Best Player Prize (₹)</Text>
            <TextInput style={s.input} value={bestPrize} onChangeText={setBestPrize}
              keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />

            <Text style={s.sectionDivider}>Details</Text>
            <Text style={s.fieldLabel}>Start Date</Text>
            <TextInput style={s.input} value={startDate} onChangeText={setStartDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.text3} />

            <Text style={s.fieldLabel}>Venue (optional)</Text>
            <TextInput style={s.input} value={venue} onChangeText={setVenue}
              placeholder="Turf name or address" placeholderTextColor={colors.text3} />

            <Text style={s.fieldLabel}>Description (optional)</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={description} onChangeText={setDescription}
              placeholder="Tournament description or rules" placeholderTextColor={colors.text3}
              multiline />

            <TouchableOpacity
              style={[s.createBtn, saving && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.createBtnText}>Create Tournament</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => { setCreateModal(false); resetForm(); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bg },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText:        { fontSize: 26, color: colors.text, fontWeight: '300' },
  title:           { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  addBtn:          { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm },
  addBtnText:      { fontSize: 13, fontWeight: '700', color: '#fff' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon:       { fontSize: 56 },
  emptyTitle:      { fontSize: 20, fontWeight: '800', color: colors.text },
  emptySub:        { fontSize: 14, color: colors.text2, textAlign: 'center' },
  emptyBtn:        { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 13 },
  emptyBtnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  list:            { padding: 16, gap: 12, paddingBottom: 40 },
  card:            { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardName:        { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
  cardSub:         { fontSize: 12, color: colors.text2 },
  statusChip:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:      { fontSize: 11, fontWeight: '700' },
  cardMeta:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metaItem:        { fontSize: 12, color: colors.text2 },
  cardActions:     { flexDirection: 'row', gap: 10 },
  manageBtn:       { flex: 1, backgroundColor: colors.accent2, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.accent },
  manageBtnText:   { fontSize: 13, fontWeight: '700', color: colors.accentText },
  deleteBtn:       { backgroundColor: colors.dangerBg, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.danger },
  deleteBtnText:   { fontSize: 13, fontWeight: '700', color: colors.danger },
  // Save button — amber when unsaved, green when saved
  saveBtn:         { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  saveBtnSaved:    { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' },
  saveBtnText:     { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHandle:     { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  fieldLabel:      { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input:           { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, marginBottom: 16 },
  chip:            { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipActive:      { backgroundColor: colors.accent2, borderColor: colors.accent },
  chipText:        { fontSize: 13, fontWeight: '600', color: colors.text2 },
  chipTextActive:  { color: colors.accentText },
  formatCard:      { backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 14, marginBottom: 8 },
  formatCardActive:{ backgroundColor: colors.accent2, borderColor: colors.accent },
  formatLabel:     { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  formatDesc:      { fontSize: 12, color: colors.text3 },
  rowTwo:          { flexDirection: 'row' },
  sectionDivider:  { fontSize: 13, fontWeight: '700', color: colors.text2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginBottom: 14, marginTop: 4 },
  createBtn:       { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  createBtnText:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  cancelBtn:       { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:   { fontSize: 14, color: colors.text2, fontWeight: '600' },
});