#!/usr/bin/env node
// Generates an importable frag playlist for one of the people in crew.ts.
// Multi-kill moments are selected as complete groups and receive a deliberate
// ranking bonus; a per-demo cap keeps the result varied across the archive.
//
//   node --import ./scripts/hltv-node.mjs scripts/generate-crew-playlist.mjs \
//     --member infe --count 100 --max-per-demo 6 \
//     --min-demo-time-ms 3000 \
//     --analysis /srv/hltv/demo-analysis \
//     --catalog /srv/hltv/app/dist/demo-index.json \
//     --out /srv/hltv/app/dist/playlists/infe-top-100.hltv-playlist.json

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  member: { type: 'string' },
  count: { type: 'string', default: '100' },
  'max-per-demo': { type: 'string', default: '6' },
  'min-demo-time-ms': { type: 'string', default: '3000' },
  analysis: { type: 'string', default: '/srv/hltv/demo-analysis' },
  catalog: { type: 'string', default: '/srv/hltv/app/dist/demo-index.json' },
  out: { type: 'string' },
  report: { type: 'string' },
} });

const { CREW, crewMemberForName } = await import('/@/archive/crew');
const member = CREW.find((candidate) => candidate.id === values.member);
if (!member) throw new Error(`Unknown crew member: ${values.member ?? '(missing)'}.`);

const targetCount = Number(values.count);
const maxPerDemo = Number(values['max-per-demo']);
const minDemoTimeMs = Number(values['min-demo-time-ms']);
if (!Number.isInteger(targetCount) || targetCount < 1) throw new Error('--count must be a positive integer.');
if (!Number.isInteger(maxPerDemo) || maxPerDemo < 1) {
  throw new Error('--max-per-demo must be a positive integer.');
}
if (!Number.isInteger(minDemoTimeMs) || minDemoTimeMs < 0) {
  throw new Error('--min-demo-time-ms must be a non-negative integer.');
}
if (!values.out) throw new Error('--out is required.');

const analysisRoot = resolve(values.analysis);
const outputPath = resolve(values.out);
const catalog = JSON.parse(await readFile(resolve(values.catalog), 'utf8'));
const catalogEntries = (catalog.demos ?? []).filter((entry) =>
  entry.status === 'complete'
  && (entry.players ?? []).some((name) => crewMemberForName(name)?.id === member.id));

const historyValueAt = (history, atMs) => history.find((entry) =>
  entry.fromMs <= atMs && (entry.toMs === null || atMs < entry.toMs))?.value;

const playerNameAt = (playersById, playerId, atMs, slot) => {
  if (!playerId) return slot === 0 ? 'World' : `Player ${slot}`;
  const player = playersById.get(playerId);
  const session = player?.sessions?.find((candidate) =>
    candidate.joinedAtMs <= atMs && (candidate.leftAtMs === null || atMs <= candidate.leftAtMs));
  return historyValueAt(session?.names ?? [], atMs)
    ?? session?.names?.at(-1)?.value
    ?? `Player ${slot}`;
};

const eligibleVisibility = (perspective, visibility) => perspective === 'pov'
  ? visibility === 'recorded_pov'
  : visibility === 'hltv_replay' || visibility === 'hltv_director';

