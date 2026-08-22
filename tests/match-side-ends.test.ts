import { describe, expect, it } from 'vitest';
import { selectMatchSideEnds } from '../src/analysis/match-side-ends';
import type {
  DeathEvent,
  MatchRestartEvent,
  PlayerIdentity,
  ReplayEvent,
  RoundSummary,
} from '../src/analysis/schema';

const player = (
  ordinal: number,
  initial: 'TERRORIST' | 'CT',
  swappedAtMs: number,
): PlayerIdentity => ({
  playerId: `p${ordinal}`,
  steamId: { value: null, evidence: 'unknown' },
  sessions: [{
    sessionId: `s${ordinal}`,
    slot: ordinal,
    userId: ordinal,
    joinedAtMs: 0,
    leftAtMs: null,
    names: [{ fromMs: 0, toMs: null, value: `${initial}-${ordinal}`, evidence: 'observed' }],
    teams: [{
      fromMs: 0,
      toMs: swappedAtMs,
      value: initial,
      evidence: 'observed',
    }, {
      fromMs: swappedAtMs,
      toMs: null,
      value: initial === 'TERRORIST' ? 'CT' : 'TERRORIST',
      evidence: 'observed',
    }],
  }],
});

const base = (eventId: string, demoTimeMs: number, roundId: string | null) => ({
  eventId,
  demoTimeMs,
  packetOrdinal: demoTimeMs,
  directoryEntry: 0,
  byteOffset: demoTimeMs,
  roundId,
  evidence: 'observed' as const,
  source: { rawMessage: 'test', messageOrdinal: 0 },
});

const restart = (demoTimeMs: number): MatchRestartEvent => ({
  ...base(`restart-${demoTimeMs}`, demoTimeMs, null),
  type: 'match_restart',
});

const death = (
  roundId: string,
  demoTimeMs: number,
  weapon = 'ak47',
): DeathEvent => ({
  ...base(`death-${roundId}-${demoTimeMs}-${weapon}`, demoTimeMs, roundId),
  type: 'death',
  killerPlayerId: 'p1',
  victimPlayerId: 'p6',
  killerSlot: 1,
  victimSlot: 6,
  weapon,
  headshot: false,
  teamKill: { value: false, evidence: 'derived' },
  worldKill: false,
  suicide: false,
  aliveBefore: {
    terrorists: { value: 5, evidence: 'derived' },
    counterTerrorists: { value: 5, evidence: 'derived' },
  },
  entityObservation: {
    killer: {
      entity: true, position: true, angles: true,
      positionValue: [0, 0, 0], angleValue: [0, 0, 0], evidence: 'derived',
    },
    victim: {
      entity: true, position: true, angles: true,
      positionValue: [0, 0, 0], angleValue: [0, 0, 0], evidence: 'derived',
    },
  },
});

type Fixture = {
  players: PlayerIdentity[];
  rounds: RoundSummary[];
  events: ReplayEvent[];
};

const fixture = (
  mr: 12 | 15,
  secondHalfWinnerTeams: Array<'team-1' | 'team-2'>,
  includeRestart = true,
): Fixture => {
  const liveStart = 60_000;
  const halftimeAt = liveStart + mr * 30_000;
  const players = [1, 2, 3, 4, 5].map((id) => player(id, 'TERRORIST', halftimeAt))
    .concat([6, 7, 8, 9, 10].map((id) => player(id, 'CT', halftimeAt)));
  const rounds: RoundSummary[] = [];
  const events: ReplayEvent[] = includeRestart ? [restart(50_000)] : [];

  // En full warmuprond och en ren knivrunda ligger före live-restarten.
  rounds.push({
    roundId: 'warmup', number: 1, startTimeMs: 0, endTimeMs: 20_000,
    winner: { value: 'TERRORIST', evidence: 'derived' }, deathEventIds: [],
  });
  events.push(death('warmup', 10_000));
  rounds.push({
    roundId: 'knife', number: 2, startTimeMs: 25_000, endTimeMs: 40_000,
    winner: { value: 'CT', evidence: 'derived' }, deathEventIds: [],
  });
  events.push(death('knife', 30_000, 'knife'), death('knife', 31_000, 'knife'));

  const firstHalfWinnerTeams = Array.from({ length: mr }, (_, index) =>
    index < Math.ceil(mr * 2 / 3) ? 'team-1' as const : 'team-2' as const);
  const winnerTeams = [...firstHalfWinnerTeams, ...secondHalfWinnerTeams];
  winnerTeams.forEach((winnerTeam, index) => {
    const startTimeMs = liveStart + index * 30_000;
    const firstHalf = index < mr;
    const winner = firstHalf
      ? winnerTeam === 'team-1' ? 'TERRORIST' : 'CT'
      : winnerTeam === 'team-1' ? 'CT' : 'TERRORIST';
    const roundId = `live-${index + 1}`;
    rounds.push({
      roundId,
      number: index + 3,
      startTimeMs,
      endTimeMs: startTimeMs + 20_000,
      winner: { value: winner, evidence: 'derived' },
      deathEventIds: [],
    });
    events.push(death(roundId, startTimeMs + 10_000));
  });
  return { players, rounds, events };
};

