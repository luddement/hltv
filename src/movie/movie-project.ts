import {
  FRAG_REEL_CONTINUOUS_GAP_MS,
  FRAG_REEL_PREROLL_MS,
  fragReelEndTimeMs,
  type FragReelEvent,
} from '/@/demo/frag-reel';

export type MovieQualityId = '720p' | '720p-120' | '1080p' | '1080p-120' | '1440p' | '2160p' | 'max-hq';
export type MovieExportState = 'idle' | 'starting' | 'recording' | 'finalizing' | 'complete' | 'error';
export type MovieCompletionAction = 'close' | 'fail' | 'finish' | 'wait';
export type MovieBackpressureAction = 'continue' | 'pause' | 'wait' | 'resume';

export const MOVIE_INTRO_DURATION_MS = 3_000;
export const MOVIE_SCOREBOARD_DURATION_MS = 3_000;

export type MovieScoreboardEvent = {
  demoTimeMs: number;
  side: 'TERRORIST' | 'CT';
};

/** Marks the final included frag before the followed team changes side. */
export const movieSideEndsAtIndex = (
  events: readonly MovieScoreboardEvent[],
  index: number,
): boolean => {
  const event = events[index];
  return Boolean(event && (index === events.length - 1 || events[index + 1]?.side !== event.side));
};

export const movieSideCount = (events: readonly MovieScoreboardEvent[]): number =>
  events.reduce((count, event, index) =>
    count + (index === 0 || events[index - 1]?.side !== event.side ? 1 : 0), 0);

const validCalendarDate = (year: number, month: number, day: number): boolean => {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

/** Infers the match date from common demo filename stamps such as 0407281433. */
export const inferDemoMatchDate = (demoName: string): string | undefined => {
  const base = demoName.replace(/\.dem$/i, '');
  const fourDigitYear = base.match(
    /(?:^|\D)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])(?:[-_.]?[0-2]\d[0-5]\d)?(?:\D|$)/,
  );
  const shortYear = base.match(
    /(?:^|\D)(\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?:[0-2]\d[0-5]\d)?(?:\D|$)/,
  );
  const match = fourDigitYear ?? shortYear;
  if (!match) return undefined;
  const rawYear = Number(match[1]);
  const year = match === shortYear
    ? rawYear > new Date().getUTCFullYear() % 100 ? 1900 + rawYear : 2000 + rawYear
    : rawYear;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validCalendarDate(year, month, day)) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Decides what the reel may do when its final post-roll has elapsed. */
export const movieCompletionAction = (
  state: MovieExportState,
): MovieCompletionAction => {
  if (state === 'recording') return 'finish';
  if (state === 'finalizing') return 'wait';
  if (state === 'starting') return 'fail';
  return 'close';
};

/** Keeps the encoder queue bounded while preserving every requested frame. */
export const movieBackpressureAction = (
  backlogFrames: number,
  fps: number,
  paused: boolean,
): MovieBackpressureAction => {
  const highWaterMark = Math.max(12, Math.round(fps / 2));
  const lowWaterMark = Math.max(2, Math.round(fps / 10));
  if (paused) return backlogFrames <= lowWaterMark ? 'resume' : 'wait';
  return backlogFrames >= highWaterMark ? 'pause' : 'continue';
};

export type MovieQuality = {
  id: MovieQualityId;
  label: string;
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
};

export const MOVIE_QUALITIES: readonly MovieQuality[] = [
  {
    id: '720p', label: '720p · 60 FPS · FPS priority', width: 1280, height: 720, fps: 60,
    videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: '720p-120', label: '720p · 120 FPS · motion priority', width: 1280, height: 720, fps: 120,
    videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: '1080p', label: '1080p · 60 FPS target · balanced', width: 1920, height: 1080, fps: 60,
    videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: '1080p-120', label: '1080p · 120 FPS · demanding', width: 1920, height: 1080, fps: 120,
    videoBitsPerSecond: 28_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: '1440p', label: '1440p · 60 FPS target · demanding', width: 2560, height: 1440, fps: 60,
    videoBitsPerSecond: 18_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: '2160p', label: '4K · 60 FPS · maximum quality', width: 3840, height: 2160, fps: 60,
    videoBitsPerSecond: 50_000_000, audioBitsPerSecond: 192_000,
  },
  {
    id: 'max-hq', label: 'MAX HQ · 1440p · 60 FPS · smooth', width: 2560, height: 1440, fps: 60,
    videoBitsPerSecond: 36_000_000, audioBitsPerSecond: 192_000,
  },
] as const;

export type MovieClip = {
  startTimeMs: number;
  endTimeMs: number;
  eventIds: string[];
};

export type FragMovieTimeline = {
  clips: MovieClip[];
  durationMs: number;
};

/** Builds the same visible timeline as Only Frags, excluding hidden seek time. */
export const buildFragMovieTimeline = (
  sourceEvents: readonly FragReelEvent[],
): FragMovieTimeline => {
  const events = [...sourceEvents].sort((left, right) => left.demoTimeMs - right.demoTimeMs);
  const clips: MovieClip[] = [];

  for (const [index, event] of events.entries()) {
    const startTimeMs = Math.max(0, event.demoTimeMs - FRAG_REEL_PREROLL_MS);
    const endTimeMs = fragReelEndTimeMs(event);
    const previousEvent = events[index - 1];
    const activeClip = clips.at(-1);
    const gapFromPreviousMs = previousEvent
      ? event.demoTimeMs - previousEvent.demoTimeMs
      : Number.POSITIVE_INFINITY;
    const sameFirstPersonTarget = previousEvent
      && previousEvent.killerPlayerId != null
      && previousEvent.killerPlayerId === event.killerPlayerId;
    const previousEndTimeMs = previousEvent
      ? fragReelEndTimeMs(previousEvent)
      : Number.NEGATIVE_INFINITY;
    const alreadyShownByPreviousCamera = sameFirstPersonTarget
      && event.demoTimeMs <= previousEndTimeMs;
    const nextFragIsStillAheadWhenPostrollEnds = event.demoTimeMs > previousEndTimeMs;
    const continuous = previousEvent
      && activeClip
      && gapFromPreviousMs <= FRAG_REEL_CONTINUOUS_GAP_MS
      && (alreadyShownByPreviousCamera || nextFragIsStillAheadWhenPostrollEnds);

    if (continuous) {
      activeClip.endTimeMs = endTimeMs;
      activeClip.eventIds.push(event.eventId);
    } else {
      clips.push({ startTimeMs, endTimeMs, eventIds: [event.eventId] });
    }
  }

  return {
    clips,
    durationMs: clips.reduce((total, clip) => total + clip.endTimeMs - clip.startTimeMs, 0),
  };
};

export const estimatedMovieBytes = (
  durationMs: number,
  quality: MovieQuality,
): number => Math.ceil(
  durationMs / 1_000
  * (quality.videoBitsPerSecond + quality.audioBitsPerSecond)
  / 8,
);

export const safeMovieFilename = (
  demoName: string,
  teamName: string,
  extension: string,
): string => {
  const base = demoName.replace(/\.dem$/i, '');
  const clean = `${base}-${teamName}-only-frags`
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return `${clean || 'only-frags'}.${extension}`;
};
