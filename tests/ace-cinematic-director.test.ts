import { describe, expect, it } from 'vitest';
import type { DeathEvent, HighlightMoment } from '../src/analysis/schema';
import {
  buildAceCinematicPlan,
  cinematicCameraFrameAt,
} from '../src/movie/ace-cinematic-director';

const death = (
  id: string,
  demoTimeMs: number,
  victimPosition: [number, number, number],
): DeathEvent => ({
  type: 'death', eventId: id, demoTimeMs, packetOrdinal: 1, directoryEntry: 0,
  byteOffset: 1, roundId: 'round-9', evidence: 'observed',
  source: { rawMessage: '', messageOrdinal: 1 },
  killerPlayerId: 'seck', victimPlayerId: `victim-${id}`, killerSlot: 5,
  victimSlot: 6, weapon: 'm4a1', headshot: true,
  teamKill: { value: false, evidence: 'observed' }, worldKill: false, suicide: false,
  aliveBefore: {
    terrorists: { value: 5, evidence: 'derived' },
    counterTerrorists: { value: 5, evidence: 'derived' },
  },
  entityObservation: {
    killer: {
      entity: true, position: true, angles: true,
      positionValue: [-300, -390, 36], angleValue: [0, 20, 0], evidence: 'derived',
    },
    victim: {
      entity: true, position: true, angles: true,
      positionValue: victimPosition, angleValue: [0, 180, 0], evidence: 'derived',
    },
  },
});

const deaths = [
  death('a', 767_493, [76, -324, -18]),
  death('b', 768_661, [495, -175, 36]),
  death('c', 770_967, [-177, -327, 36]),
  death('d', 771_585, [120, -154, 36]),
  death('e', 771_683, [355, -46, 36]),
];
const moment: HighlightMoment = {
  momentId: 'moment-38', startTimeMs: 764_493, endTimeMs: 775_683,
  eventIds: deaths.map((entry) => entry.eventId), killerPlayerId: 'seck', team: 'CT',
  rating: { score: 100, confidence: 1, reasons: [] },
};

describe('ace cinematic director', () => {
  it('turns a verified five-kill moment into a feature-length in-player sequence', () => {
    const plan = buildAceCinematicPlan(moment, deaths);
    expect(plan?.passes).toHaveLength(11);
    expect(plan?.passes.map((pass) => pass.mode)).toEqual([
      'pov', 'chase', 'overview', 'camera', 'camera', 'camera',
      'camera', 'camera', 'camera', 'camera', 'pov',
    ]);
    expect(plan?.visibleDurationMs).toBeGreaterThanOrEqual(80_000);
    expect(plan?.visibleDurationMs).toBeLessThanOrEqual(120_000);
  });

  it('produces finite, moving cameras that keep looking at the fight', () => {
    const pass = buildAceCinematicPlan(moment, deaths)?.passes.find((entry) =>
      entry.id === 'crossfire-dolly');
    expect(pass).toBeDefined();
    const start = cinematicCameraFrameAt(pass!, pass!.startTimeMs);
    const middle = cinematicCameraFrameAt(
      pass!,
      (pass!.startTimeMs + pass!.endTimeMs) / 2,
    );
    expect(start?.origin).not.toEqual(middle?.origin);
    expect([...middle!.origin, ...middle!.angles].every(Number.isFinite)).toBe(true);
  });

  it('keeps the dedicated god-eye camera vertically above the tracked fight', () => {
    const pass = buildAceCinematicPlan(moment, deaths)?.passes.find((entry) =>
      entry.id === 'gods-eye');
    const frame = cinematicCameraFrameAt(
      pass!,
      (pass!.startTimeMs + pass!.endTimeMs) / 2,
    );
    expect(frame?.angles[0]).toBeCloseTo(90, 5);
    expect(frame?.angles[1]).toBeCloseTo(0, 5);
  });

  it('rejects an incomplete fake ace', () => {
    expect(buildAceCinematicPlan(moment, deaths.slice(0, 4))).toBeUndefined();
  });
});
