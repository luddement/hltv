export type DemoCatalogEntry = {
  path: string;
  filename: string;
  year: number | null;
  recordedAt: string | null;
  sizeBytes: number;
  sha256: string | null;
  status: 'complete' | 'partial' | 'error';
  error?: string;
  map?: string;
  mapChecksum?: string;
  networkProtocol?: number;
  perspective?: 'hltv' | 'pov';
  durationSeconds?: number;
  roundCount?: number;
  deathCount?: number;
  fragCount?: number;
  topFragScore?: number | null;
  topRoundScore?: number | null;
  topMomentScore?: number | null;
  momentCount?: number;
  teams?: string[];
  players?: string[];
  /** Matchflagga: minst en identifierad PRAXXA-medlem gjorde ett komplett ace. */
  ace?: boolean;
  crewAceCount?: number;
  crewAceMembers?: string[];
  /** Matchflagga: minst en identifierad PRAXXA-medlem nådde 0–12. */
  zeroTwelve?: boolean;
  crewZeroTwelveCount?: number;
  crewZeroTwelveMembers?: string[];
  analyzerVersion?: string;
};

export type DemoCatalog = {
  generatedAt: string;
  analyzerVersion: string;
  demoCount: number;
  demos: DemoCatalogEntry[];
};

export type DemoCatalogSort =
  | 'date-desc'
  | 'date-asc'
  | 'frag-desc'
  | 'round-desc'
  | 'comments-desc'
  | 'ace-desc'
  | 'zero-twelve-desc';

const searchableText = (entry: DemoCatalogEntry): string => [
  entry.filename,
  entry.path,
  entry.map,
  entry.recordedAt,
  entry.year,
  ...(entry.teams ?? []),
  ...(entry.players ?? []),
  ...(entry.crewAceMembers ?? []),
  ...(entry.crewZeroTwelveMembers ?? []),
].filter((value) => value !== undefined && value !== null).join(' ')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en-GB');

const descendingScore = (
  left: number | null | undefined,
  right: number | null | undefined,
): number => (right ?? -1) - (left ?? -1);

const descendingDate = (left: DemoCatalogEntry, right: DemoCatalogEntry): number =>
  (right.recordedAt ?? '').localeCompare(left.recordedAt ?? '');

export const filterDemoCatalog = (
  entries: readonly DemoCatalogEntry[],
  query: string,
  year: 'all' | number,
  sort: DemoCatalogSort,
  commentCounts: ReadonlyMap<string, number> = new Map(),
): DemoCatalogEntry[] => {
  const normalizedQuery = query.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('en-GB');
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const filtered = entries.filter((entry) => {
    if (year !== 'all' && entry.year !== year) return false;
    const haystack = searchableText(entry);
    return queryTerms.every((term) => haystack.includes(term));
  });

  return [...filtered].sort((left, right) => {
    if (sort === 'frag-desc') {
      return descendingScore(left.topFragScore, right.topFragScore)
        || descendingDate(left, right);
    }
    if (sort === 'round-desc') {
      return descendingScore(left.topRoundScore, right.topRoundScore)
        || descendingDate(left, right);
    }
    if (sort === 'comments-desc') {
      return (commentCounts.get(right.path) ?? 0) - (commentCounts.get(left.path) ?? 0)
        || descendingDate(left, right);
    }
    if (sort === 'ace-desc') {
      return descendingScore(left.crewAceCount, right.crewAceCount)
        || descendingDate(left, right);
    }
    if (sort === 'zero-twelve-desc') {
      return descendingScore(left.crewZeroTwelveCount, right.crewZeroTwelveCount)
        || descendingDate(left, right);
    }
    if (sort === 'date-asc') {
      return (left.recordedAt ?? '9999').localeCompare(right.recordedAt ?? '9999');
    }
    return descendingDate(left, right);
  });
};

export const demoCatalogMatchup = (entry: DemoCatalogEntry): string => {
  const teams = (entry.teams ?? []).filter(Boolean).slice(0, 2);
  return teams.length === 2 ? teams.join(' vs ') : teams[0] ?? 'Teams unknown';
};

export const demoCatalogAssetUrl = (base: string, path: string): string =>
  `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
