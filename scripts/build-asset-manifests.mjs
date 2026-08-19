#!/usr/bin/env node
// Förberäknar spelresursmanifesten så att de kan serveras statiskt.
//
//   node scripts/build-asset-manifests.mjs
//
// server.mjs bygger manifestet per förfrågan genom att läsa filsystemet och
// räkna GoldSrc-CRC. På en ren nginx finns ingen som kör den koden, och
// query-parametrar påverkar inte vilken statisk fil som serveras. Därför
// genereras en fil per (karta, checksumma) som arkivet faktiskt innehåller:
//
//   public/game-assets-manifest/<karta>.<checksumma>.json
//
// Kombinationerna läses ur demo-index.json, så mängden är exakt den som
// uppspelningen kan begära — varken fler eller färre.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createGameAssetManifest } from '../game-assets-manifest.mjs';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values: options } = parseArgs({
  options: {
    catalog: { type: 'string', default: join(appDirectory, 'public', 'demo-index.json') },
    assets: { type: 'string', default: join(appDirectory, 'game-assets') },
    out: { type: 'string', default: join(appDirectory, 'public', 'game-assets-manifest') },
  },
});

const catalogPath = resolve(options.catalog);
const gameAssetsDirectory = resolve(options.assets);
const outDirectory = resolve(options.out);

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const demoAssetPaths = new Set(
  JSON.parse(await readFile(join(appDirectory, 'demo-assets.json'), 'utf8')),
);

// Samma nyckel som klienten bygger: gemener karta + åttasiffrig hex-checksumma.
const wanted = new Map();
for (const demo of catalog.demos) {
  if (!demo.map || demo.status === 'error') continue;
  const map = demo.map.toLowerCase();
  const checksum = (demo.mapChecksum ?? '00000000').toLowerCase();
  if (!/^[a-z0-9_]+$/.test(map) || !/^[0-9a-f]{8}$/.test(checksum)) continue;
  wanted.set(`${map}.${checksum}`, { map, checksum });
}

console.log(`${wanted.size} unika (karta, checksumma) i ${catalog.demoCount} demos`);
await mkdir(outDirectory, { recursive: true });

let written = 0;
let empty = 0;
for (const [key, { map, checksum }] of [...wanted].sort()) {
  const entries = createGameAssetManifest({
    gameAssetsDirectory,
    demoAssetPaths,
    requestedMap: map,
    requestedChecksum: Number.parseInt(checksum, 16) >>> 0,
  });
  // Ett tomt manifest betyder att kartan saknas i game-assets. Filen skrivs
  // ändå, så att uppspelningen får ett tydligt svar i stället för en 404.
  const hasMap = entries.some((entry) => entry.path === `game-assets/cstrike/maps/${map}.bsp`);
  if (!hasMap) empty += 1;
  await writeFile(join(outDirectory, `${key}.json`), `${JSON.stringify(entries)}\n`);
  written += 1;
}

console.log(
  `Skrev ${written} manifest till ${outDirectory}`
  + (empty ? `\nVARNING: ${empty} saknar sin BSP i ${gameAssetsDirectory}` : ''),
);
