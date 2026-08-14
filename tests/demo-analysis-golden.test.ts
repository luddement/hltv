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
