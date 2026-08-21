import type { Xash3D } from 'xash3d-fwgs';
import type { DemoCompatibilityProfile, DemoSource } from '/@/demo/goldsrc-demo';
import {
  DEMO_COMPATIBILITY_PROFILES,
  readDemoSource,
} from '/@/demo/goldsrc-demo';
import XashLoader, {
  GAME_SETTINGS,
  type LoadProgress,
} from '/@/services/xash-loader';
import type { GameAssetEntry } from '/@/services/local-asset-mount';
import type { MovieAudioCapture, MoviePcmBlock } from '/@/movie/movie-recorder';
import { CLEAR_TRANSIENT_HUD_COMMAND, hiddenSeekHudCommands } from '/@/demo/seek-hud';

const XASH_BASE_DIR = '/rodir';
const DEMO_FILENAME = 'hltv_replay.dem';
const DEMO_PATH = `${XASH_BASE_DIR}/cstrike/${DEMO_FILENAME}`;
const DEMO_SEEK_STARTUP_COMPENSATION_MS = 1_500;
const PRESENTATION_WARMUP_MIN_MS = 3_000;
const PRESENTATION_STABLE_FRAME_COUNT = 16;
const PRESENTATION_STABLE_FRAME_MAX_DELTA_MS = 200;

export type DemoEngineOptions = {
  canvas: HTMLCanvasElement;
  gameFiles: GameAssetEntry[];
  demoSource: DemoSource;
  demoBuffer?: ArrayBuffer;
  compatibilityProfile: DemoCompatibilityProfile;
  isHltv: boolean;
  captureFrames?: boolean;
  compactScoreboard?: boolean;
  targetFps?: number;
  renderSize?: { width: number; height: number };
  startAtMs?: number;
  reconstructionCamera?: {
    origin: [number, number, number];
    angles: [number, number, number];
    entityIndex: number;
    nativeHltv: boolean;
    weapon: string;
    label: string;
    activateAfterMs: number;
    durationMs: number;
  };
  onSeekStateChange?: (seeking: boolean) => void;
  onReconstructionStateChange?: (active: boolean) => void;
  onNativeFovChange?: (fov: number) => void;
  onNativeWeaponChange?: (weaponId: number) => void;
  onLog: (message: string, isError: boolean) => void;
  onProgress: (progress: LoadProgress) => void;
};

class DemoEngine {
  private xash?: Xash3D;
  private runtimeSeekCompletion?: () => void;
  private runtimeSeekTimer?: number;
  private lifecycleTimers = new Set<number>();

  private setHiddenSeekHud(xash: Xash3D, hidden: boolean): void {
    // Töm bufferten INNAN tiderna återställs. Gör man tvärtom hinner de gamla
    // raderna bli synliga igen i samma ögonblick som livstiden blir positiv.
    if (!hidden) xash.Cmd_ExecuteString(CLEAR_TRANSIENT_HUD_COMMAND);
    for (const command of hiddenSeekHudCommands(hidden)) {
      xash.Cmd_ExecuteString(command);
    }
  }

  private scheduleFor(
    xash: Xash3D,
    callback: () => void,
    delayMs: number,
  ): number {
    const timer = window.setTimeout(() => {
      this.lifecycleTimers.delete(timer);
      if (this.xash !== xash || !xash.running) return;
      callback();
    }, delayMs);
    this.lifecycleTimers.add(timer);
    return timer;
  }

  private waitForStablePresentation(
    xash: Xash3D,
    callback: (elapsedMs: number, stableFrames: number) => void,
  ): void {
    const startedAt = performance.now();
    let previousFrameAt = startedAt;
    let stableFrames = 0;
    const sample = (now: number) => {
      if (this.xash !== xash || !xash.running) return;
      const elapsedMs = now - startedAt;
      const frameDeltaMs = now - previousFrameAt;
      previousFrameAt = now;
      if (elapsedMs >= PRESENTATION_WARMUP_MIN_MS
        && frameDeltaMs <= PRESENTATION_STABLE_FRAME_MAX_DELTA_MS) {
        stableFrames += 1;
      } else if (frameDeltaMs > PRESENTATION_STABLE_FRAME_MAX_DELTA_MS) {
        // Shader compilation, texture upload or another main-thread stall
        // means the scene is not ready. Require a fresh uninterrupted run.
        stableFrames = 0;
      }
      if (stableFrames >= PRESENTATION_STABLE_FRAME_COUNT) {
        callback(elapsedMs, stableFrames);
        return;
      }
      window.requestAnimationFrame(sample);
    };
    window.requestAnimationFrame(sample);
  }

