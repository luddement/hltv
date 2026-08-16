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
  : visibility === 'hltv_replay' || visibility === 'hltv_director';

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

  const sameFirstPersonTarget = current.killerPlayerId != null
    && current.killerPlayerId === next.killerPlayerId;
  const wasAlreadyShownByCurrentCamera = sameFirstPersonTarget
    && next.demoTimeMs <= demoTimeMs;
  if (wasAlreadyShownByCurrentCamera
    && next.demoTimeMs - current.demoTimeMs <= FRAG_REEL_CONTINUOUS_GAP_MS) {
    return { type: 'advance', index: nextIndex };
  }

  const nextFragIsStillAhead = next.demoTimeMs > demoTimeMs;
  if (nextFragIsStillAhead
    && next.demoTimeMs - current.demoTimeMs <= FRAG_REEL_CONTINUOUS_GAP_MS) {
    return { type: 'advance', index: nextIndex };
  }

  return {
    type: 'seek',
    index: nextIndex,
    targetMs: Math.max(0, next.demoTimeMs - FRAG_REEL_PREROLL_MS),
  };
};
