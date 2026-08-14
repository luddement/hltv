import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { goldSrcMapChecksumFile } from './goldsrc-map-crc.mjs';

const runtimeAsset = (relativePath, demoAssetPaths) => {
  const path = relativePath.toLowerCase().replace(/\\/g, '/');
  return (
    demoAssetPaths.has(path) ||
    // A GoldSrc signon resource list can refer to the map from the previous
    // level as well as the active one. Mount the official installed BSP set so
    // that such a harmless reference cannot abort demo playback. The requested
    // map is overwritten below with its CRC-matched historical revision.
    (path.startsWith('cstrike/maps/') && path.endsWith('.bsp')) ||
    path.startsWith('valve/sprites/') ||
    path === 'valve/resource/valve_english.txt' ||
    // Maps can precache arbitrary stock Half-Life models during signon (for
    // example Dust2 requests valve/models/mil_crategibs.mdl). Missing even one
    // referenced model aborts the demo before the first frame.
    (path.startsWith('valve/models/') && path.endsWith('.mdl')) ||
    path.startsWith('cstrike/sprites/') ||
    path.startsWith('cstrike/events/') ||
    path.startsWith('cstrike/models/') ||
    path.startsWith('cstrike/sound/') ||
    path === 'cstrike/halflife.wad' ||
    path === 'valve/gfx/vgui/timer.tga'
  );
};

const walkFiles = (directory, visit) => {
  if (!existsSync(directory)) return;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, item.name);
    if (item.isDirectory()) walkFiles(absolutePath, visit);
    else visit(absolutePath);
  }
};

const resolveMapAsset = (gameAssetsDirectory, requestedMap, requestedChecksum) => {
  const filename = `${requestedMap}.bsp`;
  const candidates = [];
  const installed = resolve(gameAssetsDirectory, 'cstrike', 'maps', filename);
  if (existsSync(installed)) candidates.push(installed);
  walkFiles(resolve(gameAssetsDirectory, 'map-library'), (filePath) => {
    if (basename(filePath).toLowerCase() === filename) candidates.push(filePath);
  });

  // Several older GoldSrc demos store 00000000 instead of a map CRC.  Zero
  // means that the recording cannot identify a specific BSP revision; it is
  // not a checksum that any real map file is expected to match.
  if (requestedChecksum === undefined || requestedChecksum === 0) return candidates[0];
  return candidates.find((filePath) => {
    try {
      return goldSrcMapChecksumFile(filePath) === requestedChecksum;
    } catch {
      return false;
    }
  });
};

const addEntry = (entries, gameAssetsDirectory, mountedPath, absolutePath) => {
  if (!existsSync(absolutePath) || statSync(absolutePath).size <= 0) return;
  const actualPath = relative(gameAssetsDirectory, absolutePath).replace(/\\/g, '/');
  entries.set(mountedPath.toLowerCase(), {
    path: `game-assets/${mountedPath}`,
    url: `/game-assets/${actualPath.split('/').map(encodeURIComponent).join('/')}`,
    size: statSync(absolutePath).size,
  });
};

const addMapCompanions = (entries, gameAssetsDirectory, requestedMap, mapPath) => {
  const normalized = mapPath.replace(/\\/g, '/');
  const marker = '/cstrike/maps/';
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex < 0) return;
  const cstrikeDirectory = normalized.slice(0, markerIndex + '/cstrike'.length);
  for (const [mountedPath, sourcePath] of [
    [`cstrike/maps/${requestedMap}.txt`, `${cstrikeDirectory}/maps/${requestedMap}.txt`],
    [`cstrike/overviews/${requestedMap}.txt`, `${cstrikeDirectory}/overviews/${requestedMap}.txt`],
    [`cstrike/overviews/${requestedMap}.bmp`, `${cstrikeDirectory}/overviews/${requestedMap}.bmp`],
  ]) {
    addEntry(entries, gameAssetsDirectory, mountedPath, sourcePath);
  }
};

const readBspEntities = (mapPath) => {
  const bytes = readFileSync(mapPath);
  if (bytes.byteLength < 12) return '';
  const offset = bytes.readInt32LE(4);
  const length = bytes.readInt32LE(8);
  if (offset < 0 || length < 0 || offset + length > bytes.byteLength) return '';
  return bytes.subarray(offset, offset + length).toString('latin1');
};

const addMapSkybox = (entries, gameAssetsDirectory, mapPath) => {
  const skyName = readBspEntities(mapPath).match(/"skyname"\s+"([^"]+)"/i)?.[1];
  if (!skyName || !/^[a-z0-9_-]+$/i.test(skyName)) return;
  const escaped = skyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const facePattern = new RegExp(`^${escaped}(?:bk|dn|ft|lf|rt|up)\\.(?:tga|bmp|pcx)$`, 'i');

  for (const root of ['cstrike', 'valve']) {
    const directory = resolve(gameAssetsDirectory, root, 'gfx', 'env');
    if (!existsSync(directory)) continue;
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isFile() && facePattern.test(item.name)) {
        addEntry(
          entries,
          gameAssetsDirectory,
          `${root}/gfx/env/${item.name}`,
          resolve(directory, item.name),
        );
      }
    }
  }
};

const addMapWads = (entries, gameAssetsDirectory, mapPath) => {
  const normalized = mapPath.replace(/\\/g, '/');
  const marker = '/cstrike/maps/';
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex < 0) return;
  const cstrikeDirectory = normalized.slice(0, markerIndex + '/cstrike'.length);
  const wadList = readBspEntities(mapPath).match(/"wad"\s+"([^"]+)"/i)?.[1] ?? '';
  for (const reference of wadList.split(';')) {
    const filename = reference.replace(/\\/g, '/').split('/').pop();
    if (!filename || !/^[a-z0-9_.-]+\.wad$/i.test(filename)) continue;
    const historical = resolve(cstrikeDirectory, filename);
    const installed = resolve(gameAssetsDirectory, 'cstrike', filename);
    const source = existsSync(historical) ? historical : installed;
    addEntry(entries, gameAssetsDirectory, `cstrike/${filename}`, source);
  }
};

export const createGameAssetManifest = ({
  gameAssetsDirectory,
  demoAssetPaths,
  requestedMap = 'de_train',
  requestedChecksum,
}) => {
  if (!existsSync(gameAssetsDirectory)) return [];
  const entries = new Map();

  const walkRuntimeAssets = (directory, prefix) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = `${prefix}/${item.name}`;
      const absolutePath = resolve(directory, item.name);
      if (item.isDirectory()) walkRuntimeAssets(absolutePath, relativePath);
      else if (runtimeAsset(relativePath, demoAssetPaths)) {
        addEntry(entries, gameAssetsDirectory, relativePath, absolutePath);
      }
    }
  };

  for (const root of ['valve', 'cstrike']) {
    const directory = resolve(gameAssetsDirectory, root);
    if (existsSync(directory)) walkRuntimeAssets(directory, root);
  }

  const mapPath = resolveMapAsset(gameAssetsDirectory, requestedMap, requestedChecksum);
  if (mapPath) {
    addEntry(entries, gameAssetsDirectory, `cstrike/maps/${requestedMap}.bsp`, mapPath);
    addMapCompanions(entries, gameAssetsDirectory, requestedMap, mapPath);
    addMapSkybox(entries, gameAssetsDirectory, mapPath);
    addMapWads(entries, gameAssetsDirectory, mapPath);
  }
  return Array.from(entries.values());
};
