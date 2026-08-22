#!/usr/bin/env node
// Identifierar slutet av första och andra tävlingshalvan i alla analyser.
// Warmup och knivrundor tas aldrig med. Resultatet används av
// capture-side-end-scoreboards.mjs och kan granskas innan någon browser startas.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { selectMatchSideEnds } from '/@/analysis/match-side-ends';

const { values } = parseArgs({
  options: {
    analysis: { type: 'string', default: resolve('../demo-analysis') },
    output: { type: 'string', default: resolve('../side-end-capture-manifest.json') },
    limit: { type: 'string' },
  },
});
const analysisRoot = resolve(values.analysis);
const outputPath = resolve(values.output);
const limit = values.limit ? Number(values.limit) : undefined;

const collect = async (directory) => {
  const paths = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith('.dem.json')) paths.push(path);
    }
  };
  await walk(directory);
  return paths.sort();
};

const files = (await collect(analysisRoot)).slice(0, limit);
const demos = [];
const skipped = [];
for (const [index, path] of files.entries()) {
  try {
    const analysis = JSON.parse(await readFile(path, 'utf8'));
    if (analysis.error) throw new Error(analysis.error);
    const selection = selectMatchSideEnds(analysis);
    const demoPath = relative(analysisRoot, path).replace(/\.json$/, '');
    if (selection) demos.push({ demoPath, ...selection });
    else skipped.push({ demoPath, reason: 'No reliable MR12/MR15 side swap found.' });
  } catch (error) {
    skipped.push({
      demoPath: relative(analysisRoot, path).replace(/\.json$/, ''),
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  if ((index + 1) % 250 === 0 || index + 1 === files.length) {
    console.log(`[${index + 1}/${files.length}] ${demos.length} matches found`);
  }
}

const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  analysisRoot,
  totals: {
    analyzed: files.length,
    selected: demos.length,
    highConfidence: demos.filter((demo) => demo.confidence === 'high').length,
    review: demos.filter((demo) => demo.confidence === 'review').length,
    reviewCaptures: demos.flatMap((demo) => demo.captures)
      .filter((capture) => capture.review).length,
    missingPlayerCaptures: demos.flatMap((demo) => demo.captures)
      .filter((capture) => capture.missingPlayerIds.length > 0).length,
    skipped: skipped.length,
    screenshots: demos.length * 2,
  },
  demos,
  skipped,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.totals, null, 2));
console.log(`Manifest: ${outputPath}`);
