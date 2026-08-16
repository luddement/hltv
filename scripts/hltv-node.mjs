// Kör appens analyskedja i vanliga Node utan Vite eller Vitest.
//
//   node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs
//
// Två saker behövs: Vites '/@'-alias måste lösas av Node, och analyskedjan
// förväntar sig att 'window' och 'document' finns eftersom den normalt körs i
// en webbläsarworker. Ingen av modulerna rör DOM:en, så tomma stubbar räcker.

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDirectory = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = resolvePath(appDirectory, 'src');
const ALIAS = '/@/';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith(ALIAS)) return nextResolve(specifier, context);
    const base = resolvePath(sourceDirectory, specifier.slice(ALIAS.length));
    for (const candidate of [base, `${base}.ts`, `${base}.js`]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw new Error(`Kunde inte lösa ${specifier} under ${sourceDirectory}`);
  },
});

Object.assign(globalThis, {
  window: globalThis,
  document: {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  },
});
