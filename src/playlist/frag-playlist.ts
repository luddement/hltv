import { FRAG_REEL_CONTINUOUS_GAP_MS } from '/@/demo/frag-reel';

export const FRAG_PLAYLIST_SCHEMA_VERSION = 1 as const;
export const FRAG_PLAYLIST_STORAGE_KEY = 'replay-lab-frag-playlist-v1';

export type FragPlaylistItem = {
  id: string;
  demoPath: string;
  demoName: string;
  demoSha256: string | null;
  eventId: string;
  sourcePacketOrdinal?: number;
  sourceMessageOrdinal?: number;
  demoTimeMs: number;
  clipStartTimeMs: number;
  clipEndTimeMs: number;
  mapName: string;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  score: number | null;
};

export type FragPlaylist = {
  schemaVersion: typeof FRAG_PLAYLIST_SCHEMA_VERSION;
  database: 'hltv-archive';
  title: string;
  createdAt: string;
  updatedAt: string;
  items: FragPlaylistItem[];
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Playlist field ${field} is missing.`);
  }
  return value;
};

const finiteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Playlist field ${field} is invalid.`);
  }
  return value;
};

const parseItem = (value: unknown, index: number): FragPlaylistItem => {
  if (!value || typeof value !== 'object') throw new Error(`Playlist item ${index + 1} is invalid.`);
  const item = value as Record<string, unknown>;
  const clipStartTimeMs = finiteNumber(item.clipStartTimeMs, 'clipStartTimeMs');
  const clipEndTimeMs = finiteNumber(item.clipEndTimeMs, 'clipEndTimeMs');
  if (clipEndTimeMs < clipStartTimeMs) throw new Error(`Playlist item ${index + 1} has an invalid time range.`);
  return {
    id: text(item.id, 'id'),
    demoPath: text(item.demoPath, 'demoPath'),
    demoName: text(item.demoName, 'demoName'),
    demoSha256: item.demoSha256 === null ? null : text(item.demoSha256, 'demoSha256'),
    eventId: text(item.eventId, 'eventId'),
    ...(typeof item.sourcePacketOrdinal === 'number' && Number.isInteger(item.sourcePacketOrdinal)
      ? { sourcePacketOrdinal: finiteNumber(item.sourcePacketOrdinal, 'sourcePacketOrdinal') }
      : {}),
    ...(typeof item.sourceMessageOrdinal === 'number' && Number.isInteger(item.sourceMessageOrdinal)
      ? { sourceMessageOrdinal: finiteNumber(item.sourceMessageOrdinal, 'sourceMessageOrdinal') }
      : {}),
    demoTimeMs: finiteNumber(item.demoTimeMs, 'demoTimeMs'),
    clipStartTimeMs,
    clipEndTimeMs,
    mapName: text(item.mapName, 'mapName'),
    killer: text(item.killer, 'killer'),
    victim: text(item.victim, 'victim'),
    weapon: text(item.weapon, 'weapon'),
    headshot: item.headshot === true,
    score: item.score === null ? null : finiteNumber(item.score, 'score'),
  };
};

export const createFragPlaylist = (now = new Date()): FragPlaylist => {
  const timestamp = now.toISOString();
  return {
    schemaVersion: FRAG_PLAYLIST_SCHEMA_VERSION,
    database: 'hltv-archive',
    title: 'My frag playlist',
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [],
  };
};

export const parseFragPlaylist = (value: unknown): FragPlaylist => {
  if (!value || typeof value !== 'object') throw new Error('The file is not a frag playlist.');
  const project = value as Record<string, unknown>;
  if (project.schemaVersion !== FRAG_PLAYLIST_SCHEMA_VERSION) {
    throw new Error(`Unsupported playlist version: ${String(project.schemaVersion)}.`);
  }
  if (project.database !== 'hltv-archive') {
    throw new Error('The playlist belongs to another demo database.');
  }
  if (!Array.isArray(project.items)) throw new Error('The playlist has no item list.');
  const items = project.items.map(parseItem);
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('The playlist contains duplicate item IDs.');
  }
  return {
    schemaVersion: FRAG_PLAYLIST_SCHEMA_VERSION,
    database: 'hltv-archive',
    title: text(project.title, 'title'),
    createdAt: text(project.createdAt, 'createdAt'),
    updatedAt: text(project.updatedAt, 'updatedAt'),
    items,
  };
};

