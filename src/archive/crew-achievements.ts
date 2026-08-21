import { completeAceGroups, playerScorelines } from '/@/analysis/achievements';
import type { DemoAnalysisIndex } from '/@/analysis/schema';
import { crewMemberForName } from '/@/archive/crew';

export type CrewDemoAchievements = {
  ace: boolean;
  crewAceCount: number;
  crewAceMembers: string[];
  zeroTwelve: boolean;
  crewZeroTwelveCount: number;
  crewZeroTwelveMembers: string[];
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

  const totalsByMember = new Map<string, { kills: number; deaths: number }>();
  for (const [playerId, scoreline] of playerScorelines(index.events)) {
    const memberId = crewIdByPlayerId.get(playerId);
    if (!memberId) continue;
    const total = totalsByMember.get(memberId) ?? { kills: 0, deaths: 0 };
    total.kills += scoreline.kills;
    total.deaths += scoreline.deaths;
    totalsByMember.set(memberId, total);
  }
  const zeroTwelveMemberIds = [...totalsByMember]
    .filter(([, scoreline]) => scoreline.kills === 0 && scoreline.deaths === 12)
    .map(([memberId]) => memberId);
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
  };
};