const stableId = (demoPath, eventId) => {
  const hex = createHash('sha256').update(`${demoPath}\n${eventId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const multiKillBonus = (count) => count <= 1 ? 0 : 18 + (count - 2) * 16;
const groups = [];
let unreadableAnalyses = 0;

for (const entry of catalogEntries) {
  let document;
  try {
    document = JSON.parse(await readFile(join(analysisRoot, `${entry.path}.json`), 'utf8'));
  } catch {
    unreadableAnalyses += 1;
    continue;
  }

  const playersById = new Map((document.players ?? []).map((player) => [player.playerId, player]));
  const memberPlayerIds = new Set((document.players ?? [])
    .filter((player) => (player.sessions ?? []).some((session) =>
      (session.names ?? []).some((name) => crewMemberForName(name.value)?.id === member.id)))
    .map((player) => player.playerId));
  if (!memberPlayerIds.size) continue;

  const deaths = (document.events ?? []).filter((event) => event.type === 'death');
  const deathsById = new Map(deaths.map((death) => [death.eventId, death]));
  const ratingsById = new Map((document.fragRatings ?? []).map((rating) => [rating.eventId, rating]));
  const eligibleIds = new Set(deaths
    .filter((death) => memberPlayerIds.has(death.killerPlayerId))
    // Without the complete lead-in the frag cannot start from a stable POV.
    // Very early deaths are also commonly malformed demo-start events.
    .filter((death) => death.demoTimeMs >= minDemoTimeMs)
    .filter((death) => eligibleVisibility(
      document.demo?.perspective?.kind,
      ratingsById.get(death.eventId)?.visibility,
    ))
    .map((death) => death.eventId));
  if (!eligibleIds.size) continue;

  const groupedIds = new Set();
  for (const moment of document.moments ?? []) {
    if (!memberPlayerIds.has(moment.killerPlayerId)) continue;
    const momentDeaths = (moment.eventIds ?? [])
      .filter((eventId) => eligibleIds.has(eventId))
      .map((eventId) => deathsById.get(eventId))
      .filter(Boolean)
      .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    if (!momentDeaths.length) continue;
    momentDeaths.forEach((death) => groupedIds.add(death.eventId));
    const fragScores = momentDeaths.map((death) => ratingsById.get(death.eventId)?.score ?? 0);
    const momentScore = moment.rating?.score ?? Math.max(...fragScores);
    groups.push({
      demo: entry,
      document,
      playersById,
      deaths,
      deathsInMoment: momentDeaths,
      ratingsById,
      momentId: moment.momentId,
      momentScore,
      selectionScore: momentScore * 0.7
        + Math.max(...fragScores) * 0.3
        + multiKillBonus(momentDeaths.length),
    });
  }

  // A valid frag should normally belong to a moment, but retain it as a
  // single-frag group if an older analysis file predates moment generation.
  for (const eventId of eligibleIds) {
    if (groupedIds.has(eventId)) continue;
    const death = deathsById.get(eventId);
    const rating = ratingsById.get(eventId);
    if (!death || !rating) continue;
    groups.push({
      demo: entry,
      document,
      playersById,
      deaths,
      deathsInMoment: [death],
      ratingsById,
      momentId: `fallback-${eventId}`,
      momentScore: rating.score,
      selectionScore: rating.score,
    });
  }
}

const selectedGroups = [];
const selectedGroupKeys = new Set();
const demoFragCounts = new Map();
const demoGroupCounts = new Map();
let selectedFragCount = 0;

while (selectedFragCount < targetCount) {
  const remaining = targetCount - selectedFragCount;
  const candidates = groups
    .filter((group) => !selectedGroupKeys.has(`${group.demo.path}\n${group.momentId}`))
    .filter((group) => group.deathsInMoment.length <= remaining)
    .filter((group) =>
      (demoFragCounts.get(group.demo.path) ?? 0) + group.deathsInMoment.length <= maxPerDemo)
    .map((group) => ({
      group,
      adjustedScore: group.selectionScore
        - (demoFragCounts.get(group.demo.path) ?? 0) * 4
        - (demoGroupCounts.get(group.demo.path) ?? 0) * 6,
    }))
    .sort((left, right) => right.adjustedScore - left.adjustedScore
      || right.group.selectionScore - left.group.selectionScore
      || left.group.demo.path.localeCompare(right.group.demo.path));
  const next = candidates[0]?.group;
  if (!next) break;
  selectedGroups.push(next);
  selectedGroupKeys.add(`${next.demo.path}\n${next.momentId}`);
  selectedFragCount += next.deathsInMoment.length;
  demoFragCounts.set(next.demo.path,
    (demoFragCounts.get(next.demo.path) ?? 0) + next.deathsInMoment.length);
  demoGroupCounts.set(next.demo.path, (demoGroupCounts.get(next.demo.path) ?? 0) + 1);
}

if (selectedFragCount !== targetCount) {
  throw new Error(`Could only select ${selectedFragCount}/${targetCount} frags with max ${maxPerDemo} per demo.`);
}

// Keep each demo contiguous so playback mounts it once. Demos are ordered by
// their strongest selected moment; moments and frags remain chronological.
const selectedByDemo = new Map();
for (const group of selectedGroups) {
  const list = selectedByDemo.get(group.demo.path) ?? [];
  list.push(group);
  selectedByDemo.set(group.demo.path, list);
}
const demoGroups = [...selectedByDemo.values()].sort((left, right) =>
  Math.max(...right.map((group) => group.selectionScore))
  - Math.max(...left.map((group) => group.selectionScore)));

const items = demoGroups.flatMap((demoMoments) => demoMoments
  .sort((left, right) => left.deathsInMoment[0].demoTimeMs - right.deathsInMoment[0].demoTimeMs)
  .flatMap((group) => group.deathsInMoment.map((death) => {
    const rating = group.ratingsById.get(death.eventId);
    const killerDeath = group.deaths.find((candidate) =>
      candidate.victimPlayerId === death.killerPlayerId
      && candidate.demoTimeMs > death.demoTimeMs
      && candidate.demoTimeMs <= death.demoTimeMs + 3_000);
    const clipEndTimeMs = killerDeath
      ? Math.max(death.demoTimeMs, killerDeath.demoTimeMs - 500)
      : death.demoTimeMs + 3_000;
    return {
      id: stableId(group.demo.path, death.eventId),
      demoPath: group.demo.path,
      demoName: group.demo.filename,
      demoSha256: group.demo.sha256 ?? null,
      eventId: death.eventId,
      sourcePacketOrdinal: death.packetOrdinal,
      sourceMessageOrdinal: death.source?.messageOrdinal,
      demoTimeMs: death.demoTimeMs,
      clipStartTimeMs: Math.max(0, death.demoTimeMs - 3_000),
      clipEndTimeMs,
      mapName: group.document.demo.mapName,
      killer: playerNameAt(group.playersById, death.killerPlayerId, death.demoTimeMs, death.killerSlot),
      victim: playerNameAt(group.playersById, death.victimPlayerId, death.demoTimeMs, death.victimSlot),
      weapon: death.weapon,
      headshot: death.headshot === true,
      score: rating?.score ?? null,
    };
  })));

const now = new Date().toISOString();
const playlist = {
  schemaVersion: 1,
  database: 'hltv-archive',
  title: `${member.name} — ${targetCount} snyggaste frags`,
  createdAt: now,
  updatedAt: now,
  items,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(playlist, null, 2)}\n`);

const selectedMultiKills = selectedGroups.filter((group) => group.deathsInMoment.length > 1);
const report = {
  member: member.name,
  generatedAt: now,
  playlist: outputPath,
  frags: items.length,
  demos: selectedByDemo.size,
  candidateDemos: catalogEntries.length,
  candidateMoments: groups.length,
  unreadableAnalyses,
  maxPerDemo,
  minDemoTimeMs,
  multiKillMoments: selectedMultiKills.length,
  fragsFromMultiKills: selectedMultiKills.reduce((total, group) =>
    total + group.deathsInMoment.length, 0),
  headshots: items.filter((item) => item.headshot).length,
  maps: [...new Set(items.map((item) => item.mapName))].sort(),
  topMoments: [...selectedGroups]
    .sort((left, right) => right.selectionScore - left.selectionScore)
    .slice(0, 20)
    .map((group) => ({
      demo: group.demo.path,
      atMs: group.deathsInMoment[0].demoTimeMs,
      frags: group.deathsInMoment.length,
      momentScore: group.momentScore,
      selectionScore: Math.round(group.selectionScore * 10) / 10,
    })),
};
if (values.report) {
  const reportPath = resolve(values.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
