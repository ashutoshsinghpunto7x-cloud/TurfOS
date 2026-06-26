import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  fetchFixtures, fetchInnings, fetchBattingScores, fetchBowlingScores,
  fetchTeams, fetchDeliveries, recordDelivery, undoLastDelivery,
  createInnings, updateInnings, updateFixture, updateStandingsAfterMatch,
  calcStrikeRate, calcEconomy, ballsToOvers, fetchTournamentById,
  DeliveryOutcome, Delivery, outcomeIsFairBall, Tournament,
  TournamentInnings, BattingScore, BowlingScore, TournamentFixture, TournamentTeam,
} from '../services/tournamentService';
import { useStore } from '../store/useStore';
import { palette, radius, font, spacing, shadow } from '../theme/theme';

type Tab = 'live' | 'scorecard' | 'bowling' | 'result';

const OUTCOMES: { key: DeliveryOutcome; label: string; color: string; bg: string; size?: 'lg' }[] = [
  { key: '0',  label: '0',   color: palette.textTertiary,   bg: palette.glass2       },
  { key: '1',  label: '1',   color: palette.textPrimary,    bg: palette.glass3       },
  { key: '2',  label: '2',   color: palette.textPrimary,    bg: palette.glass3       },
  { key: '3',  label: '3',   color: palette.textPrimary,    bg: palette.glass3       },
  { key: '4',  label: '4',   color: '#60A5FA',              bg: palette.accentSoft   },
  { key: '6',  label: '6',   color: '#34D399',              bg: palette.emeraldSoft, size: 'lg' },
  { key: 'W',  label: 'W',   color: '#F87171',              bg: palette.redSoft,     size: 'lg' },
  { key: 'WD', label: 'Wd',  color: '#FCD34D',              bg: palette.amberSoft    },
  { key: 'NB', label: 'NB',  color: '#FCD34D',              bg: palette.amberSoft    },
  { key: 'B',  label: 'Bye', color: palette.textTertiary,   bg: palette.glass2       },
  { key: 'LB', label: 'LB',  color: palette.textTertiary,   bg: palette.glass2       },
];

