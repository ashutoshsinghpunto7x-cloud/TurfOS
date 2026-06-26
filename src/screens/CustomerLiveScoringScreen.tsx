import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  fetchCustomerVisibleTournaments,
  fetchLiveMatches,
  LiveMatchSummary,
  Tournament,
} from '../services/tournamentService';
import { palette, radius, font, spacing, shadow } from '../theme/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Memoized match card — only re-renders when its own match data changes
// ─────────────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match:        LiveMatchSummary;
  onPress:      (fixtureId: string, tournamentId: string) => void;
}

const MatchCard = memo(({ match, onPress }: MatchCardProps) => {
  const isLive      = match.status === 'live';
  const isScheduled = match.status === 'scheduled';
  const f           = match.fixture;

  return (
    <TouchableOpacity
      style={[s.matchCard, isLive && s.matchCardLive]}
      onPress={() => onPress(f.id, f.tournament_id ?? '')}
      activeOpacity={0.85}
    >
      {isLive && (
        <View style={s.liveBadge}>
          <View style={s.livePulse} />
          <Text style={s.liveBadgeText}>LIVE</Text>
        </View>
      )}

      <Text style={s.matchLabel}>
        {f.round_label ?? `Round ${f.round}`} · Match {f.match_number}
      </Text>

      {/* Teams + score */}
      <View style={s.teamsRow}>
        <View style={s.teamBlock}>
          <Text style={s.teamNameTxt} numberOfLines={1}>
            {f.team1_name ?? 'TBD'}
          </Text>
          {isLive && match.battingTeam === f.team1_name && (
            <Text style={s.battingLabel}>BAT</Text>
          )}
        </View>

        <View style={s.scoreBlock}>
          {isLive ? (
            <>
              <Text style={s.scoreBig}>{match.totalRuns}/{match.totalWickets}</Text>
              <Text style={s.scoreSmall}>({match.oversStr} ov)</Text>
              {match.target != null && <Text style={s.targetSmall}>Need {match.target}</Text>}
            </>
          ) : (
            <Text style={s.vsText}>VS</Text>
          )}
        </View>

        <View style={[s.teamBlock, { alignItems: 'flex-end' }]}>
          <Text style={s.teamNameTxt} numberOfLines={1}>
            {f.team2_name ?? 'TBD'}
          </Text>
          {isLive && match.battingTeam === f.team2_name && (
            <Text style={[s.battingLabel, { textAlign: 'right' }]}>BAT</Text>
          )}
        </View>
      </View>

      {/* Live details */}
      {isLive && (match.striker || match.nonStriker || match.currentBowler) && (
        <View style={s.liveDetails}>
          {match.striker && (
            <View style={s.liveDetailChip}>
              <Text style={s.liveDetailLabel}>Striker</Text>
              <Text style={s.liveDetailVal}>{match.striker} ★</Text>
            </View>
          )}
          {match.nonStriker && (
            <View style={s.liveDetailChip}>
              <Text style={s.liveDetailLabel}>Non-striker</Text>
              <Text style={s.liveDetailVal}>{match.nonStriker}</Text>
            </View>
          )}
          {match.currentBowler && (
            <View style={s.liveDetailChip}>
              <Text style={s.liveDetailLabel}>Bowling</Text>
              <Text style={s.liveDetailVal}>{match.currentBowler}</Text>
            </View>
          )}
        </View>
      )}

      {/* This over balls */}
      {isLive && match.recentDeliveries.length > 0 && (
        <View style={s.recentRow}>
          <Text style={s.recentLabel}>This over: </Text>
          <View style={s.recentDots}>
            {match.recentDeliveries.map((d, i) => {
              const color =
                d === '4'  ? '#60A5FA' :
                d === '6'  ? '#34D399' :
                d === 'W'  ? '#F87171' :
                (d === 'WD' || d === 'NB') ? '#FCD34D' :
                palette.textTertiary;
              return (
                <View key={i} style={[s.recentDot, { borderColor: color + '66', backgroundColor: color + '22' }]}>
                  <Text style={[s.recentDotTxt, { color }]}>{d === '0' ? '·' : d}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {isScheduled && (
        <Text style={s.scheduledText}>
          {f.match_date ? `📅 ${f.match_date}${f.match_time ? ` · ${f.match_time}` : ''}` : 'Date TBD'}
        </Text>
      )}

      <Text style={s.tapHint}>Tap for full scorecard →</Text>
    </TouchableOpacity>
  );
}, (prev, next) => {
  const pm = prev.match; const nm = next.match;
  return (
    pm.totalRuns      === nm.totalRuns &&
    pm.totalWickets   === nm.totalWickets &&
    pm.totalBalls     === nm.totalBalls &&
    pm.striker        === nm.striker &&
    pm.nonStriker     === nm.nonStriker &&
    pm.currentBowler  === nm.currentBowler &&
    pm.status         === nm.status &&
    pm.recentDeliveries.join(',') === nm.recentDeliveries.join(',') &&
    pm.fixture.winner_id === nm.fixture.winner_id
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tournament section header — memoized
// ─────────────────────────────────────────────────────────────────────────────

interface TourneySectionProps {
  tourney:     Tournament;
  matches:     LiveMatchSummary[];
  isExpanded:  boolean;
  onToggle:    (id: string) => void;
  onMatchPress:(fixtureId: string, tournamentId: string) => void;
  isSaved:     boolean;
}

const TourneySection = memo(({
  tourney, matches, isExpanded, onToggle, onMatchPress, isSaved,
}: TourneySectionProps) => {
  // ── Filter out completed matches — customers only see live & upcoming ──────
  const visibleMatches = useMemo(
    () => matches.filter((m) => m.status !== 'completed'),
    [matches],
  );

  const liveCount = useMemo(
    () => visibleMatches.filter((m) => m.status === 'live').length,
    [visibleMatches],
  );

  const sortedMatches = useMemo(() => [...visibleMatches].sort((a, b) => {
    const order = { live: 0, scheduled: 1 };
    return (order[a.status as keyof typeof order] ?? 2) - (order[b.status as keyof typeof order] ?? 2);
  }), [visibleMatches]);

  // Hide the entire section if there's nothing to show
  if (visibleMatches.length === 0) return null;

  return (
    <View style={s.tourneySection}>
      <TouchableOpacity style={s.tourneyHeader} onPress={() => onToggle(tourney.id)}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.tourneyName}>{tourney.name}</Text>
            {isSaved && (
              <View style={s.savedBadge}><Text style={s.savedBadgeText}>Saved</Text></View>
            )}
          </View>
          <Text style={s.tourneySub}>{tourney.sport} · {visibleMatches.length} match{visibleMatches.length !== 1 ? 'es' : ''}</Text>
        </View>
        {liveCount > 0 && (
          <View style={s.liveCountBadge}>
            <Text style={s.liveCountText}>{liveCount} LIVE</Text>
          </View>
        )}
        <Text style={s.chevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={s.matchList}>
          {sortedMatches.length === 0 ? (
            <View style={s.noMatchCard}>
              <Text style={s.noMatchText}>No active matches</Text>
            </View>
          ) : (
            sortedMatches.map((m) => (
              <MatchCard key={m.fixture.id} match={m} onPress={onMatchPress} />
            ))
          )}
        </View>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerLiveScoringScreen() {
  const navigation = useNavigation<any>();

  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [liveData, setLiveData]           = useState<Record<string, LiveMatchSummary[]>>({});
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!tournaments.length) setLoading(true);

    const { tournaments: t } = await fetchCustomerVisibleTournaments();
    setTournaments(t);

    const liveMap: Record<string, LiveMatchSummary[]> = {};
    await Promise.all(t.map(async (tourney) => {
      const { matches } = await fetchLiveMatches(tourney.id);
      // Store all matches in state; filtering happens inside TourneySection
      liveMap[tourney.id] = matches;
    }));
    setLiveData(liveMap);

    // Auto-expand first tournament that has a live match
    const liveTourney = t.find((tourney) =>
      (liveMap[tourney.id] ?? []).some((m) => m.status === 'live'),
    );
    if (liveTourney) {
      setExpandedTournament(liveTourney.id);
    } else if (t.length > 0) {
      setExpandedTournament((prev) => prev ?? t[0].id);
    }

    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, [tournaments.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = useCallback((id: string) => {
    setExpandedTournament((prev) => prev === id ? null : id);
  }, []);

  const handleMatchPress = useCallback((fixtureId: string, tournamentId: string) => {
    navigation.navigate('MatchScoring', { fixtureId, tournamentId });
  }, [navigation]);

  // ── Check if any tournament has visible (non-completed) matches ────────────
  const hasAnyVisibleMatches = useMemo(() =>
    tournaments.some((t) =>
      (liveData[t.id] ?? []).some((m) => m.status !== 'completed'),
    ),
  [tournaments, liveData]);

  const retentionSummary = useMemo(() => {
    const temporary = tournaments.filter((t) => !t.is_saved && t.status !== 'ongoing' && t.expires_at).length;
    return { temporary };
  }, [tournaments]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>Live Scores</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={palette.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Live Scores</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Show empty state if no tournaments at all, OR all matches are completed */}
      {tournaments.length === 0 || !hasAnyVisibleMatches ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🏏</Text>
          <Text style={s.emptyTitle}>No Active Matches</Text>
          <Text style={s.emptyText}>Live and upcoming matches will appear here</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={palette.accent}
            />
          }
        >
          <Text style={s.refreshHint}>Pull to refresh · Tap a match for full scorecard</Text>

          {retentionSummary.temporary > 0 && (
            <View style={s.retentionStrip}>
              <Text style={s.retentionText}>
                ⏱ {retentionSummary.temporary} recent event{retentionSummary.temporary > 1 ? 's' : ''} expire in 24 hours if not saved by the organiser
              </Text>
            </View>
          )}

          {tournaments.map((tourney) => (
            <TourneySection
              key={tourney.id}
              tourney={tourney}
              matches={liveData[tourney.id] ?? []}
              isExpanded={expandedTournament === tourney.id}
              onToggle={handleToggle}
              onMatchPress={handleMatchPress}
              isSaved={tourney.is_saved ?? false}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: palette.abyss },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: 'rgba(8,12,20,0.97)', borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glass2, borderRadius: radius.xs, borderWidth: 1, borderColor: palette.borderSubtle },
  backText:        { fontSize: 22, color: palette.textPrimary, lineHeight: 28 },
  title:           { flex: 1, fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary, textAlign: 'center' },
  scroll:          { padding: spacing.md, paddingBottom: 48, gap: spacing.sm },
  refreshHint:     { fontSize: font.xs, color: palette.textTertiary, textAlign: 'center', marginBottom: 2 },
  emptyIcon:       { fontSize: 52 },
  emptyTitle:      { fontSize: font.lg, fontWeight: font.extrabold, color: palette.textPrimary },
  emptyText:       { fontSize: font.sm, color: palette.textTertiary },

  retentionStrip:  { backgroundColor: palette.amberSoft, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  retentionText:   { fontSize: font.xs, color: palette.amberBright, lineHeight: 18 },

  tourneySection:  { backgroundColor: palette.midnight, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.borderFaint, overflow: 'hidden', ...shadow.sm },
  tourneyHeader:   { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderFaint },
  tourneyName:     { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },
  tourneySub:      { fontSize: font.xs, color: palette.textTertiary, marginTop: 2 },
  savedBadge:      { backgroundColor: palette.emeraldSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  savedBadgeText:  { fontSize: font.xs - 1, fontWeight: font.extrabold, color: palette.emeraldBright },
  liveCountBadge:  { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginRight: spacing.xs },
  liveCountText:   { fontSize: font.xs - 1, fontWeight: font.black, color: '#F87171' },
  chevron:         { fontSize: 12, color: palette.textTertiary },
  matchList:       { padding: spacing.sm, gap: spacing.xs },
  noMatchCard:     { padding: spacing.md, alignItems: 'center' },
  noMatchText:     { fontSize: font.xs, color: palette.textTertiary },

  matchCard:       { backgroundColor: palette.glass1, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: palette.borderFaint, gap: spacing.xs },
  matchCardLive:   { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.04)', borderLeftWidth: 3, borderLeftColor: '#F87171' },
  liveBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  livePulse:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F87171' },
  liveBadgeText:   { fontSize: font.xs - 1, fontWeight: font.black, color: '#F87171', letterSpacing: 1 },
  matchLabel:      { fontSize: font.xs, color: palette.textTertiary, fontWeight: font.medium },
  teamsRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamBlock:       { flex: 1 },
  teamNameTxt:     { fontSize: font.md, fontWeight: font.extrabold, color: palette.textPrimary },
  battingLabel:    { fontSize: font.xs - 1, fontWeight: font.black, color: palette.accentBright, letterSpacing: 0.5 },
  scoreBlock:      { alignItems: 'center', paddingHorizontal: spacing.sm },
  scoreBig:        { fontSize: font.xl, fontWeight: font.black, color: palette.textPrimary },
  scoreSmall:      { fontSize: font.xs, color: palette.textTertiary },
  targetSmall:     { fontSize: font.xs, color: palette.amberBright, fontWeight: font.bold },
  vsText:          { fontSize: font.md, fontWeight: font.black, color: palette.textTertiary },
  liveDetails:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  liveDetailChip:  { backgroundColor: palette.glass2, borderRadius: radius.xs, paddingHorizontal: spacing.xs + 2, paddingVertical: 4, borderWidth: 1, borderColor: palette.borderFaint },
  liveDetailLabel: { fontSize: font.xs - 2, color: palette.textTertiary, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  liveDetailVal:   { fontSize: font.xs, color: palette.textPrimary, fontWeight: font.semibold },
  recentRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  recentLabel:     { fontSize: font.xs, color: palette.textTertiary },
  recentDots:      { flexDirection: 'row', gap: 4 },
  recentDot:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  recentDotTxt:    { fontSize: font.xs - 1, fontWeight: font.extrabold },
  scheduledText:   { fontSize: font.xs, color: palette.textTertiary },
  tapHint:         { fontSize: font.xs - 1, color: palette.accent, fontWeight: font.medium, marginTop: 2 },
});