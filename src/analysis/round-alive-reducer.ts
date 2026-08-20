import type { EvidenceValue, RoundSummary } from '/@/analysis/schema';

export type CompetitiveTeam = 'TERRORIST' | 'CT';

export type AliveCounts = {
  terrorists: EvidenceValue<number>;
  counterTerrorists: EvidenceValue<number>;
};

type PlayerRoundState = {
  team: string | undefined;
  alive: boolean | null;
};

const isCompetitiveTeam = (team: string | undefined): team is CompetitiveTeam =>
  team === 'TERRORIST' || team === 'CT';

export class RoundAliveReducer {
  readonly rounds: RoundSummary[] = [];
  private readonly players = new Map<string, PlayerRoundState>();

  get currentRound(): RoundSummary | undefined {
    return this.rounds.at(-1);
  }

  joinPlayer(playerId: string): void {
    this.players.set(playerId, { team: undefined, alive: null });
  }

  leavePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  setTeam(playerId: string, team: string): void {
    const player = this.players.get(playerId);
    if (player) player.team = team;
  }

  startRound(atMs: number): RoundSummary {
    const previousRound = this.currentRound;
    if (previousRound && previousRound.endTimeMs === null) previousRound.endTimeMs = atMs;

    const round: RoundSummary = {
      roundId: `round-${this.rounds.length + 1}`,
      number: this.rounds.length + 1,
      startTimeMs: atMs,
      endTimeMs: null,
      winner: { value: null, evidence: 'unknown' },
      deathEventIds: [],
    };
    this.rounds.push(round);
    for (const player of this.players.values()) {
      player.alive = isCompetitiveTeam(player.team) ? true : null;
    }
    return round;
  }

  discardCurrentRound(): RoundSummary | undefined {
    const round = this.currentRound;
    if (!round || round.endTimeMs !== null) return undefined;
    this.rounds.pop();
    for (const player of this.players.values()) player.alive = null;
    return round;
  }

  clearRounds(): RoundSummary[] {
    const removed = this.rounds.splice(0);
    for (const player of this.players.values()) player.alive = null;
    return removed;
  }

  aliveCounts(): AliveCounts {
    return {
      terrorists: this.knownCount('TERRORIST'),
      counterTerrorists: this.knownCount('CT'),
    };
  }

  recordDeath(eventId: string, victimPlayerId: string | null): AliveCounts {
    const before = this.aliveCounts();
    if (this.currentRound) this.currentRound.deathEventIds.push(eventId);
    if (victimPlayerId) {
      const victim = this.players.get(victimPlayerId);
      if (victim) victim.alive = false;
    }
    return before;
  }

  endRound(atMs: number, winner: CompetitiveTeam): RoundSummary | undefined {
    const round = this.currentRound;
    if (!round || round.endTimeMs !== null) return undefined;
    round.endTimeMs = atMs;
    round.winner = { value: winner, evidence: 'derived' };
    return round;
  }

  private knownCount(team: CompetitiveTeam): EvidenceValue<number> {
    const players = Array.from(this.players.values()).filter((player) => player.team === team);
    if (!players.length || players.some((player) => player.alive === null)) {
      return { value: null, evidence: 'unknown' };
    }
    return {
      value: players.filter((player) => player.alive).length,
      evidence: 'derived',
    };
  }
}
