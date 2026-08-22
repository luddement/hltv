#!/usr/bin/env node
// Tar native CS-scoreboardbilder från manifestet. Körningen är sekventiell,
// återupptagbar och hoppar automatiskt över redan skapade filer.

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string', default: resolve('../side-end-capture-manifest.json') },
    output: { type: 'string', default: resolve('../scoreboard-screenshots') },
    'base-url': { type: 'string', default: 'http://127.0.0.1:43175' },
    'high-confidence-only': { type: 'boolean', default: false },
    // Kept as a no-op compatibility flag for the previous high-only default.
    'include-review': { type: 'boolean', default: false },
    limit: { type: 'string' },
    format: { type: 'string', default: 'jpeg' },
  },
});
if (!['jpeg', 'png'].includes(values.format)) throw new Error('--format must be jpeg or png');
const manifest = JSON.parse(await readFile(resolve(values.manifest), 'utf8'));
const outputRoot = resolve(values.output);
const allDemos = manifest.demos.filter((demo) =>
  !values['high-confidence-only'] || demo.confidence === 'high');
const demos = values.limit ? allDemos.slice(0, Number(values.limit)) : allDemos;
const extension = values.format === 'png' ? 'png' : 'jpg';
const CAPTURE_VERSION = 2;
const exists = async (path) => access(path).then(() => true, () => false);
const readJson = async (path) => {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return undefined; }
};
const results = [];
const checkpoint = () => writeFile(join(outputRoot, 'capture-results.json'), `${JSON.stringify({
  updatedAt: new Date().toISOString(),
  totals: {
    queued: demos.length,
    captured: results.filter((entry) => entry.status === 'captured').length,
    existing: results.filter((entry) => entry.status === 'skipped-existing').length,
    review: results.filter((entry) => entry.review).length,
    errors: results.filter((entry) => entry.status === 'error').length,
  },
  results,
}, null, 2)}\n`);

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1_920, height: 1_080 } });
const page = await context.newPage();
page.setDefaultTimeout(180_000);

try {
  for (const [index, demo] of demos.entries()) {
    const directory = join(outputRoot, demo.demoPath.replace(/\.dem$/i, ''));
    const metadataPath = join(directory, 'capture.json');
    const selectionWideReview = Array.isArray(demo.reviewReasons)
      ? demo.reviewReasons.includes('live-start-not-restart-anchored')
      : demo.confidence === 'review';
    const targets = demo.captures.map((capture) => ({
      capture,
      path: join(directory, `half-${capture.half}.${extension}`),
      review: selectionWideReview || capture.review === true,
    }));
    const previousMetadata = await readJson(metadataPath);
    const currentCapture = previousMetadata?.version === CAPTURE_VERSION
      && previousMetadata?.format === values.format
      && targets.every((target) => previousMetadata.captures?.some((capture) =>
        capture.half === target.capture.half
        && capture.demoTimeMs === target.capture.demoTimeMs));
    const missing = [];
    for (const target of targets) {
      if (!currentCapture || !(await exists(target.path))) missing.push(target);
    }
    if (!missing.length) {
      results.push({
        demoPath: demo.demoPath,
        status: 'skipped-existing',
        review: demo.confidence === 'review' || targets.some((target) => target.review),
        reviewReasons: demo.reviewReasons ?? [],
      });
      console.log(`[${index + 1}/${demos.length}] exists ${demo.demoPath}`);
      await checkpoint();
      continue;
    }

    try {
      await mkdir(directory, { recursive: true });
      const first = targets[0];
      const url = new URL(`/demo/${demo.demoPath.split('/').map(encodeURIComponent).join('/')}`, values['base-url']);
      url.searchParams.set('scoreboardCaptureMs', String(first.capture.demoTimeMs));
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const root = document.documentElement.dataset;
        return root.scoreboardCaptureReady === 'true' || Boolean(root.scoreboardCaptureError);
      });
      const firstError = await page.evaluate(() => document.documentElement.dataset.scoreboardCaptureError);
      if (firstError) throw new Error(firstError);
      if (missing.some((target) => target.capture.half === 1)) {
        await page.locator('#canvas').screenshot({
          path: first.path,
          type: values.format,
          ...(values.format === 'jpeg' ? { quality: 95 } : {}),
        });
      }

      const second = targets[1];
      if (missing.some((target) => target.capture.half === 2)) {
        await page.evaluate(async (demoTimeMs) => {
          const controller = window.__hltvScoreboardCapture;
          if (!controller) throw new Error('Scoreboard capture controller is unavailable.');
          await controller.next(demoTimeMs);
        }, second.capture.demoTimeMs);
        await page.locator('#canvas').screenshot({
          path: second.path,
          type: values.format,
          ...(values.format === 'jpeg' ? { quality: 95 } : {}),
        });
      }
      const reviewTargets = targets.filter((target) => target.review).map((target) => ({
        half: target.capture.half,
        reason: target.capture.reason,
        missingPlayerIds: target.capture.missingPlayerIds ?? [],
        file: target.path,
      }));
      await writeFile(join(directory, 'review.json'), `${JSON.stringify({
        demoPath: demo.demoPath,
        review: demo.confidence === 'review' || reviewTargets.length > 0,
        confidence: demo.confidence,
        reviewReasons: demo.reviewReasons ?? [],
        captures: reviewTargets,
      }, null, 2)}\n`);
      await writeFile(metadataPath, `${JSON.stringify({
        version: CAPTURE_VERSION,
        capturedAt: new Date().toISOString(),
        demoPath: demo.demoPath,
        format: values.format,
        captures: targets.map((target) => ({
          half: target.capture.half,
          demoTimeMs: target.capture.demoTimeMs,
          review: target.review,
          file: target.path,
        })),
      }, null, 2)}\n`);
      results.push({
        demoPath: demo.demoPath,
        status: 'captured',
        files: targets.map((entry) => entry.path),
        review: demo.confidence === 'review' || reviewTargets.length > 0,
        reviewReasons: demo.reviewReasons ?? [],
      });
      console.log(`[${index + 1}/${demos.length}] captured ${demo.demoPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ demoPath: demo.demoPath, status: 'error', error: message });
      console.error(`[${index + 1}/${demos.length}] ERROR ${demo.demoPath}: ${message}`);
    }
    await checkpoint();
  }
} finally {
  await browser.close();
}

console.log(`Finished: ${results.filter((entry) => entry.status === 'captured').length} captured, ${results.filter((entry) => entry.status === 'error').length} errors.`);
