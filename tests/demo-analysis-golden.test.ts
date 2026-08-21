import { describe, expect, it } from 'vitest';
import protocol46 from './fixtures/protocol-46.golden.json';
import protocol47 from './fixtures/protocol-47.golden.json';
import protocol48 from './fixtures/protocol-48.golden.json';
import type { ParsedAnalysis, PreparedAnalysis } from '/@/analysis/demo-analyzer';
import { isDeathEvent } from '/@/analysis/schema';
import type { DemoCompatibilityProfile, GoldSrcDemo } from '/@/demo/goldsrc-demo';

const workerDocument = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.assign(globalThis, { window: globalThis, document: workerDocument });

type GoldenFixture = typeof protocol46;

const fixtures: GoldenFixture[] = [protocol46, protocol47, protocol48];

const parsedAnalysis = (fixture: GoldenFixture): ParsedAnalysis => ({
  header: {
    demoProtocol: 5,
    netProtocol: fixture.protocol,
    mapName: 'test_map',
    modName: 'cstrike',
    mapCrc: 0x12345678,
    dirOffset: 544,
  },
  directories: [{
    id: 0,
    name: 'Playback',
    flags: 0,
    cdTrack: -1,
    time: fixture.durationMs / 1_000,
    frames: fixture.frames.length,
    offset: 544,
    length: 1_024,
  }],
  frames: fixture.frames.map((frame, frameIndex) => ({
    time: frame.time,
    tick: frameIndex,
    packetOrdinal: frameIndex,
    directoryEntry: 0,
    byteOffset: 544 + frameIndex * 100,
    messages: frame.messages.map((message) => ({
      type: message.type,
      data: {
        ...message.data,
        ...('payload' in message.data
          ? { payload: new Uint8Array(message.data.payload) }
          : {}),
      },
    })),
  })),
  customMessages: [{ index: 64, size: -1, name: 'fixture-message' }],
});

const demoMetadata = (fixture: GoldenFixture): GoldSrcDemo => ({
  name: `protocol-${fixture.protocol}.dem`,
  size: 2_048,
  magic: 'HLDEMO',
  demoProtocol: 5,
  networkProtocol: fixture.protocol,
  mapName: 'test_map',
  gameDirectory: 'cstrike',
  mapChecksum: 0x12345678,
  directoryOffset: 544,
  duration: fixture.durationMs / 1_000,
  frameCount: fixture.frames.length,
  isHltv: true,
  compatibilityProfile: `cs-goldsrc-${fixture.protocol}` as DemoCompatibilityProfile,
  directory: [{
    type: 0,
    description: 'Playback',
    flags: 0,
    cdTrack: -1,
    playbackTime: fixture.durationMs / 1_000,
    frameCount: fixture.frames.length,
    offset: 544,
    fileLength: 1_024,
  }],
});

const fixtureIdentity: PreparedAnalysis = {
  demoHash: 'fixture-sha256',
  cacheId: 'fixture-cache-id',
};

