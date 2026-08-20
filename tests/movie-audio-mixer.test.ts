import { describe, expect, it } from 'vitest';
import {
  mixMovieAudioBlock,
  movieMusicTrackDuration,
  type MovieMusicTrack,
} from '../src/movie/movie-audio-mixer';

const track = (overrides: Partial<MovieMusicTrack> = {}): MovieMusicTrack => ({
  id: 'music-1',
  name: 'Bring Me to Life.mp3',
  sampleRate: 4,
  channels: [new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25])],
  startAtSeconds: 0,
  trimStartSeconds: 0,
  volume: 1,
  ...overrides,
});

describe('movie audio mixer', () => {
  it('mixes music against movie time while retaining quieter game audio', () => {
    const mixed = mixMovieAudioBlock({
      sampleRate: 4,
      channels: [new Float32Array([0.2, 0.2, 0.2, 0.2])],
    }, 4, {
      tracks: [track()],
      gameVolume: 0.5,
      musicVolume: 0.5,
      crossfadeSeconds: 0,
    });
    expect([...mixed.channels[0]!]).toEqual([
      expect.closeTo(0.6),
      expect.closeTo(0.475),
      expect.closeTo(0.35),
      expect.closeTo(0.225),
    ]);
  });

  it('supports a movie start time and an offset into the song', () => {
    const mixed = mixMovieAudioBlock({
      sampleRate: 4,
      channels: [new Float32Array(4)],
    }, 4, {
      tracks: [track({ startAtSeconds: 1.5, trimStartSeconds: 0.5 })],
      gameVolume: 1,
      musicVolume: 1,
      crossfadeSeconds: 0,
    });
    expect([...mixed.channels[0]!]).toEqual([0, 0, 0.5, 0.75]);
  });

  it('reports the playable duration after trimming the song start', () => {
    expect(movieMusicTrackDuration(track({ trimStartSeconds: 0.75 }))).toBe(1.25);
  });
});
