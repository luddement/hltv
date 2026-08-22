import { describe, expect, it } from 'vitest';
import {
  buildReplayRoute,
  EMPTY_REPLAY_ROUTE,
  parseReplayRoute,
  sameReplayRoute,
  type ReplayRoute,
} from '/@/app/replay-route';

const route = (over: Partial<ReplayRoute> = {}): ReplayRoute => ({ ...EMPTY_REPLAY_ROUTE, ...over });

describe('delbara länkar', () => {
  it('tomt läge blir roten utan frågesträng', () => {
    expect(buildReplayRoute(EMPTY_REPLAY_ROUTE)).toBe('/');
  });

  it('bär demons sökväg utan att koda om katalogstrukturen', () => {
    const built = buildReplayRoute(route({ demoPath: '2005/sticky_e-0512190355-de_inferno.dem' }));
    expect(built).toBe('/demo/2005/sticky_e-0512190355-de_inferno.dem');
  });

  it('tar bara med det som avviker från standardläget', () => {
    const built = buildReplayRoute(route({
      demoPath: '2005/x.dem',
      player: 'p7',
      search: 'awp',
      sort: 'score',
      headshotsOnly: true,
    }));
    expect(built).toBe('/demo/2005/x.dem?player=p7&q=awp&sort=score&hs=1');
  });

  it('bevarar den explicita debug-flaggan men utelämnar den i normalläget', () => {
    const built = buildReplayRoute(route({ demoPath: '2005/x.dem', debug: true }));
    expect(built).toBe('/demo/2005/x.dem?debug=true');
    expect(parseReplayRoute(`https://praxxa.pro${built}`).debug).toBe(true);
    expect(parseReplayRoute('https://praxxa.pro/demo/2005/x.dem?debug=1').debug).toBe(false);
  });

  it('rundgång: allt som byggs går att läsa tillbaka', () => {
    const original = route({
      demoPath: '2007/dik_seconds-0711122044-de_clan1_mill.dem',
      team: 'team-2',
      search: 'jokkinho ak47',
      sort: 'score',
      headshotsOnly: true,
    });
    const parsed = parseReplayRoute(`https://praxxa.pro${buildReplayRoute(original)}`);
    expect(sameReplayRoute(parsed, original)).toBe(true);
  });

  it('klarar mellanslag och specialtecken i sökningen', () => {
    const built = buildReplayRoute(route({ demoPath: '2005/x.dem', search: 'a b&c=d' }));
    const parsed = parseReplayRoute(`https://praxxa.pro${built}`);
    expect(parsed.search).toBe('a b&c=d');
  });

  it('hashen är bara rullningsmål, aldrig tillstånd', () => {
    const parsed = parseReplayRoute('https://praxxa.pro/demo/2005/x.dem?player=p1#only-frags');
    expect(parsed.anchor).toBe('only-frags');
    expect(parsed.player).toBe('p1');
    expect(buildReplayRoute(parsed)).toBe('/demo/2005/x.dem?player=p1#only-frags');
  });

  it('en adress utan demo ger tomt läge, inte ett fel', () => {
    expect(parseReplayRoute('https://praxxa.pro/').demoPath).toBe('');
    expect(parseReplayRoute('inte en url').demoPath).toBe('');
  });

  it('okänd sorteringsflagga faller tillbaka på matchtid', () => {
    expect(parseReplayRoute('https://praxxa.pro/demo/a.dem?sort=hittepå').sort).toBe('time');
  });
});
