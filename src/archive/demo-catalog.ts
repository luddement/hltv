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
  /** Matchflagga: en PRAXXA-medlem hade 12 deaths utan frag som T eller CT. */
  zeroTwelve?: boolean;
  crewZeroTwelveCount?: number;
  crewZeroTwelveMembers?: string[];
  crewZeroTwelveSides?: { member: string; side: 'T' | 'CT' }[];
  analyzerVersion?: string;
};

export type DemoCatalog = {
  generatedAt: string;
  analyzerVersion: string;
  demoCount: number;
  demos: DemoCatalogEntry[];
};

export type DemoCatalogSortColumn =
  | 'date'
  | 'match'
  | 'map'
  | 'frag'
  | 'round'
  | 'comments'
  | 'ace'
  | 'zero-twelve';

export type DemoCatalogSortDirection = 'asc' | 'desc';

export type DemoCatalogSort = `${DemoCatalogSortColumn}-${DemoCatalogSortDirection}`;

export const demoCatalogSortColumns: readonly DemoCatalogSortColumn[] = [
  'date', 'match', 'map', 'frag', 'round', 'comments', 'ace', 'zero-twelve',
];

export const demoCatalogSortValues: readonly DemoCatalogSort[] = demoCatalogSortColumns
  .flatMap((column) => [`${column}-desc`, `${column}-asc`] as DemoCatalogSort[]);

export const demoCatalogSortColumn = (sort: DemoCatalogSort): DemoCatalogSortColumn =>
  sort.slice(0, sort.lastIndexOf('-')) as DemoCatalogSortColumn;

export const demoCatalogSortDirection = (sort: DemoCatalogSort): DemoCatalogSortDirection =>
  (sort.endsWith('-asc') ? 'asc' : 'desc');

export const toggleDemoCatalogSort = (
  sort: DemoCatalogSort,
  column: DemoCatalogSortColumn,
): DemoCatalogSort => (
  demoCatalogSortColumn(sort) === column && demoCatalogSortDirection(sort) === 'desc'
    ? `${column}-asc`
    : `${column}-desc`
);

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

const compareScore = (
  left: number | null | undefined,
  right: number | null | undefined,
  direction: DemoCatalogSortDirection,
): number => {
  // Missing scores always sink to the bottom, in both directions.
  if (left === null || left === undefined) return (right === null || right === undefined) ? 0 : 1;
  if (right === null || right === undefined) return -1;
  return direction === 'asc' ? left - right : right - left;
};

const compareDate = (
  left: DemoCatalogEntry,
  right: DemoCatalogEntry,
  direction: DemoCatalogSortDirection,
): number => (direction === 'asc'
  ? (left.recordedAt ?? '9999').localeCompare(right.recordedAt ?? '9999')
  : (right.recordedAt ?? '').localeCompare(left.recordedAt ?? ''));

const compareText = (
  left: string | null | undefined,
  right: string | null | undefined,
  direction: DemoCatalogSortDirection,
): number => {
  const leftValue = left?.trim();
  const rightValue = right?.trim();
  if (!leftValue) return rightValue ? 1 : 0;
  if (!rightValue) return -1;
  const compared = leftValue.localeCompare(rightValue, 'en-GB', { sensitivity: 'base' });
  return direction === 'asc' ? compared : -compared;
};

const columnScore = (
  entry: DemoCatalogEntry,
  column: DemoCatalogSortColumn,
  commentCounts: ReadonlyMap<string, number>,
): number | null | undefined => {
  if (column === 'frag') return entry.topFragScore;
  if (column === 'round') return entry.topRoundScore;
  if (column === 'ace') return entry.crewAceCount;
  if (column === 'zero-twelve') return entry.crewZeroTwelveCount;
  return commentCounts.get(entry.path) ?? 0;
};

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

  const column = demoCatalogSortColumn(sort);
  const direction = demoCatalogSortDirection(sort);

  return [...filtered].sort((left, right) => {
    if (column === 'date') return compareDate(left, right, direction);
    if (column === 'match') {
      return compareText(demoCatalogMatchup(left), demoCatalogMatchup(right), direction)
        || compareDate(left, right, 'desc');
    }
    if (column === 'map') {
      return compareText(left.map, right.map, direction)
        || compareDate(left, right, 'desc');
    }
    return compareScore(
      columnScore(left, column, commentCounts),
      columnScore(right, column, commentCounts),
      direction,
    ) || compareDate(left, right, 'desc');
  });
};

export const demoCatalogMatchup = (entry: DemoCatalogEntry): string => {
  const teams = (entry.teams ?? []).filter(Boolean).slice(0, 2);
  return teams.length === 2 ? teams.join(' vs ') : teams[0] ?? 'Teams unknown';
};

export const demoCatalogAssetUrl = (base: string, path: string): string =>
  `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
