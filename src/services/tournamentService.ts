import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type TournamentFormat = 'knockout' | 'round_robin' | 'round_robin_knockout';
export type TournamentStatus = 'draft' | 'registration' | 'ongoing' | 'completed' | 'cancelled';
export type FixtureStatus    = 'scheduled' | 'live' | 'completed' | 'walkover' | 'cancelled';

export interface Tournament {
  id:               string;
  owner_id:         string;
  name:             string;
  sport:            string;
  format:           TournamentFormat;
  status:           TournamentStatus;
  entry_fee:        number;
  prize_pool:       number;
  winner_prize:     number;
  runner_up_prize:  number;
  best_player_prize:number;
  custom_prizes:    { label: string; amount: number }[];
  num_teams:        number;
  overs_per_match:  number;
  start_date:       string | null;
  end_date:         string | null;
  venue:            string | null;
  description:      string | null;
  rules:            string | null;
  is_saved?:        boolean;
  expires_at?:      string | null;
  public_visible?:  boolean;
  created_at:       string;
}

export interface TournamentTeam {
  id:            string;
  tournament_id: string;
  team_name:     string;
  captain_name:  string;
  captain_phone: string;
  vc_name:       string | null;
  vc_phone:      string | null;
  group_name:    string | null;
  seed:          number | null;
  registered_at: string;
}

export interface TournamentFixture {
  id:             string;
  tournament_id:  string;
  round:          number;
  round_label:    string | null;
  match_number:   number;
  team1_id:       string | null;
  team2_id:       string | null;
  team1_name:     string | null;
  team2_name:     string | null;
  match_date:     string | null;
  match_time:     string | null;
  venue:          string | null;
  status:         FixtureStatus;
  winner_id:      string | null;
  toss_winner_id: string | null;
  toss_decision:  string | null;
  player_of_match:string | null;
  notes:          string | null;
}

export interface TournamentInnings {
  id:               string;
  fixture_id:       string;
  innings_number:   number;
  batting_team_id:  string | null;
  bowling_team_id:  string | null;
  batting_team_name:string | null;
  bowling_team_name:string | null;
  total_runs:       number;
  total_wickets:    number;
  total_balls:      number;
  overs_completed:  number;
  extras_total:     number;
  extras_wides:     number;
  extras_no_balls:  number;
  extras_byes:      number;
  extras_leg_byes:  number;
  is_completed:     boolean;
}

export interface BattingScore {
  id:              string;
  innings_id:      string;
  batting_position:number | null;
  player_name:     string;
  runs:            number;
  balls_faced:     number;
  fours:           number;
  sixes:           number;
  dismissal_type:  string | null;
  dismissed_by:    string | null;
  fielder_name:    string | null;
  is_not_out:      boolean;
}

export interface BowlingScore {
  id:          string;
  innings_id:  string;
  bowl_order:  number | null;
  player_name: string;
  overs:       number;
  balls:       number;
  runs_given:  number;
  wickets:     number;
  maidens:     number;
  wides:       number;
  no_balls:    number;
}

export interface Standing {
  team_id:       string;
  team_name:     string;
  played:        number;
  won:           number;
  lost:          number;
  tied:          number;
  no_result:     number;
  points:        number;
  runs_scored:   number;
  balls_faced:   number;
  runs_conceded: number;
  balls_bowled:  number;
  nrr:           number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toNum(v: any, d = 0): number {
  const n = Number(v);
  return isNaN(n) ? d : n;
}

// ── TOURNAMENTS ─────────────────────────────────────────────────────────────

export async function fetchTournaments(ownerId: string): Promise<{
  tournaments: Tournament[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) return { tournaments: [], error: error.message };
  return { tournaments: (data ?? []) as Tournament[], error: null };
}

export async function createTournament(params: {
  ownerId:         string;
  name:            string;
  sport:           string;
  format:          TournamentFormat;
  numTeams:        number;
  oversPerMatch:   number;
  entryFee:        number;
  prizePool:       number;
  winnerPrize:     number;
  runnerUpPrize:   number;
  bestPlayerPrize: number;
  customPrizes:    { label: string; amount: number }[];
  startDate:       string | null;
  endDate:         string | null;
  venue:           string | null;
  description:     string | null;
  rules:           string | null;
}): Promise<{ tournament: Tournament | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      owner_id:          params.ownerId,
      name:              params.name.trim(),
      sport:             params.sport,
      format:            params.format,
      num_teams:         params.numTeams,
      overs_per_match:   params.oversPerMatch,
      entry_fee:         params.entryFee,
      prize_pool:        params.prizePool,
      winner_prize:      params.winnerPrize,
      runner_up_prize:   params.runnerUpPrize,
      best_player_prize: params.bestPlayerPrize,
      custom_prizes:     params.customPrizes,
      start_date:        params.startDate,
      end_date:          params.endDate,
      venue:             params.venue?.trim() ?? null,
      description:       params.description?.trim() ?? null,
      rules:             params.rules?.trim() ?? null,
      status:            'draft',
    })
    .select().single();
  if (error || !data) return { tournament: null, error: error?.message ?? 'Failed to create tournament.' };
  return { tournament: data as Tournament, error: null };
}

