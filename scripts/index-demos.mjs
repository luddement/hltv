#!/usr/bin/env node
// Bygger en JSON-databas över alla demos.
//
//   node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse
//   node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs rescore
//
// Två artefakter, med avsikt åtskilda:
//
//   demo-index.json      Katalogen. En rad per demo, liten nog att följa med
//                        bygget. Ligger i public/ och hamnar därför i dist/.
//   demo-analysis/       Hela analysindexet per demo: spelare, ronder, events,
//                        observerade skott. Stort, serveras vid behov.
//
// 'parse' läser demofilerna och är det dyra steget. 'rescore' rör aldrig en
// demofil: den läser analysindexen, kör om poängsättningen med nuvarande regler
// i highlight-analyzer.ts och skriver om fragpoäng, moments och rondpoäng. Ändra
// reglerna, kör 'rescore', och hela databasen är uppdaterad på nytt.

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(appDirectory, '..');

const YEAR_PATTERN = /^\d{4}$/;
const STAMP_PATTERN = /-(\d{10})-/;
const EARLIEST_YEAR = 1998;

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: 'string', default: join(workspaceRoot, 'demos') },
    catalog: { type: 'string', default: join(appDirectory, 'public', 'demo-index.json') },
    analysis: { type: 'string', default: join(workspaceRoot, 'demo-analysis') },
    year: { type: 'string', multiple: true },
    limit: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

const command = positionals[0] ?? 'parse';
const root = resolve(options.root);
const catalogPath = resolve(options.catalog);
const analysisRoot = resolve(options.analysis);
const selectedYears = new Set(options.year ?? []);
const limit = options.limit ? Number(options.limit) : undefined;

if (!['parse', 'rescore'].includes(command)) {
  throw new Error(`Okänt kommando: ${command}. Använd 'parse' eller 'rescore'.`);
}
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error('--limit måste vara ett heltal som är minst 1');
}

/** Läser året ur demons datumstämpel -ÅÅMMDDTTMM-, annars ur årsmappen. */
const readRecording = (filename, parentName) => {
  const match = STAMP_PATTERN.exec(filename);
  if (match) {
    const [, stamp] = match;
    const year = 2000 + Number(stamp.slice(0, 2));
    const recorded = new Date(Date.UTC(
      year,
      Number(stamp.slice(2, 4)) - 1,
      Number(stamp.slice(4, 6)),
      Number(stamp.slice(6, 8)),
      Number(stamp.slice(8, 10)),
    ));
    if (year >= EARLIEST_YEAR
      && year <= new Date().getUTCFullYear()
      && !Number.isNaN(recorded.getTime())
      && recorded.getUTCMonth() === Number(stamp.slice(2, 4)) - 1) {
      return { year, recordedAt: recorded.toISOString() };
    }
  }
  if (YEAR_PATTERN.test(parentName)) return { year: Number(parentName), recordedAt: null };
  return { year: null, recordedAt: null };
};

const collectDemos = async () => {
  const found = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.dem')) found.push(path);
    }
  };
  await walk(root);
  found.sort();
  const filtered = selectedYears.size
    ? found.filter((path) => selectedYears.has(String(readRecording(basename(path), basename(dirname(path))).year)))
    : found;
  return limit === undefined ? filtered : filtered.slice(0, limit);
};

const analysisPathFor = (demoPath) => {
  const relativePath = relative(root, demoPath);
  return join(analysisRoot, `${relativePath}.json`);
};

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
};

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
};

/** Plockar ut det katalogen visar. Allt tungt stannar i analysfilen. */
const catalogEntry = (record, teamsOf) => {
  const { index } = record;
  if (!index) {
    return {
      path: record.relativePath,
      filename: record.filename,
      year: record.year,
      recordedAt: record.recordedAt,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      status: 'error',
      error: record.error,
    };
  }
  const names = new Set();
  for (const player of index.players) {
    for (const session of player.sessions) {
      for (const entry of session.names) if (entry.value) names.add(entry.value);
    }
  }
  const scores = index.fragRatings.map((rating) => rating.score);
  const roundScores = index.roundRatings.map((rating) => rating.score);
  const momentScores = index.moments.map((moment) => moment.rating.score);
  return {
    path: record.relativePath,
    filename: record.filename,
    year: record.year,
    recordedAt: record.recordedAt,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    status: index.diagnostics.status,
    map: index.demo.mapName,
    mapChecksum: (index.demo.mapChecksum >>> 0).toString(16).padStart(8, '0'),
    networkProtocol: index.demo.networkProtocol,
    perspective: index.demo.perspective.kind,
    durationSeconds: Math.round(index.demo.durationMs / 1000),
    roundCount: index.diagnostics.roundCount,
    deathCount: index.diagnostics.deathEvents,
    fragCount: index.fragRatings.length,
    topFragScore: scores.length ? Math.max(...scores) : null,
    topRoundScore: roundScores.length ? Math.max(...roundScores) : null,
    topMomentScore: momentScores.length ? Math.max(...momentScores) : null,
    momentCount: index.moments.length,
    teams: teamsOf(index.players),
    players: [...names].sort(),
    analyzerVersion: index.analyzerVersion,
  };
};

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
};

