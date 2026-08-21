import { isValidFrag } from '/@/analysis/achievements';
import {
  buildLogicalTeamIndex,
  logicalTeamForSideAt,
  type LogicalTeamId,
} from '/@/analysis/team-identity';
import type {
  DeathEvent,
  DemoAnalysisIndex,
  RoundSummary,
} from '/@/analysis/schema';

export type RegulationLength = 12 | 15;

export type SideEndCapture = {
  half: 1 | 2;
  roundId: string;
  competitiveRoundNumber: number;
  demoTimeMs: number;
  reason: 'halftime' | 'match-won' | 'regulation-complete' | 'demo-ended';
};

export type MatchSideEndSelection = {
  mr: RegulationLength;
  liveStartTimeMs: number;
  confidence: 'high' | 'review';
  captures: [SideEndCapture, SideEndCapture];
  excludedRoundIds: string[];
};

type CandidateRound = {
  round: RoundSummary;
  deaths: DeathEvent[];
  terroristTeam: LogicalTeamId;
  winnerTeam: LogicalTeamId;
};

const MIN_ROUND_MS = 3_000;
const MAX_ROUND_MS = 5 * 60_000;
const MAX_BETWEEN_ROUNDS_MS = 3 * 60_000;
const LIVE_RESTART_WINDOW_MS = 2 * 60_000;
const SCOREBOARD_SETTLE_MS = 1_250;

const isKnifeWeapon = (weapon: string): boolean =>
  weapon.toLocaleLowerCase('en-US').startsWith('knife');

const captureTime = (
  round: RoundSummary,
  nextRound: RoundSummary | undefined,
): number => {
  const end = round.endTimeMs ?? round.startTimeMs;
  const afterScoreUpdate = end + SCOREBOARD_SETTLE_MS;
  return nextRound
    ? Math.max(end + 250, Math.min(afterScoreUpdate, nextRound.startTimeMs - 250))
    : afterScoreUpdate;
};

const contiguous = (rounds: readonly CandidateRound[]): boolean => rounds.every((entry, index) => {
  if (!index) return true;
  const previousEnd = rounds[index - 1].round.endTimeMs;
  return previousEnd !== null
    && entry.round.startTimeMs >= previousEnd
    && entry.round.startTimeMs - previousEnd <= MAX_BETWEEN_ROUNDS_MS;
});

/**
 * Väljer slutet av första respektive andra tävlingshalvan. Warmup och
 * knivrundor kan finnas kvar i råanalysen, men får aldrig bli captures:
 *
 * - rena knivrundor filtreras bort,
 * - en observerad match-restart förankrar live-starten,
 * - halvtid kräver ett verkligt massbyte av T/CT efter exakt MR12/MR15,
 * - andra halvan slutar vid vinst, full reglering eller sista spelade rond.
 *
 * Demos utan en säker restart kan fortfarande identifieras via sidbytet, men
 * märks `review` och ska inte massköras utan kontroll.
 */
