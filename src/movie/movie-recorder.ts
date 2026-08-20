import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  VideoSample,
  VideoSampleSource,
  type StreamTargetChunk,
  type Target,
} from 'mediabunny';
import type { MovieQuality } from '/@/movie/movie-project';
import type { MovieHudFrame, MovieIntroCard } from '/@/movie/movie-hud-renderer';
import {
  renderMovieHud,
  renderMovieIntro,
  renderMovieSight,
} from '/@/movie/movie-hud-renderer';

type MovieFileWrite = Blob | Uint8Array | {
  type: 'write';
  position: number;
  data: Uint8Array;
};

type WritableMovieFile = {
  write(data: MovieFileWrite): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
};

type SaveFileWindow = Window & typeof globalThis & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ createWritable(): Promise<WritableMovieFile> }>;
};

export type MovieContainer = {
  mimeType: string;
  extension: 'mp4' | 'webm';
};

export type PreparedMovieOutput = {
  filename: string;
  container: MovieContainer;
  writer?: WritableMovieFile;
};

export type MovieAudioCapture = {
  sampleRate: number;
  numberOfChannels: number;
  subscribe: (listener: (block: MoviePcmBlock) => void) => () => void;
  close: () => void;
};

export type MoviePcmBlock = {
  sampleRate: number;
  channels: Float32Array[];
};

export type MovieCaptureMode = 'direct' | 'composited';

export const preferredMovieContainer = (): MovieContainer | undefined => {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return undefined;
  return { mimeType: 'video/mp4', extension: 'mp4' };
};

export const prepareMovieOutput = async (
  filenameWithoutExtension: string,
): Promise<PreparedMovieOutput> => {
  const container = preferredMovieContainer();
  if (!container) {
    throw new Error('This browser does not provide the WebCodecs support required for high-frame-rate export.');
  }
  const filename = `${filenameWithoutExtension}.${container.extension}`;
  const picker = (window as SaveFileWindow).showSaveFilePicker;
  if (!picker) return { filename, container };
  const handle = await picker({
    suggestedName: filename,
    types: [{
      description: 'MP4-video',
      accept: { 'video/mp4': ['.mp4'] },
    }],
  });
  return { filename, container, writer: await handle.createWritable() };
};

export type MovieRecorderOptions = {
  sourceCanvas: HTMLCanvasElement;
  quality: MovieQuality;
  output: PreparedMovieOutput;
  audio?: MovieAudioCapture;
  captureMode: MovieCaptureMode;
  intro?: MovieIntroCard;
  hudFrame: () => MovieHudFrame | undefined;
  onBytes?: (bytes: number) => void;
  onError?: (error: Error) => void;
  onEncoderMode?: (mode: 'hardware' | 'software' | 'browser-default') => void;
};

type MovieRecorderState = 'unstarted' | 'recording' | 'paused' | 'inactive';

export class MovieRecorder {
  private static readonly probeCanvas = document.createElement('canvas');
  private readonly outputCanvas?: HTMLCanvasElement;
  private readonly context?: CanvasRenderingContext2D;
  private directOverlayCanvas?: HTMLCanvasElement;
  private directOverlayContext?: CanvasRenderingContext2D;
  private output?: Output<Mp4OutputFormat, Target>;
  private bufferTarget?: BufferTarget;
  private videoSource?: VideoSampleSource;
  private audioSource?: AudioSampleSource;
  private currentAudio?: MovieAudioCapture;
  private unsubscribeAudio?: () => void;
  private audioQueue: Promise<void> = Promise.resolve();
  private readonly pendingAudioBlocks: Array<{ block: MoviePcmBlock; fadeIn: boolean }> = [];
  private audioNeedsFadeIn = true;
  private audioSampleRate = 0;
  private audioChannelCount = 0;
  private queuedAudioFrames = 0;
  private receivedAudioFrames = 0;
  private frameRequest = 0;
  private frameQueue: Promise<void> = Promise.resolve();
  private byteCount = 0;
  private capturedFrameCount = 0;
  private encodedFrameCount = 0;
  private readonly recentEncodedFrameTimes: number[] = [];
  private recordingStartedAt = 0;
  private gameplayStartFrameCount = 0;
  private pausedAt = 0;
  private pausedDurationMs = 0;
  private recorderState: MovieRecorderState = 'unstarted';
  private failure?: Error;
  private cancelled = false;
  private finalized = false;
  private stopped?: Promise<void>;