describe.each(fixtures)('protocol $protocol golden analysis', (fixture) => {
  it('normalizes player sessions and death semantics deterministically', async () => {
    const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
    const index = normalizeParsedAnalysis(
      parsedAnalysis(fixture),
      demoMetadata(fixture),
      fixtureIdentity,
    );

    expect({
      deathEvents: index.diagnostics.deathEvents,
      roundCount: index.diagnostics.roundCount,
      playerSessions: index.diagnostics.playerSessions,
      unknownPlayerReferences: index.diagnostics.unknownPlayerReferences,
    }).toEqual(fixture.expected.diagnostics);

    expect(index.players.map((player) => {
      const session = player.sessions[0];
      return {
        playerId: player.playerId,
        userId: session.userId,
        joinedAtMs: session.joinedAtMs,
        leftAtMs: session.leftAtMs,
        names: session.names.map((entry) => entry.value),
        teams: session.teams.map((entry) => entry.value),
      };
    })).toEqual(fixture.expected.players);

    expect(index.events.filter(isDeathEvent).map((death) => ({
      demoTimeMs: death.demoTimeMs,
      killerPlayerId: death.killerPlayerId,
      victimPlayerId: death.victimPlayerId,
      weapon: death.weapon,
      headshot: death.headshot,
      teamKill: death.teamKill,
      worldKill: death.worldKill,
      suicide: death.suicide,
    }))).toEqual(fixture.expected.deaths);

    expect(index.demo.networkProtocol).toBe(fixture.protocol);
  });

  if (fixture.protocol === 48) {
    it('closes the old name interval when a player is renamed', async () => {
      const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
      const index = normalizeParsedAnalysis(
        parsedAnalysis(fixture),
        demoMetadata(fixture),
        fixtureIdentity,
      );
      expect(index.players[0].sessions[0].names).toEqual([
        { fromMs: 1_000, toMs: 2_000, value: 'Before', evidence: 'observed' },
        { fromMs: 2_000, toMs: 10_000, value: 'After', evidence: 'observed' },
      ]);
    });
  }

  if (fixture.protocol === 46) {
    it('rejects malformed DeathMsg lookalikes with impossible player slots', async () => {
      const parsed = parsedAnalysis(fixture);
      parsed.frames[0].messages.push({
        type: 64,
        data: {
          name: 'DeathMsg',
          payload: new Uint8Array([56, 64, 1, 69, 0]),
        },
      });
      parsed.frames[0].messages.push({
        type: 64,
        data: {
          name: 'DeathMsg',
          payload: new Uint8Array([1, 2, 0, 100, 16, 0]),
        },
      });
      const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
      const index = normalizeParsedAnalysis(parsed, demoMetadata(fixture), fixtureIdentity);

      expect(index.diagnostics.deathEvents).toBe(fixture.expected.diagnostics.deathEvents);
      expect(index.events.filter(isDeathEvent).some((death) =>
        death.killerSlot === 56 || death.victimSlot === 64)).toBe(false);
    });

    it('does not let malformed userinfo evict a verified slot identity', async () => {
      const parsed = parsedAnalysis(fixture);
      parsed.frames[0].messages.push({
        type: 13,
        data: {
          clientIndex: 0,
          clientUserId: 0x7fffffff,
          clientUserInfo: 'binary parser garbage',
        },
      });
      const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
      const index = normalizeParsedAnalysis(parsed, demoMetadata(fixture), fixtureIdentity);

      expect(index.players).toHaveLength(fixture.expected.players.length);
      expect(index.players[0].sessions[0].names[0].value).toBe('Alpha');
      expect(index.events.filter(isDeathEvent)[0].killerPlayerId).toBe('player-1');
    });
  }
});

