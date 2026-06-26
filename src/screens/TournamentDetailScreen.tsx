import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  fetchTournaments, updateTournament, fetchTeams, registerTeam,
  deleteTeam, fetchFixtures, saveFixtures, generateKnockoutFixtures,
  generateRoundRobinFixtures, updateFixture, fetchStandings,
  initStandings, createManualFixture, getNextMatchNumber,
  Tournament, TournamentTeam, TournamentFixture, Standing,
} from '../services/tournamentService';
import { useStore } from '../store/useStore';
import { palette, radius, font, spacing, shadow } from '../theme/theme';

type Tab = 'overview' | 'teams' | 'fixtures' | 'standings';
type FixtureMode = 'auto' | 'manual';

const STATUS_COLORS: Record<string, string> = {
  scheduled: palette.textTertiary,
  live:       '#F87171',
  completed:  '#34D399',
  walkover:   palette.textTertiary,
  cancelled:  palette.redBright,
};

export default function TournamentDetailScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const { profile } = useStore();
  const { tournamentId } = route.params as { tournamentId: string };

  const [tab, setTab]                     = useState<Tab>('overview');
  const [tournament, setTournament]       = useState<Tournament | null>(null);
  const [teams, setTeams]                 = useState<TournamentTeam[]>([]);
  const [fixtures, setFixtures]           = useState<TournamentFixture[]>([]);
  const [standings, setStandings]         = useState<Standing[]>([]);
  const [loading, setLoading]             = useState(true);

  // Team registration modal
  const [teamModal, setTeamModal]         = useState(false);
  const [savingTeam, setSavingTeam]       = useState(false);
  const [teamName, setTeamName]           = useState('');
  const [captainName, setCaptainName]     = useState('');
  const [captainPhone, setCaptainPhone]   = useState('');
  const [vcName, setVcName]               = useState('');
  const [vcPhone, setVcPhone]             = useState('');

  // Fixture mode
  const [fixtureMode, setFixtureMode]     = useState<FixtureMode>('auto');

  // Manual fixture creation modal
  const [manualModal, setManualModal]     = useState(false);
  const [manualTeam1Id, setManualTeam1Id] = useState('');
  const [manualTeam2Id, setManualTeam2Id] = useState('');
  const [manualRound, setManualRound]     = useState('1');
  const [manualRoundLabel, setManualRoundLabel] = useState('Match');
  const [manualDate, setManualDate]       = useState('');
  const [manualTime, setManualTime]       = useState('');
  const [savingManual, setSavingManual]   = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [{ tournaments }, { teams: t }, { fixtures: f }, { standings: st }] = await Promise.all([
      fetchTournaments(profile.id),
      fetchTeams(tournamentId),
      fetchFixtures(tournamentId),
      fetchStandings(tournamentId),
    ]);
    setTournament(tournaments.find((x) => x.id === tournamentId) ?? null);
    setTeams(t); setFixtures(f); setStandings(st);
    setLoading(false);
  }, [tournamentId, profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Team registration ─────────────────────────────────────────────────────

  const handleRegisterTeam = async () => {
    if (!teamName.trim())   { Alert.alert('Required', 'Enter team name.'); return; }
    if (!captainName.trim()){ Alert.alert('Required', 'Enter captain name.'); return; }
    if (captainPhone.trim().length < 10) { Alert.alert('Required', 'Enter valid captain phone.'); return; }
    if (tournament && teams.length >= tournament.num_teams) {
      Alert.alert('Full', `Maximum ${tournament.num_teams} teams allowed.`); return;
    }
    setSavingTeam(true);
    const { error } = await registerTeam({
      tournamentId, teamName: teamName.trim(), captainName: captainName.trim(),
      captainPhone: captainPhone.trim(), vcName: vcName.trim() || null, vcPhone: vcPhone.trim() || null,
    });
    setSavingTeam(false);
    if (error) { Alert.alert('Error', error); return; }
    setTeamModal(false);
    setTeamName(''); setCaptainName(''); setCaptainPhone(''); setVcName(''); setVcPhone('');
    load();
  };

  // ── Auto fixture generation ───────────────────────────────────────────────

  const handleGenerateFixtures = async () => {
    if (!tournament) return;
    if (teams.length < 2) { Alert.alert('Not enough teams', 'Register at least 2 teams first.'); return; }

    const hasCompleted = fixtures.some((f) => f.status === 'completed' || f.status === 'live');
    const proceed = async () => {
      let generated;
      if (tournament.format === 'round_robin' || tournament.format === 'round_robin_knockout') {
        generated = generateRoundRobinFixtures(teams, tournamentId);
      } else {
        generated = generateKnockoutFixtures(teams, tournamentId);
      }
      const { error } = await saveFixtures(tournamentId, generated);
      if (error) { Alert.alert('Error', error); return; }
      if (tournament.format !== 'knockout') await initStandings(tournamentId, teams);
      await updateTournament(tournamentId, { status: 'ongoing' });
      load();
      Alert.alert('✓ Fixtures Generated', `${generated.length} matches scheduled.`);
    };

    if (hasCompleted) {
      Alert.alert('Matches in Progress',
        'Some matches are completed. Only unplayed fixtures will be regenerated. Continue?',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: proceed }]);
    } else {
      proceed();
    }
  };

  // ── Manual fixture creation ───────────────────────────────────────────────

  const handleCreateManualFixture = async () => {
    if (!manualTeam1Id || !manualTeam2Id) { Alert.alert('Required', 'Select both teams.'); return; }
    if (manualTeam1Id === manualTeam2Id)  { Alert.alert('Invalid', 'Teams must be different.'); return; }

    const t1 = teams.find((t) => t.id === manualTeam1Id);
    const t2 = teams.find((t) => t.id === manualTeam2Id);

    // Check for duplicate matchup in existing fixtures
    const duplicate = fixtures.find((f) =>
      ((f.team1_id === manualTeam1Id && f.team2_id === manualTeam2Id) ||
       (f.team1_id === manualTeam2Id && f.team2_id === manualTeam1Id)) &&
      f.status !== 'cancelled'
    );
    if (duplicate) {
      Alert.alert(
        'Match exists',
        `${t1?.team_name} vs ${t2?.team_name} already has a fixture (Match ${duplicate.match_number}). Create another?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Anyway', onPress: () => doCreateManual(t1!, t2!) },
        ],
      );
      return;
    }

    doCreateManual(t1!, t2!);
  };

  const doCreateManual = async (t1: TournamentTeam, t2: TournamentTeam) => {
    setSavingManual(true);
    const matchNum = await getNextMatchNumber(tournamentId);
    const { error } = await createManualFixture({
      tournamentId,
      round:       parseInt(manualRound, 10) || 1,
      roundLabel:  manualRoundLabel.trim() || 'Match',
      matchNumber: matchNum,
      team1Id:     t1.id,
      team2Id:     t2.id,
      team1Name:   t1.team_name,
      team2Name:   t2.team_name,
      matchDate:   manualDate.trim() || null,
      matchTime:   manualTime.trim() || null,
      venue:       null,
    });
    setSavingManual(false);
    if (error) { Alert.alert('Error', error); return; }
    setManualModal(false);
    setManualTeam1Id(''); setManualTeam2Id('');
    setManualRound('1'); setManualRoundLabel('Match');
    setManualDate(''); setManualTime('');
    if (tournament?.status === 'draft' || tournament?.status === 'registration') {
      await updateTournament(tournamentId, { status: 'ongoing' });
    }
    load();
    Alert.alert('✓ Fixture Created', `Match ${matchNum}: ${t1.team_name} vs ${t2.team_name}`);
  };

  // ── Status advance ────────────────────────────────────────────────────────

  const STATUS_NEXT: Record<string, string> = {
    draft: 'Open Registration', registration: 'Start Tournament', ongoing: 'Complete Tournament',
  };
  const handleStatusAdvance = async () => {
    if (!tournament) return;
    const map: Record<string, string> = { draft: 'registration', registration: 'ongoing', ongoing: 'completed' };
    const next = map[tournament.status];
    if (!next) return;
    await updateTournament(tournamentId, { status: next as any });
    load();
  };

  if (loading || !tournament) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={palette.accent} size="large" /></View></SafeAreaView>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'teams',     label: `Teams (${teams.length}/${tournament.num_teams})` },
    { key: 'fixtures',  label: `Fixtures (${fixtures.length})` },
    { key: 'standings', label: 'Standings' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{tournament.name}</Text>
          <Text style={s.headerSub}>{tournament.sport} · {tournament.format.replace(/_/g, ' ')}</Text>
        </View>
        {STATUS_NEXT[tournament.status] && (
          <TouchableOpacity style={s.advanceBtn} onPress={handleStatusAdvance}>
            <Text style={s.advanceBtnText}>{STATUS_NEXT[tournament.status]}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarWrap} contentContainerStyle={s.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[s.tabItem, tab === t.key && s.tabItemActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          {tournament.prize_pool > 0 && (
            <View style={s.prizeCard}>
              <Text style={s.prizeTitle}>🏆 Prize Pool: ₹{tournament.prize_pool}</Text>
              <View style={s.prizeGrid}>
                {tournament.winner_prize > 0    && <View style={s.prizeItem}><Text style={s.prizeLabel}>Winner</Text><Text style={s.prizeVal}>₹{tournament.winner_prize}</Text></View>}
                {tournament.runner_up_prize > 0 && <View style={s.prizeItem}><Text style={s.prizeLabel}>Runner-up</Text><Text style={s.prizeVal}>₹{tournament.runner_up_prize}</Text></View>}
                {tournament.best_player_prize > 0 && <View style={s.prizeItem}><Text style={s.prizeLabel}>Best Player</Text><Text style={s.prizeVal}>₹{tournament.best_player_prize}</Text></View>}
              </View>
            </View>
          )}
          {[
            { label: 'Format',      value: tournament.format.replace(/_/g, ' ') },
            { label: 'Teams',       value: `${teams.length} / ${tournament.num_teams}` },
            { label: 'Overs/Match', value: String(tournament.overs_per_match) },
            { label: 'Start Date',  value: tournament.start_date ?? '—' },
            { label: 'Venue',       value: tournament.venue ?? '—' },
            { label: 'Entry Fee',   value: tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : 'Free' },
          ].map((r) => (
            <View key={r.label} style={s.infoRow}>
              <Text style={s.infoLabel}>{r.label}</Text>
              <Text style={s.infoVal}>{r.value}</Text>
            </View>
          ))}
          {tournament.description ? <View style={s.descBox}><Text style={s.descText}>{tournament.description}</Text></View> : null}
        </ScrollView>
      )}

      {/* ── Teams ── */}
      {tab === 'teams' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          <TouchableOpacity
            style={[s.addTeamBtn, teams.length >= tournament.num_teams && { opacity: 0.5 }]}
            onPress={() => teams.length < tournament.num_teams && setTeamModal(true)}
          >
            <Text style={s.addTeamBtnText}>
              {teams.length >= tournament.num_teams ? '✓ All Teams Registered' : '+ Register Team'}
            </Text>
          </TouchableOpacity>
          {teams.length === 0 ? (
            <View style={s.emptyWrap}><Text style={s.emptyIcon}>👥</Text><Text style={s.emptyText}>No teams yet</Text></View>
          ) : (
            teams.map((team, i) => (
              <View key={team.id} style={s.teamCard}>
                <View style={s.teamTop}>
                  <View style={s.teamSeed}><Text style={s.teamSeedText}>{i + 1}</Text></View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={s.teamName}>{team.team_name}</Text>
                    <Text style={s.teamCaptain}>C: {team.captain_name} · {team.captain_phone}</Text>
                    {team.vc_name && <Text style={s.teamCaptain}>VC: {team.vc_name}</Text>}
                  </View>
                  {(tournament.status === 'registration' || tournament.status === 'draft') && (
                    <TouchableOpacity onPress={() => Alert.alert('Remove', `Remove "${team.team_name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteTeam(team.id); load(); } },
                    ])}>
                      <Text style={s.removeTeam}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Fixtures ── */}
      {tab === 'fixtures' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          {/* Fixture mode toggle */}
          <View style={s.fixtureModeRow}>
            <TouchableOpacity
              style={[s.fixtureModeBtn, fixtureMode === 'auto' && s.fixtureModeBtnActive]}
              onPress={() => setFixtureMode('auto')}
            >
              <Text style={[s.fixtureModeTxt, fixtureMode === 'auto' && { color: palette.accentBright }]}>
                ⚡ Auto Generate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.fixtureModeBtn, fixtureMode === 'manual' && s.fixtureModeBtnActive]}
              onPress={() => setFixtureMode('manual')}
            >
              <Text style={[s.fixtureModeTxt, fixtureMode === 'manual' && { color: palette.accentBright }]}>
                ✏️ Manual Create
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto mode */}
          {fixtureMode === 'auto' && (
            <TouchableOpacity style={s.generateBtn} onPress={handleGenerateFixtures}>
              <Text style={s.generateBtnText}>
                {fixtures.length > 0 ? '↻ Regenerate Fixtures' : '⚡ Generate Fixtures'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Manual mode */}
          {fixtureMode === 'manual' && (
            <TouchableOpacity
              style={s.manualCreateBtn}
              onPress={() => {
                if (teams.length < 2) { Alert.alert('Need Teams', 'Register at least 2 teams to create a fixture.'); return; }
                setManualModal(true);
              }}
            >
              <Text style={s.manualCreateBtnText}>+ Create Match Manually</Text>
            </TouchableOpacity>
          )}

          {/* Fixture list */}
          {fixtures.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyText}>No fixtures yet</Text>
            </View>
          ) : (
            Array.from(new Set(fixtures.map((f) => f.round))).map((round) => {
              const roundFixtures = fixtures.filter((f) => f.round === round);
              const roundLabel    = roundFixtures[0]?.round_label ?? `Round ${round}`;
              return (
                <View key={`r-${round}`}>
                  <Text style={s.roundLabel}>{roundLabel}</Text>
                  {roundFixtures.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[s.fixtureCard, f.status === 'completed' && s.fixtureCardDone, f.status === 'live' && s.fixtureCardLive]}
                      onPress={() => navigation.navigate('MatchScoring', { fixtureId: f.id, tournamentId })}
                    >
                      <View style={s.fixtureMeta}>
                        <Text style={s.fixtureMatchNum}>Match {f.match_number}</Text>
                        <View style={[s.fixStatusChip, { borderColor: STATUS_COLORS[f.status] + '66' }]}>
                          <Text style={[s.fixStatusText, { color: STATUS_COLORS[f.status] }]}>
                            {f.status === 'live' ? '🔴 LIVE' : f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.fixtureTeams}>
                        <Text style={[s.fixtureTeamName, f.winner_id === f.team1_id && s.winnerText]} numberOfLines={1}>
                          {f.team1_name ?? 'TBD'}
                        </Text>
                        <View style={s.vsBadge}><Text style={s.vsTxt}>VS</Text></View>
                        <Text style={[s.fixtureTeamName, { textAlign: 'right' }, f.winner_id === f.team2_id && s.winnerText]} numberOfLines={1}>
                          {f.team2_name ?? 'TBD'}
                        </Text>
                      </View>
                      {f.match_date && <Text style={s.fixtureDate}>📅 {f.match_date}{f.match_time ? ` · ${f.match_time}` : ''}</Text>}
                      {f.player_of_match && <Text style={s.pomText}>⭐ POM: {f.player_of_match}</Text>}
                      {f.status === 'scheduled' && <Text style={s.fixtureAction}>Tap to start scoring →</Text>}
                      {f.status === 'live' && <Text style={[s.fixtureAction, { color: '#F87171' }]}>Tap to continue scoring →</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Standings ── */}
      {tab === 'standings' && (
        <ScrollView contentContainerStyle={s.tabContent}>
          {standings.length === 0 ? (
            <View style={s.emptyWrap}><Text style={s.emptyIcon}>📊</Text><Text style={s.emptyText}>Standings appear after matches</Text></View>
          ) : (
            <View style={s.standingsTable}>
              <View style={[s.standingsRow, s.standingsHeader]}>
                <Text style={[s.sCell, s.sTeamCell, s.sHdr]}># Team</Text>
                <Text style={[s.sCell, s.sHdr]}>P</Text>
                <Text style={[s.sCell, s.sHdr]}>W</Text>
                <Text style={[s.sCell, s.sHdr]}>L</Text>
                <Text style={[s.sCell, s.sHdr]}>Pts</Text>
                <Text style={[s.sCell, s.sHdr]}>NRR</Text>
              </View>
              {standings.map((st, i) => (
                <View key={st.team_id} style={[s.standingsRow, i % 2 === 0 && s.standingsRowAlt]}>
                  <Text style={[s.sCell, s.sTeamCell]} numberOfLines={1}>{i + 1}. {st.team_name}</Text>
                  <Text style={s.sCell}>{st.played}</Text>
                  <Text style={s.sCell}>{st.won}</Text>
                  <Text style={s.sCell}>{st.lost}</Text>
                  <Text style={[s.sCell, s.sPtsCell]}>{st.points}</Text>
                  <Text style={s.sCell}>{st.nrr > 0 ? '+' : ''}{st.nrr}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Team registration modal ── */}
      <Modal visible={teamModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Register Team</Text>
            <Text style={s.modalSub}>Team {teams.length + 1} of {tournament.num_teams}</Text>
            {[
              { label: 'Team Name *',       val: teamName,     set: setTeamName,     ph: 'e.g. Thunder Strikers' },
              { label: 'Captain Name *',    val: captainName,  set: setCaptainName,  ph: 'Captain full name' },
              { label: 'Captain Phone *',   val: captainPhone, set: setCaptainPhone, ph: '10-digit number', num: true },
              { label: 'Vice Captain',      val: vcName,       set: setVcName,       ph: 'Optional' },
              { label: 'VC Phone',          val: vcPhone,      set: setVcPhone,      ph: 'Optional', num: true },
            ].map((f) => (
              <View key={f.label}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.input} value={f.val} onChangeText={f.set}
                  placeholder={f.ph} placeholderTextColor={palette.textTertiary}
                  keyboardType={f.num ? 'phone-pad' : 'default'} autoCapitalize="words" />
              </View>
            ))}
            <TouchableOpacity style={[s.saveBtn, savingTeam && { opacity: 0.7 }]} onPress={handleRegisterTeam} disabled={savingTeam}>
              {savingTeam ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Register Team</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setTeamModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Manual fixture creation modal ── */}
      <Modal visible={manualModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={s.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Create Match</Text>
            <Text style={s.modalSub}>Set up a match between any two teams</Text>

            <Text style={s.fieldLabel}>Team 1 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {teams.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.teamChip, manualTeam1Id === t.id && s.teamChipActive]}
                    onPress={() => setManualTeam1Id(t.id)}
                  >
                    <Text style={[s.teamChipText, manualTeam1Id === t.id && { color: palette.accentBright }]}>
                      {t.team_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>Team 2 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {teams.filter((t) => t.id !== manualTeam1Id).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.teamChip, manualTeam2Id === t.id && s.teamChipActive]}
                    onPress={() => setManualTeam2Id(t.id)}
                  >
                    <Text style={[s.teamChipText, manualTeam2Id === t.id && { color: palette.accentBright }]}>
                      {t.team_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Round</Text>
                <TextInput style={s.input} value={manualRound} onChangeText={setManualRound}
                  keyboardType="number-pad" placeholder="1" placeholderTextColor={palette.textTertiary} />
              </View>
              <View style={{ flex: 2, marginLeft: spacing.xs }}>
                <Text style={s.fieldLabel}>Round Label</Text>
                <TextInput style={s.input} value={manualRoundLabel} onChangeText={setManualRoundLabel}
                  placeholder="e.g. Quarter Final" placeholderTextColor={palette.textTertiary} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Date</Text>
                <TextInput style={s.input} value={manualDate} onChangeText={setManualDate}
                  placeholder="YYYY-MM-DD" placeholderTextColor={palette.textTertiary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Text style={s.fieldLabel}>Time</Text>
                <TextInput style={s.input} value={manualTime} onChangeText={setManualTime}
                  placeholder="e.g. 10:00 AM" placeholderTextColor={palette.textTertiary} />
              </View>
            </View>

            <TouchableOpacity style={[s.saveBtn, savingManual && { opacity: 0.7 }]}
              onPress={handleCreateManualFixture} disabled={savingManual}>
              {savingManual ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Create Match</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setManualModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: palette.abyss },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: 'rgba(8,12,20,0.97)', borderBottomWidth: 1, borderBottomColor: palette.borderFaint, gap: spacing.xs },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glass2, borderRadius: radius.xs, borderWidth: 1, borderColor: palette.borderSubtle },
  backText:        { fontSize: 22, color: palette.textPrimary, lineHeight: 28 },
  headerTitle:     { fontSize: font.sm, fontWeight: font.extrabold, color: palette.textPrimary },
  headerSub:       { fontSize: font.xs, color: palette.textTertiary, textTransform: 'capitalize' },
  advanceBtn:      { backgroundColor: palette.accentSoft, borderRadius: radius.xs, paddingHorizontal: spacing.xs + 2, paddingVertical: 6, borderWidth: 1, borderColor: palette.borderAccent },
  advanceBtnText:  { fontSize: font.xs - 1, fontWeight: font.bold, color: palette.accentBright },
  tabBarWrap:      { backgroundColor: 'rgba(8,12,20,0.97)', borderBottomWidth: 1, borderBottomColor: palette.borderFaint, maxHeight: 46 },
  tabBar:          { flexDirection: 'row', paddingHorizontal: 4 },
  tabItem:         { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:   { borderBottomColor: palette.accent },
  tabText:         { fontSize: font.xs, fontWeight: font.semibold, color: palette.textTertiary },
  tabTextActive:   { color: palette.accentBright, fontWeight: font.bold },
  tabContent:      { padding: spacing.md, paddingBottom: 40, gap: spacing.sm },
  // Overview
  prizeCard:       { backgroundColor: palette.violetSoft, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: palette.borderViolet },
  prizeTitle:      { fontSize: font.md, fontWeight: font.extrabold, color: palette.violetText, marginBottom: spacing.sm },
  prizeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prizeItem:       { backgroundColor: palette.glass2, borderRadius: radius.sm, padding: spacing.sm, minWidth: 90, alignItems: 'center', borderWidth: 1, borderColor: palette.borderFaint },
  prizeLabel:      { fontSize: font.xs, color: palette.textTertiary, marginBottom: 2 },
  prizeVal:        { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2, borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  infoLabel:       { fontSize: font.sm, color: palette.textTertiary },
  infoVal:         { fontSize: font.sm, fontWeight: font.bold, color: palette.textPrimary, textTransform: 'capitalize' },
  descBox:         { backgroundColor: palette.glass1, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint },
  descText:        { fontSize: font.sm, color: palette.textSecondary, lineHeight: 19 },
  // Teams
  addTeamBtn:      { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', ...shadow.accent },
  addTeamBtnText:  { fontSize: font.md, fontWeight: font.bold, color: '#fff' },
  teamCard:        { backgroundColor: palette.midnight, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint },
  teamTop:         { flexDirection: 'row', alignItems: 'center' },
  teamSeed:        { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderAccent },
  teamSeedText:    { fontSize: font.sm, fontWeight: font.extrabold, color: palette.accentBright },
  teamName:        { fontSize: font.md, fontWeight: font.bold, color: palette.textPrimary, marginBottom: 2 },
  teamCaptain:     { fontSize: font.xs, color: palette.textTertiary },
  removeTeam:      { fontSize: 18, color: palette.redBright, padding: 4 },
  emptyWrap:       { alignItems: 'center', gap: spacing.sm, paddingVertical: 40 },
  emptyIcon:       { fontSize: 44 },
  emptyText:       { fontSize: font.sm, color: palette.textTertiary },
  // Fixtures
  fixtureModeRow:  { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  fixtureModeBtn:  { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5, borderColor: palette.borderSubtle, backgroundColor: palette.glass1 },
  fixtureModeBtnActive: { backgroundColor: palette.accentSoft, borderColor: palette.borderAccent },
  fixtureModeTxt:  { fontSize: font.sm, fontWeight: font.bold, color: palette.textTertiary },
  generateBtn:     { backgroundColor: palette.accentSoft, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: palette.borderAccent },
  generateBtnText: { fontSize: font.md, fontWeight: font.bold, color: palette.accentBright },
  manualCreateBtn: { backgroundColor: palette.violetSoft, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: palette.borderViolet },
  manualCreateBtnText: { fontSize: font.md, fontWeight: font.bold, color: palette.violetText },
  roundLabel:      { fontSize: font.xs, fontWeight: font.extrabold, color: palette.accentBright, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.xs, marginBottom: spacing.xs - 2 },
  fixtureCard:     { backgroundColor: palette.midnight, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint, marginBottom: spacing.xs },
  fixtureCardDone: { borderLeftWidth: 3, borderLeftColor: '#34D399' },
  fixtureCardLive: { borderLeftWidth: 3, borderLeftColor: '#F87171', backgroundColor: 'rgba(239,68,68,0.05)' },
  fixtureMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  fixtureMatchNum: { fontSize: font.xs, fontWeight: font.bold, color: palette.textTertiary, textTransform: 'uppercase' },
  fixStatusChip:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  fixStatusText:   { fontSize: font.xs, fontWeight: font.bold },
  fixtureTeams:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  fixtureTeamName: { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary, flex: 1 },
  winnerText:      { color: '#34D399' },
  vsBadge:         { backgroundColor: palette.glass3, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2, marginHorizontal: 6 },
  vsTxt:           { fontSize: font.xs - 1, fontWeight: font.black, color: palette.textTertiary },
  fixtureDate:     { fontSize: font.xs, color: palette.textTertiary, marginTop: 4 },
  pomText:         { fontSize: font.xs, color: palette.amberBright, marginTop: 4 },
  fixtureAction:   { fontSize: font.xs, color: palette.accent, marginTop: 6, fontWeight: font.semibold },
  // Standings
  standingsTable:  { backgroundColor: palette.midnight, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: palette.borderFaint },
  standingsRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: spacing.sm },
  standingsHeader: { backgroundColor: palette.glass2 },
  standingsRowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
  sCell:           { width: 36, textAlign: 'center', fontSize: font.xs, color: palette.textSecondary },
  sTeamCell:       { flex: 1, textAlign: 'left' },
  sHdr:            { fontSize: font.xs - 1, fontWeight: font.extrabold, color: palette.textTertiary, textTransform: 'uppercase' },
  sPtsCell:        { fontWeight: font.extrabold, color: palette.accentBright },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: palette.midnight, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: 48, borderWidth: 1, borderColor: palette.borderSubtle, borderBottomWidth: 0 },
  modalHandle:     { width: 40, height: 4, backgroundColor: palette.glass4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle:      { fontSize: font.xl, fontWeight: font.extrabold, color: palette.textPrimary, marginBottom: 2 },
  modalSub:        { fontSize: font.xs, color: palette.textTertiary, marginBottom: spacing.md },
  fieldLabel:      { fontSize: font.xs, fontWeight: font.extrabold, color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  input:           { backgroundColor: palette.glass2, borderWidth: 1, borderColor: palette.borderSubtle, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: font.md, color: palette.textPrimary, marginBottom: spacing.sm },
  saveBtn:         { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4, ...shadow.accent },
  saveBtnText:     { fontSize: font.md, fontWeight: font.extrabold, color: '#fff' },
  cancelBtn:       { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText:   { fontSize: font.sm, color: palette.textTertiary, fontWeight: font.semibold },
  teamChip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, backgroundColor: palette.glass2, borderWidth: 1.5, borderColor: palette.borderSubtle },
  teamChipActive:  { backgroundColor: palette.accentSoft, borderColor: palette.borderAccent },
  teamChipText:    { fontSize: font.sm, fontWeight: font.semibold, color: palette.textSecondary },
});