#!/usr/bin/env node
// Tar native CS-scoreboardbilder från manifestet. Körningen är sekventiell,
// återupptagbar och hoppar automatiskt över redan skapade filer.

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string', default: resolve('../side-end-capture-manifest.json') },
    output: { type: 'string', default: resolve('../scoreboard-screenshots') },
    'base-url': { type: 'string', default: 'http://127.0.0.1:43175' },
    'include-review': { type: 'boolean', default: false },
    limit: { type: 'string' },
    format: { type: 'string', default: 'jpeg' },
  },
});
if (!['jpeg', 'png'].includes(values.format)) throw new Error('--format must be jpeg or png');
const manifest = JSON.parse(await readFile(resolve(values.manifest), 'utf8'));
const outputRoot = resolve(values.output);
const allDemos = manifest.demos.filter((demo) =>
  values['include-review'] || demo.confidence === 'high');
const demos = values.limit ? allDemos.slice(0, Number(values.limit)) : allDemos;
const extension = values.format === 'png' ? 'png' : 'jpg';
const exists = async (path) => access(path).then(() => true, () => false);
const results = [];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1_920, height: 1_080 } });
const page = await context.newPage();
page.setDefaultTimeout(180_000);

try {
  for (const [index, demo] of demos.entries()) {
    const directory = join(outputRoot, demo.demoPath.replace(/\.dem$/i, ''));
    const targets = demo.captures.map((capture) => ({
      capture,
      path: join(directory, `half-${capture.half}.${extension}`),
    }));
    const missing = [];
    for (const target of targets) if (!(await exists(target.path))) missing.push(target);
    if (!missing.length) {
      results.push({ demoPath: demo.demoPath, status: 'skipped-existing' });
      console.log(`[${index + 1}/${demos.length}] exists ${demo.demoPath}`);
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
      results.push({ demoPath: demo.demoPath, status: 'captured', files: targets.map((entry) => entry.path) });
      console.log(`[${index + 1}/${demos.length}] captured ${demo.demoPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ demoPath: demo.demoPath, status: 'error', error: message });
      console.error(`[${index + 1}/${demos.length}] ERROR ${demo.demoPath}: ${message}`);
    }
    await writeFile(join(outputRoot, 'capture-results.json'), `${JSON.stringify({
      updatedAt: new Date().toISOString(), results,
    }, null, 2)}\n`);
  }
} finally {
  await browser.close();
}

console.log(`Finished: ${results.filter((entry) => entry.status === 'captured').length} captured, ${results.filter((entry) => entry.status === 'error').length} errors.`);