const main = async () => {
  const { buildLogicalTeamIndex } = await import('/@/analysis/team-identity');
  const teamsOf = (players) => buildLogicalTeamIndex(players).teams
    .map((team) => team.name)
    .filter((name) => typeof name === 'string' && name.length > 0);

  const demos = await collectDemos();
  console.log(`${command === 'parse' ? 'PARSNING' : 'OMSCORING'}: ${demos.length} demo(s) under ${root}`);
  if (!demos.length) return 0;

  const inspect = command === 'parse' ? (await import('/@/demo/goldsrc-demo')).inspectDemoFile : undefined;
  const analyze = command === 'parse' ? (await import('/@/analysis/demo-analyzer')).analyzeDemo : undefined;
  const { ANALYZER_VERSION } = await import('/@/analysis/demo-analyzer');
  const rescoreWith = command === 'rescore'
    ? (await import('/@/analysis/highlight-analyzer')).buildHighlightAnalysis
    : undefined;

  const catalog = [];
  const counts = { done: 0, skipped: 0, failed: 0, knownErrors: 0 };
  const startedAt = Date.now();

  for (const [position, demoPath] of demos.entries()) {
    const filename = basename(demoPath);
    const { year, recordedAt } = readRecording(filename, basename(dirname(demoPath)));
    const { size } = await stat(demoPath);
    const targetPath = analysisPathFor(demoPath);
    const record = {
      relativePath: relative(root, demoPath),
      filename,
      year,
      recordedAt,
      sizeBytes: size,
      sha256: null,
      index: undefined,
      error: undefined,
    };

    try {
      if (command === 'rescore') {
        const stored = await readJson(targetPath);
        if (!stored) throw new Error('analysfil saknas — kör "parse" först');
        record.sha256 = stored.demo?.sha256 ?? null;
        if (stored.error) {
          record.error = stored.error;
          counts.knownErrors += 1;
        } else {
          // Poängsättningen räknas om, parsningen återanvänds oförändrad.
          const rescored = rescoreWith(stored, stored.observedShots ?? []);
          record.index = {
            ...stored,
            ...rescored,
            analyzerVersion: ANALYZER_VERSION,
            createdAt: new Date().toISOString(),
          };
          await writeJson(targetPath, record.index);
        }
      } else {
        const bytes = await readFile(demoPath);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        record.sha256 = sha256;
        const stored = options.force ? undefined : await readJson(targetPath);
        if (stored
          && stored.demo?.sha256 === sha256
          && stored.analyzerVersion === ANALYZER_VERSION) {
          record.index = stored.error ? undefined : stored;
          record.error = stored.error;
          if (stored.error) counts.knownErrors += 1;
          counts.skipped += 1;
        } else {
          const file = new File([bytes], filename);
          const demo = await inspect(file);
          record.index = analyze(await file.arrayBuffer(), demo, {
            demoHash: sha256,
            cacheId: `${sha256}-${demo.compatibilityProfile}`,
          });
          await writeJson(targetPath, record.index);
        }
      }
      if (!record.error) counts.done += record.index ? 1 : 0;
    } catch (error) {
      record.error = error.message;
      counts.failed += 1;
      // Felet sparas så att en trasig demo inte parsas om vid varje körning.
      if (command === 'parse' && record.sha256) {
        await writeJson(targetPath, {
          analyzerVersion: ANALYZER_VERSION,
          demo: { sha256: record.sha256, name: filename },
          error: record.error,
        });
      }
    }

    catalog.push(catalogEntry(record, teamsOf));

    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = (elapsed / (position + 1)) * (demos.length - position - 1);
    const state = record.error ? `FEL: ${record.error}` : `${record.index?.fragRatings.length ?? 0} frags`;
    console.log(
      `[${position + 1}/${demos.length}] ${record.relativePath} — ${state}`
      + ` (kvar ca ${formatDuration(remaining)})`,
    );
  }

  catalog.sort((left, right) => (left.recordedAt ?? '').localeCompare(right.recordedAt ?? ''));
  await writeJson(catalogPath, {
    generatedAt: new Date().toISOString(),
    analyzerVersion: ANALYZER_VERSION,
    demoCount: catalog.length,
    demos: catalog,
  });

  const { size: catalogSize } = await stat(catalogPath);
  console.log(
    `\nKlart: ${counts.done} analyserade, ${counts.skipped} oförändrade,`
    + ` ${counts.knownErrors} kända fel, ${counts.failed} nya fel.`
    + `\nKatalog: ${catalogPath} (${(catalogSize / 1024 ** 2).toFixed(1)} MiB)`
    + `\nAnalysfiler: ${analysisRoot}`,
  );
  return counts.failed ? 1 : 0;
};

process.exitCode = await main();
