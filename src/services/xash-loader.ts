import { type Xash3D } from 'xash3d-fwgs';
import { type Xash3DWebRTC } from '/@/services/xash-webrtc.ts';
import type { FilesWithPath } from '/@/utils/directory-open.ts';
import type { GameAssetEntry } from '/@/services/local-asset-mount.ts';
import type { ConsoleCallback, Enumify } from '/@/types.ts';
import { unzipSync } from 'fflate';
import { getZip } from '/@/utils/zip-helpers';
import SaveManager from '/@/services/save-manager.ts';
import { useXashStore } from '/@/stores/store.ts';
import { delay } from '/@/utils/helpers.ts';
import { DEFAULT_GAME_DIR } from '/@/services/save-manager.ts';

// Xash WASM Imports
// @ts-ignore -- vite url imports
import filesystemURL from 'xash3d-fwgs/filesystem_stdio.wasm?url';
// Locally rebuilt from the same upstream commit/toolchain as the npm wrapper;
// see engine-patches/README.md for source and reproducible protocol 46 patch.
// @ts-ignore -- vite url imports
import xashURL from '../../engine-patches/xash-protocol46.wasm?url';
// @ts-ignore -- vite url imports
import menuURL from 'xash3d-fwgs/libmenu.wasm?url';
// @ts-ignore -- vite url imports
import webgl2URL from 'xash3d-fwgs/libref_webgl2.wasm?url';
// @ts-ignore -- vite url imports
import extrasURL from 'xash3d-fwgs/extras.pk3?url';
// @ts-ignore -- vite url imports
import HLClientURL from 'hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm?url';
// @ts-ignore -- vite url imports
import HLServerURL from 'hlsdk-portable/dlls/hl_emscripten_wasm32.wasm?url';
// @ts-ignore -- vite url imports
import CSMenuURL from 'cs16-client/cl_dll/menu_emscripten_wasm32.wasm?url';
// Locally rebuilt from CS16Client with independent legacy-compatibility and
// compact scoreboard presentation flags.
// @ts-ignore -- vite url imports
import CSClientURL from '../../engine-patches/cs16-client-hltv-v24.wasm?url';
// @ts-ignore -- vite url imports
import CSServerURL from 'cs16-client/dlls/cs_emscripten_wasm32.wasm?url';

const XASH_BASE_DIR = '/rodir/';

// The wrapper already loads filesystem, menu, client, server and renderer.
// Repeating them here makes Emscripten try the same side modules again after
// Xash has changed cwd to /rodir, producing scary but non-fatal dlopen errors.
// The wrapper preloads the selected server module under Half-Life's default
// DLL name. Counter-Strike later asks Emscripten for its real name, which
// otherwise triggers a synchronous second fetch and a blocking Xash warning.
const DYNAMIC_LIBRARIES = [
  // Demo assets live under /rodir, so libc resolves the engine's first
  // filesystem dlopen against that cwd. Preload the absolute alias as well as
  // the wrapper's normal basename to keep startup fully asynchronous.
  '/rodir/filesystem_stdio.wasm',
  'dlls/cs_emscripten_wasm32.wasm',
];

export interface GameLoaderOptions {
  canvas: HTMLCanvasElement;
  selectedGame: Enumify<typeof GAME_SETTINGS>;
  launchArgs: string[];
  preserveDrawingBuffer?: boolean;
  onLog?: (message: string, isError: boolean) => void;
}

export interface LoadProgress {
  current: number;
  total: number;
}

export interface StartGameOptions extends GameLoaderOptions {
  onStartLoading?: () => void;
  onEndLoading?: () => void;
  onProgress?: (progress: LoadProgress) => void;
  setCanvasLoading?: () => void;
}

export interface PostLoadOptions {
  xash: Xash3D;
  selectedGame: Enumify<typeof GAME_SETTINGS>;
  customGameArg: string;
  enableCheats?: boolean;
}

export interface FullStartOptions {
  canvas: HTMLCanvasElement;
  selectedGame: Enumify<typeof GAME_SETTINGS>;
  selectedZip?: string;
  selectedLocalFolder?: string;
  launchOptions?: string;
  fullScreen?: boolean;
  enableConsole?: boolean;
  enableCheats?: boolean;
  onStartLoading?: () => void;
  onEndLoading?: () => void;
  onProgress?: (progress: LoadProgress) => void;
  setCanvasLoading?: () => void;
  setMaxLoadingAmount?: (amount: number) => void;
}

