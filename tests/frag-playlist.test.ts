import { describe, expect, it } from 'vitest';
import {
  createFragPlaylist,
  parseFragPlaylist,
  playlistDurationMs,
  playlistItemKey,
  safePlaylistFilename,
} from '../src/playlist/frag-playlist';

const item = {
  id: 'item-1',
  demoPath: '2005/match.dem',
  demoName: 'match.dem',
  demoSha256: 'abc',
  eventId: 'event-10',
  demoTimeMs: 10_000,
  clipStartTimeMs: 7_000,
  clipEndTimeMs: 13_000,
  mapName: 'de_nuke',
  killer: 'alice',
  victim: 'bob',
  weapon: 'ak47',
  headshot: true,
  score: 72,
};

describe('frag playlist', () => {
  it('round-trips the shareable versioned format', () => {
    const project = { ...createFragPlaylist(new Date('2026-08-20T12:00:00Z')), items: [item] };
    expect(parseFragPlaylist(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });

  it('rejects playlists from another schema or database', () => {
    expect(() => parseFragPlaylist({ schemaVersion: 2, database: 'hltv-archive', items: [] }))
      .toThrow('Unsupported playlist version');
    expect(() => parseFragPlaylist({
      ...createFragPlaylist(), database: 'somewhere-else',
    })).toThrow('another demo database');
    expect(() => parseFragPlaylist({
      ...createFragPlaylist(), items: [item, item],
    })).toThrow('duplicate item IDs');
  });

  it('uses database-stable identity and sums visible clip time', () => {
    expect(playlistItemKey(item)).toBe('2005/match.dem\nevent-10');
    expect(playlistDurationMs([item, { ...item, id: 'item-2' }])).toBe(12_000);
    expect(safePlaylistFilename('NiP vs SK — Best!')).toBe('nip-vs-sk-best.hltv-playlist.json');
  });
});
