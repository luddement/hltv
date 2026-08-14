import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DemoAnalysisIndex } from '/@/analysis/schema';
import { inspectDemoFile } from '/@/demo/goldsrc-demo';

const workerDocument = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.assign(globalThis, { window: globalThis, document: workerDocument });

const workspaceRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

const localDemos = [
  {
    file: 'r60_sthlm.dem',
    protocol: 46,
    expected: {
      deathEvents: 243,
      roundCount: 37,
      playerSessions: 12,
      headshots: 66,
      suicides: 5,
      teamKills: 17,
      worldKills: 1,
    },
    perspective: { kind: 'pov', focusPlayerIds: 1, focusTeams: ['CT', 'TERRORIST'] },
    reconstruction: {
      teammateFrags: 114,
      entityAtFrag: 77,
      positionAtFrag: 77,
      anglesAtFrag: 77,
      numericPositionsAtFrag: 77,
      numericAnglesAtFrag: 77,
    },
  },
  {
    file: 'cstrike/as.dem',
    protocol: 47,
    expected: {
      deathEvents: 45,
      roundCount: 0,
      playerSessions: 10,
      headshots: 12,
      suicides: 0,
      teamKills: 0,
      worldKills: 0,
    },
    perspective: { kind: 'pov', focusPlayerIds: 1, focusTeams: ['CT'] },
    reconstruction: {
      teammateFrags: 12,
      entityAtFrag: 5,
      positionAtFrag: 5,
      anglesAtFrag: 5,
      numericPositionsAtFrag: 5,
      numericAnglesAtFrag: 5,
    },
  },
] as const;

const analyzeLocalDemo = async (relativePath: string): Promise<DemoAnalysisIndex> => {
  const path = resolve(workspaceRoot, relativePath);
  const bytes = await readFile(path);
  const file = new File([bytes], basename(path));
  const demo = await inspectDemoFile(file);
  const buffer = await file.arrayBuffer();
  const { analyzeDemo } = await import('/@/analysis/demo-analyzer');
  return analyzeDemo(buffer, demo, {
    demoHash: `local-fixture-${relativePath}`,
    cacheId: `local-fixture-${relativePath}`,
  });
};

describe('local binary demo goldens', () => {
  for (const fixture of localDemos) {
    const fixtureExists = existsSync(resolve(workspaceRoot, fixture.file));
    it.runIf(fixtureExists)(`decodes ${fixture.file} as protocol ${fixture.protocol}`, async () => {
      const index = await analyzeLocalDemo(fixture.file);
      const deaths = index.events.filter((event) => event.type === 'death');
      expect(index.demo.networkProtocol).toBe(fixture.protocol);
      expect(index.schemaVersion).toBe(2);
      expect({
        kind: index.demo.perspective.kind,
        focusPlayerIds: index.demo.perspective.focusPlayerIds.length,
        focusTeams: Array.from(new Set(
          index.demo.perspective.focusTeamHistory.map((entry) => entry.value),
        )),
      }).toEqual(fixture.perspective);
      expect({
        deathEvents: index.diagnostics.deathEvents,
        roundCount: index.diagnostics.roundCount,
        playerSessions: index.diagnostics.playerSessions,
        headshots: deaths.filter((death) => death.headshot).length,
        suicides: deaths.filter((death) => death.suicide).length,
        teamKills: deaths.filter((death) => death.teamKill.value).length,
        worldKills: deaths.filter((death) => death.worldKill).length,
      }).toEqual(fixture.expected);
      if (index.demo.perspective.kind === 'pov') {
        const focusTeams = new Set(index.demo.perspective.focusTeamHistory.map((entry) => entry.value));
        expect(index.fragRatings.every((rating) => focusTeams.has(rating.team))).toBe(true);
        expect(index.fragRatings.every((rating) => rating.visibility !== 'hltv_replay')).toBe(true);
        expect(index.fragRatings.length).toBeLessThan(index.diagnostics.deathEvents);
        const teammateFrags = index.fragRatings.filter((rating) =>
          rating.visibility === 'killfeed_only');
        expect({
          teammateFrags: teammateFrags.length,
          entityAtFrag: teammateFrags.filter((rating) => rating.reconstruction.entity).length,
          positionAtFrag: teammateFrags.filter((rating) => rating.reconstruction.position).length,
          anglesAtFrag: teammateFrags.filter((rating) => rating.reconstruction.angles).length,
          numericPositionsAtFrag: teammateFrags.filter((rating) =>
            rating.reconstruction.positionValue?.every(Number.isFinite)).length,
          numericAnglesAtFrag: teammateFrags.filter((rating) =>
            rating.reconstruction.angleValue?.every(Number.isFinite)).length,
        }).toEqual(fixture.reconstruction);
      } else {
        expect(new Set(index.fragRatings.map((rating) => rating.team))).toEqual(
          new Set(['TERRORIST', 'CT']),
        );
      }
    }, 30_000);
  }

  const beamHoseDemo = 'caterchryinfe_3on3-0407281433-de_dust2.dem';
  it.runIf(existsSync(resolve(workspaceRoot, beamHoseDemo)))(
    'keeps protocol-46 HLTV spectator packets byte-aligned',
    async () => {
      const index = await analyzeLocalDemo(beamHoseDemo);
      expect(index.diagnostics.status).toBe('complete');
      expect(index.demo.perspective.kind).toBe('hltv');
      expect({
        deathEvents: index.diagnostics.deathEvents,
        roundCount: index.diagnostics.roundCount,
        playerSessions: index.diagnostics.playerSessions,
        unknownPlayerReferences: index.diagnostics.unknownPlayerReferences,
        fragRatings: index.fragRatings.length,
      }).toEqual({
        deathEvents: 104,
        roundCount: 30,
        playerSessions: 7,
        unknownPlayerReferences: 0,
        fragRatings: 96,
      });
      const names = new Set(index.players.flatMap((player) =>
        player.sessions.flatMap((session) => session.names.map((name) => name.value))));
      expect([...names]).toEqual(expect.arrayContaining([
        '> crapoffline ldmnt',
        'aoH ? Grazze',
        'aoH ? Gladiator',
        'starfighter',
        'aoH ? Grogge',
      ]));
      const deaths = index.events.filter((event) => event.type === 'death');
      expect({
        headshots: deaths.filter((death) => death.headshot).length,
        suicides: deaths.filter((death) => death.suicide).length,
        teamKills: deaths.filter((death) => death.teamKill.value).length,
        worldKills: deaths.filter((death) => death.worldKill).length,
      }).toEqual({ headshots: 31, suicides: 5, teamKills: 3, worldKills: 0 });
      expect(deaths.every((death) =>
        death.victimPlayerId !== null
        && (death.worldKill || death.killerPlayerId !== null))).toBe(true);
    },
    30_000,
  );
});
