import { describe, expect, it } from 'vitest';
import {
  demoCatalogAssetUrl,
  demoCatalogMatchup,
  filterDemoCatalog,
  toggleDemoCatalogSort,
  type DemoCatalogEntry,
} from '/@/archive/demo-catalog';

const demos: DemoCatalogEntry[] = [
  {
    path: '2004/crap_-_alpha-0401011200-de_nuke.dem',
    filename: 'crap_-_alpha-0401011200-de_nuke.dem',
    year: 2004,
    recordedAt: '2004-01-01T12:00:00.000Z',
    sizeBytes: 10,
    sha256: 'a',
    status: 'complete',
    map: 'de_nuke',
    topFragScore: 91,
    topRoundScore: 70,
    teams: ['crap', 'alpha'],
    players: ['crap ldmnt'],
    crewAceCount: 1,
    crewAceMembers: ['luddement'],
    crewZeroTwelveCount: 0,
    crewZeroTwelveMembers: [],
  },
  {
    path: '2005/praxxa_-_beta-0502011200-de_train.dem',
    filename: 'praxxa_-_beta-0502011200-de_train.dem',
    year: 2005,
    recordedAt: '2005-02-01T12:00:00.000Z',
    sizeBytes: 20,
    sha256: 'b',
    status: 'complete',
    map: 'de_train',
    topFragScore: 72,
    topRoundScore: 98,
    teams: ['Präxxa', 'beta'],
    players: ['luddi'],
    crewAceCount: 3,
    crewAceMembers: ['luddement'],
    crewZeroTwelveCount: 1,
    crewZeroTwelveMembers: ['luddement'],
  },
];

describe('demo catalog', () => {
  it('searches filenames, teams, players and maps without caring about accents', () => {
    expect(filterDemoCatalog(demos, 'praxxa', 'all', 'date-desc')).toEqual([demos[1]]);
    expect(filterDemoCatalog(demos, 'ldmnt', 'all', 'date-desc')).toEqual([demos[0]]);
    expect(filterDemoCatalog(demos, 'de_nuke', 'all', 'date-desc')).toEqual([demos[0]]);
    expect(filterDemoCatalog(demos, 'crap ldmnt nuke', 'all', 'date-desc')).toEqual([demos[0]]);
  });

  it('filters years and sorts by the highest frag or round score', () => {
    expect(filterDemoCatalog(demos, '', 2004, 'date-desc')).toEqual([demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'frag-desc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'round-desc')).toEqual([demos[1], demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'ace-desc')).toEqual([demos[1], demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'zero-twelve-desc')).toEqual([demos[1], demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'comments-desc', new Map([
      [demos[0].path, 1],
      [demos[1].path, 3],
    ]))).toEqual([demos[1], demos[0]]);
  });

  it('sorts every column ascending as well, keeping missing scores last', () => {
    expect(filterDemoCatalog(demos, '', 'all', 'date-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'frag-asc')).toEqual([demos[1], demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'round-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'ace-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'zero-twelve-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'comments-asc', new Map([
      [demos[0].path, 3],
      [demos[1].path, 1],
    ]))).toEqual([demos[1], demos[0]]);

    const unscored: DemoCatalogEntry = { ...demos[0], path: 'x.dem', topFragScore: null };
    expect(filterDemoCatalog([unscored, demos[1]], '', 'all', 'frag-asc'))
      .toEqual([demos[1], unscored]);
    expect(filterDemoCatalog([unscored, demos[1]], '', 'all', 'frag-desc'))
      .toEqual([demos[1], unscored]);
  });

  it('sorts match and map names in both directions', () => {
    expect(filterDemoCatalog(demos, '', 'all', 'match-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'match-desc')).toEqual([demos[1], demos[0]]);
    expect(filterDemoCatalog(demos, '', 'all', 'map-asc')).toEqual([demos[0], demos[1]]);
    expect(filterDemoCatalog(demos, '', 'all', 'map-desc')).toEqual([demos[1], demos[0]]);
  });

  it('toggles a column between descending and ascending', () => {
    expect(toggleDemoCatalogSort('date-desc', 'date')).toBe('date-asc');
    expect(toggleDemoCatalogSort('date-asc', 'date')).toBe('date-desc');
    expect(toggleDemoCatalogSort('date-asc', 'zero-twelve')).toBe('zero-twelve-desc');
    expect(toggleDemoCatalogSort('zero-twelve-desc', 'zero-twelve')).toBe('zero-twelve-asc');
  });

  it('formats matchups and safely encodes nested archive URLs', () => {
    expect(demoCatalogMatchup(demos[0])).toBe('crap vs alpha');
    expect(demoCatalogAssetUrl('/demo-files', '2004/home 2/match.dem'))
      .toBe('/demo-files/2004/home%202/match.dem');
  });
});