export const selectMatchSideEnds = (
  input: Pick<DemoAnalysisIndex, 'players' | 'rounds' | 'events'>,
): MatchSideEndSelection | undefined => {
  const deathsByRound = new Map<string, DeathEvent[]>();
  for (const event of input.events) {
    if (event.type !== 'death' || !event.roundId) continue;
    const deaths = deathsByRound.get(event.roundId) ?? [];
    deaths.push(event);
    deathsByRound.set(event.roundId, deaths);
  }

  const logicalTeams = buildLogicalTeamIndex(input.players);
  const candidates = input.rounds.flatMap((round): CandidateRound[] => {
    const end = round.endTimeMs;
    const winner = round.winner.value;
    if (end === null || !winner || end <= round.startTimeMs) return [];
    if (end - round.startTimeMs < MIN_ROUND_MS || end - round.startTimeMs > MAX_ROUND_MS) return [];
    const deaths = (deathsByRound.get(round.roundId) ?? [])
      .filter(isValidFrag)
      .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    if (deaths.length > 10) return [];
    // En riktig pistol-/eco-rond kan i teorin sluta med bara kniv, men för en
    // arkivkörning är ett falskt knivresultat värre än en review-markerad demo.
    if (deaths.length >= 2 && deaths.every((death) => isKnifeWeapon(death.weapon))) return [];
    const sampleTime = round.startTimeMs + Math.min(1_000, (end - round.startTimeMs) / 2);
    return [{
      round,
      deaths,
      terroristTeam: logicalTeamForSideAt(logicalTeams, input.players, 'TERRORIST', sampleTime),
      winnerTeam: logicalTeamForSideAt(logicalTeams, input.players, winner, end),
    }];
  }).sort((left, right) => left.round.startTimeMs - right.round.startTimeMs);

  const restartTimes = input.events
    .filter((event) => event.type === 'match_restart')
    .map((event) => event.demoTimeMs)
    .sort((left, right) => left - right);

  const selections: Array<MatchSideEndSelection & { score: number }> = [];
  for (let boundary = 0; boundary + 1 < candidates.length; boundary += 1) {
    const firstSecondHalf = candidates[boundary + 1];
    if (candidates[boundary].terroristTeam === firstSecondHalf.terroristTeam) continue;

    for (const mr of [15, 12] as const) {
      const start = boundary - mr + 1;
      if (start < 0) continue;
      const firstHalf = candidates.slice(start, boundary + 1);
      if (firstHalf.length !== mr
        || !contiguous(firstHalf)
        || firstHalf.some((entry) => entry.terroristTeam !== firstHalf[0].terroristTeam)) continue;

      const firstRound = firstHalf[0].round;
      const restart = restartTimes.filter((time) => time <= firstRound.startTimeMs).at(-1);
      const restartAnchored = restart !== undefined
        && firstRound.startTimeMs - restart <= LIVE_RESTART_WINDOW_MS
        && !candidates.some((entry) => entry.round.startTimeMs > restart
          && entry.round.startTimeMs < firstRound.startTimeMs);
      // En restart mitt i den första halvan betyder att den valda sekvensen
      // fortfarande innehåller warmup eller ett avbrutet matchförsök.
      if (restartTimes.some((time) => time > firstRound.startTimeMs
        && time < (firstHalf.at(-1)?.round.endTimeMs ?? Infinity))) continue;

      const score = new Map<LogicalTeamId, number>([['team-1', 0], ['team-2', 0]]);
      for (const entry of firstHalf) score.set(entry.winnerTeam, (score.get(entry.winnerTeam) ?? 0) + 1);

      const secondHalf: CandidateRound[] = [];
      for (let index = boundary + 1; index < candidates.length && secondHalf.length < mr; index += 1) {
        const entry = candidates[index];
        if (entry.terroristTeam !== firstSecondHalf.terroristTeam) break;
        const previous = secondHalf.at(-1) ?? candidates[boundary];
        const previousEnd = previous.round.endTimeMs;
        if (previousEnd === null
          || entry.round.startTimeMs < previousEnd
          || entry.round.startTimeMs - previousEnd > MAX_BETWEEN_ROUNDS_MS) break;
        secondHalf.push(entry);
        score.set(entry.winnerTeam, (score.get(entry.winnerTeam) ?? 0) + 1);
        if ((score.get(entry.winnerTeam) ?? 0) >= mr + 1) break;
      }
      if (!secondHalf.length) continue;

      const lastSecondHalf = secondHalf.at(-1)!;
      const matchWon = [...score.values()].some((wins) => wins >= mr + 1);
      const reason = matchWon
        ? 'match-won' as const
        : secondHalf.length === mr
          ? 'regulation-complete' as const
          : 'demo-ended' as const;
      const confidence = restartAnchored && reason !== 'demo-ended' ? 'high' as const : 'review' as const;
      const candidateRoundIds = new Set([...firstHalf, ...secondHalf].map((entry) => entry.round.roundId));
      const nextAfterHalftime = candidates[boundary + 1]?.round;
      const nextAfterMatch = candidates[candidates.indexOf(lastSecondHalf) + 1]?.round;
      selections.push({
        mr,
        liveStartTimeMs: firstRound.startTimeMs,
        confidence,
        captures: [{
          half: 1,
          roundId: firstHalf.at(-1)!.round.roundId,
          competitiveRoundNumber: mr,
          demoTimeMs: captureTime(firstHalf.at(-1)!.round, nextAfterHalftime),
          reason: 'halftime',
        }, {
          half: 2,
          roundId: lastSecondHalf.round.roundId,
          competitiveRoundNumber: mr + secondHalf.length,
          demoTimeMs: captureTime(lastSecondHalf.round, nextAfterMatch),
          reason,
        }],
        excludedRoundIds: input.rounds
          .filter((round) => !candidateRoundIds.has(round.roundId))
          .map((round) => round.roundId),
        score: (restartAnchored ? 100 : 0) + (reason === 'demo-ended' ? 0 : 20) + mr,
      });
    }
  }

  const best = selections.sort((left, right) => right.score - left.score
    || left.liveStartTimeMs - right.liveStartTimeMs)[0];
  if (!best) return undefined;
  const { score: _score, ...selection } = best;
  return selection;
};