  get running(): boolean {
    return this.xash?.running ?? false;
  }

  async start(options: DemoEngineOptions): Promise<Xash3D> {
    if (this.running) {
      throw new Error('The engine is already running.');
    }

    const compatibility = DEMO_COMPATIBILITY_PROFILES[options.compatibilityProfile];
    const compactScoreboard = options.compactScoreboard ?? false;
    let rendererStarted = false;
    let completeSeek: (() => void) | undefined;
    const handleEngineLog = (message: string, isError: boolean) => {
      const nativeFov = message.match(/ReplayLab native FOV:\s*(\d+)/i);
      if (nativeFov) options.onNativeFovChange?.(Number(nativeFov[1]));
      const nativeWeapon = message.match(/ReplayLab native weapon:\s*(\d+)/i);
      if (nativeWeapon) options.onNativeWeaponChange?.(Number(nativeWeapon[1]));
      if (message.includes('Setting up renderer')) rendererStarted = true;
      if (message.includes('ReplayLab fast-forward complete')) {
        window.setTimeout(() => {
          if (this.runtimeSeekCompletion) this.runtimeSeekCompletion();
          else completeSeek?.();
        }, 0);
      }
      options.onLog(message, isError);
    };
    const launchArgs = [
      '-game',
      'cstrike',
      '-windowed',
      '-ref',
      'webgl2',
      ...(options.renderSize ? [
        '-width',
        String(options.renderSize.width),
        '-height',
        String(options.renderSize.height),
      ] : []),
      '+_vgui_menus',
      '0',
      '+hud_scale',
      compatibility.legacyScoreboard ? '2.5' : '0',
      '+con_notifytime',
      '0',
      '+fps_override',
      '1',
      '+fps_max',
      String(Math.max(100, Math.round(options.targetFps ?? 100))),
      '+volume',
      '0.08',
      '+playdemo',
      'hltv_replay',
    ];

    options.onLog('Initierar Xash3D WebAssembly…', false);
    options.onLog(`Kompatibilitetsprofil: ${compatibility.label}.`, false);
    if (options.renderSize) {
      options.canvas.width = options.renderSize.width;
      options.canvas.height = options.renderSize.height;
      options.onLog(
        `Locking the render surface to ${options.renderSize.width}×${options.renderSize.height} for movie export.`,
        false,
      );
    }
    const xash = await XashLoader.initXash({
      canvas: options.canvas,
      selectedGame: GAME_SETTINGS.CS,
      launchArgs,
      preserveDrawingBuffer: options.captureFrames,
      onLog: handleEngineLog,
    });

    const [extras, demoBuffer] = await Promise.all([
      XashLoader.fetchExtras(),
      options.demoBuffer ?? readDemoSource(options.demoSource),
      XashLoader.processAssetEntries(options.gameFiles, xash, options.onProgress),
    ]);

    if (!xash.em) {
      throw new Error('The WebAssembly file system could not start.');
    }

    xash.em.FS.mkdirTree(`${XASH_BASE_DIR}/cstrike`);
    xash.em.FS.writeFile(DEMO_PATH, new Uint8Array(demoBuffer));
    await XashLoader.writeExtras(xash, extras);
    xash.em.FS.chdir(`${XASH_BASE_DIR}/`);

    options.onLog(`Mounted the demo as cstrike/${DEMO_FILENAME}.`, false);
    options.onLog('Startkommando: playdemo hltv_replay', false);
    xash.main();
    this.xash = xash;

    // Some installations do not ship a game .rc containing `stuffcmds`, so
    // the +playdemo argument is not consumed. Execute it again once CS16Client
    // has registered its demo commands.
    this.scheduleFor(xash, () => {
      options.onLog('Running playdemo after client initialization.', false);
      if (compatibility.legacyScoreboard) {
        xash.Cmd_ExecuteString('cl_corpsestay 10');
      }
      xash.Cmd_ExecuteString('hltv_replay_mode 1');
      // Historical servers often sent HTML MOTDs which this client renders as
      // raw text. They are unrelated to the recording and must never cover it.
      xash.Cmd_ExecuteString('cl_hide_motd 1');
      // Native spectator state must stay strictly scoped to HLTV. Ordinary POV
      // demos use the original recorded CS/Xash view and weapon pipeline.
      xash.Cmd_ExecuteString(`set hltv_native_spectator ${options.isHltv ? 1 : 0}`);
      if (options.isHltv) {
        // CS16Client defaults spectator picture-in-picture to on. During native
        // in-eye replay that splits the renderer and leaves large black areas.
        xash.Cmd_ExecuteString('set spec_pip_internal 0');
        xash.Cmd_ExecuteString('spec_pip 0');
        xash.Cmd_ExecuteString('spec_mode 4');
      }
      xash.Cmd_ExecuteString('con_notifytime 0');
      xash.Cmd_ExecuteString('r_drawviewmodel 1');
      xash.Cmd_ExecuteString(
        `hud_scale ${compatibility.legacyScoreboard ? 1280 : 0}`,
      );
      xash.Cmd_ExecuteString(
        `hltv_legacy_scoreboard ${compatibility.legacyScoreboard ? 1 : 0}`,
      );
      xash.Cmd_ExecuteString(`hltv_compact_scoreboard ${compactScoreboard ? 1 : 0}`);
      xash.Cmd_ExecuteString('cl_crosshair_size small');
      xash.Cmd_ExecuteString('cl_dynamiccrosshair 0');
      const startAtMs = Math.max(0, options.startAtMs ?? 0);
      if (startAtMs > 0) {
        options.onSeekStateChange?.(true);
        options.onLog(
          `Restarting and seeking invisibly to the selected position (${Math.round(startAtMs)} ms).`,
          false,
        );
        xash.Cmd_ExecuteString('volume 0');
        xash.Cmd_ExecuteString('r_norefresh 1');
        this.setHiddenSeekHud(xash, true);
        xash.Cmd_ExecuteString('sys_timescale 1');
        xash.Cmd_ExecuteString(`set hltv_fastforward ${(startAtMs / 1_000).toFixed(3)}`);
      }
      xash.Cmd_ExecuteString('playdemo hltv_replay');
      // Close GameUI deterministically. Unlike Escape/togglemenu or slot10,
      // this command cannot accidentally open the menu or change weapons.
      xash.Cmd_ExecuteString('hltv_closemenu');
      if (startAtMs > 0) {
        // The patched HLDEMO reader consumes packets directly until the target.
        let seekCompleted = false;
        completeSeek = () => {
          if (seekCompleted) return;
          seekCompleted = true;
          if (!this.running) return;
          const camera = options.reconstructionCamera;
          const revealPlayback = () => {
            if (!this.running) return;
            xash.Cmd_ExecuteString('sys_timescale 1');
            xash.Cmd_ExecuteString('r_norefresh 0');
            this.setHiddenSeekHud(xash, false);
            xash.Cmd_ExecuteString('volume 0.08');
            // A +showscores packet consumed during the hidden seek can otherwise
            // leave the scoreboard latched over the selected highlight.
            xash.Cmd_ExecuteString('-showscores');
            xash.Cmd_ExecuteString('hltv_closemenu');
            options.onSeekStateChange?.(false);
            options.onLog(
              camera?.activateAfterMs === 0
                ? 'First-person camera ready; normal playback resumed.'
                : 'Hidden seek complete; normal playback resumed.',
              false,
            );
          };
          const activateCamera = () => {
            if (!camera || !this.running) return;
            if (camera.nativeHltv) {
              if (!options.isHltv) {
                options.onLog(
                  'Ignored an HLTV camera in a regular POV demo.',
                  true,
                );
                return;
              }
              xash.Cmd_ExecuteString('-showscores');
              xash.Cmd_ExecuteString('hltv_reconstruction_camera 0');
              xash.Cmd_ExecuteString('spec_autodirector 0');
              xash.Cmd_ExecuteString('set spec_pip_internal 0');
              xash.Cmd_ExecuteString('spec_pip 0');
              xash.Cmd_ExecuteString(`hltv_native_weapon ${camera.weapon}`);
              xash.Cmd_ExecuteString(`hltv_spec_player ${camera.entityIndex}`);
              xash.Cmd_ExecuteString('bind SPACE +jump');
              xash.Cmd_ExecuteString('bind MOUSE1 +attack');
              xash.Cmd_ExecuteString('bind MOUSE2 +attack2');
              xash.Cmd_ExecuteString('bind w +forward');
              xash.Cmd_ExecuteString('bind a +moveleft');
              xash.Cmd_ExecuteString('bind s +back');
              xash.Cmd_ExecuteString('bind d +moveright');
              options.onReconstructionStateChange?.(true);
              options.onLog(`Killer's native HLTV POV active: ${camera.label}.`, false);
              return;
            }
            const commandValue = (value: number) => Number.isFinite(value)
              ? value.toFixed(4)
              : '0';
            xash.Cmd_ExecuteString(`hltv_reconstruction_x ${commandValue(camera.origin[0])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_y ${commandValue(camera.origin[1])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_z ${commandValue(camera.origin[2])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_pitch ${commandValue(camera.angles[0])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_yaw ${commandValue(camera.angles[1])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_roll ${commandValue(camera.angles[2])}`);
            xash.Cmd_ExecuteString(`hltv_reconstruction_entity ${camera.entityIndex}`);
            xash.Cmd_ExecuteString('r_drawviewmodel 1');
            xash.Cmd_ExecuteString('hud_draw 1');
            xash.Cmd_ExecuteString('hltv_reconstruction_camera 1');
            options.onReconstructionStateChange?.(true);
            options.onLog(`Killer POV camera active: ${camera.label}.`, false);
            this.scheduleFor(xash, () => {
              if (!this.running) return;
              xash.Cmd_ExecuteString('hltv_reconstruction_camera 0');
              xash.Cmd_ExecuteString('r_drawviewmodel 1');
              xash.Cmd_ExecuteString('hud_draw 1');
              options.onReconstructionStateChange?.(false);
              options.onLog('Killer camera ended; recorded POV restored.', false);
            }, camera.durationMs);
          };

          if (camera?.activateAfterMs === 0) {
            // Keep demo time and audio frozen while native spectator commands
            // take effect. The seek overlay stays visible until the killer's
            // first-person camera has rendered and settled, so the requested
            // preroll begins with the correct POV instead of spending most of
            // its three seconds waiting for spectator mode to switch.
            xash.Cmd_ExecuteString('sys_timescale 0');
            xash.Cmd_ExecuteString('r_norefresh 0');
            activateCamera();
            this.waitForStablePresentation(xash, (elapsedMs, stableFrames) => {
              options.onLog(
                `First-person scene stable after ${Math.round(elapsedMs)} ms and ${stableFrames} clean frames.`,
                false,
              );
              revealPlayback();
            });
            return;
          }

          revealPlayback();
          if (camera) this.scheduleFor(xash, activateCamera, camera.activateAfterMs);
        };
        // Safety timeout for a missing completion marker. The production engine
        // normally emits the marker immediately after reaching the target.
        this.scheduleFor(
          xash,
          () => completeSeek?.(),
          Math.max(10_000, startAtMs / 15 + DEMO_SEEK_STARTUP_COMPENSATION_MS),
        );
      }
    }, 3_500);

    // Some original demos take longer to complete the initial client signon.
    // Retry only when no map renderer has appeared, avoiding a restart of a
    // replay that is already running.
    this.scheduleFor(xash, () => {
      if (!rendererStarted) {
        options.onLog('No map after sign-on; trying to start the demo again.', false);
        xash.Cmd_ExecuteString('playdemo hltv_replay');
      }
    }, 18_000);

    // CS reloads its client DLL during signon, so reapply replay presentation
    // cvars while the recording settles. Do not send slot commands here: when
    // no menu is open, `slot10` can holster the recorded player's viewmodel.
    for (let delay = 6_500; delay <= 24_500; delay += 2_000) {
      this.scheduleFor(xash, () => {
        xash.Cmd_ExecuteString('hltv_replay_mode 1');
        xash.Cmd_ExecuteString('cl_hide_motd 1');
        xash.Cmd_ExecuteString(`set hltv_native_spectator ${options.isHltv ? 1 : 0}`);
        xash.Cmd_ExecuteString('hltv_closemenu');
        xash.Cmd_ExecuteString('r_drawviewmodel 1');
        xash.Cmd_ExecuteString(
          `hltv_legacy_scoreboard ${compatibility.legacyScoreboard ? 1 : 0}`,
        );
        xash.Cmd_ExecuteString(`hltv_compact_scoreboard ${compactScoreboard ? 1 : 0}`);
        // Sign-on can recreate the CS client after the initial command. Set
        // first person once as soon as that client is available, then leave
        // later manual spectator-mode changes alone.
        if (options.isHltv) {
          xash.Cmd_ExecuteString('set spec_pip_internal 0');
          xash.Cmd_ExecuteString('spec_pip 0');
        }
        if (options.isHltv && delay === 6_500) xash.Cmd_ExecuteString('spec_mode 4');
      }, delay);
    }

    return xash;
  }

