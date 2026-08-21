import type {
  DeathEvent,
  DemoAnalysisIndex,
  ReplayEvent,
  RoundSummary,
} from '/@/analysis/schema';

export type CompleteAce = {
  roundId: string;
  killerPlayerId: string;
  eventIds: string[];
};

export type PlayerScoreline = {
  kills: number;
  deaths: number;
};

const MAX_CLOSED_ROUND_MS = 5 * 60_000;
const MAX_OPEN_ROUND_KILL_SPAN_MS = 3 * 60_000;

export const isValidFrag = (death: DeathEvent): boolean => Boolean(
  death.killerPlayerId
  && !death.worldKill
  && !death.suicide
  && death.teamKill.value !== true,
);

const plausibleRound = (
  round: RoundSummary,
  kills: readonly DeathEvent[],
): boolean => {
  const first = kills[0]?.demoTimeMs;
  const last = kills.at(-1)?.demoTimeMs;
  if (first === undefined || last === undefined || first < round.startTimeMs) return false;
  if (round.endTimeMs !== null) {
    return round.endTimeMs > round.startTimeMs
      && round.endTimeMs - round.startTimeMs <= MAX_CLOSED_ROUND_MS
      && last <= round.endTimeMs;
  }
  return last - first <= MAX_OPEN_ROUND_KILL_SPAN_MS;
};

/**
 * Ett komplett ace är exakt fem giltiga kills mot fem olika offer av samma
 * spelare under en och samma rimliga rond. Killarnas inbördes tempo spelar
 * ingen roll — en långsam femma är fortfarande ett ace.
 */
export const completeAceGroups = (
  input: Pick<DemoAnalysisIndex, 'rounds' | 'events'>,
): CompleteAce[] => {
  const roundsById = new Map(input.rounds.map((round) => [round.roundId, round]));
  const groups = new Map<string, DeathEvent[]>();
  for (const event of input.events) {
    if (event.type !== 'death' || !event.roundId || !event.killerPlayerId || !isValidFrag(event)) {
      continue;
    }
    const key = `${event.roundId}\n${event.killerPlayerId}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  const aces: CompleteAce[] = [];
  for (const kills of groups.values()) {
    kills.sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    const roundId = kills[0]?.roundId;
    const killerPlayerId = kills[0]?.killerPlayerId;
    const round = roundId ? roundsById.get(roundId) : undefined;
    if (!round || !roundId || !killerPlayerId || kills.length !== 5) continue;
    if (new Set(kills.map((kill) => kill.victimPlayerId).filter(Boolean)).size !== 5) continue;
    if (!plausibleRound(round, kills)) continue;
    aces.push({
      roundId,
      killerPlayerId,
      eventIds: kills.map((kill) => kill.eventId),
    });
  }
  return aces.sort((left, right) => {
    const leftEvent = input.events.find((event) => event.eventId === left.eventIds[0]);
    const rightEvent = input.events.find((event) => event.eventId === right.eventIds[0]);
    return (leftEvent?.demoTimeMs ?? 0) - (rightEvent?.demoTimeMs ?? 0);
  });
};

/** Scoreboard-liknande slutrad per playerId för exakt 0–12-detektering. */
export const playerScorelines = (
  events: readonly ReplayEvent[],
): Map<string, PlayerScoreline> => {
  const scorelines = new Map<string, PlayerScoreline>();
  const row = (playerId: string): PlayerScoreline => {
    const existing = scorelines.get(playerId);
    if (existing) return existing;
    const created = { kills: 0, deaths: 0 };
    scorelines.set(playerId, created);
    return created;
  };

  for (const event of events) {
    if (event.type !== 'death') continue;
    if (event.victimPlayerId) row(event.victimPlayerId).deaths += 1;
    if (event.killerPlayerId && isValidFrag(event)) row(event.killerPlayerId).kills += 1;
  }
  return scorelines;
};

/**
 * Returnerar identiteter som vid någon punkt i demot når 0 kills och 12
 * deaths. En senare kill suddar inte ut bedriften — scoreboarden stod 0–12.
 * resolveIdentity gör att återanslutningar/playerId-byten kan slås ihop till
 * samma person.
 */
export const zeroTwelveMilestones = (
  events: readonly ReplayEvent[],
  resolveIdentity: (playerId: string) => string | undefined = (playerId) => playerId,
): Set<string> => {
  const scorelines = new Map<string, PlayerScoreline>();
  const milestones = new Set<string>();
  const row = (identity: string): PlayerScoreline => {
    const existing = scorelines.get(identity);
    if (existing) return existing;
    const created = { kills: 0, deaths: 0 };
    scorelines.set(identity, created);
    return created;
  };

  const deaths = events
    .filter((event): event is DeathEvent => event.type === 'death')
    .sort((left, right) => left.demoTimeMs - right.demoTimeMs
      || left.packetOrdinal - right.packetOrdinal);
  for (const death of deaths) {
    if (death.killerPlayerId && isValidFrag(death)) {
      const killer = resolveIdentity(death.killerPlayerId);
      if (killer) row(killer).kills += 1;
    }
    if (death.victimPlayerId) {
      const victim = resolveIdentity(death.victimPlayerId);
      if (victim) {
        const scoreline = row(victim);
        scoreline.deaths += 1;
        if (scoreline.kills === 0 && scoreline.deaths === 12) milestones.add(victim);
      }
    }
  }
  return milestones;
};