// Constants

const XASH_LIBS = {
  filesystem: filesystemURL,
  xash: xashURL,
  menu: menuURL,
};

// Perform these callbacks when the matching command is emitted from the xash console
export const BASE_GAME_SETTINGS = {
  consoleCallbacks: [
    {
      id: 'onExit',
      match: 'exit',
      callback: () => XashLoader.onExit(),
    },
    {
      id: 'onQuit',
      match: 'quit',
      callback: () => XashLoader.onExit(),
    },
    {
      id: 'onShutdown',
      match: 'CL_Shutdown()',
      callback: () => XashLoader.onExit(),
    },
    {
      id: 'onTest',
      match: 'test',
      callback: () => console.log('test'),
    },
    {
      id: 'onSave',
      match: 'save',
      callback: () => SaveManager.onSave(), // We set what this does after xash launches.
    },
  ] as ConsoleCallback[],
};

export const GAME_SETTINGS = {
  HL: {
    name: 'Half-Life',
    launchArgs: [],
    publicDir: 'hl/',
    libraries: {
      ...XASH_LIBS,
      client: HLClientURL,
      server: HLServerURL,
    },
    ...BASE_GAME_SETTINGS,
  },
  CS: {
    name: 'Counter-Strike',
    launchArgs: ['-game', 'cstrike', '+_vgui_menus', '0'],
    publicDir: 'cs/',
    libraries: {
      ...XASH_LIBS,
      menu: CSMenuURL,
      client: CSClientURL,
      server: CSServerURL,
    },
    ...BASE_GAME_SETTINGS,
  },
} as const;

export const DEFAULT_GAME = 'valve';
const DEFAULT_ARGS = ['+hud_scale', '2.5', '+volume', '0.05', '-ref', 'webgl2'];
const WINDOW_ARGS = ['-windowed', ...DEFAULT_ARGS];
const FULLSCREEN_ARGS = ['-fullscreen', ...DEFAULT_ARGS];
const CONSOLE_ARG = '-console';

const onBeforeUnload = (event: Event) => {
  event.preventDefault();
  event.returnValue = false;
};

class XashLoader {
  private async _getXashInstance(): Promise<
    typeof Xash3D | typeof Xash3DWebRTC
  > {
    const store = useXashStore();
    if (store.multiplayerIP && /\d/.test(store.multiplayerIP)) {
      const { Xash3DWebRTC } = await import('../services/xash-webrtc.ts');
      return Xash3DWebRTC;
    } else {
      const { Xash3D } = await import('xash3d-fwgs');
      return Xash3D;
    }
  }

  public async initXash(options: GameLoaderOptions): Promise<Xash3D> {
    const Xash3D = await this._getXashInstance();

    if (!Xash3D) {
      throw new Error('No Xash found.');
    }

    const store = useXashStore();

    if (options.preserveDrawingBuffer) {
      const canvas = options.canvas as HTMLCanvasElement & { replayLabCaptureReady?: boolean };
      if (!canvas.replayLabCaptureReady) {
        const getContext = canvas.getContext.bind(canvas) as (
          contextId: string,
          contextAttributes?: Record<string, unknown>,
        ) => RenderingContext | null;
        canvas.getContext = ((
          contextId: string,
          contextAttributes?: Record<string, unknown>,
        ) => getContext(
          contextId,
          contextId === 'webgl' || contextId === 'webgl2'
            ? { ...contextAttributes, preserveDrawingBuffer: true }
            : contextAttributes,
        )) as typeof canvas.getContext;
        canvas.replayLabCaptureReady = true;
      }
    }

    const xash = new Xash3D({
      multiplayerIP: store.multiplayerIP,
      onError: XashLoader.removeReloadListener,
      module: {
        arguments: options.launchArgs,
        print: (message: string) => options.onLog?.(message, false),
        printErr: (message: string) => options.onLog?.(message, true),
        locateFile: (path: string) => {
          // dlopen resolves libraries relative to the virtual cwd after startup
          // (for example /rodir/filesystem_stdio.wasm). Match both those paths
          // and Emscripten's initial bare filenames.
          const filename = path.split('/').pop() || path;
          switch (filename) {
            case 'xash.wasm':
              return xashURL;
            case 'filesystem_stdio.wasm':
              return filesystemURL;
            case 'menu_emscripten_wasm32.wasm':
              return options.selectedGame.libraries.menu;
            case 'hl_emscripten_wasm32.wasm':
              return options.selectedGame.libraries.server;
            // bshift fix
            case 'bshift_emscripten_wasm32.wasm':
              return HLServerURL;
            //opfor fix
            case 'opfor_emscripten_wasm32.wasm':
              return HLServerURL;
            case 'client_emscripten_wasm32.wasm':
              return options.selectedGame.libraries.client;
            // cs
            case 'cs_emscripten_wasm32.wasm':
              return CSServerURL;
            case 'mp_emscripten_wasm32.wasm':
              return CSServerURL;
            case 'libref_webgl2.wasm':
            case 'libref_webgl.wasm':
              return webgl2URL;
            // Check this (not supported yet)
            case 'libvgui_support.wasm':
              return menuURL;
          }
          return path;
        },
      },
      canvas: options.canvas,
      libraries: options.selectedGame.libraries,
      dynamicLibraries: DYNAMIC_LIBRARIES,
    });

    await xash.init();
    return xash;
  }

