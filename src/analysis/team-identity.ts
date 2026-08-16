import type { PlayerIdentity } from '/@/analysis/schema';

export type CompetitiveSide = 'TERRORIST' | 'CT';
export type LogicalTeamId = 'team-1' | 'team-2';

export type LogicalTeam = {
  id: LogicalTeamId;
  name: string;
  initialSide: CompetitiveSide;
  playerIds: string[];
};

export type LogicalTeamIndex = {
  teams: [LogicalTeam, LogicalTeam];
  teamIdByPlayerId: Map<string, LogicalTeamId>;
};

const INITIAL_ROSTER_WINDOW_MS = 60_000;
const TEAM_NAME_STOP_WORDS = new Set([
  'counter', 'counterstrike', 'cs', 'ct', 'gaming', 'player', 'spelare',
  'team', 'terrorist', 'the', 'unnamed', 'unknown', 'okänd',
]);

const isCompetitiveSide = (value: string): value is CompetitiveSide =>
  value === 'TERRORIST' || value === 'CT';

const sideAt = (player: PlayerIdentity, atMs: number): CompetitiveSide | undefined => {
  for (const session of player.sessions) {
    if (session.joinedAtMs > atMs || (session.leftAtMs !== null && session.leftAtMs < atMs)) {
      continue;
    }
    const entry = session.teams.find((team) =>
      team.fromMs <= atMs && (team.toMs === null || atMs < team.toMs));
    if (entry && isCompetitiveSide(entry.value)) return entry.value;
  }
  return undefined;
};

const firstCompetitiveSide = (player: PlayerIdentity) => player.sessions
  .flatMap((session) => session.teams)
  .filter((entry) => isCompetitiveSide(entry.value))
  .sort((left, right) => left.fromMs - right.fromMs)[0];

const playerNames = (player: PlayerIdentity): string[] => Array.from(new Set(
  player.sessions.flatMap((session) => session.names.map((entry) => entry.value.trim()))
    .filter(Boolean),
));

const normalizedFullName = (name: string): string => name.normalize('NFKC')
  .toLocaleLowerCase('en-US')
  .replace(/[^\p{L}\p{N}]+/gu, '');

const meaningfulPrefix = (name: string): string | undefined => name.normalize('NFKC')
  .match(/[\p{L}\p{N}]+/gu)
  ?.find((token) => {
    const normalized = token.toLocaleLowerCase('en-US');
    return token.length >= 2
      && !/^\d+$/.test(token)
      && !TEAM_NAME_STOP_WORDS.has(normalized);
  });

export const inferTeamName = (names: readonly string[]): string | undefined => {
  const votes = new Map<string, { variants: Map<string, number>; players: number }>();
  for (const name of new Set(names)) {
    const prefix = meaningfulPrefix(name);
    if (!prefix) continue;
    const key = prefix.toLocaleLowerCase('en-US');
    const vote = votes.get(key) ?? { variants: new Map<string, number>(), players: 0 };
    vote.players += 1;
    vote.variants.set(prefix, (vote.variants.get(prefix) ?? 0) + 1);
    votes.set(key, vote);
  }

  const winner = [...votes.entries()]
    .filter(([, vote]) => vote.players >= 2)
    .sort(([leftKey, left], [rightKey, right]) =>
      right.players - left.players || leftKey.localeCompare(rightKey))[0];
  if (!winner) return undefined;
  return [...winner[1].variants.entries()]
    .sort(([left], [right]) => left.localeCompare(right))[0]?.[0];
};

export const buildLogicalTeamIndex = (players: readonly PlayerIdentity[]): LogicalTeamIndex => {
  const firstSides = players.flatMap((player) => {
    const entry = firstCompetitiveSide(player);
    return entry ? [{ player, side: entry.value as CompetitiveSide, atMs: entry.fromMs }] : [];
  }).sort((left, right) => left.atMs - right.atMs);
  const firstRosterAtMs = firstSides[0]?.atMs ?? 0;
  const teamIdByPlayerId = new Map<string, LogicalTeamId>();
  const teamForInitialSide = (side: CompetitiveSide): LogicalTeamId =>
    side === 'TERRORIST' ? 'team-1' : 'team-2';

  for (const entry of firstSides) {
    if (entry.atMs <= firstRosterAtMs + INITIAL_ROSTER_WINDOW_MS) {
      teamIdByPlayerId.set(entry.player.playerId, teamForInitialSide(entry.side));
    }
  }

  // Late joins and reconnects inherit identity from an exact normalized nick,
  // or from the already-known roster occupying their side at join time. This
  // is what keeps a substitute attached to the team after a halftime swap.
  for (const entry of firstSides) {
    if (teamIdByPlayerId.has(entry.player.playerId)) continue;
    const nameMatches = new Set<LogicalTeamId>();
    const names = new Set(playerNames(entry.player).map(normalizedFullName).filter(Boolean));
    for (const known of players) {
      const knownTeam = teamIdByPlayerId.get(known.playerId);
      if (!knownTeam) continue;
      if (playerNames(known).some((name) => names.has(normalizedFullName(name)))) {
        nameMatches.add(knownTeam);
      }
    }
    if (nameMatches.size === 1) {
      teamIdByPlayerId.set(entry.player.playerId, [...nameMatches][0]);
      continue;
    }

    const sideVotes = new Map<LogicalTeamId, number>([['team-1', 0], ['team-2', 0]]);
    for (const known of players) {
      const knownTeam = teamIdByPlayerId.get(known.playerId);
      if (knownTeam && sideAt(known, entry.atMs) === entry.side) {
        sideVotes.set(knownTeam, (sideVotes.get(knownTeam) ?? 0) + 1);
      }
    }
    const orderedVotes = [...sideVotes.entries()].sort((left, right) => right[1] - left[1]);
    const inferred = orderedVotes[0][1] > orderedVotes[1][1]
      ? orderedVotes[0][0]
      : teamForInitialSide(entry.side);
    teamIdByPlayerId.set(entry.player.playerId, inferred);
  }

  const team = (id: LogicalTeamId, initialSide: CompetitiveSide, fallback: string): LogicalTeam => {
    const members = players.filter((player) => teamIdByPlayerId.get(player.playerId) === id);
    return {
      id,
      initialSide,
      name: inferTeamName(members.flatMap(playerNames)) ?? fallback,
      playerIds: members.map((player) => player.playerId),
    };
  };
  const teams: [LogicalTeam, LogicalTeam] = [
    team('team-1', 'TERRORIST', 'Team 1'),
    team('team-2', 'CT', 'Team 2'),
  ];
  if (teams[0].name.toLocaleLowerCase('en-US') === teams[1].name.toLocaleLowerCase('en-US')) {
    teams[0].name = 'Team 1';
    teams[1].name = 'Team 2';
  }
  return { teams, teamIdByPlayerId };
};

export const logicalTeamForSideAt = (
  index: LogicalTeamIndex,
  players: readonly PlayerIdentity[],
  side: CompetitiveSide,
  atMs: number,
): LogicalTeamId => {
  const votes = new Map<LogicalTeamId, number>([['team-1', 0], ['team-2', 0]]);
  for (const player of players) {
    const teamId = index.teamIdByPlayerId.get(player.playerId);
    if (teamId && sideAt(player, atMs) === side) {
      votes.set(teamId, (votes.get(teamId) ?? 0) + 1);
    }
  }
  const ordered = [...votes.entries()].sort((left, right) => right[1] - left[1]);
  return ordered[0][1] > ordered[1][1]
    ? ordered[0][0]
    : side === 'TERRORIST' ? 'team-1' : 'team-2';
};
