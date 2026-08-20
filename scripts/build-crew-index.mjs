#!/usr/bin/env node
// Bygger crew-index.json: per person, aggregerat över hela arkivet.
//
//   node --import ./scripts/hltv-node.mjs scripts/build-crew-index.mjs \
//     --analysis /srv/hltv/demo-analysis --catalog /srv/hltv/app/dist/demo-index.json \
//     --out /srv/hltv/app/dist/crew-index.json
//
// Katalogen bär demonivå (längd, år, karta). Frags, dödsfall och headshots per
// person finns bara i analysfilerna, där death-eventen pekar på playerId och
// sessionerna bär namnhistoriken. Den här kopplar ihop de två.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  analysis: { type: 'string', default: '/srv/hltv/demo-analysis' },
  catalog: { type: 'string', default: '/srv/hltv/app/dist/demo-index.json' },
  out: { type: 'string', default: '/srv/hltv/app/dist/crew-index.json' },
} });

const { CREW, crewMemberForName } = await import('/@/archive/crew');

const catalog = JSON.parse(await readFile(resolve(values.catalog), 'utf8'));
const byPath = new Map(catalog.demos.map((d) => [d.path, d]));

const blank = () => ({
  demos: 0, seconds: 0, frags: 0, deaths: 0, headshots: 0,
  years: new Set(), maps: new Map(), nicks: new Map(), mates: new Map(),
});
const stats = new Map(CREW.map((m) => [m.id, blank()]));

let files = 0;
for (const year of await readdir(resolve(values.analysis))) {
  let entries;
  try { entries = await readdir(join(resolve(values.analysis), year)); } catch { continue; }
  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    files += 1;
    let doc;
    try { doc = JSON.parse(await readFile(join(resolve(values.analysis), year, file), 'utf8')); }
    catch { continue; }

    const demo = byPath.get(`${year}/${file.replace(/\.json$/, '')}`);

    // playerId -> alla namn personen använde i just det här demot.
    const namesById = new Map();
    for (const player of doc.players ?? []) {
      const names = new Set();
      for (const session of player.sessions ?? []) {
        for (const entry of session.names ?? []) if (entry.value) names.add(entry.value);
      }
      namesById.set(player.playerId, [...names]);
    }

    // Föräldralös analys: reparationen skrev *.repaired.dem, indexeraren hann
    // analysera den, och utbytet döpte sedan om filen. Den sökvägen finns inte
    // i katalogen och ska inte räknas.
    if (!demo || demo.status !== 'complete') continue;

    // playerId -> crew-id, för att kunna tillskriva frags och headshots.
    const crewById = new Map();
    for (const [id, names] of namesById) {
      for (const name of names) {
        const member = crewMemberForName(name);
        if (!member) continue;
        crewById.set(id, member.id);
        stats.get(member.id).nicks.set(name, (stats.get(member.id).nicks.get(name) ?? 0) + 1);
        break;
      }
    }

    // MEDLEMSKAP kommer från katalogens players[], inte från sessionsnamnen.
    // Det är samma källa som arkivfiltret använder, så antalet demos här och
    // antalet träffar i filtret blir per definition lika. Sessionerna missar
    // enstaka namn — sju demos skilde innan — och då hade sidan visat en
    // siffra som inte gick att klicka fram.
    const present = new Set();
    for (const name of demo.players ?? []) {
      const member = crewMemberForName(name);
      if (member) present.add(member.id);
    }
    if (!present.size) continue;

    for (const id of present) {
      const s = stats.get(id);
      s.demos += 1;
      s.seconds += demo?.durationSeconds ?? 0;
      if (demo?.year) s.years.add(demo.year);
      if (demo?.map) s.maps.set(demo.map, (s.maps.get(demo.map) ?? 0) + 1);
      for (const other of present) if (other !== id) s.mates.set(other, (s.mates.get(other) ?? 0) + 1);
    }

    for (const event of doc.events ?? []) {
      if (event.type !== 'death') continue;
      const killer = crewById.get(event.killerPlayerId);
      const victim = crewById.get(event.victimPlayerId);
      if (killer) {
        const s = stats.get(killer);
        s.frags += 1;
        if (event.headshot) s.headshots += 1;
      }
      if (victim) stats.get(victim).deaths += 1;
    }
  }
}

const top = (map, n = 3) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([value, count]) => ({ value, count }));

const members = CREW.map((member) => {
  const s = stats.get(member.id);
  return {
    id: member.id,
    name: member.name,
    demos: s.demos,
    seconds: s.seconds,
    frags: s.frags,
    deaths: s.deaths,
    headshots: s.headshots,
    headshotPercent: s.frags ? Math.round((s.headshots / s.frags) * 1000) / 10 : 0,
    ratio: s.deaths ? Math.round((s.frags / s.deaths) * 100) / 100 : null,
    years: [...s.years].sort(),
    topMaps: top(s.maps),
    topNicks: top(s.nicks, 5),
    playedWith: top(s.mates, 4),
  };
}).sort((a, b) => b.frags - a.frags);

await writeFile(resolve(values.out), JSON.stringify({
  generatedAt: new Date().toISOString(),
  analysisFiles: files,
  members,
}, null, 2));

console.log(`${files} analysfiler lästa, ${members.length} personer`);
for (const m of members) {
  console.log(`  ${m.name.padEnd(8)} ${String(m.demos).padStart(4)} demos ${(m.seconds/3600).toFixed(0).padStart(4)} h `
    + `${String(m.frags).padStart(6)} frags ${String(m.headshots).padStart(5)} hs (${m.headshotPercent}%) K/D ${m.ratio ?? '-'}`);
}