  public async processFiles(
    filesArray: FilesWithPath[],
    xash: Xash3D,
    onProgress?: (progress: LoadProgress) => void,
  ): Promise<void> {
    if (!filesArray?.length) {
      console.warn('No files selected to start Xash.');
      return;
    }

    xash.em.FS.mkdirTree(XASH_BASE_DIR);

    // Determine the root directory from the selected files so we can strip it from all paths.
    // This ensures the contents of the selected folder are placed directly in XASH_BASE_DIR.
    // e.g., if a file path is "Half-Life/valve/config.cfg", we want to remove "Half-Life/".
    const firstPath = filesArray[0].path;
    const rootDirEndIndex = firstPath.indexOf('/');
    const pathPrefixToRemove =
      rootDirEndIndex !== -1 ? firstPath.substring(0, rootDirEndIndex + 1) : '';

    const allDirs = new Set<string>();

    // Collect directories first
    for (const entry of filesArray) {
      const relativePath = entry.path.substring(pathPrefixToRemove.length);
      if (!relativePath) continue;

      const path = XASH_BASE_DIR + relativePath;
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        allDirs.add(dir);
      }
    }

    // Create directories
    for (const dir of allDirs) {
      xash.em.FS.mkdirTree(dir);
    }

    // Write files
    let current = 0;
    for (const entry of filesArray) {
      const relativePath = entry.path.substring(pathPrefixToRemove.length);
      if (!relativePath) {
        current++;
        onProgress?.({ current, total: filesArray.length });
        continue;
      }

      const path = XASH_BASE_DIR + relativePath;
      const data = await entry.file.arrayBuffer();
      xash.em.FS.writeFile(path, new Uint8Array(data));

      current++;
      onProgress?.({ current, total: filesArray.length });
    }