describe('legacy round timers', () => {
  const messageFrame = (
    time: number,
    name: string,
    payload: number[],
    packetOrdinal: number,
  ): ParsedAnalysis['frames'][number] => ({
    time,
    tick: packetOrdinal,
    packetOrdinal,
    directoryEntry: 0,
    byteOffset: 544 + packetOrdinal * 100,
    messages: [{ type: 64, data: { name, payload: new Uint8Array(payload) } }],
  });
  const tokenPayload = (token: string): number[] => [
    1,
    ...new TextEncoder().encode(token),
    0,
  ];
  const teamScorePayload = (team: 'TERRORIST' | 'CT', score: number): number[] => [
    ...new TextEncoder().encode(team),
    0,
    score & 0xff,
    score >>> 8,
  ];

  it('accepts a reset 105-second timer after match restart and drops interrupted starts', async () => {
    const parsed = parsedAnalysis(protocol47);
    parsed.frames = [
      messageFrame(0, 'RoundTime', [90, 0], 0),
      messageFrame(10, 'TextMsg', tokenPayload('#Game_will_restart_in'), 1),
      messageFrame(20, 'RoundTime', [105, 0], 2),
      messageFrame(30, 'TextMsg', tokenPayload('#Game_will_restart_in'), 3),
      messageFrame(40, 'RoundTime', [8, 0], 4),
      messageFrame(50, 'RoundTime', [105, 0], 5),
      messageFrame(60, 'SendAudio', tokenPayload('%!MRAD_ctwin'), 6),
      messageFrame(70, 'RoundTime', [8, 0], 7),
      messageFrame(80, 'RoundTime', [105, 0], 8),
      messageFrame(90, 'SendAudio', tokenPayload('%!MRAD_terwin'), 9),
    ];
    const demo = demoMetadata(protocol47);
    demo.duration = 100;
    const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
    const index = normalizeParsedAnalysis(parsed, demo, fixtureIdentity);

    expect(index.rounds.map((round) => ({
      startTimeMs: round.startTimeMs,
      winner: round.winner.value,
    }))).toEqual([
      { startTimeMs: 50_000, winner: 'CT' },
      { startTimeMs: 80_000, winner: 'TERRORIST' },
    ]);
    expect(index.events.filter((event) => event.type === 'match_restart')
      .map((event) => event.demoTimeMs)).toEqual([10_000, 30_000]);
  });

  it('recovers full 105-second rounds when an HLTV recording starts mid-match', async () => {
    const parsed = parsedAnalysis(protocol47);
    parsed.frames = [
      messageFrame(0, 'RoundTime', [74, 0], 0),
      messageFrame(7, 'SendAudio', tokenPayload('%!MRAD_terwin'), 1),
      messageFrame(12, 'RoundTime', [8, 0], 2),
      messageFrame(20, 'RoundTime', [105, 0], 3),
      messageFrame(55, 'SendAudio', tokenPayload('%!MRAD_terwin'), 4),
      messageFrame(60, 'RoundTime', [8, 0], 5),
      messageFrame(68, 'RoundTime', [105, 0], 6),
      messageFrame(120, 'SendAudio', tokenPayload('%!MRAD_ctwin'), 7),
    ];
    const demo = demoMetadata(protocol47);
    demo.duration = 130;
    const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
    const index = normalizeParsedAnalysis(parsed, demo, fixtureIdentity);

    expect(index.rounds.map((round) => ({
      startTimeMs: round.startTimeMs,
      winner: round.winner.value,
    }))).toEqual([
      { startTimeMs: 20_000, winner: 'TERRORIST' },
      { startTimeMs: 68_000, winner: 'CT' },
    ]);
  });

  it('closes an old round from a TeamScore increment when SendAudio is missing', async () => {
    const parsed = parsedAnalysis(protocol47);
    parsed.frames = [
      messageFrame(0, 'TeamScore', teamScorePayload('CT', 0), 0),
      messageFrame(0, 'TeamScore', teamScorePayload('TERRORIST', 0), 1),
      messageFrame(10, 'RoundTime', [120, 0], 2),
      messageFrame(50, 'TeamScore', teamScorePayload('CT', 1), 3),
      messageFrame(50, 'TeamScore', teamScorePayload('TERRORIST', 0), 4),
    ];
    const demo = demoMetadata(protocol47);
    demo.duration = 60;
    const { normalizeParsedAnalysis } = await import('/@/analysis/demo-analyzer');
    const index = normalizeParsedAnalysis(parsed, demo, fixtureIdentity);

    expect(index.rounds.map((round) => ({
      startTimeMs: round.startTimeMs,
      endTimeMs: round.endTimeMs,
      winner: round.winner.value,
    }))).toEqual([{
      startTimeMs: 10_000,
      endTimeMs: 50_000,
      winner: 'CT',
    }]);
    expect(index.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'team_score', team: 'CT', score: 1 }),
      expect.objectContaining({ type: 'round_end', evidence: 'observed' }),
    ]));
  });
});