function OutcomeDot({ outcome }: { outcome: DeliveryOutcome }) {
  const MAP: Record<DeliveryOutcome, { label: string; color: string; bg: string }> = {
    '0': { label: '·', color: palette.textTertiary,  bg: palette.glass1      },
    '1': { label: '1', color: palette.textPrimary,   bg: palette.glass3      },
    '2': { label: '2', color: palette.textPrimary,   bg: palette.glass3      },
    '3': { label: '3', color: palette.textPrimary,   bg: palette.glass3      },
    '4': { label: '4', color: '#60A5FA',             bg: palette.accentSoft  },
    '6': { label: '6', color: '#34D399',             bg: palette.emeraldSoft },
    'W': { label: 'W', color: '#F87171',             bg: palette.redSoft     },
    'WD':{ label: 'w', color: '#FCD34D',             bg: palette.amberSoft   },
    'NB':{ label: 'n', color: '#FCD34D',             bg: palette.amberSoft   },
    'B': { label: 'b', color: palette.textTertiary,  bg: palette.glass1      },
    'LB':{ label: 'l', color: palette.textTertiary,  bg: palette.glass1      },
  };
  const c = MAP[outcome] ?? MAP['0'];
  return (
    <View style={[od.dot, { backgroundColor: c.bg, borderColor: c.color + '55' }]}>
      <Text style={[od.txt, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}
const od = StyleSheet.create({
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  txt: { fontSize: font.xs, fontWeight: font.extrabold },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// readOnly prop = customer view (no controls)
// ─────────────────────────────────────────────────────────────────────────────

interface Props { readOnly?: boolean; }

export default function MatchScoringScreen({ readOnly: readOnlyProp }: Props) {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { profile } = useStore();

  const { fixtureId, tournamentId } = route.params as { fixtureId: string; tournamentId: string };

  const role     = profile?.role ?? 'customer';
  const readOnly = readOnlyProp ?? (role === 'customer');

  const [fixture, setFixture]       = useState<TournamentFixture | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams]           = useState<TournamentTeam[]>([]);
  const [innings, setInnings]       = useState<TournamentInnings[]>([]);
  const [batting, setBatting]       = useState<BattingScore[]>([]);
  const [bowling, setBowling]       = useState<BowlingScore[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<Tab>('live');
  const [activeInnings, setActiveInnings] = useState<1 | 2>(1);

  const [currentOver, setCurrentOver]   = useState(1);
  const [currentBall, setCurrentBall]   = useState(1);

  // FIX: Use refs to always hold the latest values for use inside handleRecord
  // This prevents stale closure issues when reading striker/nonStriker during async ops
  const [striker, setStrikerState]       = useState('');
  const [nonStriker, setNonStrikerState] = useState('');
  const strikerRef    = useRef('');
  const nonStrikerRef = useRef('');

  // Wrapper setters that keep refs in sync
  const setStriker = useCallback((val: string) => {
    strikerRef.current = val;
    setStrikerState(val);
  }, []);
  const setNonStriker = useCallback((val: string) => {
    nonStrikerRef.current = val;
    setNonStrikerState(val);
  }, []);

  const [bowlerName, setBowlerName]   = useState('');
  const [recording, setRecording]     = useState(false);
  const [undoing, setUndoing]         = useState(false);
  const [lastOutcome, setLastOutcome] = useState<DeliveryOutcome | null>(null);

  const flashAnim = useRef(new Animated.Value(0)).current;

  const [tossModal, setTossModal]       = useState(false);
  const [tossWinnerId, setTossWinnerId] = useState('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');

  const [nameModal, setNameModal]       = useState(false);
  const [nameType, setNameType]         = useState<'striker' | 'nonStriker' | 'bowler'>('striker');
  const [nameInput, setNameInput]       = useState('');

  const [resultModal, setResultModal]   = useState(false);
  const [matchResult, setMatchResult]   = useState<'team1_win' | 'team2_win' | 'tie'>('team1_win');
  const [pomName, setPomName]           = useState('');
  const [savingResult, setSavingResult] = useState(false);

  const refreshTimer = useRef<any>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [{ fixtures }, { teams: t }, { innings: inn }, { tournament: tourney }] = await Promise.all([
      fetchFixtures(tournamentId),
      fetchTeams(tournamentId),
      fetchInnings(fixtureId),
      fetchTournamentById(tournamentId),
    ]);

    const fix = fixtures.find((f) => f.id === fixtureId) ?? null;
    setFixture(fix);
    setTournament(tourney);
    setTeams(t);
    setInnings(inn);

    const activeInn = inn[activeInnings - 1];
    if (activeInn) {
      const [{ scores: bat }, { scores: bowl }, { deliveries: dels }] = await Promise.all([
        fetchBattingScores(activeInn.id),
        fetchBowlingScores(activeInn.id),
        fetchDeliveries(activeInn.id),
      ]);
      setBatting(bat); setBowling(bowl); setDeliveries(dels);

      const fairCount = dels.filter((d) => d.is_fair_ball).length;
      setCurrentOver(Math.floor(fairCount / 6) + 1);
      setCurrentBall((fairCount % 6) + 1);

      if (!readOnly && dels.length > 0) {
        const last = dels[dels.length - 1];
        if (!strikerRef.current) setStriker(last.batsman_name ?? '');
        if (!bowlerName) setBowlerName(last.bowler_name ?? '');
      }
    } else {
      setBatting([]); setBowling([]); setDeliveries([]);
      setCurrentOver(1); setCurrentBall(1);
    }

    setLoading(false);
  }, [fixtureId, tournamentId, activeInnings]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    if (readOnly) {
      refreshTimer.current = setInterval(() => { load(); }, 15000);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [load, readOnly]));

  // ── Flash ──────────────────────────────────────────────────────────────────
  const flashBall = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  // ── Toss ───────────────────────────────────────────────────────────────────
  const handleSaveToss = async () => {
    if (!tossWinnerId || !fixture) { Alert.alert('Select', 'Select the toss winner.'); return; }
    const battingTeamId = tossDecision === 'bat' ? tossWinnerId
      : (fixture.team1_id === tossWinnerId ? fixture.team2_id! : fixture.team1_id!);
    const bowlingTeamId = battingTeamId === fixture.team1_id ? fixture.team2_id! : fixture.team1_id!;
    const battingTeam   = teams.find((t) => t.id === battingTeamId);
    const bowlingTeam   = teams.find((t) => t.id === bowlingTeamId);

    await updateFixture(fixtureId, { toss_winner_id: tossWinnerId, toss_decision: tossDecision, status: 'live' });
    await createInnings({
      fixtureId, tournamentId, inningsNumber: 1,
      battingTeamId, bowlingTeamId,
      battingTeamName: battingTeam?.team_name ?? '',
      bowlingTeamName: bowlingTeam?.team_name ?? '',
    });
    setTossModal(false);
    load();
  };

  // ── Record delivery ────────────────────────────────────────────────────────
  const handleRecord = async (outcome: DeliveryOutcome) => {
    if (recording || readOnly) return;

    // FIX: Read from refs to get current values synchronously before any state changes
    const currentStriker    = strikerRef.current;
    const currentNonStriker = nonStrikerRef.current;

    if (!currentStriker.trim())   { Alert.alert('Set Striker',  'Set the striker (batsman on strike) first.'); return; }
    if (!bowlerName.trim())        { Alert.alert('Set Bowler',   'Set the current bowler first.'); return; }

    const inn = innings[activeInnings - 1];
    if (!inn) { Alert.alert('No Innings', 'Start innings via toss.'); return; }

    setRecording(true);
    setLastOutcome(outcome);

    const isFair = outcomeIsFairBall(outcome);

    // FIX: Pass the captured currentStriker (not state) to ensure correct batsman is recorded
    const { error, wicketFell, inningsEnded } = await recordDelivery({
      inningsId:   inn.id,
      fixtureId,
      tournamentId,
      overNumber:  currentOver,
      ballNumber:  currentBall,
      outcome,
      batsmanName: currentStriker.trim(),   // uses ref snapshot, not potentially-stale state
      bowlerName:  bowlerName.trim(),
      oversPerMatch: tournament?.overs_per_match ?? 20,
    });

    setRecording(false);

    if (error) { Alert.alert('Error', error); return; }

    flashBall();

    // ── Strike rotation logic ───────────────────────────────────────────────
    // All rotation uses currentStriker / currentNonStriker captured at top of function
    // to avoid reading partially-updated state.

    if (outcome === 'W') {
      // Wicket: clear striker, non-striker stays and becomes the "facing" end
      // New batsman will be set manually by scorer
      setStriker('');
      // nonStriker stays as-is; they'll face from their end until over ends
      Alert.alert('Wicket!', 'Set the new batsman as Striker.');
    } else if (outcome === '1' || outcome === '3') {
      // Odd runs: swap — the non-striker now faces
      setStriker(currentNonStriker);
      setNonStriker(currentStriker);
    }
    // 0, 2, 4, 6, B, LB: same striker faces next ball — no swap needed
    // WD, NB: same striker faces the re-bowl — no swap needed

    // ── Advance ball counter (fair deliveries only) ─────────────────────────
    // WD and NB are NOT fair balls, so currentBall does NOT advance
    if (isFair) {
      if (currentBall >= 6) {
        // End of over: always swap ends regardless of outcome
        // (even if wicket — non-striker walks to striker end for new over)
        const newStriker    = outcome === 'W' ? '' : (
          // If odd runs already swapped, striker is already updated via setStriker above.
          // For even/0/boundary at end of over: non-striker comes to face.
          (outcome === '1' || outcome === '3') ? currentStriker : currentNonStriker
        );
        const newNonStriker = outcome === 'W'
          ? currentNonStriker
          : ((outcome === '1' || outcome === '3') ? currentNonStriker : currentStriker);

        // Only override if it wasn't already set by the odd-run logic above
        if (outcome !== '1' && outcome !== '3' && outcome !== 'W') {
          setStriker(newStriker);
          setNonStriker(newNonStriker);
        }
        // For odd runs at end of over: swap happened, then swap again = original order restored
        // i.e. last ball of over was a single: non-striker ran to striker end,
        // then changeover swaps them back so same person faces. Handle this:
        if (outcome === '1' || outcome === '3') {
          // After odd-run swap: currentStriker is now nonStriker, currentNonStriker is now striker
          // End of over swap on top: swap again → back to currentNonStriker facing = correct
          setStriker(currentStriker);
          setNonStriker(currentNonStriker);
        }

        setCurrentOver((o) => o + 1);
        setCurrentBall(1);
        Alert.alert('Over Complete!', `Over ${currentOver} done. Please set the new bowler.`);
      } else {
        setCurrentBall((b) => b + 1);
      }
    }
    // WD/NB: currentBall stays the same, currentOver stays the same — re-bowl

    // ── Auto-innings-end signal ──────────────────────────────────────────────
    if (inningsEnded) {
      if (activeInnings === 1) {
        Alert.alert(
          'Innings Complete!',
          'All overs bowled. Ready to start 2nd innings.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'Innings Complete!',
          'All overs bowled. Record the match result.',
          [{ text: 'OK' }],
        );
      }
    }

    await load();
  };

  // ── Swap strike manually ───────────────────────────────────────────────────
  const handleSwapStrike = () => {
    if (readOnly) return;
    // FIX: Use refs to get current values for the swap
    const currentStriker    = strikerRef.current;
    const currentNonStriker = nonStrikerRef.current;
    setStriker(currentNonStriker);
    setNonStriker(currentStriker);
  };

  // ── Undo ───────────────────────────────────────────────────────────────────
  const handleUndo = async () => {
    const inn = innings[activeInnings - 1];
    if (!inn || deliveries.length === 0) { Alert.alert('Nothing to undo'); return; }
    Alert.alert('Undo Last Ball', 'Remove the last delivery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo', style: 'destructive',
        onPress: async () => {
          setUndoing(true);
          await undoLastDelivery(inn.id);
          setUndoing(false);
          await load();
        },
      },
    ]);
  };

  // ── Start innings 2 ────────────────────────────────────────────────────────
  const handleStartInnings2 = async () => {
    const inn1 = innings[0];
    if (!inn1 || innings.length >= 2) return;
    await updateInnings(inn1.id, { is_completed: true });
    await createInnings({
      fixtureId, tournamentId, inningsNumber: 2,
      battingTeamId:   inn1.bowling_team_id!,
      bowlingTeamId:   inn1.batting_team_id!,
      battingTeamName: inn1.bowling_team_name ?? '',
      bowlingTeamName: inn1.batting_team_name ?? '',
    });
    setActiveInnings(2);
    setStriker(''); setNonStriker(''); setBowlerName('');
    setCurrentOver(1); setCurrentBall(1);
    load();
  };

  // ── Result ─────────────────────────────────────────────────────────────────
  const handleSaveResult = async () => {
    if (!fixture) return;
    setSavingResult(true);
    const winnerId = matchResult === 'tie' ? null
      : matchResult === 'team1_win' ? fixture.team1_id : fixture.team2_id;
    await updateFixture(fixtureId, { status: 'completed', winner_id: winnerId, player_of_match: pomName.trim() || null });
    for (const inn of innings) await updateInnings(inn.id, { is_completed: true });
    const inn1 = innings[0]; const inn2 = innings[1];
    if (inn1 && inn2 && fixture.team1_id && fixture.team2_id) {
      await updateStandingsAfterMatch({
        tournamentId,
        winnerId,
        loserId: winnerId === fixture.team1_id ? fixture.team2_id : fixture.team1_id,
        team1Id: fixture.team1_id, team2Id: fixture.team2_id,
        team1RunsScored: inn1.batting_team_id === fixture.team1_id ? inn1.total_runs : inn2.total_runs,
        team1BallsFaced: inn1.batting_team_id === fixture.team1_id ? inn1.total_balls : inn2.total_balls,
        team2RunsScored: inn1.batting_team_id === fixture.team2_id ? inn1.total_runs : inn2.total_runs,
        team2BallsFaced: inn1.batting_team_id === fixture.team2_id ? inn1.total_balls : inn2.total_balls,
        isTie: matchResult === 'tie',
      });
    }
    setSavingResult(false);
    setResultModal(false);
    load();
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const currentInnings = innings[activeInnings - 1];
  const totalRuns      = currentInnings?.total_runs    ?? 0;
  const totalWickets   = currentInnings?.total_wickets ?? 0;
  const totalBalls     = currentInnings?.total_balls   ?? 0;
  const oversStr       = ballsToOvers(totalBalls);
  // FIX: target = innings[0].total_runs + 1 (total_runs already includes extras)
  const target         = activeInnings === 2 && innings[0]
    ? (innings[0].total_runs ?? 0) + 1 : null;
  const thisOverDels   = deliveries.filter((d) => d.over_number === currentOver);
  const fairThisOver   = thisOverDels.filter((d) => d.is_fair_ball).length;

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={palette.accent} size="large" /></View></SafeAreaView>;
  }
  if (!fixture) {
    return <SafeAreaView style={s.safe}><View style={s.center}><Text style={{ color: palette.redBright }}>Fixture not found.</Text></View></SafeAreaView>;
  }

  const needsToss = !fixture.toss_winner_id && fixture.status !== 'completed';
  const TABS: { key: Tab; label: string }[] = [
    { key: 'live',      label: '🔴 Live'   },
    { key: 'scorecard', label: 'Batting'   },
    { key: 'bowling',   label: 'Bowling'   },
    { key: 'result',    label: 'Result'    },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Match {fixture.match_number} · {fixture.round_label}</Text>
          <Text style={s.headerSub}>
            {fixture.team1_name ?? 'TBD'} vs {fixture.team2_name ?? 'TBD'}
            {readOnly && <Text style={s.readOnlyTag}>  👁 View Only</Text>}
          </Text>
        </View>
        {!readOnly && fixture.status !== 'completed' && (
          <TouchableOpacity style={s.endBtn} onPress={() => setResultModal(true)}>
            <Text style={s.endBtnText}>End</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toss prompt (owner only) */}
      {needsToss && !readOnly && (
        <TouchableOpacity style={s.tossBanner} onPress={() => setTossModal(true)}>
          <Text style={s.tossBannerText}>🪙 Tap to record toss →</Text>
        </TouchableOpacity>
      )}

      {/* Innings selector */}
      {innings.length > 0 && (
        <View style={s.innSelector}>
          {([1, 2] as const).slice(0, innings.length + (innings.length < 2 && !readOnly ? 1 : 0)).map((n) => {
            const inn = innings[n - 1];
            return (
              <TouchableOpacity
                key={n}
                style={[s.innTab, activeInnings === n && s.innTabActive]}
                onPress={() => {
                  if (n === 2 && innings.length < 2 && !readOnly) {
                    Alert.alert('Start 2nd Innings', 'End 1st innings?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Start', onPress: handleStartInnings2 },
                    ]);
                    return;
                  }
                  setActiveInnings(n);
                }}
              >
                <Text style={[s.innTabText, activeInnings === n && s.innTabTextActive]}>
                  {inn ? `${n === 1 ? '1st' : '2nd'} Inn — ${inn.batting_team_name}` : '+ 2nd Inn'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Score bar */}
      {currentInnings && (
        <View style={s.scoreBar}>
          <Text style={s.scoreMain}>{totalRuns}/{totalWickets}</Text>
          <Text style={s.scoreOvers}>  ({oversStr} ov)</Text>
          {target && <Text style={s.targetText}>  Need {target}</Text>}
          <Text style={s.scoreTeam}>  {currentInnings.batting_team_name}</Text>
        </View>
      )}

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[s.tabItem, activeTab === t.key && s.tabItemActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>

        {/* ═══ LIVE TAB ═══════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <>
            {!fixture.toss_winner_id ? (
              readOnly ? (
                <View style={s.infoCard}><Text style={s.infoText}>Match has not started yet.</Text></View>
              ) : (
                <TouchableOpacity style={s.tossBtn} onPress={() => setTossModal(true)}>
                  <Text style={s.tossBtnText}>🪙 Record Toss to Start</Text>
                </TouchableOpacity>
              )
            ) : !currentInnings ? (
              <View style={s.infoCard}><Text style={s.infoText}>Innings will appear here once started.</Text></View>
            ) : (
              <>
                {/* ── Striker / Non-striker / Bowler ────────────────────── */}
                <View style={s.playerSection}>
                  {/* Batting side */}
                  <View style={s.playerColumn}>
                    <Text style={s.playerColumnTitle}>Batting</Text>

                    {/* Striker */}
                    <TouchableOpacity
                      style={[s.playerCard, s.playerCardStriker]}
                      onPress={() => {
                        if (readOnly) return;
                        setNameType('striker'); setNameInput(striker); setNameModal(true);
                      }}
                      disabled={readOnly}
                    >
                      <View style={s.strikeDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.playerCardRole}>Striker ★</Text>
                        <Text style={[s.playerCardName, !striker && { color: palette.textTertiary }]}>
                          {striker || (readOnly ? '—' : 'Tap to set')}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Swap button */}
                    {!readOnly && (
                      <TouchableOpacity style={s.swapBtn} onPress={handleSwapStrike}>
                        <Text style={s.swapBtnText}>⇅ Swap Strike</Text>
                      </TouchableOpacity>
                    )}

                    {/* Non-striker */}
                    <TouchableOpacity
                      style={[s.playerCard, s.playerCardNonStriker]}
                      onPress={() => {
                        if (readOnly) return;
                        setNameType('nonStriker'); setNameInput(nonStriker); setNameModal(true);
                      }}
                      disabled={readOnly}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.playerCardRole}>Non-Striker</Text>
                        <Text style={[s.playerCardName, !nonStriker && { color: palette.textTertiary }]}>
                          {nonStriker || (readOnly ? '—' : 'Tap to set')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Bowling side */}
                  <View style={s.playerColumn}>
                    <Text style={s.playerColumnTitle}>Bowling</Text>
                    <TouchableOpacity
                      style={[s.playerCard, s.playerCardBowler]}
                      onPress={() => {
                        if (readOnly) return;
                        setNameType('bowler'); setNameInput(bowlerName); setNameModal(true);
                      }}
                      disabled={readOnly}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.playerCardRole}>Current Bowler</Text>
                        <Text style={[s.playerCardName, !bowlerName && { color: palette.textTertiary }]}>
                          {bowlerName || (readOnly ? '—' : 'Tap to set')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Over display ─────────────────────────────────────── */}
                <View style={s.overCard}>
                  <Text style={s.overTitle}>Over {currentOver}</Text>
                  <View style={s.overDotsRow}>
                    {thisOverDels.map((d) => (
                      <OutcomeDot key={d.id} outcome={d.outcome as DeliveryOutcome} />
                    ))}
                    {Array.from({ length: Math.max(0, 6 - fairThisOver) }, (_, i) => {
                      const pos = fairThisOver + i + 1;
                      const isCurrent = pos === currentBall && !readOnly;
                      return (
                        <Animated.View
                          key={`empty-${i}`}
                          style={[
                            s.emptyBall,
                            isCurrent && s.emptyBallCurrent,
                          ]}
                        >
                          <Text style={[s.emptyBallText, isCurrent && s.emptyBallTextCurrent]}>{pos}</Text>
                        </Animated.View>
                      );
                    })}
                  </View>
                  <Text style={s.overHint}>
                    Ball {readOnly ? (fairThisOver + 1) : currentBall} of over {currentOver}
                    {lastOutcome && !readOnly ? ` · Last: ${lastOutcome}` : ''}
                  </Text>
                </View>

                {/* ── Outcome buttons (owner only) ─────────────────────── */}
                {!readOnly && (
                  <>
                    <View style={s.outcomesGrid}>
                      {OUTCOMES.map((o) => (
                        <TouchableOpacity
                          key={o.key}
                          style={[
                            s.outcomeBtn,
                            { backgroundColor: o.bg, borderColor: o.color + '55' },
                            o.size === 'lg' && s.outcomeBtnLg,
                            recording && { opacity: 0.5 },
                          ]}
                          onPress={() => handleRecord(o.key)}
                          disabled={recording}
                          activeOpacity={0.7}
                        >
                          {recording && lastOutcome === o.key
                            ? <ActivityIndicator color={o.color} size="small" />
                            : <Text style={[s.outcomeBtnText, { color: o.color }, o.size === 'lg' && s.outcomeBtnTextLg]}>{o.label}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[s.undoBtn, (undoing || deliveries.length === 0) && { opacity: 0.4 }]}
                      onPress={handleUndo}
                      disabled={undoing || deliveries.length === 0}
                    >
                      <Text style={s.undoBtnText}>{undoing ? '…' : '↩ Undo Last Ball'}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* ── Score summary ─────────────────────────────────────── */}
                <View style={s.miniSummary}>
                  {[
                    { val: String(totalRuns),    label: 'Runs' },
                    { val: String(totalWickets), label: 'Wkts' },
                    { val: oversStr,             label: 'Overs' },
                    { val: String(currentInnings.extras_total ?? 0), label: 'Extras' },
                  ].map((stat) => (
                    <React.Fragment key={stat.label}>
                      <View style={s.miniStat}>
                        <Text style={s.miniStatVal}>{stat.val}</Text>
                        <Text style={s.miniStatLabel}>{stat.label}</Text>
                      </View>
                      {stat.label !== 'Extras' && <View style={s.miniDivider} />}
                    </React.Fragment>
                  ))}
                </View>

                <View style={s.extrasRow}>
                  <Text style={s.extrasText}>
                    Wd {currentInnings.extras_wides ?? 0} · NB {currentInnings.extras_no_balls ?? 0} · B {currentInnings.extras_byes ?? 0} · LB {currentInnings.extras_leg_byes ?? 0}
                  </Text>
                </View>

                {/* Start 2nd innings (owner) */}
                {!readOnly && innings.length === 1 && (
                  <TouchableOpacity style={s.nextInnBtn} onPress={handleStartInnings2}>
                    <Text style={s.nextInnBtnText}>→ End 1st Innings & Start 2nd</Text>
                  </TouchableOpacity>
                )}

                {/* Read-only auto-refresh indicator */}
                {readOnly && (
                  <View style={s.liveIndicator}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>Auto-refreshing every 15 seconds</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ BATTING TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'scorecard' && (
          <>
            {batting.length === 0 ? (
              <View style={s.emptyTab}><Text style={s.emptyTabText}>No batting data yet.</Text></View>
            ) : (
              <View style={s.scoreTable}>
                <View style={[s.tableRow, s.tableHeader]}>
                  {['Batsman', 'R', 'B', '4s', '6s', 'SR'].map((h) => (
                    <Text key={h} style={[s.tableCell, h === 'Batsman' && s.tableCellWide, s.tableHeaderText]}>{h}</Text>
                  ))}
                </View>
                {batting.map((b, i) => (
                  <View key={b.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                    <View style={[s.tableCell, s.tableCellWide]}>
                      <Text style={s.playerName}>{b.player_name}{b.is_not_out ? '*' : ''}</Text>
                      {!b.is_not_out && b.dismissal_type && (
                        <Text style={s.dismissalText}>{b.dismissal_type.replace('_', ' ')}</Text>
                      )}
                    </View>
                    <Text style={[s.tableCell, s.tableCellBold]}>{b.runs}</Text>
                    <Text style={s.tableCell}>{b.balls_faced}</Text>
                    <Text style={s.tableCell}>{b.fours}</Text>
                    <Text style={s.tableCell}>{b.sixes}</Text>
                    <Text style={s.tableCell}>{calcStrikeRate(b.runs, b.balls_faced)}</Text>
                  </View>
                ))}
                <View style={[s.tableRow, s.tableTotal]}>
                  <Text style={[s.tableCell, s.tableCellWide, s.tableCellBold]}>Total</Text>
                  <Text style={[s.tableCell, s.tableCellBold]}>{batting.reduce((a, b) => a + b.runs, 0)}</Text>
                  <Text style={[s.tableCell, s.tableCellBold]}>{batting.reduce((a, b) => a + b.balls_faced, 0)}</Text>
                  <Text style={[s.tableCell, s.tableCellBold]}>{batting.reduce((a, b) => a + b.fours, 0)}</Text>
                  <Text style={[s.tableCell, s.tableCellBold]}>{batting.reduce((a, b) => a + b.sixes, 0)}</Text>
                  <Text style={s.tableCell}>—</Text>
                </View>
              </View>
            )}
            {currentInnings && (
              <View style={s.inningsTotals}>
                <Text style={s.inningsTotalsTitle}>{currentInnings.batting_team_name}</Text>
                <Text style={s.inningsTotalsScore}>{totalRuns}/{totalWickets} ({oversStr} ov) · Extras {currentInnings.extras_total ?? 0}</Text>
              </View>
            )}
          </>
        )}

        {/* ═══ BOWLING TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'bowling' && (
          bowling.length === 0 ? (
            <View style={s.emptyTab}><Text style={s.emptyTabText}>No bowling data yet.</Text></View>
          ) : (
            <View style={s.scoreTable}>
              <View style={[s.tableRow, s.tableHeader]}>
                {['Bowler', 'O', 'R', 'W', 'Eco', 'Wd'].map((h) => (
                  <Text key={h} style={[s.tableCell, h === 'Bowler' && s.tableCellWide, s.tableHeaderText]}>{h}</Text>
                ))}
              </View>
              {bowling.map((b, i) => (
                <View key={b.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                  <Text style={[s.tableCell, s.tableCellWide, s.playerName]}>{b.player_name}</Text>
                  <Text style={s.tableCell}>{b.overs}</Text>
                  <Text style={s.tableCell}>{b.runs_given}</Text>
                  <Text style={[s.tableCell, b.wickets > 0 && { color: palette.emeraldBright, fontWeight: font.extrabold }]}>{b.wickets}</Text>
                  <Text style={s.tableCell}>{calcEconomy(b.runs_given, b.overs)}</Text>
                  <Text style={s.tableCell}>{b.wides}</Text>
                </View>
              ))}
            </View>
          )
        )}

        {/* ═══ RESULT TAB ═════════════════════════════════════════════════════ */}
        {activeTab === 'result' && (
          fixture.status === 'completed' ? (
            <View style={s.resultCard}>
              <Text style={s.resultTitle}>
                {fixture.winner_id
                  ? `🏆 ${teams.find((t) => t.id === fixture.winner_id)?.team_name ?? 'Winner'} Won!`
                  : '🤝 Match Tied'}
              </Text>
              {fixture.player_of_match && <Text style={s.pomText}>⭐ POM: {fixture.player_of_match}</Text>}
              {innings.map((inn, i) => (
                <View key={inn.id} style={s.innResult}>
                  <Text style={s.innResultLabel}>{inn.batting_team_name} (Inn {i + 1})</Text>
                  <Text style={s.innResultScore}>
                    {inn.total_runs}/{inn.total_wickets} ({ballsToOvers(inn.total_balls)} ov) · Ex {inn.extras_total ?? 0}
                  </Text>
                </View>
              ))}
            </View>
          ) : readOnly ? (
            <View style={s.infoCard}><Text style={s.infoText}>Match in progress.</Text></View>
          ) : (
            <TouchableOpacity style={s.endMatchBtn} onPress={() => setResultModal(true)}>
              <Text style={s.endMatchBtnText}>🏆 Record Final Result</Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      {/* ── Toss modal ─────────────────────────────────────────────────────── */}
      {!readOnly && (
        <Modal visible={tossModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Record Toss</Text>
              <Text style={s.fieldLabel}>Toss Winner</Text>
              {[fixture.team1_id, fixture.team2_id].filter(Boolean).map((tid) => {
                const team = teams.find((t) => t.id === tid);
                return (
                  <TouchableOpacity key={tid} style={[s.selCard, tossWinnerId === tid && s.selCardActive]} onPress={() => setTossWinnerId(tid!)}>
                    <Text style={[s.selCardText, tossWinnerId === tid && { color: palette.accentBright }]}>{team?.team_name ?? '—'}</Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Decision</Text>
              <View style={s.decisionRow}>
                {(['bat', 'bowl'] as const).map((d) => (
                  <TouchableOpacity key={d} style={[s.decisionBtn, tossDecision === d && s.decisionBtnActive]} onPress={() => setTossDecision(d)}>
                    <Text style={[s.decisionText, tossDecision === d && { color: palette.accentBright }]}>
                      {d === 'bat' ? '🏏 Bat First' : '⚾ Bowl First'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveToss}><Text style={s.saveBtnText}>Start Match</Text></TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setTossModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Name input modal (striker / non-striker / bowler) ─────────────── */}
      {!readOnly && (
        <Modal visible={nameModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>
                {nameType === 'striker' ? '🏏 Set Striker' : nameType === 'nonStriker' ? '🏃 Set Non-Striker' : '⚾ Set Bowler'}
              </Text>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={s.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Player name"
                placeholderTextColor={palette.textTertiary}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (nameType === 'striker')          setStriker(nameInput.trim());
                  else if (nameType === 'nonStriker')  setNonStriker(nameInput.trim());
                  else                                  setBowlerName(nameInput.trim());
                  setNameModal(false);
                }}
              />
              <TouchableOpacity style={s.saveBtn} onPress={() => {
                if (nameType === 'striker')          setStriker(nameInput.trim());
                else if (nameType === 'nonStriker')  setNonStriker(nameInput.trim());
                else                                  setBowlerName(nameInput.trim());
                setNameModal(false);
              }}>
                <Text style={s.saveBtnText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setNameModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Result modal ───────────────────────────────────────────────────── */}
      {!readOnly && (
        <Modal visible={resultModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Record Match Result</Text>
              <Text style={s.fieldLabel}>Winner</Text>
              {[
                { key: 'team1_win' as const, label: fixture.team1_name ?? 'Team 1' },
                { key: 'team2_win' as const, label: fixture.team2_name ?? 'Team 2' },
                { key: 'tie' as const,       label: 'Match Tied' },
              ].map((opt) => (
                <TouchableOpacity key={opt.key} style={[s.selCard, matchResult === opt.key && s.selCardActive]} onPress={() => setMatchResult(opt.key)}>
                  <Text style={[s.selCardText, matchResult === opt.key && { color: palette.accentBright }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Player of the Match</Text>
              <TextInput style={s.nameInput} value={pomName} onChangeText={setPomName}
                placeholder="Optional" placeholderTextColor={palette.textTertiary} autoCapitalize="words" />
              <TouchableOpacity style={[s.saveBtn, savingResult && { opacity: 0.7 }]} onPress={handleSaveResult} disabled={savingResult}>
                {savingResult ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Confirm Result</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setResultModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: palette.abyss },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: 'rgba(8,12,20,0.97)', borderBottomWidth: 1, borderBottomColor: palette.borderFaint, gap: spacing.xs },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glass2, borderRadius: radius.xs, borderWidth: 1, borderColor: palette.borderSubtle },
  backText:        { fontSize: 22, color: palette.textPrimary, lineHeight: 28 },
  headerTitle:     { fontSize: font.sm, fontWeight: font.extrabold, color: palette.textPrimary },
  headerSub:       { fontSize: font.xs, color: palette.textTertiary, marginTop: 1 },
  readOnlyTag:     { color: palette.accentBright, fontWeight: font.bold },
  endBtn:          { backgroundColor: palette.redSoft, borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  endBtnText:      { fontSize: font.xs, fontWeight: font.bold, color: palette.redBright },
  tossBanner:      { backgroundColor: 'rgba(245,158,11,0.1)', padding: spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.2)' },
  tossBannerText:  { fontSize: font.xs, fontWeight: font.bold, color: palette.amberBright },
  innSelector:     { flexDirection: 'row', backgroundColor: palette.midnight, borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  innTab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  innTabActive:    { borderBottomColor: palette.accent },
  innTabText:      { fontSize: font.xs, color: palette.textTertiary, fontWeight: font.medium },
  innTabTextActive:{ color: palette.accentBright, fontWeight: font.bold },
  scoreBar:        { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: palette.midnight, borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  scoreMain:       { fontSize: 26, fontWeight: font.black, color: palette.textPrimary },
  scoreOvers:      { fontSize: font.sm, color: palette.textTertiary },
  targetText:      { fontSize: font.sm, color: palette.amberBright, fontWeight: font.bold },
  scoreTeam:       { fontSize: font.xs, color: palette.textTertiary },
  tabBar:          { flexDirection: 'row', backgroundColor: palette.midnight, borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  tabItem:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:   { borderBottomColor: palette.accent },
  tabText:         { fontSize: font.xs, fontWeight: font.semibold, color: palette.textTertiary },
  tabTextActive:   { color: palette.accentBright, fontWeight: font.bold },
  tabContent:      { padding: spacing.md, paddingBottom: 48, gap: spacing.sm },

  // Player section
  playerSection:   { flexDirection: 'row', gap: spacing.xs },
  playerColumn:    { flex: 1, gap: spacing.xs },
  playerColumnTitle:{ fontSize: font.xs - 1, fontWeight: font.black, color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  playerCard:      { borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerCardStriker:{ backgroundColor: palette.accentSoft, borderColor: palette.borderAccent },
  playerCardNonStriker:{ backgroundColor: palette.glass1, borderColor: palette.borderSubtle },
  playerCardBowler:{ backgroundColor: palette.redSoft, borderColor: 'rgba(239,68,68,0.25)' },
  playerCardRole:  { fontSize: font.xs - 1, fontWeight: font.bold, color: palette.textTertiary, marginBottom: 2 },
  playerCardName:  { fontSize: font.sm, fontWeight: font.extrabold, color: palette.textPrimary },
  strikeDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accentBright },
  swapBtn:         { backgroundColor: palette.glass2, borderRadius: radius.xs, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: palette.borderSubtle },
  swapBtnText:     { fontSize: font.xs, color: palette.accentBright, fontWeight: font.bold },

  // Over
  tossBtn:         { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  tossBtnText:     { fontSize: font.md, fontWeight: font.bold, color: palette.amberBright },
  infoCard:        { backgroundColor: palette.glass1, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint, alignItems: 'center' },
  infoText:        { fontSize: font.sm, color: palette.textTertiary },
  overCard:        { backgroundColor: palette.glass1, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint, gap: spacing.xs },
  overTitle:       { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },
  overDotsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  emptyBall:       { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: palette.borderSubtle, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glass1 },
  emptyBallCurrent:{ borderColor: palette.accent, backgroundColor: palette.accentSoft },
  emptyBallText:   { fontSize: font.xs, color: palette.textTertiary, fontWeight: font.bold },
  emptyBallTextCurrent: { color: palette.accentBright },
  overHint:        { fontSize: font.xs, color: palette.textTertiary },

  // Outcome buttons
  outcomesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  outcomeBtn:      { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, ...shadow.sm },
  outcomeBtnLg:    { width: 72, height: 72, borderRadius: 36 },
  outcomeBtnText:  { fontSize: font.lg, fontWeight: font.black },
  outcomeBtnTextLg:{ fontSize: font.xl },

  undoBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs + 2, backgroundColor: palette.glass1, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.borderFaint },
  undoBtnText:     { fontSize: font.xs, color: palette.textTertiary, fontWeight: font.medium },

  miniSummary:     { flexDirection: 'row', backgroundColor: palette.glass2, borderRadius: radius.md, borderWidth: 1, borderColor: palette.borderFaint, overflow: 'hidden' },
  miniStat:        { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  miniStatVal:     { fontSize: font.xl, fontWeight: font.black, color: palette.textPrimary },
  miniStatLabel:   { fontSize: font.xs - 1, color: palette.textTertiary, marginTop: 2 },
  miniDivider:     { width: 1, backgroundColor: palette.borderFaint },
  extrasRow:       { alignItems: 'center' },
  extrasText:      { fontSize: font.xs, color: palette.textTertiary },
  nextInnBtn:      { backgroundColor: palette.accentSoft, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', borderWidth: 1, borderColor: palette.borderAccent },
  nextInnBtnText:  { fontSize: font.sm, fontWeight: font.bold, color: palette.accentBright },
  liveIndicator:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  liveDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F87171' },
  liveText:        { fontSize: font.xs, color: palette.textTertiary },

  // Tables
  scoreTable:      { backgroundColor: palette.midnight, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.borderFaint, overflow: 'hidden' },
  tableRow:        { flexDirection: 'row', paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.xs },
  tableHeader:     { backgroundColor: palette.glass2 },
  tableRowAlt:     { backgroundColor: 'rgba(255,255,255,0.012)' },
  tableTotal:      { backgroundColor: palette.glass3, borderTopWidth: 1, borderTopColor: palette.borderFaint },
  tableCell:       { width: 44, textAlign: 'center', fontSize: font.xs, color: palette.textSecondary },
  tableCellWide:   { flex: 2, textAlign: 'left' },
  tableCellBold:   { fontWeight: font.extrabold, color: palette.textPrimary },
  tableHeaderText: { fontWeight: font.black, color: palette.textTertiary, fontSize: font.xs - 1, textTransform: 'uppercase' },
  playerName:      { fontSize: font.xs, fontWeight: font.bold, color: palette.textPrimary },
  dismissalText:   { fontSize: font.xs - 1, color: palette.textTertiary, marginTop: 1 },
  inningsTotals:   { backgroundColor: palette.glass1, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint },
  inningsTotalsTitle:{ fontSize: font.sm, fontWeight: font.bold, color: palette.textSecondary, marginBottom: 2 },
  inningsTotalsScore:{ fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },

  // Result
  resultCard:      { backgroundColor: palette.emeraldSoft, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', gap: spacing.sm },
  resultTitle:     { fontSize: font.xxl, fontWeight: font.black, color: palette.emeraldBright, textAlign: 'center' },
  pomText:         { fontSize: font.sm, color: palette.amberBright, fontWeight: font.semibold },
  innResult:       { backgroundColor: palette.glass2, borderRadius: radius.sm, padding: spacing.sm, width: '100%', borderWidth: 1, borderColor: palette.borderFaint },
  innResultLabel:  { fontSize: font.xs, color: palette.textTertiary, marginBottom: 2 },
  innResultScore:  { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },
  endMatchBtn:     { backgroundColor: palette.redSoft, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  endMatchBtnText: { fontSize: font.md, fontWeight: font.bold, color: palette.redBright },
  emptyTab:        { alignItems: 'center', paddingVertical: 40 },
  emptyTabText:    { fontSize: font.sm, color: palette.textTertiary, textAlign: 'center' },

  // Modals
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: palette.midnight, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: 48, borderWidth: 1, borderColor: palette.borderSubtle, borderBottomWidth: 0, gap: spacing.xs },
  modalHandle:     { width: 40, height: 4, backgroundColor: palette.glass4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle:      { fontSize: font.xl, fontWeight: font.extrabold, color: palette.textPrimary, marginBottom: 2 },
  fieldLabel:      { fontSize: font.xs, fontWeight: font.extrabold, color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  selCard:         { backgroundColor: palette.glass2, borderRadius: radius.sm, borderWidth: 1.5, borderColor: palette.borderSubtle, padding: spacing.md, marginBottom: spacing.xs },
  selCardActive:   { backgroundColor: palette.accentSoft, borderColor: palette.borderAccent },
  selCardText:     { fontSize: font.md, fontWeight: font.bold, color: palette.textSecondary },
  decisionRow:     { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  decisionBtn:     { flex: 1, backgroundColor: palette.glass2, borderRadius: radius.sm, borderWidth: 1.5, borderColor: palette.borderSubtle, padding: spacing.md, alignItems: 'center' },
  decisionBtnActive:{ backgroundColor: palette.accentSoft, borderColor: palette.borderAccent },
  decisionText:    { fontSize: font.sm, fontWeight: font.bold, color: palette.textSecondary },
  nameInput:       { backgroundColor: palette.glass2, borderWidth: 1, borderColor: palette.borderSubtle, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: font.md, color: palette.textPrimary, marginBottom: spacing.sm },
  saveBtn:         { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...shadow.accent },
  saveBtnText:     { fontSize: font.md, fontWeight: font.extrabold, color: '#fff' },
  cancelBtn:       { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:   { fontSize: font.sm, color: palette.textTertiary, fontWeight: font.semibold },
});