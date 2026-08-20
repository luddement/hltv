import { describe, expect, it } from 'vitest';
import {
  buildHighlightAnalysis,
  withVerifiedWallbangBonus,
} from '/@/analysis/highlight-analyzer';
import type {
  AnalysisPerspective,
  DeathEvent,
  DemoAnalysisIndex,
  PlayerIdentity,
} from '/@/analysis/schema';

const player = (playerId: string, slot: number, team: 'TERRORIST' | 'CT'): PlayerIdentity => ({
  playerId,
  steamId: { value: null, evidence: 'unknown' },
  sessions: [{
    sessionId: `session-${slot}`,
    slot,
    userId: slot,
    joinedAtMs: 0,
    leftAtMs: 20_000,
    names: [{ fromMs: 0, toMs: 20_000, value: playerId, evidence: 'observed' }],
    teams: [{ fromMs: 0, toMs: 20_000, value: team, evidence: 'observed' }],
  }],
});

const death = (
  eventId: string,
  atMs: number,
  killerPlayerId: string,
  victimPlayerId: string,
  killerSlot: number,
  victimSlot: number,
  terrorists: number,
  counterTerrorists: number,
  headshot = false,
): DeathEvent => ({
  eventId,
  type: 'death',
  demoTimeMs: atMs,
  packetOrdinal: Number(eventId.replace(/\D/g, '')),
  directoryEntry: 0,
  byteOffset: atMs,
  roundId: 'round-1',
  evidence: 'observed',
  source: { rawMessage: 'DeathMsg', messageOrdinal: 0 },
  killerPlayerId,
  victimPlayerId,
  killerSlot,
  victimSlot,
  weapon: 'deagle',
  headshot,
  teamKill: { value: false, evidence: 'derived' },
  worldKill: false,
  suicide: false,
  aliveBefore: {
    terrorists: { value: terrorists, evidence: 'derived' },
    counterTerrorists: { value: counterTerrorists, evidence: 'derived' },
  },
  entityObservation: {
    killer: {
      entity: true,
      position: true,
      angles: true,
      positionValue: [100, 200, 300],
      angleValue: [0, 90, 0],
      evidence: 'derived',
    },
    victim: {
      entity: true,
      position: true,
      angles: true,
      positionValue: [200, 300, 400],
      angleValue: [0, 180, 0],
      evidence: 'derived',
    },
  },
});

const input = (perspective: AnalysisPerspective) => ({
  players: [
    player('t-pov', 1, 'TERRORIST'),
    player('t-mate', 2, 'TERRORIST'),
    player('ct-1', 3, 'CT'),
    player('ct-2', 4, 'CT'),
    player('ct-3', 5, 'CT'),
  ],
  rounds: [{
    roundId: 'round-1',
    number: 1,
    startTimeMs: 1_000,
    endTimeMs: 10_000,
    winner: { value: 'TERRORIST' as const, evidence: 'derived' as const },
    deathEventIds: ['death-1', 'death-2', 'death-3', 'death-4', 'death-5'],
  }],
  events: [
    death('death-1', 2_000, 't-pov', 'ct-1', 1, 3, 1, 3, true),
    death('death-5', 3_000, 'ct-1', 't-mate', 3, 2, 1, 2),
    death('death-2', 4_000, 't-pov', 'ct-2', 1, 4, 1, 2, true),
    death('death-3', 5_000, 't-pov', 'ct-3', 1, 5, 1, 1),
    death('death-4', 7_000, 't-mate', 'ct-1', 2, 3, 2, 1),
  ],
  demo: {
    sha256: 'fixture',
    name: 'fixture.dem',
    durationMs: 20_000,
    demoProtocol: 5,
    networkProtocol: 48 as const,
    compatibilityProfile: 'cs-goldsrc-48',
    mapName: 'de_test',
    mapChecksum: 1,
    isHltv: perspective.kind === 'hltv',
    perspective,
  },
}) satisfies Pick<DemoAnalysisIndex, 'players' | 'rounds' | 'events' | 'demo'>;

