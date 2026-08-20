#!/usr/bin/env node
// Letar nickvarianter i demokatalogen.
//
//   node scripts/find-player-aliases.mjs seck dennis
//   node scripts/find-player-aliases.mjs --min 3 crm robin
//
// Namn i arkivet bär klantaggar som byts var tredje månad: samma person heter
// "pXa cater", "[cRAp]cater" och "PRAXXA // cater <LUDDEMENT>". Sökningen är
// därför på delsträng, och resultatet är ett UNDERLAG att kurera för hand —
// "danne" och "robin" är vanliga namn och träffar andra personer.

const CATALOG = process.env.HLTV_CATALOG ?? 'https://praxxa.pro/demo-index.json';
const args = process.argv.slice(2);
let min = 2;
const seeds = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--min') { min = Number(args[i + 1]); i += 1; continue; }
  seeds.push(args[i].toLowerCase());
}
if (!seeds.length) {
  console.error('Ange minst ett sökord. Exempel: node scripts/find-player-aliases.mjs cater ldmnt');
  process.exit(2);
}

const catalog = await (await fetch(CATALOG)).json();
const demos = catalog.demos.filter((entry) => entry.status === 'complete');

const count = new Map();
const seconds = new Map();
const years = new Map();
for (const demo of demos) {
  for (const name of demo.players ?? []) {
    count.set(name, (count.get(name) ?? 0) + 1);
    seconds.set(name, (seconds.get(name) ?? 0) + (demo.durationSeconds ?? 0));
    if (demo.year) {
      if (!years.has(name)) years.set(name, new Set());
      years.get(name).add(demo.year);
    }
  }
}

const hits = [...count.entries()]
  .filter(([name, n]) => n >= min && seeds.some((seed) => name.toLowerCase().includes(seed)))
  .sort((a, b) => b[1] - a[1]);

console.log(`${hits.length} namn matchar ${seeds.join(', ')} med minst ${min} demos\n`);
let demoTotal = 0;
for (const [name, n] of hits) {
  const y = [...(years.get(name) ?? [])].sort();
  const span = y.length ? (y.length === 1 ? `${y[0]}` : `${y[0]}-${y.at(-1)}`) : '';
  console.log(`  ${String(n).padStart(4)} demos ${(seconds.get(name) / 3600).toFixed(1).padStart(7)} h  ${span.padEnd(10)} ${name}`);
  demoTotal += n;
}
console.log(`\n  ${demoTotal} demoförekomster totalt`);
