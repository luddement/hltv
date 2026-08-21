import type {
  AnalysisPerspective,
  DeathEvent,
  DemoAnalysisIndex,
  FragRating,
  HighlightMoment,
  HistoryEntry,
  ObservedShot,
  PlayerIdentity,
  ReplayEvent,
  RoundRating,
  ScoreReason,
  ScoreRating,
} from '/@/analysis/schema';
import { completeAceGroups } from '/@/analysis/achievements';

type Team = 'TERRORIST' | 'CT';
type HighlightInput = Pick<DemoAnalysisIndex, 'players' | 'rounds' | 'events' | 'demo'>;

const MULTI_KILL_WINDOW_MS = 6_000;
const TRADE_WINDOW_MS = 5_000;
const SHOT_ATTRIBUTION_WINDOW_MS = 3_000;
const SHOT_EVENT_LAG_MS = 50;
const SPRAY_TRANSFER_GAP_MS = 400;
const MIN_MEASURABLE_FAST_KILL_MS = 50;

export type { ObservedShot };

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
const clampConfidence = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value * 100))) / 100;
const isTeam = (value: string | undefined): value is Team =>
  value === 'TERRORIST' || value === 'CT';

const historyValueAt = <T>(history: HistoryEntry<T>[], atMs: number): T | undefined =>
  history.find((entry) => entry.fromMs <= atMs && (entry.toMs === null || atMs < entry.toMs))
    ?.value;

const sessionAt = (player: PlayerIdentity, atMs: number) =>
  player.sessions.find((session) =>
    session.joinedAtMs <= atMs && (session.leftAtMs === null || atMs <= session.leftAtMs),
  );

const teamAt = (
  playersById: Map<string, PlayerIdentity>,
  playerId: string | null,
  atMs: number,
): Team | undefined => {
  if (!playerId) return undefined;
  const player = playersById.get(playerId);
  const team = player && sessionAt(player, atMs)
    ? historyValueAt(sessionAt(player, atMs)?.teams ?? [], atMs)
    : undefined;
  return isTeam(team) ? team : undefined;
};

const focusTeamAt = (perspective: AnalysisPerspective, atMs: number): Team | undefined => {
  const team = historyValueAt(perspective.focusTeamHistory, atMs);
  return isTeam(team) ? team : undefined;
};

const deathEvents = (events: ReplayEvent[]): DeathEvent[] =>
  events.filter((event): event is DeathEvent => event.type === 'death');

const score = (reasons: ScoreReason[], confidence: number): ScoreRating => ({
  score: clampScore(reasons.reduce((total, reason) => total + reason.points, 0)),
  confidence: clampConfidence(confidence),
  reasons,
});

const reason = (
  code: string,
  label: string,
  points: number,
  evidence: 'observed' | 'derived' = 'derived',
): ScoreReason => ({ code, label, points, evidence });

const weaponBonus = (weapon: string): ScoreReason | undefined => {
  const normalized = weapon.toLowerCase();
  if (normalized === 'knife') return reason('weapon_knife', 'Knivfrag', 15, 'observed');
  if (normalized === 'deagle') return reason('weapon_deagle', 'Deagle-frag', 7, 'observed');
  return undefined;
};

export const withVerifiedWallbangBonus = (
  rating: FragRating,
  hasVerifiedMapChecksum = true,
): FragRating => {
  if (!hasVerifiedMapChecksum) return rating;
  if (rating.reasons.some((entry) => entry.code === 'wallbang')) return rating;
  const isHeadshot = rating.reasons.some((entry) => entry.code === 'headshot');
  const wallbangReasons = [
    reason('wallbang', 'Wallbang', 10, 'derived'),
    ...(isHeadshot
      ? [reason('wallbang_headshot', 'Headshot genom vägg', 5, 'derived')]
      : []),
  ];
  return {
    ...rating,
    score: clampScore(rating.score + wallbangReasons.reduce((total, entry) =>
      total + entry.points, 0)),
    reasons: [...rating.reasons, ...wallbangReasons],
  };
};

