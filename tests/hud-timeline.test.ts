import { describe, expect, it } from 'vitest';
import { HUD_EVENT_HOLD_MS, selectHudTimelineEvent } from '../src/demo/hud-timeline';

const events = [
  { eventId: 'frag-1', demoTimeMs: 10_000 },
  { eventId: 'frag-2', demoTimeMs: 11_200 },
  { eventId: 'frag-3', demoTimeMs: 20_000 },
];

describe('HUD frag lifecycle', () => {
  it('previews an approaching frag and disappears after the result window', () => {
    expect(selectHudTimelineEvent(events, 7_000)?.eventId).toBe('frag-1');
    expect(selectHudTimelineEvent(events, 10_500)?.eventId).toBe('frag-1');
    expect(selectHudTimelineEvent(events, 20_000 + HUD_EVENT_HOLD_MS + 1)).toBeUndefined();
  });

  it('keeps a landed frag instead of revealing the next kill early', () => {
    expect(selectHudTimelineEvent(events, 10_900)?.eventId).toBe('frag-1');
  });

  it('replaces the HUD immediately when the next frag lands', () => {
    expect(selectHudTimelineEvent(events, 11_199)?.eventId).toBe('frag-1');
    expect(selectHudTimelineEvent(events, 11_200)?.eventId).toBe('frag-2');
  });

  it('moves to a later preview after the old result clears', () => {
    expect(selectHudTimelineEvent(events, 17_500)?.eventId).toBe('frag-3');
  });
});
