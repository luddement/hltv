import type { MoviePcmBlock } from '/@/movie/movie-recorder';

export type MovieMusicTrack = {
  id: string;
  name: string;
  sampleRate: number;
  channels: readonly Float32Array[];
  startAtSeconds: number;
  trimStartSeconds: number;
  volume: number;
};

export type MovieAudioMix = {
  tracks: readonly MovieMusicTrack[];
  gameVolume: number;
  musicVolume: number;
  crossfadeSeconds: number;
};

export const movieMusicTrackDuration = (track: MovieMusicTrack): number =>
  Math.max(0, (track.channels[0]?.length ?? 0) / track.sampleRate - track.trimStartSeconds);

const sampleAt = (channel: Float32Array, position: number): number => {
  const before = Math.floor(position);
  const after = Math.min(channel.length - 1, before + 1);
  const fraction = position - before;
  return (channel[before] ?? 0) * (1 - fraction) + (channel[after] ?? 0) * fraction;
};

const trackGainAt = (
  track: MovieMusicTrack,
  timelineSeconds: number,
  crossfadeSeconds: number,
): number => {
  const elapsed = timelineSeconds - track.startAtSeconds;
  const duration = movieMusicTrackDuration(track);
  if (elapsed < 0 || elapsed >= duration) return 0;
  if (crossfadeSeconds <= 0) return track.volume;
  const fade = Math.min(crossfadeSeconds, duration / 2);
  const fadeIn = Math.min(1, elapsed / fade);
  const fadeOut = Math.min(1, (duration - elapsed) / fade);
  return track.volume * Math.min(fadeIn, fadeOut);
};

/** Mixes decoded browser audio into one game-audio block at movie-timeline time. */
export const mixMovieAudioBlock = (
  block: MoviePcmBlock,
  outputStartFrame: number,
  mix: MovieAudioMix | undefined,
): MoviePcmBlock => {
  if (!mix?.tracks.length) return block;
  const frameCount = block.channels[0]?.length ?? 0;
  if (!frameCount || block.sampleRate <= 0) return block;
  const channels = block.channels.map((channel) => new Float32Array(channel.length));

  for (let frame = 0; frame < frameCount; frame++) {
    const timelineSeconds = (outputStartFrame + frame) / block.sampleRate;
    for (const [channelIndex, gameChannel] of block.channels.entries()) {
      let value = (gameChannel[frame] ?? 0) * mix.gameVolume;
      for (const track of mix.tracks) {
        const gain = trackGainAt(track, timelineSeconds, mix.crossfadeSeconds);
        if (!gain || !track.channels.length || track.sampleRate <= 0) continue;
        const sourceSeconds = track.trimStartSeconds + timelineSeconds - track.startAtSeconds;
        const sourcePosition = sourceSeconds * track.sampleRate;
        const musicChannel = track.channels[Math.min(channelIndex, track.channels.length - 1)];
        if (!musicChannel || sourcePosition < 0 || sourcePosition >= musicChannel.length) continue;
        value += sampleAt(musicChannel, sourcePosition) * gain * mix.musicVolume;
      }
      channels[channelIndex]![frame] = Math.max(-1, Math.min(1, value));
    }
  }
  return { sampleRate: block.sampleRate, channels };
};