    xash.em.FS.chdir(XASH_BASE_DIR);
  }

  /** Mounts either browser-selected Files or files exposed by the private
   * local asset server into Emscripten's in-memory filesystem. */
  public async processAssetEntries(
    entries: GameAssetEntry[],
    xash: Xash3D,
    onProgress?: (progress: LoadProgress) => void,
  ): Promise<void> {
    if (!entries.length) throw new Error('No Counter-Strike assets were found.');

    xash.em.FS.mkdirTree(XASH_BASE_DIR);
    const firstPath = entries[0].path.replace(/\\/g, '/');
    const rootEnd = firstPath.indexOf('/');
    const prefix = rootEnd === -1 ? '' : firstPath.slice(0, rootEnd + 1);
    const jobs = entries.map((entry) => ({
      entry,
      relativePath: entry.path.replace(/\\/g, '/').slice(prefix.length),
    })).filter((job) =>
      job.relativePath &&
      !job.relativePath.includes('../') &&
      ('file' in job.entry ? job.entry.file.size > 0 : job.entry.size > 0),
    );

    for (const { relativePath } of jobs) {
      const path = XASH_BASE_DIR + relativePath;
      const slash = path.lastIndexOf('/');
      if (slash > 0) xash.em.FS.mkdirTree(path.slice(0, slash));
    }

    let current = 0;
    const mount = async ({ entry, relativePath }: (typeof jobs)[number]) => {
      const data = 'file' in entry
        ? await entry.file.arrayBuffer()
        : await fetch(entry.url).then((response) => {
            if (!response.ok) throw new Error(`Could not read ${relativePath}.`);
            return response.arrayBuffer();
          });
      xash.em.FS.writeFile(XASH_BASE_DIR + relativePath, new Uint8Array(data));
      current += 1;
      onProgress?.({ current, total: jobs.length });
    };

    // A small pool avoids hundreds of serial HTTP round-trips without spiking
    // WebAssembly memory with every asset at once.
    const pending = [...jobs];
    await Promise.all(Array.from({ length: Math.min(12, pending.length) }, async () => {
      while (pending.length) {
        const job = pending.shift();
        if (job) await mount(job);
      }
    }));
    xash.em.FS.chdir(XASH_BASE_DIR);
  }

  public async processZip(zipBuffer: ArrayBuffer, xash: Xash3D): Promise<void> {
    const zipData = new Uint8Array(zipBuffer);
    const files = unzipSync(zipData);

    xash.em.FS.mkdirTree(XASH_BASE_DIR);

    for (const [filename, content] of Object.entries(files)) {
      const path = XASH_BASE_DIR + filename;
      if (filename.endsWith('/')) {
        xash.em.FS.mkdirTree(path);
      } else {
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
          xash.em.FS.mkdirTree(dir);
        }
        xash.em.FS.writeFile(path, content);
      }
    }

    xash.em.FS.chdir(XASH_BASE_DIR);
  }

  public async startWithFiles(
    options: GameLoaderOptions,
    filesArray: FilesWithPath[],
    onProgress?: (progress: LoadProgress) => void,
  ): Promise<Xash3D> {
    const xash = await this.initXash(options);

    // Load files and extras in parallel
    const [, extrasBuffer] = await Promise.all([
      this.processFiles(filesArray, xash, onProgress),
      this.fetchExtras(),
    ]);

    await this.writeExtras(xash, extrasBuffer);
    xash.main();
    return xash;
  }

  public async startWithZip(
    options: GameLoaderOptions,
    zipBuffer: ArrayBuffer,
  ): Promise<Xash3D> {
    const xash = await this.initXash(options);

    // Load zip and extras in parallel
    const [, extrasBuffer] = await Promise.all([
      this.processZip(zipBuffer, xash),
      this.fetchExtras(),
    ]);

    await this.writeExtras(xash, extrasBuffer);
    xash.main();
    return xash;
  }

  public async downloadZip(
    selectedZip: string,
    publicDir: string,
    onProgress?: (progress: number) => void,
  ): Promise<ArrayBuffer | undefined> {
    if (!selectedZip) return;
    return await getZip(selectedZip, publicDir, onProgress!);
  }

  public async fetchExtras(): Promise<ArrayBuffer> {
    const response = await fetch(extrasURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch extras.pk3: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  public async writeExtras(
    xash: Xash3D,
    extrasBuffer: ArrayBuffer,
  ): Promise<void> {
    const extrasPath = XASH_BASE_DIR + 'extras.pk3';
    xash.em.FS.writeFile(extrasPath, new Uint8Array(extrasBuffer));
  }

  public async startGameWithFiles(
    options: StartGameOptions,
    filesArray: FilesWithPath[],
  ): Promise<Xash3D> {
    if (!options.canvas) {
      throw new Error('Canvas is not available');
    }

    options.setCanvasLoading?.();
    options.onStartLoading?.();

    const xash = await this.startWithFiles(
      {
        canvas: options.canvas,
        selectedGame: options.selectedGame,
        launchArgs: options.launchArgs,
      },
      filesArray,
      options.onProgress,
    );

    options.onEndLoading?.();
    return xash;
  }

  public async startGameWithZip(
    options: StartGameOptions,
    zip?: ArrayBuffer,
    selectedZip?: string,
    publicDir?: string,
    onDownloadProgress?: (progress: number) => void,
  ): Promise<Xash3D> {
    if (!options.canvas) {
      throw new Error('Canvas is not available');
    }

    options.onStartLoading?.();

    let zipBuffer = zip;

    // Download zip and fetch extras in parallel if needed
    if (!zipBuffer && selectedZip && publicDir) {
      const [downloadedZip, extrasBuffer] = await Promise.all([
        this.downloadZip(selectedZip, publicDir, onDownloadProgress),
        this.fetchExtras(),
      ]);
      zipBuffer = downloadedZip;

      if (!zipBuffer) {
        throw new Error('Failed to download or provide zip file');
      }

      // Init xash and process zip, then write extras
      const xash = await this.initXash({
        canvas: options.canvas,
        selectedGame: options.selectedGame,
        launchArgs: options.launchArgs,
      });

      await this.processZip(zipBuffer, xash);
      await this.writeExtras(xash, extrasBuffer);
      xash.main();

      options.onEndLoading?.();
      return xash;
    }

    if (!zipBuffer) {
      throw new Error('Failed to download or provide zip file');
    }

    const xash = await this.startWithZip(
      {
        canvas: options.canvas,
        selectedGame: options.selectedGame,
        launchArgs: options.launchArgs,
      },
      zipBuffer,
    );

    options.onEndLoading?.();
    return xash;
  }

  public async initConsoleCallbacks(
    xash: Xash3D,
    callbacks: Array<{ match: string; callback: () => void }>,
  ): Promise<void> {
    await Promise.all(
      callbacks.map(async (callback) => {
        const run = true;
        while (run) {
          try {
            await xash.waitLog(callback.match, undefined, 1000);
            callback.callback();
          } catch (_error) {
            // noop
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }),
    );
  }

  private _buildLaunchArgs(options: FullStartOptions): string[] {
    const baseArgs = options.fullScreen ? FULLSCREEN_ARGS : WINDOW_ARGS;
    const args = [
      ...options.selectedGame.launchArgs,
      ...baseArgs,
      ...(options.launchOptions?.split(' ').filter(Boolean) || []),
    ];

    if (options.enableConsole) {
      args.push(CONSOLE_ARG);
    }

    if (options.selectedLocalFolder) {
      args.push('-game');
      args.push(options.selectedLocalFolder);
    }

    return args;
  }

  public async startGameFiles(
    filesArray: FilesWithPath[],
    options: FullStartOptions,
  ): Promise<Xash3D> {
    if (!options.canvas) {
      throw new Error('Canvas is not available');
    }

    try {
      const launchArgs = this._buildLaunchArgs(options);

      const xash = await this.startGameWithFiles(
        {
          canvas: options.canvas,
          selectedGame: options.selectedGame,
          launchArgs,
          setCanvasLoading: options.setCanvasLoading,
          onStartLoading: () => {
            options.onStartLoading?.();
            options.setMaxLoadingAmount?.(filesArray.length);
          },
          onEndLoading: options.onEndLoading,
          onProgress: options.onProgress,
        },
        filesArray,
      );

      return xash;
    } catch (error) {
      console.error('Failed to start Xash with files:', error);
      options.onEndLoading?.();
      throw error;
    }
  }

  public async startGameZip(
    zip: ArrayBuffer | undefined,
    options: FullStartOptions,
  ): Promise<Xash3D> {
    if (!options.canvas) {
      throw new Error('Canvas is not available');
    }

    try {
      const launchArgs = this._buildLaunchArgs(options);

      const xash = await this.startGameWithZip(
        {
          canvas: options.canvas,
          selectedGame: options.selectedGame,
          launchArgs,
          onStartLoading: options.onStartLoading,
          onEndLoading: options.onEndLoading,
        },
        zip,
        options.selectedZip,
        options.selectedGame.publicDir,
        // @ts-ignore -- ignore type in this case.
        options.onProgress!,
      );

      return xash;
    } catch (error) {
      console.error('Failed to start Xash with zip:', error);
      options.onEndLoading?.();
      throw error;
    }
  }

  public async onAfterLoad(options: PostLoadOptions): Promise<void> {
    window.addEventListener('beforeunload', onBeforeUnload);

    await delay(500); // Wait for xash to fully load first

    SaveManager.init(options.xash);

    // Determine the game ID for save transfer
    const gameId =
      options.customGameArg === DEFAULT_GAME_DIR
        ? options.selectedGame.name
        : options.customGameArg;

    await SaveManager.transferSavesToGame(gameId);

    if (options.enableCheats) {
      options.xash.Cmd_ExecuteString('sv_cheats 1');
    }
  }

  public static removeReloadListener() {
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  public static onExit() {
    this.removeReloadListener();
    window.location.reload();
  }
}

export default new XashLoader();
