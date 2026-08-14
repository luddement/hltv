export interface HudTimelineEvent {
  eventId: string;
  demoTimeMs: number;
}

export const HUD_EVENT_LEAD_MS = 3_000;
export const HUD_EVENT_HOLD_MS = 2_400;
export const HUD_EVENT_FADE_MS = 350;

/** Selects one short-lived frag card for the current demo time. */
export const selectHudTimelineEvent = <Event extends HudTimelineEvent>(
  events: readonly Event[],
  demoTimeMs: number,
  leadMs = HUD_EVENT_LEAD_MS,
  holdMs = HUD_EVENT_HOLD_MS,
): Event | undefined => {
  let latestLanded: Event | undefined;
  let nextUpcoming: Event | undefined;

  for (const event of events) {
    const offsetMs = demoTimeMs - event.demoTimeMs;
    if (offsetMs >= 0 && offsetMs <= holdMs) {
      if (!latestLanded || event.demoTimeMs > latestLanded.demoTimeMs) latestLanded = event;
      continue;
    }
    if (offsetMs < 0 && -offsetMs <= leadMs) {
      if (!nextUpcoming || event.demoTimeMs < nextUpcoming.demoTimeMs) nextUpcoming = event;
    }
  }

  return latestLanded ?? nextUpcoming;
};
