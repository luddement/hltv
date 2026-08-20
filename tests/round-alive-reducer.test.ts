import { describe, expect, it } from 'vitest';
import { RoundAliveReducer } from '/@/analysis/round-alive-reducer';

describe('RoundAliveReducer', () => {
  it('tracks alive counts before each death and resets them at round start', () => {
    const reducer = new RoundAliveReducer();
    reducer.joinPlayer('t-1');
    reducer.joinPlayer('t-2');
    reducer.joinPlayer('ct-1');
    reducer.setTeam('t-1', 'TERRORIST');
    reducer.setTeam('t-2', 'TERRORIST');
    reducer.setTeam('ct-1', 'CT');

    reducer.startRound(1_000);
    expect(reducer.recordDeath('death-1', 't-2')).toEqual({
      terrorists: { value: 2, evidence: 'derived' },
      counterTerrorists: { value: 1, evidence: 'derived' },
    });
    expect(reducer.aliveCounts().terrorists.value).toBe(1);

    reducer.startRound(10_000);
    expect(reducer.aliveCounts().terrorists.value).toBe(2);
    expect(reducer.rounds[0].endTimeMs).toBe(10_000);
  });

  it('keeps counts unknown until every relevant player has known alive state', () => {
    const reducer = new RoundAliveReducer();
    reducer.joinPlayer('late-player');
    reducer.setTeam('late-player', 'CT');
    expect(reducer.aliveCounts().counterTerrorists).toEqual({
      value: null,
      evidence: 'unknown',
    });
  });

  it('removes disconnected players and records the round winner', () => {
    const reducer = new RoundAliveReducer();
    reducer.joinPlayer('t-1');
    reducer.joinPlayer('ct-1');
    reducer.setTeam('t-1', 'TERRORIST');
    reducer.setTeam('ct-1', 'CT');
    reducer.startRound(1_000);
    reducer.leavePlayer('ct-1');

    expect(reducer.aliveCounts().counterTerrorists.value).toBeNull();
    expect(reducer.endRound(9_000, 'TERRORIST')).toMatchObject({
      endTimeMs: 9_000,
      winner: { value: 'TERRORIST', evidence: 'derived' },
    });
    expect(reducer.endRound(9_500, 'CT')).toBeUndefined();
  });

  it('can discard an interrupted round or clear pre-match rounds', () => {
    const reducer = new RoundAliveReducer();
    reducer.startRound(1_000);
    expect(reducer.discardCurrentRound()?.roundId).toBe('round-1');
    expect(reducer.rounds).toHaveLength(0);

    reducer.startRound(2_000);
    reducer.endRound(3_000, 'CT');
    reducer.startRound(4_000);
    expect(reducer.clearRounds().map((round) => round.roundId)).toEqual(['round-1', 'round-2']);
    expect(reducer.rounds).toHaveLength(0);
  });
});