  execute(command: string): void {
    if (!this.xash?.running) {
      throw new Error('The engine has not started.');
    }
    this.xash.Cmd_ExecuteString(command);
  }

  createAudioCapture(): MovieAudioCapture | undefined {
    const module = this.xash?.em?.Module as unknown as {
      SDL2?: {
        audioContext?: AudioContext;
        audio?: { scriptProcessorNode?: ScriptProcessorNode };
      };
    } | undefined;
    const context = module?.SDL2?.audioContext;
    const output = module?.SDL2?.audio?.scriptProcessorNode;
    if (!context || context.state === 'closed' || !output) return undefined;
    if (context.state === 'suspended') void context.resume();
    const originalAudioProcess = output.onaudioprocess;
    if (!originalAudioProcess) return undefined;
    let listener: ((block: MoviePcmBlock) => void) | undefined;
    const captureAudioProcess = function (
      this: ScriptProcessorNode,
      event: AudioProcessingEvent,
    ) {
      originalAudioProcess.call(this, event);
      if (!listener) return;
      const buffer = event.outputBuffer;
      const channels = Array.from(
        { length: buffer.numberOfChannels },
        (_, index) => buffer.getChannelData(index).slice(),
      );
      listener({ sampleRate: buffer.sampleRate, channels });
    };
    output.onaudioprocess = captureAudioProcess;
    return {
      sampleRate: context.sampleRate,
      // ScriptProcessorNode may report zero before its first callback even
      // though SDL opened Counter-Strike's mixer with stereo output.
      numberOfChannels: Math.max(1, output.channelCount || 2),
      subscribe: (nextListener) => {
        listener = nextListener;
        return () => {
          if (listener === nextListener) listener = undefined;
        };
      },
      close: () => {
        listener = undefined;
        if (output.onaudioprocess === captureAudioProcess) {
          output.onaudioprocess = originalAudioProcess;
        }
      },
    };
  }