const normalizedWeapon = (weapon: string): string => {
  const normalized = weapon.toLowerCase();
  if (normalized === 'mp5n') return 'mp5navy';
  if (normalized === 'elite_left' || normalized === 'elite_right') return 'elite';
  return normalized;
};

const distanceReason = (death: DeathEvent): ScoreReason | undefined => {
  const weapon = normalizedWeapon(death.weapon);
  if (['knife', 'grenade', 'hegrenade', 'world'].includes(weapon)) return undefined;
  const killer = death.entityObservation.killer.positionValue;
  const victim = death.entityObservation.victim.positionValue;
  if (!killer?.every(Number.isFinite) || !victim?.every(Number.isFinite)) return undefined;
  const distance = Math.hypot(
    killer[0] - victim[0],
    killer[1] - victim[1],
    killer[2] - victim[2],
  );
  const points = distance >= 1_000
    ? 12
    : distance >= 750
      ? 8
      : distance >= 500
        ? 5
        : distance >= 350
          ? 3
          : 0;
  return points
    ? reason('long_distance', `Långdistans · ${Math.round(distance)} units`, points)
    : undefined;
};

const precisionReasons = (
  death: DeathEvent,
  deaths: DeathEvent[],
  shots: ObservedShot[],
): ScoreReason[] => {
  const weapon = normalizedWeapon(death.weapon);
  if (weapon === 'knife' || weapon === 'grenade' || weapon === 'hegrenade') return [];
  const attributed = shots
    .filter((shot) => shot.slot === death.killerSlot && normalizedWeapon(shot.weapon) === weapon)
    .filter((shot) => shot.demoTimeMs >= death.demoTimeMs - SHOT_ATTRIBUTION_WINDOW_MS)
    .filter((shot) => shot.demoTimeMs <= death.demoTimeMs + SHOT_EVENT_LAG_MS)
    .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
  if (!attributed.length) return [];

  // A previous frag closes the previous engagement. Without one, keep every
  // matching shot in the attribution window instead of treating a short pause
  // as a brand-new one-shot attempt.
  const previousKill = deaths
    .filter((previous) => previous.eventId !== death.eventId
      && previous.killerSlot === death.killerSlot
      && previous.demoTimeMs < death.demoTimeMs)
    .sort((left, right) => right.demoTimeMs - left.demoTimeMs)[0];
  const engagement = previousKill
    ? attributed.filter((shot) => shot.demoTimeMs > previousKill.demoTimeMs)
    : attributed;
  if (!engagement.length) return [];

  const shotsToKill = engagement.length;
  const timeToKillMs = Math.max(0, death.demoTimeMs - engagement[0].demoTimeMs);
  const reasons: ScoreReason[] = [];
  if (shotsToKill === 1) {
    reasons.push(reason('precision_one_shot', '1 skott till kill', 20, 'observed'));
  } else if (shotsToKill === 2) {
    reasons.push(reason('precision_two_shots', '2 skott till kill', 15, 'observed'));
  } else if (shotsToKill <= 4) {
    reasons.push(reason('precision_short_burst', `${shotsToKill} skott till kill`, 10, 'observed'));
  } else if (shotsToKill <= 6) {
    reasons.push(reason('precision_controlled_burst', `${shotsToKill} skott till kill`, 5, 'observed'));
  } else if (shotsToKill >= 9) {
    reasons.push(reason(
      'spray_penalty',
      `${shotsToKill} skott i spray`,
      -Math.min(10, shotsToKill - 8),
      'observed',
    ));
  }
  if (timeToKillMs >= MIN_MEASURABLE_FAST_KILL_MS && timeToKillMs <= 250) {
    reasons.push(reason('fast_kill', `Kill på ${timeToKillMs} ms`, 5, 'observed'));
  }
  const transferred = previousKill
    && previousKill.victimSlot !== death.victimSlot
    && previousKill.demoTimeMs >= death.demoTimeMs - SHOT_ATTRIBUTION_WINDOW_MS
    && attributed.some((shot) => shot.demoTimeMs <= previousKill.demoTimeMs)
    && attributed.some((shot) => shot.demoTimeMs > previousKill.demoTimeMs)
    && (() => {
      const before = attributed.filter((shot) => shot.demoTimeMs <= previousKill.demoTimeMs).at(-1);
      const after = attributed.find((shot) => shot.demoTimeMs > previousKill.demoTimeMs);
      return Boolean(before && after
        && after.demoTimeMs - before.demoTimeMs <= SPRAY_TRANSFER_GAP_MS);
    })();
  if (transferred) {
    reasons.push(reason('spray_transfer', 'Spray-transfer till nytt mål', 12, 'observed'));
  }
  return reasons;
};

