import { describe, expect, it } from 'vitest';
import {
  MOVIE_QUALITIES,
  MOVIE_SCOREBOARD_DURATION_MS,
  buildFragMovieTimeline,
  estimatedMovieBytes,
  inferDemoMatchDate,
  movieBackpressureAction,
  movieCompletionAction,
  movieSideCount,
  movieSideEndsAtIndex,
  safeMovieFilename,
} from '../src/movie/movie-project';

describe('frag movie project', () => {
  it('uses six-second clips and merges only continuous reel playback', () => {
    expect(buildFragMovieTimeline([
      { eventId: 'a', demoTimeMs: 10_000, killerPlayerId: 'one' },
      { eventId: 'b', demoTimeMs: 18_000, killerPlayerId: 'one' },
      { eventId: 'c', demoTimeMs: 22_000, killerPlayerId: 'one' },
      { eventId: 'd', demoTimeMs: 40_000, killerPlayerId: 'two' },
    ])).toEqual({
      clips: [
        { startTimeMs: 7_000, endTimeMs: 21_000, eventIds: ['a', 'b'] },
        { startTimeMs: 19_000, endTimeMs: 25_000, eventIds: ['c'] },
        { startTimeMs: 37_000, endTimeMs: 43_000, eventIds: ['d'] },
      ],
      durationMs: 26_000,
    });
  });

  it('estimates encoded bytes from the selected quality bitrate', () => {
    expect(estimatedMovieBytes(60_000, MOVIE_QUALITIES[0])).toBe(61_440_000);
  });

  it('creates a portable filename', () => {
    expect(safeMovieFilename('match.dem', '> crapoffline ?', 'mp4'))
      .toBe('match-crapoffline-only-frags.mp4');
  });

  it('infers the historical match date from common demo filename timestamps', () => {
    expect(inferDemoMatchDate('caterchryinfe_3on3-0407281433-de_dust2.dem'))
      .toBe('2004-07-28');
    expect(inferDemoMatchDate('archive-2005-01-09_2210.dem')).toBe('2005-01-09');
    expect(inferDemoMatchDate('match-without-date.dem')).toBeUndefined();
    expect(inferDemoMatchDate('match-0413321200.dem')).toBeUndefined();
  });

  it('waits while the final MP4 chunks are being committed', () => {
    expect(movieCompletionAction('recording')).toBe('finish');
    expect(movieCompletionAction('finalizing')).toBe('wait');
    expect(movieCompletionAction('starting')).toBe('fail');
    expect(movieCompletionAction('complete')).toBe('close');
  });

  it('pauses playback before the encoder queue can grow without limit', () => {
    expect(movieBackpressureAction(29, 60, false)).toBe('continue');
    expect(movieBackpressureAction(30, 60, false)).toBe('pause');
    expect(movieBackpressureAction(7, 60, true)).toBe('wait');
    expect(movieBackpressureAction(6, 60, true)).toBe('resume');
  });

  it('marks only the final frag of each T/CT phase for a scorecard', () => {
    const events = [
      { demoTimeMs: 10_000, side: 'TERRORIST' as const },
      { demoTimeMs: 20_000, side: 'TERRORIST' as const },
      { demoTimeMs: 40_000, side: 'CT' as const },
      { demoTimeMs: 50_000, side: 'CT' as const },
    ];
    expect(movieSideEndsAtIndex(events, 0)).toBe(false);
    expect(movieSideEndsAtIndex(events, 1)).toBe(true);
    expect(movieSideEndsAtIndex(events, 2)).toBe(false);
    expect(movieSideEndsAtIndex(events, 3)).toBe(true);
    expect(movieSideCount(events)).toBe(2);
    expect(MOVIE_SCOREBOARD_DURATION_MS).toBe(3_000);
  });

  it('offers a high-bitrate max-HQ profile with display-safe frame pacing', () => {
    expect(MOVIE_QUALITIES.find((quality) => quality.id === 'max-hq'))
      .toMatchObject({ width: 2560, height: 1440, fps: 60, videoBitsPerSecond: 36_000_000 });
  });
});
