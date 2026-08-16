import { describe, expect, it } from 'vitest';
import { isFragReelEligible, nextFragReelAction } from '../src/demo/frag-reel';

const events = [
  { eventId: 'frag-1', demoTimeMs: 10_000 },
  { eventId: 'frag-2', demoTimeMs: 18_000 },
  { eventId: 'frag-3', demoTimeMs: 40_000 },
];

describe('only frags timeline', () => {
  it('keeps three seconds of action after a frag', () => {
    expect(nextFragReelAction(events, 0, 12_999)).toEqual({ type: 'wait' });
  });

  it('continues normally when the next frag is within ten seconds', () => {
    expect(nextFragReelAction(events, 0, 13_000)).toEqual({ type: 'advance', index: 1 });
  });

  it('seeks to three seconds before a distant next frag', () => {
    expect(nextFragReelAction(events, 1, 21_000)).toEqual({
      type: 'seek', index: 2, targetMs: 37_000,
    });
  });

  it('finishes after the last frag post-roll', () => {
    expect(nextFragReelAction(events, 2, 43_000)).toEqual({ type: 'complete' });
  });

  it('rewinds for a nearby frag when HLTV must switch first-person target', () => {
    expect(nextFragReelAction([
      { eventId: 'a', demoTimeMs: 10_000, killerPlayerId: 'player-a' },
      { eventId: 'b', demoTimeMs: 12_000, killerPlayerId: 'player-b' },
    ], 0, 13_000)).toEqual({ type: 'seek', index: 1, targetMs: 9_000 });
  });

  it('keeps the 0:41 luddi frag when a full team reel switches killer', () => {
    expect(nextFragReelAction([
      { eventId: 'tobbi', demoTimeMs: 34_536, killerPlayerId: 'player-tobbi' },
      { eventId: 'luddi', demoTimeMs: 41_336, killerPlayerId: 'player-luddi' },
    ], 0, 37_536)).toEqual({ type: 'advance', index: 1 });
  });

  it('does not replay a second quick frag already shown by the same player camera', () => {
    expect(nextFragReelAction([
      { eventId: 'a', demoTimeMs: 10_000, killerPlayerId: 'player-a' },
      { eventId: 'b', demoTimeMs: 12_000, killerPlayerId: 'player-a' },
    ], 0, 13_000)).toEqual({ type: 'advance', index: 1 });
  });

  it('includes every rated HLTV frag while keeping POV reels to recorded POV', () => {
    expect(isFragReelEligible('pov', 'recorded_pov')).toBe(true);
    expect(isFragReelEligible('pov', 'hltv_replay')).toBe(false);
    expect(isFragReelEligible('hltv', 'hltv_replay')).toBe(true);
    expect(isFragReelEligible('hltv', 'hltv_director')).toBe(true);
    expect(isFragReelEligible('hltv', 'unknown')).toBe(false);
  });
});