describe('competitive side-end selection', () => {
  it('ignores gun warmup and knife round before an MR15 live restart', () => {
    // 10–5 efter första halvan, tre motståndarronder och sedan sex raka till 16–8.
    const input = fixture(15, [
      'team-2', 'team-2', 'team-2',
      'team-1', 'team-1', 'team-1', 'team-1', 'team-1', 'team-1',
    ]);
    const selected = selectMatchSideEnds(input);

    expect(selected).toMatchObject({
      mr: 15,
      liveStartTimeMs: 60_000,
      confidence: 'high',
      reviewReasons: [],
      captures: [
        { half: 1, roundId: 'live-15', competitiveRoundNumber: 15, reason: 'halftime' },
        { half: 2, roundId: 'live-24', competitiveRoundNumber: 24, reason: 'match-won' },
      ],
    });
    expect(selected?.excludedRoundIds).toEqual(expect.arrayContaining(['warmup', 'knife']));
  });

  it('also rejects a one-kill knife round as pre-live junk', () => {
    const input = fixture(12, Array.from({ length: 7 }, () => 'team-1' as const));
    input.events = input.events.filter((event) => event.eventId !== 'death-knife-31000-knife');

    expect(selectMatchSideEnds(input)).toMatchObject({
      mr: 12,
      liveStartTimeMs: 60_000,
      excludedRoundIds: expect.arrayContaining(['warmup', 'knife']),
    });
  });

  it('supports MR12 and marks a restart-less inference for review', () => {
    const input = fixture(12, Array.from({ length: 12 }, (_, index) =>
      index % 2 ? 'team-1' as const : 'team-2' as const), false);
    const selected = selectMatchSideEnds(input);

    expect(selected).toMatchObject({
      mr: 12,
      confidence: 'review',
      captures: [
        { roundId: 'live-12', reason: 'halftime' },
        { roundId: 'live-22', reason: 'match-won' },
      ],
    });
  });

  it('uses the final played second-half round when the demo was abandoned', () => {
    const selected = selectMatchSideEnds(fixture(15, [
      'team-2', 'team-1', 'team-2', 'team-1',
    ]));

    expect(selected).toMatchObject({
      confidence: 'review',
      reviewReasons: ['demo-ended-before-result'],
      captures: [
        { roundId: 'live-15', reason: 'halftime' },
        { roundId: 'live-19', reason: 'demo-ended' },
      ],
    });
  });

  it('marks a capture for review when a live player left before the native scoreboard frame', () => {
    const input = fixture(15, Array.from({ length: 7 }, () => 'team-1' as const));
    input.players[0].sessions[0].leftAtMs = 670_000;

    const selected = selectMatchSideEnds(input);

    expect(selected).toMatchObject({
      confidence: 'review',
      reviewReasons: ['player-missing-at-match-capture'],
      captures: [
        { half: 1, review: false, missingPlayerIds: [] },
        { half: 2, review: true, missingPlayerIds: ['p1'] },
      ],
    });
  });

  it('does not flag a player who reconnects before the capture', () => {
    const input = fixture(12, Array.from({ length: 7 }, () => 'team-1' as const));
    const original = input.players[0].sessions[0];
    original.leftAtMs = 600_000;
    input.players[0].sessions.push({
      ...original,
      sessionId: 'p1-reconnected',
      joinedAtMs: 601_000,
      leftAtMs: null,
      names: [{ fromMs: 601_000, toMs: null, value: 'TERRORIST-1', evidence: 'observed' }],
      teams: [{ fromMs: 601_000, toMs: null, value: 'CT', evidence: 'observed' }],
    });

    expect(selectMatchSideEnds(input)).toMatchObject({
      confidence: 'high',
      reviewReasons: [],
      captures: [{ review: false }, { review: false }],
    });
  });

  it('drops an aborted second-half round when the server restarts back to 0–0', () => {
    const input = fixture(15, Array.from({ length: 7 }, () => 'team-1' as const));
    input.events.push(restart(535_000));

    const selected = selectMatchSideEnds(input);

    expect(selected).toMatchObject({
      confidence: 'high',
      captures: [
        { roundId: 'live-15', reason: 'halftime' },
        { roundId: 'live-22', competitiveRoundNumber: 21, reason: 'match-won' },
      ],
    });
    expect(selected?.excludedRoundIds).toContain('live-16');
  });
});