  seekTo(targetMs: number, restartDemo = false): Promise<void> {
    const xash = this.xash;
    if (!xash?.running) return Promise.reject(new Error('The engine has not started.'));

    this.runtimeSeekCompletion?.();
    if (this.runtimeSeekTimer) window.clearTimeout(this.runtimeSeekTimer);

    return new Promise((resolve) => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true;
        if (this.runtimeSeekTimer) window.clearTimeout(this.runtimeSeekTimer);
        this.runtimeSeekTimer = undefined;
        this.runtimeSeekCompletion = undefined;
        if (xash.running) {
          xash.Cmd_ExecuteString('sys_timescale 1');
          xash.Cmd_ExecuteString('r_norefresh 0');
          this.setHiddenSeekHud(xash, false);
          xash.Cmd_ExecuteString('volume 0.08');
          xash.Cmd_ExecuteString('-showscores');
          xash.Cmd_ExecuteString('hltv_closemenu');
        }
        resolve();
      };

      this.runtimeSeekCompletion = finish;
      xash.Cmd_ExecuteString('volume 0');
      xash.Cmd_ExecuteString('r_norefresh 1');
      this.setHiddenSeekHud(xash, true);
      xash.Cmd_ExecuteString('sys_timescale 1');
      xash.Cmd_ExecuteString(`set hltv_fastforward ${(Math.max(0, targetMs) / 1_000).toFixed(3)}`);
      if (restartDemo) {
        // GoldSrc cannot seek backwards inside an active demo. Restart the
        // same mounted recording, then let the patched reader fast-forward to
        // the requested preroll while rendering and audio remain paused.
        xash.Cmd_ExecuteString('playdemo hltv_replay');
        xash.Cmd_ExecuteString('hltv_closemenu');
      }
      this.runtimeSeekTimer = window.setTimeout(finish, 10_000);
    });
  }

  stop(): void {
    for (const timer of this.lifecycleTimers) window.clearTimeout(timer);
    this.lifecycleTimers.clear();
    if (this.runtimeSeekTimer) window.clearTimeout(this.runtimeSeekTimer);
    this.runtimeSeekTimer = undefined;
    this.runtimeSeekCompletion = undefined;
    const xash = this.xash;
    this.xash = undefined;
    // No presentation commands are needed immediately before destroying the
    // entire WASM runtime. Sending them into GoldSrc's command allocator while
    // shutdown begins can race command teardown and trigger a double free.
    if (xash?.running) {
      try {
        xash.quit();
      } catch (error) {
        // Emscripten may unwind a normal runtime exit by throwing its numeric
        // status sentinel (observed as Infinity after a demo reaches EOF).
        // Preserve actual JavaScript failures while treating that sentinel as
        // the successful shutdown it represents.
        if (error instanceof Error) throw error;
      }
    }
  }
}

export default new DemoEngine();
