/**
 * Delbara länkar till en vald demo och dess Only Frags-inställningar.
 *
 * Riktiga sökvägar, inga hashar för tillstånd:
 *
 *   /demo/2005/sticky_e-0512190355-de_inferno.dem?player=<id>&sort=score&hs=1
 *
 * Hashen används bara till det den är till för — vilket element sidan ska
 * rulla till, t.ex. `#only-frags`.
 *
 * Modulen är avsiktligt fri från Vue och DOM: ren strängbearbetning som går
 * att testa utan webbläsare.
 */

export type ReplaySort = 'time' | 'score';

export type ReplayRoute = {
  /** Katalogpostens path, t.ex. "2005/sticky_e-0512190355-de_inferno.dem". */
  demoPath: string;
  team: string;
  player: string;
  search: string;
  sort: ReplaySort;
  headshotsOnly: boolean;
  /** Enables experimental controls without changing the normal player. */
  debug: boolean;
  /** Element att rulla till, utan '#'. */
  anchor: string;
};

export const EMPTY_REPLAY_ROUTE: ReplayRoute = {
  demoPath: '',
  team: 'all',
  player: 'all',
  search: '',
  sort: 'time',
  headshotsOnly: false,
  debug: false,
  anchor: '',
};

const DEMO_PREFIX = '/demo/';

export const parseReplayRoute = (href: string): ReplayRoute => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ...EMPTY_REPLAY_ROUTE };
  }

  const demoPath = url.pathname.startsWith(DEMO_PREFIX)
    // Varje segment avkodas för sig; sökvägens '/' är struktur, inte data.
    ? url.pathname.slice(DEMO_PREFIX.length).split('/').map(decodeURIComponent).join('/')
    : '';

  const query = url.searchParams;
  return {
    demoPath,
    team: query.get('team') || 'all',
    player: query.get('player') || 'all',
    search: query.get('q') ?? '',
    sort: query.get('sort') === 'score' ? 'score' : 'time',
    headshotsOnly: query.get('hs') === '1',
    debug: query.get('debug') === 'true',
    anchor: url.hash.replace(/^#/, ''),
  };
};

export const buildReplayRoute = (route: ReplayRoute): string => {
  const path = route.demoPath
    ? DEMO_PREFIX + route.demoPath.split('/').map(encodeURIComponent).join('/')
    : '/';

  // Bara det som avviker från standardläget hamnar i länken, så en delad
  // adress säger vad som faktiskt valts i stället för att räkna upp allt.
  const query = new URLSearchParams();
  if (route.team !== 'all') query.set('team', route.team);
  if (route.player !== 'all') query.set('player', route.player);
  if (route.search) query.set('q', route.search);
  if (route.sort !== 'time') query.set('sort', route.sort);
  if (route.headshotsOnly) query.set('hs', '1');
  if (route.debug) query.set('debug', 'true');

  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ''}${route.anchor ? `#${route.anchor}` : ''}`;
};

/** Sant när två rutter beskriver samma vy, hash oräknad. */
export const sameReplayRoute = (a: ReplayRoute, b: ReplayRoute): boolean =>
  a.demoPath === b.demoPath
  && a.team === b.team
  && a.player === b.player
  && a.search === b.search
  && a.sort === b.sort
  && a.headshotsOnly === b.headshotsOnly
  && a.debug === b.debug;