const visibleFor = (
  perspective: AnalysisPerspective,
  killerPlayerId: string,
  death: DeathEvent,
): FragRating['visibility'] => {
  if (perspective.kind === 'hltv') {
    const observation = death.entityObservation.killer;
    const hasFinitePosition = observation.positionValue?.every(Number.isFinite) === true;
    const hasFiniteAngles = observation.angleValue?.every(Number.isFinite) === true;
    return observation.entity
      && observation.position
      && observation.angles
      && hasFinitePosition
      && hasFiniteAngles
      ? 'hltv_replay'
      : 'hltv_director';
  }
  return perspective.focusPlayerIds.includes(killerPlayerId)
    ? 'recorded_pov'
    : 'killfeed_only';
};

export const buildHighlightAnalysis = (
  input: HighlightInput,
  observedShots: ObservedShot[] = [],
): Pick<DemoAnalysisIndex, 'fragRatings' | 'moments' | 'roundRatings'> => {
  const playersById = new Map(input.players.map((player) => [player.playerId, player]));
  const perspective = input.demo.perspective;
  const deaths = deathEvents(input.events);
  const roundById = new Map(input.rounds.map((round) => [round.roundId, round]));
  const eligibleDeaths: Array<{
    death: DeathEvent;
    killerPlayerId: string;
    team: Team;
  }> = [];
  const aceEventIds = new Set(
    completeAceGroups(input).flatMap((ace) => ace.eventIds),
  );

  for (const death of deaths) {
    if (!death.killerPlayerId || death.worldKill || death.suicide || death.teamKill.value === true) {
      continue;
    }
    const team = teamAt(playersById, death.killerPlayerId, death.demoTimeMs);
    if (!team) continue;
    if (perspective.kind === 'pov' && focusTeamAt(perspective, death.demoTimeMs) !== team) continue;
    eligibleDeaths.push({ death, killerPlayerId: death.killerPlayerId, team });
  }

  const firstDeathByRound = new Map<string, string>();
  for (const death of deaths) {
    if (death.roundId && !death.worldKill && !death.suicide && !firstDeathByRound.has(death.roundId)) {
      firstDeathByRound.set(death.roundId, death.eventId);
    }
  }

  const fragRatings: FragRating[] = [];
  const streaks = new Map<string, { atMs: number; count: number; roundId: string | null }>();
  for (const { death, killerPlayerId, team } of eligibleDeaths) {
    const reasons: ScoreReason[] = [reason('frag', 'Frag', 25, 'observed')];
    if (death.headshot) reasons.push(reason('headshot', 'Headshot', 10, 'observed'));
    if (aceEventIds.has(death.eventId)) {
      reasons.push(reason('ace', 'ACE · 5 kills i ronden', 0, 'observed'));
    }
    if (death.roundId && firstDeathByRound.get(death.roundId) === death.eventId) {
      reasons.push(reason('opening_kill', 'Opening kill', 10));
    }

    const round = death.roundId ? roundById.get(death.roundId) : undefined;
    const ownAlive = team === 'TERRORIST'
      ? death.aliveBefore.terrorists
      : death.aliveBefore.counterTerrorists;
    const enemyAlive = team === 'TERRORIST'
      ? death.aliveBefore.counterTerrorists
      : death.aliveBefore.terrorists;
    if (ownAlive.value !== null && enemyAlive.value !== null) {
      if (ownAlive.value === 1 && enemyAlive.value >= 2) {
        reasons.push(reason(
          'clutch_kill',
          `Clutchfrag i 1v${enemyAlive.value}`,
          Math.min(20, 12 + (enemyAlive.value - 2) * 4),
        ));
      } else if (enemyAlive.value > ownAlive.value && round?.winner.value === team) {
        reasons.push(reason(
          'numbers_disadvantage',
          `Frag i numerärt underläge ${ownAlive.value}v${enemyAlive.value}`,
          Math.min(15, (enemyAlive.value - ownAlive.value) * 5),
        ));
      }
    }

    if (round?.winner.value === team) reasons.push(reason('round_win', 'Bidrar till vunnen rond', 10));
    const bonus = weaponBonus(death.weapon);
    if (bonus) reasons.push(bonus);
    const distanceBonus = distanceReason(death);
    if (distanceBonus) reasons.push(distanceBonus);
    reasons.push(...precisionReasons(death, deaths, observedShots));

    const streak = streaks.get(killerPlayerId);
    const streakCount = streak
      && streak.roundId === death.roundId
      && death.demoTimeMs - streak.atMs <= MULTI_KILL_WINDOW_MS
      ? streak.count + 1
      : 1;
    streaks.set(killerPlayerId, {
      atMs: death.demoTimeMs,
      count: streakCount,
      roundId: death.roundId,
    });
    if (streakCount > 1) {
      reasons.push(reason(
        'kill_streak',
        `Frag ${streakCount} i snabb följd`,
        Math.min(16, 5 + (streakCount - 2) * 4),
      ));
    }

    const traded = deaths.some((previous) => {
      if (previous.demoTimeMs >= death.demoTimeMs
        || death.demoTimeMs - previous.demoTimeMs > TRADE_WINDOW_MS
        || previous.roundId !== death.roundId) return false;
      const previousVictimTeam = teamAt(playersById, previous.victimPlayerId, previous.demoTimeMs);
      const previousKillerTeam = teamAt(playersById, previous.killerPlayerId, previous.demoTimeMs);
      return previous.killerPlayerId === death.victimPlayerId
        && previousVictimTeam === team
        && previousKillerTeam !== undefined
        && previousKillerTeam !== team;
    });
    if (traded) reasons.push(reason('trade', 'Snabb trade', 8));

    let confidence = 0.55 + 0.15;
    if (ownAlive.value !== null && enemyAlive.value !== null) confidence += 0.15;
    if (round) confidence += 0.1;
    confidence += 0.05;
    fragRatings.push({
      eventId: death.eventId,
      team,
      ace: aceEventIds.has(death.eventId),
      visibility: visibleFor(perspective, killerPlayerId, death),
      reconstruction: death.entityObservation.killer,
      ...score(reasons, confidence),
    });
  }

  const ratingByEvent = new Map(fragRatings.map((rating) => [rating.eventId, rating]));
  const moments: HighlightMoment[] = [];
  const activeMomentByKiller = new Map<string, { moment: HighlightMoment; lastDeathMs: number }>();
  for (const { death, killerPlayerId, team } of eligibleDeaths) {
    const key = `${death.roundId ?? 'no-round'}:${killerPlayerId}`;
    const active = activeMomentByKiller.get(key);
    const canExtend = active && death.demoTimeMs - active.lastDeathMs <= MULTI_KILL_WINDOW_MS;
    if (canExtend) {
      active.moment.eventIds.push(death.eventId);
      active.moment.endTimeMs = death.demoTimeMs + 4_000;
      active.lastDeathMs = death.demoTimeMs;
    } else {
      const moment: HighlightMoment = {
        momentId: `moment-${moments.length + 1}`,
        startTimeMs: Math.max(0, death.demoTimeMs - 3_000),
        endTimeMs: death.demoTimeMs + 4_000,
        eventIds: [death.eventId],
        killerPlayerId,
        team,
        rating: { score: 0, confidence: 0, reasons: [] },
      };
      moments.push(moment);
      activeMomentByKiller.set(key, { moment, lastDeathMs: death.demoTimeMs });
    }
  }

  for (const moment of moments) {
    const ratings = moment.eventIds
      .map((eventId) => ratingByEvent.get(eventId))
      .filter((rating): rating is FragRating => Boolean(rating));
    const bestFrag = Math.max(0, ...ratings.map((rating) => rating.score));
    if (ratings.length === 1) {
      moment.rating = {
        score: bestFrag,
        confidence: ratings[0].confidence,
        reasons: [...ratings[0].reasons],
      };
      continue;
    }
    const firstDeath = deaths.find((death) => death.eventId === moment.eventIds[0]);
    const lastDeath = deaths.find((death) => death.eventId === moment.eventIds.at(-1));
    const durationSeconds = firstDeath && lastDeath
      ? Math.max(0, lastDeath.demoTimeMs - firstDeath.demoTimeMs) / 1_000
      : 0;
    const headshots = moment.eventIds.filter((eventId) =>
      deaths.find((death) => death.eventId === eventId)?.headshot).length;
    const reasons = [
      reason('best_frag', `Bästa fragget ${bestFrag}/100`, Math.round(bestFrag * 0.55)),
      reason(
        'multi_kill',
        `${ratings.length} frags på ${durationSeconds.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s`,
        Math.min(45, 18 + (ratings.length - 2) * 12),
        'observed',
      ),
    ];
    if (durationSeconds <= 6) reasons.push(reason('tempo', 'Högt tempo', 10));
    if (headshots) reasons.push(reason('headshots', `${headshots} headshots`, Math.min(10, headshots * 3), 'observed'));
    moment.rating = score(
      reasons,
      ratings.reduce((total, rating) => total + rating.confidence, 0) / ratings.length,
    );
  }

  const teamsForRound = (roundId: string): Team[] => {
    if (perspective.kind === 'hltv') return ['TERRORIST', 'CT'];
    const round = roundById.get(roundId);
    const team = round && focusTeamAt(perspective, round.startTimeMs);
    return team ? [team] : [];
  };
  const roundRatings: RoundRating[] = [];
  for (const round of input.rounds) {
    if (round.endTimeMs === null || round.endTimeMs <= round.startTimeMs) continue;
    const winningTeam = round.winner.value;
    if (!winningTeam || !teamsForRound(round.roundId).includes(winningTeam)) continue;
    for (const team of [winningTeam]) {
      const teamFrags = fragRatings.filter((rating) =>
        rating.team === team
        && deaths.find((death) => death.eventId === rating.eventId)?.roundId === round.roundId);
      // A normal competitive side has five opponents. More than five
      // winning-team frags means the legacy round boundary is not trustworthy
      // (typically signon history or multiple rounds merged together).
      if (teamFrags.length > 5) continue;
      const teamMoments = moments.filter((moment) =>
        moment.team === team
        && deaths.find((death) => death.eventId === moment.eventIds[0])?.roundId === round.roundId);
      const bestMoment = teamMoments.reduce<HighlightMoment | undefined>(
        (best, moment) => !best || moment.rating.score > best.rating.score ? moment : best,
        undefined,
      );
      // A team round is deliberately just the winning side's frag work across
      // the complete round. Five 100-point frags produce a 100-point round;
      // bomb context, comeback heuristics and losing-team highlights cannot
      // move the ranking and make it feel arbitrary.
      const fragScoreTotal = teamFrags.reduce((total, rating) => total + rating.score, 0);
      const roundFragScore = clampScore(fragScoreTotal / 5);
      const bestFragScore = Math.max(0, ...teamFrags.map((rating) => rating.score));
      const reasons: ScoreReason[] = [
        reason(
          'winning_team_frags',
          `${teamFrags.length} ${teamFrags.length === 1 ? 'frag' : 'frags'} by the winner`,
          roundFragScore,
          'observed',
        ),
        reason('frag_score_total', `Frag value ${fragScoreTotal}/500`, 0, 'observed'),
      ];
      if (bestFragScore) {
        reasons.push(reason('best_frag', `Best frag ${bestFragScore}/100`, 0, 'observed'));
      }

      const confidenceParts = teamFrags.map((rating) => rating.confidence);
      const confidence = confidenceParts.length
        ? confidenceParts.reduce((total, value) => total + value, 0) / confidenceParts.length
        : round.winner.evidence === 'observed' ? 0.75 : 0.65;
      roundRatings.push({
        roundId: round.roundId,
        team,
        bestMomentId: bestMoment?.momentId ?? null,
        ...score(reasons, confidence),
      });
    }
  }

  return { fragRatings, moments, roundRatings };
};
