export interface FragReelEvent {
  eventId: string;
  demoTimeMs: number;
  killerPlayerId?: string | null;
}

export type FragReelPerspective = 'pov' | 'hltv';
export type FragReelVisibility =
  | 'recorded_pov'
  | 'hltv_replay'
  | 'hltv_director'
  | 'killfeed_only'
  | 'unknown';

export const isFragReelEligible = (
  perspective: FragReelPerspective,
  visibility: FragReelVisibility | undefined,
): boolean => perspective === 'pov'
  ? visibility === 'recorded_pov'
  : visibility === 'hltv_replay';

export const FRAG_REEL_PREROLL_MS = 3_000;
export const FRAG_REEL_POSTROLL_MS = 3_000;
export const FRAG_REEL_CONTINUOUS_GAP_MS = 10_000;

export type FragReelAction =
  | { type: 'wait' }
  | { type: 'advance'; index: number }
  | { type: 'seek'; index: number; targetMs: number }
  | { type: 'complete' };

export const nextFragReelAction = (
  events: readonly FragReelEvent[],
  index: number,
  demoTimeMs: number,
): FragReelAction => {
  const current = events[index];
  if (!current || demoTimeMs < current.demoTimeMs + FRAG_REEL_POSTROLL_MS) {
    return { type: 'wait' };
  }

  const nextIndex = index + 1;
  const next = events[nextIndex];
  if (!next) return { type: 'complete' };

  const sameFirstPersonTarget = current.killerPlayerId === undefined
    || next.killerPlayerId === undefined
    || current.killerPlayerId === next.killerPlayerId;
  if (sameFirstPersonTarget
    && next.demoTimeMs - current.demoTimeMs <= FRAG_REEL_CONTINUOUS_GAP_MS) {
    return { type: 'advance', index: nextIndex };
  }

  return {
    type: 'seek',
    index: nextIndex,
    targetMs: Math.max(0, next.demoTimeMs - FRAG_REEL_PREROLL_MS),
  };
};
