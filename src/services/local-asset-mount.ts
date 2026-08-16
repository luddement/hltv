import type { DemoSource } from '/@/demo/goldsrc-demo';
import type { FilesWithPath } from '/@/utils/directory-open';

export const LOCAL_ASSET_ROOT = '/__hltv_assets__';

type MountedSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

type MountedEntry = {
  path: string;
  source: MountedSource;
  priority: number;
};

export type GameAssetEntry =
  | FilesWithPath
  | { path: string; url: string; size: number };

const normalize = (value: string): string =>
  value.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

const gameRelativePath = (path: string): { path: string; priority: number } | null => {
  const normalized = normalize(path);
  for (const [folder, priority] of [
    ['cstrike', 2],
    ['valve', 1],
  ] as const) {
    const marker = `/${folder}/`;
    const index = `/${normalized}`.indexOf(marker);
    if (index >= 0) {
      return {
        path: `/${normalized}`.slice(index + marker.length),
        priority,
      };
    }
  }
  return null;
};

const workerController = async (): Promise<ServiceWorker> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support Service Workers.');
  }

  await navigator.serviceWorker.register('/local-assets-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Could not activate the local file bridge. Reload the page.')),
      5000,
    );
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timeout);
        if (navigator.serviceWorker.controller) resolve(navigator.serviceWorker.controller);
      },
      { once: true },
    );
  });
};

const addEntry = (entries: Map<string, MountedEntry>, entry: MountedEntry) => {
  const key = normalize(entry.path);
  const previous = entries.get(key);
  if (!previous || entry.priority >= previous.priority) entries.set(key, entry);
};

export async function mountLocalAssets(
  gameFiles: GameAssetEntry[],
  demoSource: DemoSource,
): Promise<number> {
  const entries = new Map<string, MountedEntry>();

  addEntry(entries, {
    path: 'replays/hltv_replay.dem',
    priority: 10,
    source:
      demoSource.kind === 'file'
        ? { kind: 'file', file: demoSource.file }
        : { kind: 'url', url: demoSource.url },
  });

  for (const item of gameFiles) {
    const relative = gameRelativePath(item.path);
    if (!relative) continue;

    const path = normalize(relative.path);
    const source: MountedSource = 'file' in item
      ? { kind: 'file', file: item.file }
      : { kind: 'url', url: item.url };
    const basename = path.split('/').pop() ?? path;

    if (path.endsWith('.wad')) {
      addEntry(entries, { path: `wads/${basename}`, source, priority: relative.priority });
    }
    if (path.startsWith('maps/') && path.endsWith('.bsp')) {
      addEntry(entries, { path: `maps/${basename}`, source, priority: relative.priority });
    }
    if (path.startsWith('models/') && path.endsWith('.mdl')) {
      addEntry(entries, { path, source, priority: relative.priority });
    }
    if (path.startsWith('gfx/env/') && path.endsWith('.tga')) {
      addEntry(entries, { path: `skies/${basename}`, source, priority: relative.priority });
    }
    if (path.startsWith('sound/')) {
      addEntry(entries, {
        path: `sounds/${path.slice('sound/'.length)}`,
        source,
        priority: relative.priority,
      });
    }
    if (path.startsWith('sprites/')) {
      addEntry(entries, { path, source, priority: relative.priority });
    }
  }

  const controller = await workerController();
  const channel = new MessageChannel();
  const response = new Promise<number>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('The local file bridge did not respond.')),
      10000,
    );
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data.count as number);
    };
  });

  controller.postMessage(
    {
      type: 'mount-assets',
      entries: Array.from(entries, ([path, entry]) => ({ path, source: entry.source })),
    },
    [channel.port2],
  );

  return response;
}