describe('highlight scoring', () => {
  it('builds an explainable high-scoring clutch moment and round', () => {
    const result = buildHighlightAnalysis(input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    }));
    const clutchMoment = result.moments.find((moment) => moment.killerPlayerId === 't-pov');
    const terroristRound = result.roundRatings.find((rating) => rating.team === 'TERRORIST');

    expect(clutchMoment?.eventIds).toEqual(['death-1', 'death-2', 'death-3']);
    expect(clutchMoment?.rating.score).toBeGreaterThanOrEqual(85);
    expect(clutchMoment?.rating.reasons.map((entry) => entry.code)).toContain('multi_kill');
    const winningFragTotal = result.fragRatings
      .filter((rating) => rating.team === 'TERRORIST')
      .reduce((total, rating) => total + rating.score, 0);
    expect(terroristRound?.score).toBe(Math.round(winningFragTotal / 5));
    expect(terroristRound?.reasons.map((entry) => entry.code)).toContain('winning_team_frags');
    expect(result.roundRatings.map((rating) => rating.team)).toEqual(['TERRORIST']);
  });

  it('limits POV highlights to the focus team and marks teammate frags as killfeed-only', () => {
    const result = buildHighlightAnalysis(input({
      kind: 'pov',
      focusPlayerIds: ['t-pov'],
      focusTeamHistory: [{
        fromMs: 0,
        toMs: 20_000,
        value: 'TERRORIST',
        evidence: 'observed',
      }],
      evidence: 'derived',
    }));

    expect(result.fragRatings.map((rating) => rating.team)).toEqual([
      'TERRORIST', 'TERRORIST', 'TERRORIST', 'TERRORIST',
    ]);
    expect(result.fragRatings.find((rating) => rating.eventId === 'death-1')?.visibility)
      .toBe('recorded_pov');
    expect(result.fragRatings.find((rating) => rating.eventId === 'death-4')?.visibility)
      .toBe('killfeed_only');
    expect(result.fragRatings.some((rating) => rating.eventId === 'death-5')).toBe(false);
    expect(result.roundRatings.map((rating) => rating.team)).toEqual(['TERRORIST']);
  });

  it('only offers native HLTV POV when killer entity data is present at the frag', () => {
    const fixture = input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    });
    const missingEntityDeath = fixture.events.find((event): event is DeathEvent =>
      event.type === 'death' && event.eventId === 'death-1');
    if (!missingEntityDeath) throw new Error('Fixture death missing');
    missingEntityDeath.entityObservation.killer = {
      entity: false,
      position: false,
      angles: false,
      positionValue: null,
      angleValue: null,
      evidence: 'derived',
    };

    const result = buildHighlightAnalysis(fixture);

    expect(result.fragRatings.find((rating) => rating.eventId === 'death-1')?.visibility)
      .toBe('hltv_director');
    expect(result.fragRatings.find((rating) => rating.eventId === 'death-2')?.visibility)
      .toBe('hltv_replay');
  });

  it('rewards efficient shots, penalizes long sprays and detects spray transfers', () => {
    const result = buildHighlightAnalysis(input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    }), [
      { demoTimeMs: 1_950, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 3_800, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 3_950, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_150, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_350, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_550, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_750, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_950, slot: 1, weapon: 'deagle' },
      ...Array.from({ length: 9 }, (_, index) => ({
        demoTimeMs: 6_200 + index * 100,
        slot: 2,
        weapon: 'deagle',
      })),
    ]);

    const oneShot = result.fragRatings.find((rating) => rating.eventId === 'death-1');
    const twoShot = result.fragRatings.find((rating) => rating.eventId === 'death-2');
    const transfer = result.fragRatings.find((rating) => rating.eventId === 'death-3');
    const spray = result.fragRatings.find((rating) => rating.eventId === 'death-4');
    expect(oneShot?.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'precision_one_shot', points: 20 }),
      expect.objectContaining({ code: 'fast_kill', points: 5 }),
    ]));
    expect(twoShot?.reasons).toContainEqual(expect.objectContaining({
      code: 'precision_two_shots',
      points: 15,
    }));
    expect(transfer?.reasons).toContainEqual(expect.objectContaining({
      code: 'spray_transfer',
      points: 12,
    }));
    expect(spray?.reasons).toContainEqual(expect.objectContaining({
      code: 'spray_penalty',
      points: -1,
    }));
  });

  it('rewards verified long-distance bullet frags but not grenades', () => {
    const fixture = input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    });
    const bullet = fixture.events.find((event): event is DeathEvent =>
      event.type === 'death' && event.eventId === 'death-1');
    const grenade = fixture.events.find((event): event is DeathEvent =>
      event.type === 'death' && event.eventId === 'death-2');
    if (!bullet || !grenade) throw new Error('Fixture deaths missing');
    bullet.entityObservation.victim.positionValue = [1_200, 200, 300];
    grenade.entityObservation.victim.positionValue = [1_200, 200, 300];
    grenade.weapon = 'grenade';

    const result = buildHighlightAnalysis(fixture);
    expect(result.fragRatings.find((entry) => entry.eventId === bullet.eventId)?.reasons)
      .toContainEqual(expect.objectContaining({ code: 'long_distance', points: 12 }));
    expect(result.fragRatings.find((entry) => entry.eventId === grenade.eventId)?.reasons
      .some((entry) => entry.code === 'long_distance')).toBe(false);
  });

  it('does not inflate a grenade opening kill with an automatic weapon bonus', () => {
    const fixture = input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    });
    const grenade = fixture.events.find((event): event is DeathEvent =>
      event.type === 'death' && event.eventId === 'death-1');
    if (!grenade) throw new Error('Fixture death missing');
    grenade.weapon = 'grenade';
    grenade.headshot = false;
    grenade.aliveBefore = {
      terrorists: { value: 3, evidence: 'derived' },
      counterTerrorists: { value: 3, evidence: 'derived' },
    };

    const rating = buildHighlightAnalysis(fixture).fragRatings
      .find((entry) => entry.eventId === grenade.eventId);

    expect(rating?.score).toBe(45);
    expect(rating?.reasons.map((entry) => entry.code)).toEqual([
      'frag', 'opening_kill', 'round_win',
    ]);
  });

  it('rewards a geometry-verified wallbang and its headshot combination', () => {
    const rating = buildHighlightAnalysis(input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    })).fragRatings[0];
    const wallbang = withVerifiedWallbangBonus(rating);

    expect(wallbang.score).toBe(Math.min(100, rating.score + 15));
    expect(wallbang.reasons.slice(-2)).toEqual([
      { code: 'wallbang', label: 'Wallbang', points: 10, evidence: 'derived' },
      {
        code: 'wallbang_headshot',
        label: 'Headshot genom vägg',
        points: 5,
        evidence: 'derived',
      },
    ]);
    expect(withVerifiedWallbangBonus(wallbang)).toEqual(wallbang);
    expect(withVerifiedWallbangBonus(rating, false)).toEqual(rating);
  });

  it('does not inflate a losing 2v5 frag after several shots in the same fight', () => {
    const fixture = input({
      kind: 'hltv', focusPlayerIds: [], focusTeamHistory: [], evidence: 'unknown',
    });
    fixture.rounds[0].winner.value = 'CT';
    fixture.events = [
      death('death-1', 5_000, 't-pov', 'ct-1', 1, 3, 2, 5, true),
    ];

    const rating = buildHighlightAnalysis(fixture, [
      { demoTimeMs: 3_922, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_165, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 4_443, slot: 1, weapon: 'deagle' },
      { demoTimeMs: 5_000, slot: 1, weapon: 'deagle' },
    ]).fragRatings[0];
    const reasonCodes = rating.reasons.map((entry) => entry.code);

    expect(reasonCodes).toContain('precision_short_burst');
    expect(reasonCodes).not.toContain('precision_one_shot');
    expect(reasonCodes).not.toContain('fast_kill');
    expect(reasonCodes).not.toContain('numbers_disadvantage');
    expect(withVerifiedWallbangBonus(rating, false)).toEqual(rating);
  });

  it('only marks a frag as a trade when it kills the previous killer', () => {
    const fixture = input({
      kind: 'hltv', focusPlayerIds: [], focusTeamHistory: [], evidence: 'unknown',
    });
    const unrelatedFrag = buildHighlightAnalysis(fixture).fragRatings
      .find((rating) => rating.eventId === 'death-2');
    expect(unrelatedFrag?.reasons.some((entry) => entry.code === 'trade')).toBe(false);

    const tradedDeath = fixture.events.find((event): event is DeathEvent =>
      event.type === 'death' && event.eventId === 'death-2');
    if (!tradedDeath) throw new Error('Fixture death missing');
    tradedDeath.victimPlayerId = 'ct-1';
    tradedDeath.victimSlot = 3;
    const actualTrade = buildHighlightAnalysis(fixture).fragRatings
      .find((rating) => rating.eventId === 'death-2');
    expect(actualTrade?.reasons).toContainEqual(expect.objectContaining({
      code: 'trade', points: 8,
    }));
  });

  it('returns identical scores for identical input', () => {
    const fixture = input({
      kind: 'hltv',
      focusPlayerIds: [],
      focusTeamHistory: [],
      evidence: 'unknown',
    });
    expect(buildHighlightAnalysis(fixture)).toEqual(buildHighlightAnalysis(fixture));
  });
});
