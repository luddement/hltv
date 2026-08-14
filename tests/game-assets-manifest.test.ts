import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameAssetManifest } from '../game-assets-manifest.mjs';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameAssetsDirectory = resolve(appDirectory, 'game-assets');

describe('installed map manifest', () => {
  it.each(['de_nuke', 'de_cbble'])('uses installed %s when an old demo has CRC zero', (map) => {
    const manifest = createGameAssetManifest({
      gameAssetsDirectory,
      demoAssetPaths: new Set<string>(),
      requestedMap: map,
      requestedChecksum: 0,
    });

    expect(manifest.some((entry) => entry.path === `game-assets/cstrike/maps/${map}.bsp`))
      .toBe(true);
    expect(manifest.some((entry) => entry.path === 'game-assets/cstrike/maps/de_train.bsp'))
      .toBe(true);
  });

  it('mounts the exact CS 1.5 Nuke revision and its historical texture wad', () => {
    const manifest = createGameAssetManifest({
      gameAssetsDirectory,
      demoAssetPaths: new Set<string>(),
      requestedMap: 'de_nuke',
      requestedChecksum: 0x07a0553a,
    });

    expect(manifest.find((entry) => entry.path === 'game-assets/cstrike/maps/de_nuke.bsp')?.url)
      .toContain('/map-library/07a0553a/');
    expect(manifest.find((entry) => entry.path === 'game-assets/cstrike/jos.wad')?.url)
      .toContain('/map-library/07a0553a/');
  });
});
