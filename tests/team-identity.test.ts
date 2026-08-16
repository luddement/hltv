import { describe, expect, it } from 'vitest';
import {
  buildLogicalTeamIndex,
  inferTeamName,
  logicalTeamForSideAt,
} from '../src/analysis/team-identity';
import type { HistoryEntry, PlayerIdentity } from '../src/analysis/schema';

const player = (
  playerId: string,
  name: string,
  teams: HistoryEntry<string>[],
  joinedAtMs = 0,
): PlayerIdentity => ({
  playerId,
  steamId: { value: null, evidence: 'unknown' },
  sessions: [{
    sessionId: `session-${playerId}`,
    slot: Number(playerId.replace(/\D/g, '')) || 1,
    userId: Number(playerId.replace(/\D/g, '')) || 1,
    joinedAtMs,
    leftAtMs: 200_000,
    names: [{ fromMs: joinedAtMs, toMs: 200_000, value: name, evidence: 'observed' }],
    teams,
  }],
});

const swapped = (first: 'TERRORIST' | 'CT', second: 'TERRORIST' | 'CT') => [
  { fromMs: 0, toMs: 100_000, value: first, evidence: 'observed' as const },
  { fromMs: 100_000, toMs: 200_000, value: second, evidence: 'observed' as const },
];

describe('logical team identity', () => {
  it('strips decorations and infers the shared clan prefix', () => {
    expect(inferTeamName([
      '> crapoffline cHRYSOFREJZ',
      '> crapoffline ldmnt',
      'starfighter',
    ])).toBe('crapoffline');
    expect(inferTeamName(['aoH ? Grazze', 'aoH ? Gladiator', 'aoH ? Grogge']))
      .toBe('aoH');
  });

  it('falls back when no reliable shared name exists', () => {
    expect(inferTeamName(['unnamed', 'starfighter', 'Player']))
      .toBeUndefined();
  });

  it('keeps the same team identity after T and CT swap sides', () => {
    const players = [
      player('p1', '> crapoffline cHRYSOFREJZ', swapped('TERRORIST', 'CT')),
      player('p2', '> crapoffline ldmnt', swapped('TERRORIST', 'CT')),
      player('p3', 'starfighter', swapped('TERRORIST', 'CT')),
      player('p4', 'aoH ? Grazze', swapped('CT', 'TERRORIST')),
      player('p5', 'aoH ? Gladiator', swapped('CT', 'TERRORIST')),
      player('p6', 'aoH ? Grogge', swapped('CT', 'TERRORIST')),
    ];
    const index = buildLogicalTeamIndex(players);

    expect(index.teams.map((team) => team.name)).toEqual(['crapoffline', 'aoH']);
    expect(index.teamIdByPlayerId.get('p1')).toBe('team-1');
    expect(logicalTeamForSideAt(index, players, 'TERRORIST', 50_000)).toBe('team-1');
    expect(logicalTeamForSideAt(index, players, 'CT', 150_000)).toBe('team-1');
  });

  it('assigns a late player without a useful nickname from the current roster side', () => {
    const players = [
      player('p1', '> crapoffline one', swapped('TERRORIST', 'CT')),
      player('p2', '> crapoffline two', swapped('TERRORIST', 'CT')),
      player('p3', 'aoH ? one', swapped('CT', 'TERRORIST')),
      player('p4', 'aoH ? two', swapped('CT', 'TERRORIST')),
      player('p7', 'unnamed', [{
        fromMs: 120_000,
        toMs: 200_000,
        value: 'CT',
        evidence: 'observed',
      }], 120_000),
    ];

    expect(buildLogicalTeamIndex(players).teamIdByPlayerId.get('p7')).toBe('team-1');
  });
});
