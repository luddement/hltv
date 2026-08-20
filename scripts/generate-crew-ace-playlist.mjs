#!/usr/bin/env node
// Generates an importable playlist containing every playable frag from every
// round where a crew member killed at least five distinct opponents. Unlike
// the highlight generator, kills do not have to be close together in time.
//
//   node --import ./scripts/hltv-node.mjs scripts/generate-crew-ace-playlist.mjs \
//     --member infe \
//     --analysis /srv/hltv/demo-analysis \
//     --catalog /srv/hltv/app/dist/demo-index.json \
//     --out /srv/hltv/generated-playlists/infe-all-aces.hltv-playlist.json \
//     --report /srv/hltv/generated-playlists/infe-all-aces.report.json

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  member: { type: 'string' },
  count: { type: 'string' },
  'fast-only': { type: 'boolean', default: false },
  'max-aces-per-demo': { type: 'string', default: '2' },
  analysis: { type: 'string', default: '/srv/hltv/demo-analysis' },
  catalog: { type: 'string', default: '/srv/hltv/app/dist/demo-index.json' },
  out: { type: 'string' },
  report: { type: 'string' },
  'min-demo-time-ms': { type: 'string', default: '3000' },
} });

const { CREW, crewMemberForName } = await import('/@/archive/crew');
const member = CREW.find((candidate) => candidate.id === values.member);
if (!member) throw new Error(`Unknown crew member: ${values.member ?? '(missing)'}.`);
if (!values.out) throw new Error('--out is required.');

const minDemoTimeMs = Number(values['min-demo-time-ms']);
const targetCount = values.count === undefined ? undefined : Number(values.count);
const maxAcesPerDemo = Number(values['max-aces-per-demo']);
if (!Number.isInteger(minDemoTimeMs) || minDemoTimeMs < 0) {
  throw new Error('--min-demo-time-ms must be a non-negative integer.');
}
if (targetCount !== undefined && (!Number.isInteger(targetCount) || targetCount < 1)) {
  throw new Error('--count must be a positive integer.');
}
if (!Number.isInteger(maxAcesPerDemo) || maxAcesPerDemo < 1) {
  throw new Error('--max-aces-per-demo must be a positive integer.');
}

const analysisRoot = resolve(values.analysis);
const outputPath = resolve(values.out);
const catalog = JSON.parse(await readFile(resolve(values.catalog), 'utf8'));
const catalogEntries = (catalog.demos ?? []).filter((entry) =>
  entry.status === 'complete'
  && (entry.players ?? []).some((name) => crewMemberForName(name)?.id === member.id));

const historyValueAt = (history, atMs) => history?.find((entry) =>
  entry.fromMs <= atMs && (entry.toMs === null || atMs < entry.toMs))?.value;

const playerSessionAt = (playersById, playerId, atMs) => playersById.get(playerId)
  ?.sessions?.find((session) =>
    session.joinedAtMs <= atMs && (session.leftAtMs === null || atMs <= session.leftAtMs));

const playerNameAt = (playersById, playerId, atMs, slot) => {
  if (!playerId) return slot === 0 ? 'World' : `Player ${slot}`;
  const session = playerSessionAt(playersById, playerId, atMs);
  return historyValueAt(session?.names, atMs)
    ?? session?.names?.at(-1)?.value
    ?? `Player ${slot}`;
};

const playerTeamAt = (playersById, playerId, atMs) => {
  if (!playerId) return undefined;
  const session = playerSessionAt(playersById, playerId, atMs);
  return historyValueAt(session?.teams, atMs) ?? session?.teams?.at(-1)?.value;
};

const isMemberAt = (playersById, playerId, atMs, slot) =>
  crewMemberForName(playerNameAt(playersById, playerId, atMs, slot))?.id === member.id;

const eligibleVisibility = (perspective, visibility) => perspective === 'pov'
  ? visibility === 'recorded_pov'
  : visibility === 'hltv_replay' || visibility === 'hltv_director';