export async function updateTournament(
  id: string,
  updates: Partial<Omit<Tournament, 'id' | 'owner_id' | 'created_at'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournaments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteTournament(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tournaments').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── TEAMS ──────────────────────────────────────────────────────────────────

export async function fetchTeams(tournamentId: string): Promise<{
  teams: TournamentTeam[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('registered_at');
  if (error) return { teams: [], error: error.message };
  return { teams: (data ?? []) as TournamentTeam[], error: null };
}

export async function registerTeam(params: {
  tournamentId: string;
  teamName:     string;
  captainName:  string;
  captainPhone: string;
  vcName:       string | null;
  vcPhone:      string | null;
}): Promise<{ team: TournamentTeam | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_teams')
    .insert({
      tournament_id: params.tournamentId,
      team_name:     params.teamName.trim(),
      captain_name:  params.captainName.trim(),
      captain_phone: params.captainPhone.trim(),
      vc_name:       params.vcName?.trim() ?? null,
      vc_phone:      params.vcPhone?.trim() ?? null,
    })
    .select().single();
  if (error || !data) return { team: null, error: error?.message ?? 'Failed to register team.' };
  return { team: data as TournamentTeam, error: null };
}

export async function deleteTeam(teamId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tournament_teams').delete().eq('id', teamId);
  return { error: error?.message ?? null };
}

// ── FIXTURE GENERATION ─────────────────────────────────────────────────────

export function generateKnockoutFixtures(
  teams: TournamentTeam[],
  tournamentId: string,
): Omit<TournamentFixture, 'id' | 'created_at'>[] {
  const fixtures: Omit<TournamentFixture, 'id' | 'created_at'>[] = [];
  const n = teams.length;

  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;

  const ROUND_LABELS: Record<number, string> = {
    2:  'Final',
    4:  'Semi Final',
    8:  'Quarter Final',
    16: 'Round of 16',
    32: 'Round of 32',
  };

  let matchNum = 1;
  const round1Size = bracketSize / 2;
  const byes      = bracketSize - n;

  const seeded = [...teams];

  for (let i = 0; i < round1Size; i++) {
    const t1Index = i * 2;
    const t2Index = i * 2 + 1;

    const team1 = seeded[t1Index - byes >= 0 ? t1Index : -1] ?? null;
    const team2 = seeded[t2Index - byes >= 0 ? t2Index : -1] ?? null;

    if (!team1 && !team2) continue;

    fixtures.push({
      tournament_id:  tournamentId,
      round:          1,
      round_label:    ROUND_LABELS[round1Size * 2] ?? `Round of ${round1Size * 2}`,
      match_number:   matchNum++,
      team1_id:       team1?.id ?? null,
      team2_id:       team2?.id ?? null,
      team1_name:     team1?.team_name ?? 'TBD',
      team2_name:     team2?.team_name ?? 'BYE',
      match_date:     null,
      match_time:     null,
      venue:          null,
      status:         (!team2 ? 'walkover' : 'scheduled') as FixtureStatus,
      winner_id:      !team2 ? (team1?.id ?? null) : null,
      toss_winner_id: null,
      toss_decision:  null,
      player_of_match:null,
      notes:          !team2 ? 'Bye — auto advance' : null,
    });
  }

  return fixtures;
}

export function generateRoundRobinFixtures(
  teams: TournamentTeam[],
  tournamentId: string,
): Omit<TournamentFixture, 'id' | 'created_at'>[] {
  const fixtures: Omit<TournamentFixture, 'id' | 'created_at'>[] = [];
  const n = teams.length;
  let matchNum = 1;

  const list = [...teams];
  if (n % 2 !== 0) list.push({ id: 'BYE', team_name: 'BYE' } as any);
  const totalRounds = list.length - 1;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < list.length / 2; i++) {
      const t1 = list[i];
      const t2 = list[list.length - 1 - i];
      if (t1.id === 'BYE' || t2.id === 'BYE') continue;

      fixtures.push({
        tournament_id:   tournamentId,
        round:           round + 1,
        round_label:     `Round ${round + 1}`,
        match_number:    matchNum++,
        team1_id:        t1.id,
        team2_id:        t2.id,
        team1_name:      t1.team_name,
        team2_name:      t2.team_name,
        match_date:      null,
        match_time:      null,
        venue:           null,
        status:          'scheduled',
        winner_id:       null,
        toss_winner_id:  null,
        toss_decision:   null,
        player_of_match: null,
        notes:           null,
      });
    }

    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return fixtures;
}

export async function saveFixtures(
  tournamentId: string,
  fixtures: Omit<TournamentFixture, 'id' | 'created_at'>[],
): Promise<{ error: string | null }> {
  await supabase
    .from('tournament_fixtures')
    .delete()
    .eq('tournament_id', tournamentId)
    .in('status', ['scheduled']);

  if (fixtures.length === 0) return { error: null };

  const { error } = await supabase.from('tournament_fixtures').insert(fixtures);
  return { error: error?.message ?? null };
}

export async function fetchFixtures(tournamentId: string): Promise<{
  fixtures: TournamentFixture[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_fixtures')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round').order('match_number');
  if (error) return { fixtures: [], error: error.message };
  return { fixtures: (data ?? []) as TournamentFixture[], error: null };
}

export async function updateFixture(
  fixtureId: string,
  updates: Partial<TournamentFixture>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_fixtures').update(updates).eq('id', fixtureId);
  return { error: error?.message ?? null };
}

// ── INNINGS ────────────────────────────────────────────────────────────────

export async function createInnings(params: {
  fixtureId:       string;
  tournamentId:    string;
  inningsNumber:   number;
  battingTeamId:   string;
  bowlingTeamId:   string;
  battingTeamName: string;
  bowlingTeamName: string;
}): Promise<{ innings: TournamentInnings | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_innings')
    .insert({
      fixture_id:        params.fixtureId,
      tournament_id:     params.tournamentId,
      innings_number:    params.inningsNumber,
      batting_team_id:   params.battingTeamId,
      bowling_team_id:   params.bowlingTeamId,
      batting_team_name: params.battingTeamName,
      bowling_team_name: params.bowlingTeamName,
    })
    .select().single();
  if (error || !data) return { innings: null, error: error?.message ?? 'Failed to create innings.' };
  return { innings: data as TournamentInnings, error: null };
}

export async function fetchInnings(fixtureId: string): Promise<{
  innings: TournamentInnings[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_innings')
    .select('*')
    .eq('fixture_id', fixtureId)
    .order('innings_number');
  if (error) return { innings: [], error: error.message };
  return { innings: (data ?? []) as TournamentInnings[], error: null };
}

export async function updateInnings(
  inningsId: string,
  updates: Partial<TournamentInnings>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_innings').update(updates).eq('id', inningsId);
  return { error: error?.message ?? null };
}

// ── BATTING SCORES ─────────────────────────────────────────────────────────

export async function upsertBattingScore(params: {
  id?:             string;
  inningsId:       string;
  fixtureId:       string;
  tournamentId:    string;
  battingPosition: number;
  playerName:      string;
  runs:            number;
  ballsFaced:      number;
  fours:           number;
  sixes:           number;
  dismissalType:   string | null;
  dismissedBy:     string | null;
  fielderName:     string | null;
  isNotOut:        boolean;
}): Promise<{ score: BattingScore | null; error: string | null }> {
  const payload = {
    innings_id:       params.inningsId,
    fixture_id:       params.fixtureId,
    tournament_id:    params.tournamentId,
    batting_position: params.battingPosition,
    player_name:      params.playerName.trim(),
    runs:             params.runs,
    balls_faced:      params.ballsFaced,
    fours:            params.fours,
    sixes:            params.sixes,
    dismissal_type:   params.dismissalType,
    dismissed_by:     params.dismissedBy?.trim() ?? null,
    fielder_name:     params.fielderName?.trim() ?? null,
    is_not_out:       params.isNotOut,
  };

  let result;
  if (params.id) {
    result = await supabase.from('tournament_batting_scores').update(payload).eq('id', params.id).select().single();
  } else {
    result = await supabase.from('tournament_batting_scores').insert(payload).select().single();
  }

  if (result.error || !result.data) return { score: null, error: result.error?.message ?? 'Failed.' };
  return { score: result.data as BattingScore, error: null };
}

export async function fetchBattingScores(inningsId: string): Promise<{
  scores: BattingScore[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_batting_scores')
    .select('*')
    .eq('innings_id', inningsId)
    .order('batting_position');
  if (error) return { scores: [], error: error.message };
  return { scores: (data ?? []) as BattingScore[], error: null };
}

// ── BOWLING SCORES ─────────────────────────────────────────────────────────

export async function upsertBowlingScore(params: {
  id?:         string;
  inningsId:   string;
  fixtureId:   string;
  tournamentId:string;
  bowlOrder:   number;
  playerName:  string;
  overs:       number;
  balls:       number;
  runsGiven:   number;
  wickets:     number;
  maidens:     number;
  wides:       number;
  noBalls:     number;
}): Promise<{ score: BowlingScore | null; error: string | null }> {
  const payload = {
    innings_id:    params.inningsId,
    fixture_id:    params.fixtureId,
    tournament_id: params.tournamentId,
    bowl_order:    params.bowlOrder,
    player_name:   params.playerName.trim(),
    overs:         params.overs,
    balls:         params.balls,
    runs_given:    params.runsGiven,
    wickets:       params.wickets,
    maidens:       params.maidens,
    wides:         params.wides,
    no_balls:      params.noBalls,
  };

  let result;
  if (params.id) {
    result = await supabase.from('tournament_bowling_scores').update(payload).eq('id', params.id).select().single();
  } else {
    result = await supabase.from('tournament_bowling_scores').insert(payload).select().single();
  }

  if (result.error || !result.data) return { score: null, error: result.error?.message ?? 'Failed.' };
  return { score: result.data as BowlingScore, error: null };
}

export async function fetchBowlingScores(inningsId: string): Promise<{
  scores: BowlingScore[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_bowling_scores')
    .select('*')
    .eq('innings_id', inningsId)
    .order('bowl_order');
  if (error) return { scores: [], error: error.message };
  return { scores: (data ?? []) as BowlingScore[], error: null };
}

// ── STANDINGS ──────────────────────────────────────────────────────────────

export async function fetchStandings(tournamentId: string): Promise<{
  standings: Standing[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('points', { ascending: false })
    .order('nrr', { ascending: false });
  if (error) return { standings: [], error: error.message };
  return { standings: (data ?? []) as Standing[], error: null };
}

export async function initStandings(
  tournamentId: string,
  teams: TournamentTeam[],
): Promise<{ error: string | null }> {
  const rows = teams.map((t) => ({
    tournament_id: tournamentId,
    team_id:       t.id,
    team_name:     t.team_name,
  }));
  const { error } = await supabase
    .from('tournament_standings')
    .upsert(rows, { onConflict: 'tournament_id,team_id' });
  return { error: error?.message ?? null };
}

export async function updateStandingsAfterMatch(params: {
  tournamentId:    string;
  winnerId:        string | null;
  loserId:         string | null;
  team1Id:         string;
  team2Id:         string;
  team1RunsScored: number;
  team1BallsFaced: number;
  team2RunsScored: number;
  team2BallsFaced: number;
  isTie:           boolean;
}): Promise<{ error: string | null }> {
  const calcNRR = (rs: number, bf: number, rc: number, bb: number): number => {
    const oF = bf / 6;
    const oB = bb / 6;
    if (oF === 0 || oB === 0) return 0;
    return Math.round(((rs / oF) - (rc / oB)) * 100) / 100;
  };

  const updateTeam = async (
    teamId: string,
    won: boolean,
    tied: boolean,
    rs: number, bf: number,
    rc: number, bb: number,
  ) => {
    const { data: current } = await supabase
      .from('tournament_standings')
      .select('*')
      .eq('tournament_id', params.tournamentId)
      .eq('team_id', teamId)
      .single();

    if (!current) return;

    const c = current as any;
    const newPlayed       = toNum(c.played)        + 1;
    const newWon          = toNum(c.won)            + (won ? 1 : 0);
    const newLost         = toNum(c.lost)           + (!won && !tied ? 1 : 0);
    const newTied         = toNum(c.tied)           + (tied ? 1 : 0);
    const newPoints       = toNum(c.points)         + (won ? 2 : tied ? 1 : 0);
    const newRunsScored   = toNum(c.runs_scored)    + rs;
    const newBallsFaced   = toNum(c.balls_faced)    + bf;
    const newRunsConceded = toNum(c.runs_conceded)  + rc;
    const newBallsBowled  = toNum(c.balls_bowled)   + bb;
    const newNRR          = calcNRR(newRunsScored, newBallsFaced, newRunsConceded, newBallsBowled);

    await supabase.from('tournament_standings').update({
      played:        newPlayed,
      won:           newWon,
      lost:          newLost,
      tied:          newTied,
      points:        newPoints,
      runs_scored:   newRunsScored,
      balls_faced:   newBallsFaced,
      runs_conceded: newRunsConceded,
      balls_bowled:  newBallsBowled,
      nrr:           newNRR,
    })
    .eq('tournament_id', params.tournamentId)
    .eq('team_id', teamId);
  };

  await updateTeam(
    params.team1Id,
    params.winnerId === params.team1Id,
    params.isTie,
    params.team1RunsScored, params.team1BallsFaced,
    params.team2RunsScored, params.team2BallsFaced,
  );

  await updateTeam(
    params.team2Id,
    params.winnerId === params.team2Id,
    params.isTie,
    params.team2RunsScored, params.team2BallsFaced,
    params.team1RunsScored, params.team1BallsFaced,
  );

  return { error: null };
}

// ── Stats helpers ──────────────────────────────────────────────────────────

export function calcStrikeRate(runs: number, balls: number): string {
  if (balls === 0) return '0.00';
  return ((runs / balls) * 100).toFixed(2);
}

export function calcEconomy(runs: number, overs: number): string {
  if (overs === 0) return '0.00';
  return (runs / overs).toFixed(2);
}

export function ballsToOvers(balls: number): string {
  const o = Math.floor(balls / 6);
  const b = balls % 6;
  return `${o}.${b}`;
}

// ── DELIVERIES (live ball-by-ball scoring) ─────────────────────────────────

export type DeliveryOutcome =
  | '0' | '1' | '2' | '3' | '4' | '6'
  | 'W'    // wicket
  | 'WD'   // wide
  | 'NB'   // no ball
  | 'B'    // bye
  | 'LB';  // leg bye

export interface Delivery {
  id:           string;
  innings_id:   string;
  fixture_id:   string;
  tournament_id:string;
  over_number:  number;
  ball_number:  number;
  is_fair_ball: boolean;
  outcome:      DeliveryOutcome;
  runs_scored:  number;
  extras:       number;
  is_wicket:    boolean;
  batsman_name: string | null;
  bowler_name:  string | null;
  created_at:   string;
}

/** Outcomes that are NOT fair deliveries (ball counter doesn't advance) */
export const EXTRA_OUTCOMES: DeliveryOutcome[] = ['WD', 'NB'];

/**
 * Batting runs credited to the batsman for each outcome.
 *
 * WD (wide) = 0 batting runs — the 1-run penalty is an extra, not credited to batsman.
 * NB (no ball) = 0 batting runs — the 1-run penalty is an extra.
 * B / LB = 0 batting runs — those are extras (byes / leg byes).
 * W (wicket) = 0 runs.
 * Everything else = face value.
 */
export function outcomeRuns(outcome: DeliveryOutcome): number {
  switch (outcome) {
    case 'W':
    case '0':
    case 'WD':
    case 'NB':
    case 'B':
    case 'LB':
      return 0;
    default:
      return parseInt(outcome, 10) || 0;
  }
}

/**
 * Extra runs added to innings total for each outcome.
 *
 * WD = 1 extra (wide penalty)
 * NB = 1 extra (no-ball penalty)
 * B  = 1 extra (bye)
 * LB = 1 extra (leg bye)
 * Everything else = 0 extras
 */
export function outcomeExtras(outcome: DeliveryOutcome): number {
  switch (outcome) {
    case 'WD':
    case 'NB':
    case 'B':
    case 'LB':
      return 1;
    default:
      return 0;
  }
}

/** Whether the outcome is a wicket */
export function outcomeIsWicket(outcome: DeliveryOutcome): boolean {
  return outcome === 'W';
}

/** Whether this counts as a fair ball (advances ball counter) */
export function outcomeIsFairBall(outcome: DeliveryOutcome): boolean {
  return !EXTRA_OUTCOMES.includes(outcome);
}

// ── FIX 2: Return type extended to signal innings-end and wicket ───────────
export interface RecordDeliveryResult {
  delivery:       Delivery | null;
  error:          string | null;
  /**
   * true when this delivery was a wicket — UI should clear the striker field
   * and prompt the scorer to enter the new batsman's name.
   */
  wicketFell:     boolean;
  /**
   * true when the innings has just been automatically completed because the
   * allotted overs (overs_per_match) were fully bowled after this delivery.
   * UI should start the next innings.
   */
  inningsEnded:   boolean;
}

/**
 * Record a single delivery and update all aggregated scores.
 *
 * FIX 1 — Auto-end innings: after writing the delivery, we re-read total_balls
 *          and compare against overs_per_match * 6. If the limit is reached,
 *          is_completed is set to true on the innings row.
 *
 * FIX 2 — Wicket signal: returns wicketFell = true so the UI can immediately
 *          clear the striker field and request the next batsman's name.
 */
export async function recordDelivery(params: {
  inningsId:      string;
  fixtureId:      string;
  tournamentId:   string;
  overNumber:     number;
  ballNumber:     number;
  outcome:        DeliveryOutcome;
  batsmanName:    string | null;
  bowlerName:     string | null;
  /** Total overs allowed per innings — pass tournament.overs_per_match */
  oversPerMatch:  number;
}): Promise<RecordDeliveryResult> {
  const isFair   = outcomeIsFairBall(params.outcome);
  const runs     = outcomeRuns(params.outcome);
  const extras   = outcomeExtras(params.outcome);
  const isWicket = outcomeIsWicket(params.outcome);

  // total runs added to the innings scoreboard = batting runs + extras
  const totalRuns = runs + extras;

  // 1. Insert delivery record
  const { data: del, error: delErr } = await supabase
    .from('tournament_deliveries')
    .insert({
      innings_id:    params.inningsId,
      fixture_id:    params.fixtureId,
      tournament_id: params.tournamentId,
      over_number:   params.overNumber,
      ball_number:   params.ballNumber,
      is_fair_ball:  isFair,
      outcome:       params.outcome,
      runs_scored:   runs,
      extras,
      is_wicket:     isWicket,
      batsman_name:  params.batsmanName,
      bowler_name:   params.bowlerName,
    })
    .select()
    .single();

  if (delErr || !del) return { delivery: null, error: delErr?.message ?? 'Failed to record delivery.', wicketFell: false, inningsEnded: false };

  // 2. Update innings totals
  const { data: inn } = await supabase
    .from('tournament_innings')
    .select('total_runs, total_wickets, total_balls, extras_total, extras_wides, extras_no_balls, extras_byes, extras_leg_byes')
    .eq('id', params.inningsId)
    .single();

  let inningsEnded = false;

  if (inn) {
    const c = inn as any;
    const newTotalBalls = toNum(c.total_balls) + (isFair ? 1 : 0);
    const newOversCompleted = Math.floor(newTotalBalls / 6);

    // FIX 1: auto-complete innings when all overs are bowled
    const maxBalls = params.oversPerMatch * 6;
    inningsEnded = newTotalBalls >= maxBalls;

    await supabase.from('tournament_innings').update({
      total_runs:      toNum(c.total_runs)      + totalRuns,
      total_wickets:   toNum(c.total_wickets)   + (isWicket ? 1 : 0),
      total_balls:     newTotalBalls,
      extras_total:    toNum(c.extras_total)     + extras,
      extras_wides:    toNum(c.extras_wides)     + (params.outcome === 'WD' ? 1 : 0),
      extras_no_balls: toNum(c.extras_no_balls)  + (params.outcome === 'NB' ? 1 : 0),
      extras_byes:     toNum(c.extras_byes)      + (params.outcome === 'B'  ? 1 : 0),
      extras_leg_byes: toNum(c.extras_leg_byes)  + (params.outcome === 'LB' ? 1 : 0),
      overs_completed: newOversCompleted,
      // FIX 1: mark innings complete if overs limit reached
      ...(inningsEnded ? { is_completed: true } : {}),
    }).eq('id', params.inningsId);
  }

  // 3. Update batsman aggregate
  // WD: don't update batsman at all (wide, batsman didn't face a ball)
  const batsmanRuns = ['B', 'LB', 'WD'].includes(params.outcome) ? 0 : runs;

  if (params.batsmanName && params.outcome !== 'WD') {
    const { data: existing } = await supabase
      .from('tournament_batting_scores')
      .select('id, runs, balls_faced, fours, sixes, dismissal_type')
      .eq('innings_id', params.inningsId)
      .eq('player_name', params.batsmanName)
      .maybeSingle();

    const ballFaced = isFair || params.outcome === 'NB' ? 1 : 0;

    if (existing) {
      const e = existing as any;
      await supabase.from('tournament_batting_scores').update({
        runs:           toNum(e.runs)        + batsmanRuns,
        balls_faced:    toNum(e.balls_faced) + ballFaced,
        fours:          toNum(e.fours)       + (params.outcome === '4' ? 1 : 0),
        sixes:          toNum(e.sixes)       + (params.outcome === '6' ? 1 : 0),
        // FIX 2: on wicket mark dismissed properly; is_not_out = false
        dismissal_type: isWicket ? 'bowled' : e.dismissal_type,
        is_not_out:     !isWicket,
      }).eq('id', e.id);
    } else {
      await supabase.from('tournament_batting_scores').insert({
        innings_id:       params.inningsId,
        fixture_id:       params.fixtureId,
        tournament_id:    params.tournamentId,
        player_name:      params.batsmanName,
        runs:             batsmanRuns,
        balls_faced:      ballFaced,
        fours:            params.outcome === '4' ? 1 : 0,
        sixes:            params.outcome === '6' ? 1 : 0,
        dismissal_type:   isWicket ? 'bowled' : 'not_out',
        is_not_out:       !isWicket,
        batting_position: 1,
      });
    }
  }

  // 4. Update bowler aggregate
  if (params.bowlerName) {
    const { data: bExisting } = await supabase
      .from('tournament_bowling_scores')
      .select('id, runs_given, wickets, balls, overs, wides, no_balls, maidens')
      .eq('innings_id', params.inningsId)
      .eq('player_name', params.bowlerName)
      .maybeSingle();

    const runsGiven = totalRuns;
    const newBalls  = bExisting
      ? toNum((bExisting as any).balls) + (isFair ? 1 : 0)
      : (isFair ? 1 : 0);
    const newOvers  = Math.floor(newBalls / 6) + (newBalls % 6) / 10;

    if (bExisting) {
      const e = bExisting as any;
      await supabase.from('tournament_bowling_scores').update({
        runs_given: toNum(e.runs_given) + runsGiven,
        wickets:    toNum(e.wickets)    + (isWicket ? 1 : 0),
        balls:      newBalls,
        overs:      newOvers,
        wides:      toNum(e.wides)    + (params.outcome === 'WD' ? 1 : 0),
        no_balls:   toNum(e.no_balls) + (params.outcome === 'NB' ? 1 : 0),
      }).eq('id', e.id);
    } else {
      await supabase.from('tournament_bowling_scores').insert({
        innings_id:    params.inningsId,
        fixture_id:    params.fixtureId,
        tournament_id: params.tournamentId,
        player_name:   params.bowlerName,
        runs_given:    runsGiven,
        wickets:       isWicket ? 1 : 0,
        balls:         newBalls,
        overs:         newOvers,
        wides:         params.outcome === 'WD' ? 1 : 0,
        no_balls:      params.outcome === 'NB' ? 1 : 0,
        maidens:       0,
        bowl_order:    1,
      });
    }
  }

  return {
    delivery:     del as Delivery,
    error:        null,
    // FIX 2: signal to UI that the striker has been dismissed
    wicketFell:   isWicket,
    // FIX 1: signal to UI to start the next innings
    inningsEnded,
  };
}

/** Fetch all deliveries for an innings */
export async function fetchDeliveries(inningsId: string): Promise<{
  deliveries: Delivery[]; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournament_deliveries')
    .select('*')
    .eq('innings_id', inningsId)
    .order('over_number')
    .order('ball_number');
  if (error) return { deliveries: [], error: error.message };
  return { deliveries: (data ?? []) as Delivery[], error: null };
}

/** Delete last delivery (undo last ball) and reverse all aggregates */
export async function undoLastDelivery(inningsId: string): Promise<{ error: string | null }> {
  const { data: last, error: fetchErr } = await supabase
    .from('tournament_deliveries')
    .select('*')
    .eq('innings_id', inningsId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !last) return { error: 'No delivery to undo.' };
  const d = last as any;

  await supabase.from('tournament_deliveries').delete().eq('id', d.id);

  // Reverse innings totals
  const { data: inn } = await supabase
    .from('tournament_innings')
    .select('total_runs, total_wickets, total_balls, extras_total, extras_wides, extras_no_balls, extras_byes, extras_leg_byes, is_completed')
    .eq('id', inningsId).single();

  if (inn) {
    const c = inn as any;
    const newTotalBalls = Math.max(0, toNum(c.total_balls) - (d.is_fair_ball ? 1 : 0));
    await supabase.from('tournament_innings').update({
      total_runs:      Math.max(0, toNum(c.total_runs)      - d.runs_scored - d.extras),
      total_wickets:   Math.max(0, toNum(c.total_wickets)   - (d.is_wicket ? 1 : 0)),
      total_balls:     newTotalBalls,
      extras_total:    Math.max(0, toNum(c.extras_total)     - d.extras),
      extras_wides:    Math.max(0, toNum(c.extras_wides)     - (d.outcome === 'WD' ? 1 : 0)),
      extras_no_balls: Math.max(0, toNum(c.extras_no_balls)  - (d.outcome === 'NB' ? 1 : 0)),
      extras_byes:     Math.max(0, toNum(c.extras_byes)      - (d.outcome === 'B'  ? 1 : 0)),
      extras_leg_byes: Math.max(0, toNum(c.extras_leg_byes)  - (d.outcome === 'LB' ? 1 : 0)),
      overs_completed: Math.floor(newTotalBalls / 6),
      // If innings was auto-completed by overs, re-open it on undo
      ...(c.is_completed ? { is_completed: false } : {}),
    }).eq('id', inningsId);
  }

  // Reverse batsman score
  if (d.batsman_name && d.outcome !== 'WD') {
    const { data: bat } = await supabase
      .from('tournament_batting_scores')
      .select('id, runs, balls_faced, fours, sixes')
      .eq('innings_id', inningsId).eq('player_name', d.batsman_name).maybeSingle();
    if (bat) {
      const b = bat as any;
      const batsmanRunsToReverse = ['B', 'LB'].includes(d.outcome) ? 0 : d.runs_scored;
      const ballFacedToReverse   = (d.is_fair_ball || d.outcome === 'NB') ? 1 : 0;
      await supabase.from('tournament_batting_scores').update({
        runs:           Math.max(0, toNum(b.runs)        - batsmanRunsToReverse),
        balls_faced:    Math.max(0, toNum(b.balls_faced) - ballFacedToReverse),
        fours:          Math.max(0, toNum(b.fours)       - (d.outcome === '4' ? 1 : 0)),
        sixes:          Math.max(0, toNum(b.sixes)       - (d.outcome === '6' ? 1 : 0)),
        is_not_out:     true,
        dismissal_type: 'not_out',
      }).eq('id', b.id);
    }
  }

  // Reverse bowler score
  if (d.bowler_name) {
    const { data: bow } = await supabase
      .from('tournament_bowling_scores')
      .select('id, runs_given, wickets, balls, wides, no_balls')
      .eq('innings_id', inningsId).eq('player_name', d.bowler_name).maybeSingle();
    if (bow) {
      const b = bow as any;
      const newBalls = Math.max(0, toNum(b.balls) - (d.is_fair_ball ? 1 : 0));
      await supabase.from('tournament_bowling_scores').update({
        runs_given: Math.max(0, toNum(b.runs_given) - d.runs_scored - d.extras),
        wickets:    Math.max(0, toNum(b.wickets)    - (d.is_wicket ? 1 : 0)),
        balls:      newBalls,
        overs:      Math.floor(newBalls / 6) + (newBalls % 6) / 10,
        wides:      Math.max(0, toNum(b.wides)    - (d.outcome === 'WD' ? 1 : 0)),
        no_balls:   Math.max(0, toNum(b.no_balls) - (d.outcome === 'NB' ? 1 : 0)),
      }).eq('id', (bow as any).id);
    }
  }

  return { error: null };
}

// ── MANUAL FIXTURE CREATION ────────────────────────────────────────────────

export async function createManualFixture(params: {
  tournamentId:  string;
  round:         number;
  roundLabel:    string;
  matchNumber:   number;
  team1Id:       string;
  team2Id:       string;
  team1Name:     string;
  team2Name:     string;
  matchDate:     string | null;
  matchTime:     string | null;
  venue:         string | null;
}): Promise<{ fixture: TournamentFixture | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_fixtures')
    .insert({
      tournament_id:  params.tournamentId,
      round:          params.round,
      round_label:    params.roundLabel,
      match_number:   params.matchNumber,
      team1_id:       params.team1Id,
      team2_id:       params.team2Id,
      team1_name:     params.team1Name,
      team2_name:     params.team2Name,
      match_date:     params.matchDate,
      match_time:     params.matchTime,
      venue:          params.venue,
      status:         'scheduled',
      winner_id:      null,
      toss_winner_id: null,
      toss_decision:  null,
      player_of_match:null,
      notes:          'Manual fixture',
    })
    .select().single();

  if (error || !data) return { fixture: null, error: error?.message ?? 'Failed to create fixture.' };
  return { fixture: data as TournamentFixture, error: null };
}

export async function getNextMatchNumber(tournamentId: string): Promise<number> {
  const { data } = await supabase
    .from('tournament_fixtures')
    .select('match_number')
    .eq('tournament_id', tournamentId)
    .order('match_number', { ascending: false })
    .limit(1)
    .single();
  return ((data as any)?.match_number ?? 0) + 1;
}

// ── CUSTOMER LIVE SCORE — public read-only helpers ─────────────────────────

export interface LiveMatchSummary {
  fixture:         TournamentFixture;
  tournamentName:  string;
  innings:         TournamentInnings[];
  battingTeam:     string;
  bowlingTeam:     string;
  totalRuns:       number;
  totalWickets:    number;
  totalBalls:      number;
  oversStr:        string;
  extrasTotal:     number;
  /**
   * FIX 3 — Target for 2nd innings.
   *
   * `total_runs` already includes extras (wide/no-ball penalties, byes, leg-byes)
   * because recordDelivery adds `runs + extras` to `total_runs`.
   * So the target is simply innings[0].total_runs + 1.
   * We must NOT add extras_total again — that would double-count them.
   */
  target:          number | null;
  striker:         string | null;
  nonStriker:      string | null;
  currentBowler:   string | null;
  recentDeliveries:string[];
  status:          'scheduled' | 'live' | 'completed' | 'other';
}

export async function fetchLiveMatches(tournamentId: string): Promise<{
  matches: LiveMatchSummary[]; error: string | null;
}> {
  const { data: fixtures, error: fixErr } = await supabase
    .from('tournament_fixtures')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('status', ['live', 'scheduled', 'completed'])
    .order('round').order('match_number');

  if (fixErr) return { matches: [], error: fixErr.message };

  const { data: tourney } = await supabase
    .from('tournaments').select('name').eq('id', tournamentId).single();
  const tournamentName = (tourney as any)?.name ?? '';

  const matches: LiveMatchSummary[] = [];

  for (const fix of (fixtures ?? [])) {
    const { data: innData } = await supabase
      .from('tournament_innings').select('*').eq('fixture_id', fix.id).order('innings_number');
    const innings = (innData ?? []) as TournamentInnings[];

    const activeInn = innings.find((i) => !i.is_completed) ?? innings[innings.length - 1];

    let striker: string | null = null;
    let nonStriker: string | null = null;
    let currentBowler: string | null = null;
    let recentDeliveries: string[] = [];

    if (activeInn) {
      const { data: dels } = await supabase
        .from('tournament_deliveries')
        .select('outcome, is_fair_ball, batsman_name, bowler_name')
        .eq('innings_id', activeInn.id)
        .order('created_at', { ascending: false })
        .limit(12);

      const delRows = (dels ?? []) as any[];
      recentDeliveries = delRows.slice(0, 6).reverse().map((d) => d.outcome);
      currentBowler    = delRows[0]?.bowler_name ?? null;

      if (delRows.length > 0) {
        striker    = delRows[0]?.batsman_name ?? null;
        nonStriker = delRows.find((d) => d.batsman_name !== striker)?.batsman_name ?? null;
      } else {
        const { data: batData } = await supabase
          .from('tournament_batting_scores')
          .select('player_name, is_not_out')
          .eq('innings_id', activeInn.id)
          .eq('is_not_out', true)
          .limit(2);
        const notOut = (batData ?? []) as any[];
        striker    = notOut[0]?.player_name ?? null;
        nonStriker = notOut[1]?.player_name ?? null;
      }
    }

    const totalRuns    = activeInn?.total_runs     ?? 0;
    const totalWickets = activeInn?.total_wickets  ?? 0;
    const totalBalls   = activeInn?.total_balls    ?? 0;
    const extrasTotal  = activeInn?.extras_total   ?? 0;

    // FIX 3: target = innings[0].total_runs + 1
    // total_runs already contains extras (wides/no-balls/byes/leg-byes) because
    // recordDelivery accumulates (batting_runs + extras) into total_runs.
    // Adding extras_total on top would double-count them.
    const target = innings.length >= 2 && activeInn === innings[1]
      ? (innings[0].total_runs ?? 0) + 1
      : null;

    matches.push({
      fixture:         fix as TournamentFixture,
      tournamentName,
      innings,
      battingTeam:     activeInn?.batting_team_name ?? fix.team1_name ?? '',
      bowlingTeam:     activeInn?.bowling_team_name ?? fix.team2_name ?? '',
      totalRuns,
      totalWickets,
      totalBalls,
      oversStr:        ballsToOvers(totalBalls),
      extrasTotal,
      target,
      striker,
      nonStriker,
      currentBowler,
      recentDeliveries,
      status:          fix.status as any,
    });
  }

  return { matches, error: null };
}

export async function fetchAllTournaments(): Promise<{ tournaments: Tournament[]; error: string | null }> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['registration', 'ongoing', 'completed'])
    .order('created_at', { ascending: false });
  if (error) return { tournaments: [], error: error.message };
  return { tournaments: (data ?? []) as Tournament[], error: null };
}

export async function fetchTournamentById(tournamentId: string): Promise<{
  tournament: Tournament | null; error: string | null;
}> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  if (error || !data) return { tournament: null, error: error?.message ?? 'Tournament not found.' };
  return { tournament: data as Tournament, error: null };
}

// ── TOURNAMENT RETENTION / SAVE MODEL ─────────────────────────────────────
// Tournaments are either:
//   saved (is_saved = true)  → permanent, always visible in history
//   temporary (is_saved = false) → visible only while expires_at > now()
//   After 24h of inactivity (expires_at < now()), hidden from customer view

export async function saveTournament(tournamentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournaments')
    .update({ is_saved: true, expires_at: null, public_visible: true })
    .eq('id', tournamentId);
  return { error: error?.message ?? null };
}

export async function setTournamentExpiry(tournamentId: string, hoursFromNow = 24): Promise<{ error: string | null }> {
  const expiresAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('tournaments')
    .update({ expires_at: expiresAt })
    .eq('id', tournamentId)
    .eq('is_saved', false);
  return { error: error?.message ?? null };
}

// Fetch tournaments visible to customers:
// - currently live/ongoing (regardless of save state)
// - saved tournaments (is_saved = true)
// - unsaved but within expiry window
export async function fetchCustomerVisibleTournaments(): Promise<{
  tournaments: Tournament[]; error: string | null;
}> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('public_visible', true)
    .or(
      `is_saved.eq.true,` +                     // saved = always visible
      `status.eq.ongoing,` +                    // live right now = always visible
      `expires_at.gt.${now}`                    // unsaved but within 24h window
    )
    .order('created_at', { ascending: false });
  if (error) return { tournaments: [], error: error.message };
  return { tournaments: (data ?? []) as Tournament[], error: null };
}

// Owner calls this when they start a tournament — sets 24h default expiry
// Owner can then hit "Save" to make it permanent
export async function initTournamentExpiry(tournamentId: string): Promise<{ error: string | null }> {
  return setTournamentExpiry(tournamentId, 24);
}