export const playlistItemKey = (
  item: Pick<FragPlaylistItem, 'demoPath' | 'demoTimeMs' | 'killer' | 'victim' | 'weapon' | 'headshot'>,
): string => [
  item.demoPath,
  item.demoTimeMs,
  item.killer.trim().toLocaleLowerCase('en-GB'),
  item.victim.trim().toLocaleLowerCase('en-GB'),
  item.weapon.trim().toLocaleLowerCase('en-GB'),
  item.headshot ? '1' : '0',
].join('\n');

export type PlaylistDeathCandidate = {
  eventId: string;
  demoTimeMs: number;
  weapon: string;
  headshot: boolean;
  packetOrdinal: number;
  source: { messageOrdinal: number };
};

export const resolvePlaylistDeath = <T extends PlaylistDeathCandidate>(
  item: FragPlaylistItem,
  deaths: readonly T[],
  labelsFor?: (death: T) => { killer: string; victim: string },
): T | undefined => {
  const exactId = deaths.find((death) => death.eventId === item.eventId);
  if (exactId) return exactId;
  if (item.sourcePacketOrdinal !== undefined && item.sourceMessageOrdinal !== undefined) {
    const exactSource = deaths.find((death) =>
      death.packetOrdinal === item.sourcePacketOrdinal
      && death.source.messageOrdinal === item.sourceMessageOrdinal);
    if (exactSource) return exactSource;
  }
  const normalize = (value: string) => value.trim().toLocaleLowerCase('en-GB');
  const candidates = deaths.filter((death) =>
    Math.abs(death.demoTimeMs - item.demoTimeMs) <= 100
    && normalize(death.weapon) === normalize(item.weapon)
    && death.headshot === item.headshot);
  if (!candidates.length) return undefined;
  if (labelsFor) {
    const labeled = candidates.find((death) => {
      const labels = labelsFor(death);
      return normalize(labels.killer) === normalize(item.killer)
        && normalize(labels.victim) === normalize(item.victim);
    });
    if (labeled) return labeled;
  }
  return [...candidates].sort((left, right) =>
    Math.abs(left.demoTimeMs - item.demoTimeMs) - Math.abs(right.demoTimeMs - item.demoTimeMs))[0];
};

/** Duration of the recorded timeline, including continuous gaps but excluding seeks. */
export const playlistDurationMs = (items: readonly FragPlaylistItem[]): number => {
  let durationMs = 0;
  let activeStartMs = 0;
  let activeEndMs = 0;
  let previous: FragPlaylistItem | undefined;
  for (const item of items) {
    const continuous = previous
      && previous.demoPath === item.demoPath
      && item.demoTimeMs >= previous.demoTimeMs
      && item.demoTimeMs - previous.demoTimeMs <= FRAG_REEL_CONTINUOUS_GAP_MS;
    if (continuous) {
      activeEndMs = Math.max(activeEndMs, item.clipEndTimeMs);
    } else {
      if (previous) durationMs += Math.max(0, activeEndMs - activeStartMs);
      activeStartMs = item.clipStartTimeMs;
      activeEndMs = item.clipEndTimeMs;
    }
    previous = item;
  }
  if (previous) durationMs += Math.max(0, activeEndMs - activeStartMs);
  return durationMs;
};

export const safePlaylistFilename = (title: string): string => {
  const clean = title.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${clean || 'frag-playlist'}.hltv-playlist.json`;
};