  constructor(private readonly options: MovieRecorderOptions) {
    if (options.captureMode === 'composited') {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = options.quality.width;
      outputCanvas.height = options.quality.height;
      const context = outputCanvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!context) throw new Error('Could not create the movie render surface.');
      this.outputCanvas = outputCanvas;
      this.context = context;
    }
  }

  get state(): MovieRecorderState {
    return this.recorderState;
  }

  get bytesWritten(): number {
    return this.byteCount;
  }

  get capturedFrames(): number {
    return this.capturedFrameCount;
  }

  get encodedFrames(): number {
    return this.encodedFrameCount;
  }

  get encodingBacklogFrames(): number {
    return Math.max(0, this.capturedFrameCount - this.encodedFrameCount);
  }

  get recentFramesPerSecond(): number {
    if (this.recentEncodedFrameTimes.length < 2) return 0;
    const durationMs = this.recentEncodedFrameTimes.at(-1)!
      - this.recentEncodedFrameTimes[0];
    return durationMs > 0
      ? (this.recentEncodedFrameTimes.length - 1) / durationMs * 1_000
      : 0;
  }

  get fileFinalized(): boolean {
    return this.finalized;
  }

  static sourceHasVisibleFrame(source: HTMLCanvasElement): boolean {
    const probe = MovieRecorder.probeCanvas;
    probe.width = 32;
    probe.height = 18;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context || source.width <= 0 || source.height <= 0) return false;
    context.clearRect(0, 0, probe.width, probe.height);
    context.drawImage(source, 0, 0, probe.width, probe.height);
    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] > 8 || pixels[offset + 1] > 8 || pixels[offset + 2] > 8) return true;
    }
    return false;
  }

  async start(): Promise<void> {
    if (this.recorderState !== 'unstarted') return;
    const encoder = await this.selectAvcEncoder();
    const target = this.createTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
      target,
    });
    const videoSource = new VideoSampleSource({
      codec: 'avc',
      bitrate: this.options.quality.videoBitsPerSecond,
      bitrateMode: 'variable',
      latencyMode: 'quality',
      hardwareAcceleration: encoder.hardwareAcceleration,
      fullCodecString: encoder.codec,
      keyFrameInterval: 2,
      sizeChangeBehavior: 'passThrough',
      transform: this.outputCanvas ? undefined : {
        width: this.options.quality.width,
        height: this.options.quality.height,
        fit: 'contain',
        process: (sample) => this.renderDirectSight(sample),
      },
      onEncodedPacket: () => this.noteEncodedFrame(),
    });
    output.addVideoTrack(videoSource, { frameRate: this.options.quality.fps });

    if (typeof AudioEncoder === 'undefined') {
      throw new Error('This browser does not provide the WebCodecs audio encoder required for AAC in MP4.');
    }
    const audioCapture = this.options.audio;
    if (!audioCapture) {
      throw new Error('Could not connect the engine PCM audio to the movie export.');
    }
    const audioBitrate = await this.selectAacBitrate(audioCapture);
    const audioSource = new AudioSampleSource({
      codec: 'aac',
      bitrate: audioBitrate,
      bitrateMode: 'variable',
    });
    output.addAudioTrack(audioSource);
    this.audioSource = audioSource;
    this.currentAudio = audioCapture;

    this.output = output as Output<Mp4OutputFormat, Target>;
    this.videoSource = videoSource;
    await output.start();
    await this.writeIntro(videoSource, audioCapture);
    this.gameplayStartFrameCount = this.capturedFrameCount;
    this.renderCompositeFrame();
    this.recordingStartedAt = performance.now();
    this.recorderState = 'recording';
    this.unsubscribeAudio = audioCapture.subscribe(this.captureAudioBlock);
    this.queueCurrentFrame();
    await this.frameQueue;
    if (this.failure) throw this.failure;
    this.frameRequest = window.requestAnimationFrame(this.captureFrame);
  }

  private async selectAacBitrate(audio: MovieAudioCapture): Promise<number> {
    const preferred = Math.min(this.options.quality.audioBitsPerSecond, 192_000);
    const numberOfChannels = Math.max(1, audio.numberOfChannels || 2);
    const candidates = [...new Set([preferred, 192_000, 160_000, 128_000])]
      .filter((bitrate) => bitrate <= preferred);
    for (const bitrate of candidates) {
      try {
        const support = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: audio.sampleRate,
          numberOfChannels,
          bitrate,
          bitrateMode: 'variable',
        });
        if (support.supported) return bitrate;
      } catch {
        // Some Web Audio nodes report incomplete metadata before their first
        // PCM callback. Try the next conservative AAC configuration.
      }
    }
    throw new Error(
      `This browser does not support ${numberOfChannels}-channel AAC at ${audio.sampleRate} Hz.`,
    );
  }

  private async selectAvcEncoder(): Promise<{
    codec: string;
    hardwareAcceleration: 'prefer-hardware' | 'prefer-software' | 'no-preference';
  }> {
    const { width, height, fps, videoBitsPerSecond } = this.options.quality;
    const codec = ((width >= 3840 || height >= 2160) && fps >= 60)
      || ((width >= 2560 || height >= 1440) && fps > 60)
      ? 'avc1.640034'
      : ((width >= 1920 || height >= 1080) && fps > 60)
        ? 'avc1.640033'
      : width >= 2560 || height >= 1440
        ? 'avc1.640033'
      : width >= 1920 || height >= 1080
        ? 'avc1.64002a'
        : 'avc1.640020';
    const baseConfig: VideoEncoderConfig = {
      codec,
      width,
      height,
      framerate: fps,
      bitrate: videoBitsPerSecond,
      bitrateMode: 'variable',
      latencyMode: 'quality',
      alpha: 'discard',
    };
    const hardware = await VideoEncoder.isConfigSupported({
      ...baseConfig,
      hardwareAcceleration: 'prefer-hardware',
    });
    if (hardware.supported) {
      try {
        await this.verifyEncoder({
          ...baseConfig,
          hardwareAcceleration: 'prefer-hardware',
        });
        this.options.onEncoderMode?.('hardware');
        return { codec, hardwareAcceleration: 'prefer-hardware' };
      } catch {
        // Some Chrome builds report a hardware profile as supported but fail
        // when the first frame is submitted. Verify before touching the file.
      }
    }
    const softwareConfig: VideoEncoderConfig = {
      ...baseConfig,
      hardwareAcceleration: 'prefer-software',
    };
    const software = await VideoEncoder.isConfigSupported(softwareConfig);
    if (software.supported) {
      await this.verifyEncoder(softwareConfig);
      this.options.onEncoderMode?.('software');
      return { codec, hardwareAcceleration: 'prefer-software' };
    }
    const browserConfig: VideoEncoderConfig = {
      ...baseConfig,
      hardwareAcceleration: 'no-preference',
    };
    const browser = await VideoEncoder.isConfigSupported(browserConfig);
    if (!browser.supported) {
      throw new Error(
        `This browser cannot encode H.264 ${width}×${height} at ${fps} FPS with WebCodecs.`,
      );
    }
    await this.verifyEncoder(browserConfig);
    this.options.onEncoderMode?.('browser-default');
    return { codec, hardwareAcceleration: 'no-preference' };
  }

  private async verifyEncoder(config: VideoEncoderConfig): Promise<void> {
    const { width, height } = this.options.quality;
    const probe = document.createElement('canvas');
    probe.width = width;
    probe.height = height;
    const context = probe.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create the encoder test frame.');
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    const source = this.outputCanvas ?? this.options.sourceCanvas;
    const scale = Math.min(width / source.width, height / source.height);
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    context.drawImage(
      source,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    let encoderError: Error | undefined;
    const encoder = new VideoEncoder({
      output: () => undefined,
      error: (error) => { encoderError = error; },
    });
    const frame = new VideoFrame(probe, { timestamp: 0, duration: 1_000_000 });
    try {
      encoder.configure(config);
      encoder.encode(frame, { keyFrame: true });
      await encoder.flush();
      if (encoderError) throw encoderError;
    } finally {
      frame.close();
      // A failed WebCodecs encoder transitions itself to `closed` before its
      // error callback runs. Calling close() again throws InvalidStateError and
      // would mask the real hardware failure instead of allowing our fallback.
      if (encoder.state !== 'closed') encoder.close();
    }
  }

  pause(): void {
    if (this.recorderState !== 'recording') return;
    this.recorderState = 'paused';
    this.pausedAt = performance.now();
    this.alignAudioToVideo(true);
    this.audioNeedsFadeIn = true;
    this.recentEncodedFrameTimes.length = 0;
  }

  resume(): void {
    if (this.recorderState !== 'paused') return;
    this.pausedDurationMs += performance.now() - this.pausedAt;
    this.pausedAt = 0;
    this.recentEncodedFrameTimes.length = 0;
    this.audioNeedsFadeIn = true;
    this.recorderState = 'recording';
  }

  /** Reconnects PCM after a playlist switches to a fresh Xash runtime. */
  replaceAudioCapture(audio: MovieAudioCapture): void {
    if (this.recorderState === 'unstarted' || this.recorderState === 'inactive') {
      throw new Error('The movie recorder is not ready for a new audio source.');
    }
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = undefined;
    this.currentAudio?.close();
    this.currentAudio = audio;
    this.audioNeedsFadeIn = true;
    this.unsubscribeAudio = audio.subscribe(this.captureAudioBlock);
  }

  async stop(): Promise<void> {
    if (this.stopped) return this.stopped;
    this.stopped = this.finalize();
    return this.stopped;
  }

  async cancel(): Promise<void> {
    if (this.cancelled || this.finalized) return;
    this.cancelled = true;
    this.recorderState = 'inactive';
    window.cancelAnimationFrame(this.frameRequest);
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = undefined;
    this.pendingAudioBlocks.length = 0;
    this.audioSource?.close();
    this.currentAudio?.close();
    this.currentAudio = undefined;
    await Promise.all([
      this.frameQueue.catch(() => undefined),
      this.audioQueue.catch(() => undefined),
    ]);
    this.videoSource?.close();
    await this.output?.cancel().catch(() => undefined);
  }

  private createTarget(): Target {
    const writer = this.options.output.writer;
    let target: Target;
    if (writer) {
      const stream = new WritableStream<StreamTargetChunk>({
        write: ({ data, position }) => writer.write({ type: 'write', position, data }),
        close: () => writer.close(),
        abort: (reason) => writer.abort(reason),
      });
      target = new StreamTarget(stream, { chunked: true, chunkSize: 2 ** 20 });
    } else {
      const bufferTarget = new BufferTarget();
      this.bufferTarget = bufferTarget;
      target = bufferTarget;
    }
    target.on('write', ({ end }) => {
      if (end <= this.byteCount) return;
      this.byteCount = end;
      this.options.onBytes?.(end);
    });
    return target;
  }

  private captureFrame = (now: number) => {
    if (this.recorderState === 'recording' && !this.failure) {
      this.renderCompositeFrame();
      const activeElapsedMs = now - this.recordingStartedAt - this.pausedDurationMs;
      const expectedFrameCount = Math.floor(
        Math.max(0, activeElapsedMs) * this.options.quality.fps / 1_000,
      ) + this.gameplayStartFrameCount + 1;
      while (this.capturedFrameCount < expectedFrameCount) this.queueCurrentFrame();
    }
    if (this.recorderState !== 'inactive') {
      this.frameRequest = window.requestAnimationFrame(this.captureFrame);
    }
  };

  private async writeIntro(
    source: VideoSampleSource,
    audioCapture: MovieAudioCapture,
  ): Promise<void> {
    const intro = this.options.intro;
    if (!intro || intro.durationSeconds <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = this.options.quality.width;
    canvas.height = this.options.quality.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create the movie intro card.');
    renderMovieIntro(context, intro);

    const duration = 1 / this.options.quality.fps;
    const frameCount = Math.max(1, Math.round(intro.durationSeconds * this.options.quality.fps));
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const sample = new VideoSample(canvas, {
        timestamp: frameIndex * duration,
        duration,
      });
      try {
        await source.add(sample);
        this.capturedFrameCount++;
      } finally {
        sample.close();
      }
    }

    this.audioSampleRate = audioCapture.sampleRate;
    this.audioChannelCount = Math.max(1, audioCapture.numberOfChannels || 2);
    const introAudioFrames = Math.round(intro.durationSeconds * this.audioSampleRate);
    this.queueAudioBlock({
      sampleRate: this.audioSampleRate,
      channels: Array.from(
        { length: this.audioChannelCount },
        () => new Float32Array(introAudioFrames),
      ),
    }, false, false);
    await this.audioQueue;
  }

  private renderCompositeFrame(): void {
    const output = this.outputCanvas;
    const context = this.context;
    if (!output || !context) return;
    const { width, height } = output;
    const source = this.options.sourceCanvas;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    if (source.width > 0 && source.height > 0) {
      const scale = Math.min(width / source.width, height / source.height);
      const drawWidth = source.width * scale;
      const drawHeight = source.height * scale;
      context.drawImage(
        source,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
    }
    renderMovieHud(context, this.options.hudFrame());
  }

  private renderDirectSight(sample: VideoSample): VideoSample | HTMLCanvasElement {
    if (this.options.intro && sample.timestamp < this.options.intro.durationSeconds) return sample;
    const frame = this.options.hudFrame();
    if (!frame || (!frame.crosshair && !frame.scope)) return sample;

    let canvas = this.directOverlayCanvas;
    let context = this.directOverlayContext;
    if (!canvas || !context) {
      canvas = document.createElement('canvas');
      canvas.width = this.options.quality.width;
      canvas.height = this.options.quality.height;
      context = canvas.getContext('2d', { alpha: false, desynchronized: true }) ?? undefined;
      if (!context) throw new Error('Could not create the movie crosshair layer.');
      this.directOverlayCanvas = canvas;
      this.directOverlayContext = context;
    }

    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    sample.draw(context, 0, 0, canvas.width, canvas.height);
    renderMovieSight(context, frame);
    return canvas;
  }

  private queueCurrentFrame(): void {
    const source = this.videoSource;
    if (!source) return;
    const frameIndex = this.capturedFrameCount;
    const duration = 1 / this.options.quality.fps;
    let sample: VideoSample;
    try {
      sample = new VideoSample(this.outputCanvas ?? this.options.sourceCanvas, {
        timestamp: frameIndex * duration,
        duration,
      });
    } catch (error) {
      this.setFailure(error);
      return;
    }
    this.capturedFrameCount++;
    this.frameQueue = this.frameQueue.then(async () => {
      if (this.failure || this.cancelled) {
        sample.close();
        return;
      }
      try {
        await source.add(sample);
      } finally {
        sample.close();
      }
    }).catch((error: unknown) => this.setFailure(error));
  }

  private captureAudioBlock = (block: MoviePcmBlock): void => {
    if (this.recorderState !== 'recording' || this.failure || this.cancelled) return;
    if (!block.channels.length || !block.channels[0]?.length || block.sampleRate <= 0) return;
    const frameCount = block.channels[0].length;
    if (block.channels.some((channel) => channel.length !== frameCount)) {
      this.setFailure(new Error('The engine PCM channels had different lengths.'));
      return;
    }
    if (!this.audioSampleRate) {
      this.audioSampleRate = block.sampleRate;
      this.audioChannelCount = block.channels.length;
    } else if (block.sampleRate !== this.audioSampleRate
      || block.channels.length !== this.audioChannelCount) {
      this.setFailure(new Error('The engine PCM format changed during export.'));
      return;
    }

    this.receivedAudioFrames += frameCount;
    this.pendingAudioBlocks.push({ block, fadeIn: this.audioNeedsFadeIn });
    this.audioNeedsFadeIn = false;
    this.flushAudioSafetyWindow();
  };

  private flushAudioSafetyWindow(): void {
    if (!this.audioSampleRate) return;
    const videoFrames = this.capturedFrameCount / this.options.quality.fps;
    const safeTargetFrames = Math.max(
      0,
      Math.round((videoFrames - 0.25) * this.audioSampleRate),
    );
    while (this.pendingAudioBlocks.length) {
      const pending = this.pendingAudioBlocks[0];
      const frameCount = pending?.block.channels[0]?.length ?? 0;
      if (!pending || this.queuedAudioFrames + frameCount > safeTargetFrames) break;
      this.pendingAudioBlocks.shift();
      this.queueAudioBlock(pending.block, pending.fadeIn, false);
    }
  }

  private alignAudioToVideo(fadeOut: boolean): void {
    if (!this.audioSampleRate || !this.audioChannelCount) return;
    const targetFrames = Math.round(
      this.capturedFrameCount / this.options.quality.fps * this.audioSampleRate,
    );
    const planned: Array<{
      block: MoviePcmBlock;
      fadeIn: boolean;
      syntheticSilence: boolean;
    }> = [];
    let remainingFrames = Math.max(0, targetFrames - this.queuedAudioFrames);

    while (remainingFrames > 0 && this.pendingAudioBlocks.length) {
      const pending = this.pendingAudioBlocks.shift()!;
      const frameCount = pending.block.channels[0]?.length ?? 0;
      const useFrames = Math.min(frameCount, remainingFrames);
      if (useFrames > 0) {
        planned.push({
          block: useFrames === frameCount ? pending.block : {
            sampleRate: pending.block.sampleRate,
            channels: pending.block.channels.map((channel) => channel.slice(0, useFrames)),
          },
          fadeIn: pending.fadeIn,
          syntheticSilence: false,
        });
        remainingFrames -= useFrames;
      }
    }
    this.pendingAudioBlocks.length = 0;

    if (remainingFrames > 0) {
      planned.push({
        block: {
          sampleRate: this.audioSampleRate,
          channels: Array.from(
            { length: this.audioChannelCount },
            () => new Float32Array(remainingFrames),
          ),
        },
        fadeIn: planned.length === 0 && this.audioNeedsFadeIn,
        syntheticSilence: true,
      });
    }
    let fadeOutIndex = -1;
    if (fadeOut) {
      for (let index = planned.length - 1; index >= 0; index--) {
        if (planned[index]?.syntheticSilence) continue;
        fadeOutIndex = index;
        break;
      }
    }
    planned.forEach((pending, index) => {
      this.queueAudioBlock(
        pending.block,
        pending.fadeIn,
        index === fadeOutIndex,
      );
    });
  }

  private queueAudioBlock(block: MoviePcmBlock, fadeIn: boolean, fadeOut: boolean): void {
    const source = this.audioSource;
    if (!source) return;
    const frameCount = block.channels[0]?.length ?? 0;
    const channelCount = block.channels.length;
    if (!frameCount || !channelCount) return;

    const planarData = new Float32Array(frameCount * channelCount);
    const fadeFrames = Math.min(frameCount, Math.max(1, Math.round(block.sampleRate * 0.008)));
    for (const [channelIndex, channel] of block.channels.entries()) {
      const destinationOffset = channelIndex * frameCount;
      if (!fadeIn && !fadeOut) {
        planarData.set(channel, destinationOffset);
        continue;
      }
      for (let frame = 0; frame < frameCount; frame++) {
        let gain = 1;
        if (fadeIn && frame < fadeFrames) gain *= (frame + 1) / fadeFrames;
        if (fadeOut && frame >= frameCount - fadeFrames) {
          gain *= Math.max(0, (frameCount - frame - 1) / fadeFrames);
        }
        planarData[destinationOffset + frame] = channel[frame] * gain;
      }
    }

    const sample = new AudioSample({
      data: planarData,
      format: 'f32-planar',
      numberOfChannels: channelCount,
      sampleRate: block.sampleRate,
      timestamp: this.queuedAudioFrames / block.sampleRate,
    });
    this.queuedAudioFrames += frameCount;
    this.audioQueue = this.audioQueue.then(async () => {
      if (this.failure || this.cancelled) return;
      await source.add(sample);
    }).finally(() => sample.close()).catch((error: unknown) => this.setFailure(error));
  }

  private noteEncodedFrame(): void {
    this.encodedFrameCount++;
    const now = performance.now();
    this.recentEncodedFrameTimes.push(now);
    while (this.recentEncodedFrameTimes.length > 2
      && this.recentEncodedFrameTimes[0] < now - 5_000) {
      this.recentEncodedFrameTimes.shift();
    }
  }

  private setFailure(error: unknown): void {
    if (this.failure) return;
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.options.onError?.(this.failure);
  }

  private async finalize(): Promise<void> {
    this.recorderState = 'inactive';
    window.cancelAnimationFrame(this.frameRequest);
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = undefined;
    this.alignAudioToVideo(true);
    this.currentAudio?.close();
    this.currentAudio = undefined;
    await Promise.all([this.frameQueue, this.audioQueue]);
    this.videoSource?.close();
    this.audioSource?.close();
    const output = this.output;
    if (!output) throw new Error('The video encoder never started.');
    const captureFailure = this.failure
      ?? (this.receivedAudioFrames === 0
        ? new Error('The engine did not deliver any PCM audio blocks to the movie.')
        : undefined);
    // Even when a source failed, finalize all packets accepted up to that
    // point. This writes the MP4 index and preserves a playable partial file;
    // aborting the File System Access writer would roll it back to zero bytes.
    await output.finalize();
    this.finalized = true;
    const buffer = this.bufferTarget?.buffer;
    if (buffer) {
      this.byteCount = buffer.byteLength;
      this.options.onBytes?.(this.byteCount);
      const blob = new Blob([buffer], { type: this.options.output.container.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.options.output.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    if (captureFailure) throw captureFailure;
  }
}