const stableId = (demoPath, eventId) => {
  const hex = createHash('sha256').update(`ace\n${demoPath}\n${eventId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const CONTINUOUS_GAP_MS = 10_000;
const sceneCountForKills = (kills) => kills.reduce((scenes, kill, index) =>
  scenes + (index === 0 || kill.demoTimeMs - kills[index - 1].demoTimeMs > CONTINUOUS_GAP_MS ? 1 : 0), 0);

const aceRounds = [];
let unreadableAnalyses = 0;
let demosWithoutRounds = 0;
let rejectedMalformedRounds = 0;

for (const entry of catalogEntries) {
  let document;
  try {
    document = JSON.parse(await readFile(join(analysisRoot, `${entry.path}.json`), 'utf8'));
  } catch {
    unreadableAnalyses += 1;
    continue;
  }

  if (!(document.rounds ?? []).length) {
    demosWithoutRounds += 1;
    continue;
  }

  const playersById = new Map((document.players ?? []).map((player) => [player.playerId, player]));
  const roundsById = new Map(document.rounds.map((round) => [round.roundId, round]));
  const ratingsById = new Map((document.fragRatings ?? []).map((rating) => [rating.eventId, rating]));
  const deaths = (document.events ?? []).filter((event) => event.type === 'death');
  const eligibleDeaths = deaths.filter((death) => {
    if (!death.roundId || !roundsById.has(death.roundId)) return false;
    if (!death.killerPlayerId || !death.victimPlayerId) return false;
    if (death.demoTimeMs < minDemoTimeMs) return false;
    if (death.worldKill || death.suicide || death.teamKill?.value === true) return false;
    if (!isMemberAt(playersById, death.killerPlayerId, death.demoTimeMs, death.killerSlot)) return false;
    const killerTeam = playerTeamAt(playersById, death.killerPlayerId, death.demoTimeMs);
    const victimTeam = playerTeamAt(playersById, death.victimPlayerId, death.demoTimeMs);
    if (killerTeam && victimTeam && killerTeam === victimTeam) return false;
    return eligibleVisibility(document.demo.perspective.kind, ratingsById.get(death.eventId)?.visibility);
  });

  const deathsByRoundAndKiller = new Map();
  for (const death of eligibleDeaths) {
    const key = `${death.roundId}\n${death.killerPlayerId}`;
    const list = deathsByRoundAndKiller.get(key) ?? [];
    list.push(death);
    deathsByRoundAndKiller.set(key, list);
  }

  for (const kills of deathsByRoundAndKiller.values()) {
    kills.sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    const uniqueVictims = new Set(kills.map((death) => death.victimPlayerId));
    if (kills.length !== 5 || uniqueVictims.size !== 5) continue;
    const round = roundsById.get(kills[0].roundId);
    const roundDurationMs = round.endTimeMs === null
      ? null
      : round.endTimeMs - round.startTimeMs;
    const validRoundBounds = round.startTimeMs <= kills[0].demoTimeMs
      && (round.endTimeMs === null || round.endTimeMs >= kills.at(-1).demoTimeMs)
      && (roundDurationMs === null || (roundDurationMs > 0 && roundDurationMs <= 300_000))
      && (roundDurationMs !== null || kills.at(-1).demoTimeMs - kills[0].demoTimeMs <= 180_000);
    if (!validRoundBounds) {
      rejectedMalformedRounds += 1;
      continue;
    }
    const scores = kills.map((death) => ratingsById.get(death.eventId)?.score ?? 0);
    aceRounds.push({
      demo: entry,
      document,
      playersById,
      deaths,
      ratingsById,
      round,
      kills,
      score: scores.reduce((total, score) => total + score, 0),
      headshots: kills.filter((death) => death.headshot === true).length,
      scenes: sceneCountForKills(kills),
    });
  }
}

// A fixed-size reel only admits whole ace rounds. One-scene aces rank first,
// then the strongest complete aces, while a soft demo cap keeps the reel varied.
const aceSpanMs = (ace) => ace.kills.at(-1).demoTimeMs - ace.kills[0].demoTimeMs;
const eligibleAceRounds = values['fast-only']
  ? aceRounds.filter((ace) => ace.scenes === 1)
  : aceRounds;
const rankedAces = [...eligibleAceRounds].sort((left, right) =>
  (values['fast-only'] ? aceSpanMs(left) - aceSpanMs(right) : left.scenes - right.scenes)
  || right.score - left.score
  || right.headshots - left.headshots
  || left.demo.path.localeCompare(right.demo.path)
  || left.kills[0].demoTimeMs - right.kills[0].demoTimeMs);
const selectedAceRounds = [];
const selectedAcesPerDemo = new Map();
let selectedFragCount = 0;
for (const ace of rankedAces) {
  if (targetCount !== undefined && selectedFragCount + ace.kills.length > targetCount) continue;
  if (targetCount !== undefined
    && (selectedAcesPerDemo.get(ace.demo.path) ?? 0) >= maxAcesPerDemo) continue;
  selectedAceRounds.push(ace);
  selectedFragCount += ace.kills.length;
  selectedAcesPerDemo.set(ace.demo.path, (selectedAcesPerDemo.get(ace.demo.path) ?? 0) + 1);
}

// Keep all ace rounds from the same demo contiguous so playback only mounts
// the demo once. The strongest ace demos are shown first; rounds stay in time order.
const acesByDemo = new Map();
for (const ace of selectedAceRounds) {
  const list = acesByDemo.get(ace.demo.path) ?? [];
  list.push(ace);
  acesByDemo.set(ace.demo.path, list);
}
const orderedDemoAces = [...acesByDemo.values()].sort((left, right) =>
  Math.max(...right.map((ace) => ace.score)) - Math.max(...left.map((ace) => ace.score))
  || left[0].demo.path.localeCompare(right[0].demo.path));

const items = orderedDemoAces.flatMap((demoAces) => demoAces
  .sort((left, right) => left.kills[0].demoTimeMs - right.kills[0].demoTimeMs)
  .flatMap((ace) => ace.kills.map((death) => {
    const rating = ace.ratingsById.get(death.eventId);
    const killerDeath = ace.deaths.find((candidate) =>
      candidate.victimPlayerId === death.killerPlayerId
      && candidate.demoTimeMs > death.demoTimeMs
      && candidate.demoTimeMs <= death.demoTimeMs + 3_000);
    return {
      id: stableId(ace.demo.path, death.eventId),
      demoPath: ace.demo.path,
      demoName: ace.demo.filename,
      demoSha256: ace.demo.sha256 ?? null,
      eventId: death.eventId,
      sourcePacketOrdinal: death.packetOrdinal,
      sourceMessageOrdinal: death.source?.messageOrdinal,
      demoTimeMs: death.demoTimeMs,
      clipStartTimeMs: Math.max(0, death.demoTimeMs - 3_000),
      clipEndTimeMs: killerDeath
        ? Math.max(death.demoTimeMs, killerDeath.demoTimeMs - 500)
        : death.demoTimeMs + 3_000,
      mapName: ace.document.demo.mapName,
      killer: playerNameAt(ace.playersById, death.killerPlayerId, death.demoTimeMs, death.killerSlot),
      victim: playerNameAt(ace.playersById, death.victimPlayerId, death.demoTimeMs, death.victimSlot),
      weapon: death.weapon,
      headshot: death.headshot === true,
      score: rating?.score ?? null,
    };
  })));

const now = new Date().toISOString();
const playlist = {
  schemaVersion: 1,
  database: 'hltv-archive',
  title: targetCount === undefined
    ? values['fast-only']
      ? `${member.name} — alla kompletta snabba ace`
      : `${member.name} — alla kompletta ace`
    : `${member.name} — ${selectedAceRounds.length} kompletta ace`,
  createdAt: now,
  updatedAt: now,
  items,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(playlist, null, 2)}\n`);

const report = {
  member: member.name,
  generatedAt: now,
  playlist: outputPath,
  rule: values['fast-only']
    ? 'Exactly five enemy kills against five distinct victims in one valid round; all five kills must fit one continuous scene.'
    : 'Exactly five enemy kills against five distinct victims in one valid round; every kill is included. Kills within ten seconds share a scene.',
  candidateDemos: catalogEntries.length,
  demosWithoutRounds,
  unreadableAnalyses,
  rejectedMalformedRounds,
  candidateAceRounds: aceRounds.length,
  eligibleAceRounds: eligibleAceRounds.length,
  fastOnly: values['fast-only'],
  selectedAceRounds: selectedAceRounds.length,
  aceDemos: acesByDemo.size,
  frags: items.length,
  scenes: selectedAceRounds.reduce((total, ace) => total + ace.scenes, 0),
  singleSceneAces: selectedAceRounds.filter((ace) => ace.scenes === 1).length,
  headshots: items.filter((item) => item.headshot).length,
  maps: [...new Set(items.map((item) => item.mapName))].sort(),
  aces: [...selectedAceRounds]
    .sort((left, right) => (values['fast-only'] ? aceSpanMs(left) - aceSpanMs(right) : 0)
      || right.score - left.score
      || left.demo.path.localeCompare(right.demo.path)
      || left.kills[0].demoTimeMs - right.kills[0].demoTimeMs)
    .map((ace) => ({
      demo: ace.demo.path,
      roundId: ace.round.roundId,
      roundNumber: ace.round.number,
      startMs: ace.kills[0].demoTimeMs,
      endMs: ace.kills.at(-1).demoTimeMs,
      spanMs: aceSpanMs(ace),
      kills: ace.kills.length,
      scenes: ace.scenes,
      headshots: ace.headshots,
      score: ace.score,
      eventIds: ace.kills.map((death) => death.eventId),
    })),
};
if (values.report) {
  const reportPath = resolve(values.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ ...report, aces: report.aces.slice(0, 20) }, null, 2));
