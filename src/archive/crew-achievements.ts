import {
  completeAceGroups,
  playerSideAt,
  zeroTwelveSideMilestones,
} from '/@/analysis/achievements';
import type { DemoAnalysisIndex } from '/@/analysis/schema';
import { crewMemberForName } from '/@/archive/crew';

export type CrewDemoAchievements = {
  ace: boolean;
  crewAceCount: number;
  crewAceMembers: string[];
  zeroTwelve: boolean;
  crewZeroTwelveCount: number;
  crewZeroTwelveMembers: string[];
  crewZeroTwelveSides: { member: string; side: 'T' | 'CT' }[];
};

export const crewIdsByPlayerId = (
  players: DemoAnalysisIndex['players'],
): Map<string, string> => {
  const result = new Map<string, string>();
  for (const player of players) {
    for (const session of player.sessions) {
      const member = session.names
        .map((entry) => crewMemberForName(entry.value))
        .find(Boolean);
      if (member) {
        result.set(player.playerId, member.id);
        break;
      }
    }
  }
  return result;
};

export const summarizeCrewDemoAchievements = (
  index: Pick<DemoAnalysisIndex, 'players' | 'rounds' | 'events'>,
): CrewDemoAchievements => {
  const crewIdByPlayerId = crewIdsByPlayerId(index.players);
  const memberNames = new Map<string, string>();
  for (const player of index.players) {
    const memberId = crewIdByPlayerId.get(player.playerId);
    if (!memberId) continue;
    for (const session of player.sessions) {
      const member = session.names
        .map((entry) => crewMemberForName(entry.value))
        .find((candidate) => candidate?.id === memberId);
      if (member) memberNames.set(memberId, member.name);
    }
  }

  const aceMemberIds: string[] = [];
  for (const ace of completeAceGroups(index)) {
    const memberId = crewIdByPlayerId.get(ace.killerPlayerId);
    if (memberId) aceMemberIds.push(memberId);
  }

  const zeroTwelveRuns = zeroTwelveSideMilestones(
    index.events,
    (playerId) => crewIdByPlayerId.get(playerId),
    (playerId, atMs) => playerSideAt(index.players, playerId, atMs),
  );
  const zeroTwelveMemberIds = zeroTwelveRuns.map((run) => run.identity);
  const names = (memberIds: readonly string[]): string[] => [...new Set(memberIds)]
    .map((memberId) => memberNames.get(memberId) ?? memberId)
    .sort((left, right) => left.localeCompare(right, 'sv'));

  return {
    ace: aceMemberIds.length > 0,
    crewAceCount: aceMemberIds.length,
    crewAceMembers: names(aceMemberIds),
    zeroTwelve: zeroTwelveMemberIds.length > 0,
    crewZeroTwelveCount: zeroTwelveMemberIds.length,
    crewZeroTwelveMembers: names(zeroTwelveMemberIds),
    crewZeroTwelveSides: zeroTwelveRuns.map((run) => ({
      member: memberNames.get(run.identity) ?? run.identity,
      side: run.side === 'TERRORIST' ? 'T' : 'CT',
    })),
  };
};
