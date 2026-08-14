import { describe, expect, it } from 'vitest';
import {
  fragWeaponLabel,
  fragWeaponViewModel,
} from '/@/demo/weapon-presentation';

const CS_FRAG_WEAPONS = [
  'p228', 'scout', 'xm1014', 'mac10', 'aug', 'elite', 'fiveseven', 'ump45',
  'sg550', 'galil', 'famas', 'usp', 'glock18', 'awp', 'mp5navy', 'm249',
  'm3', 'm4a1', 'tmp', 'g3sg1', 'deagle', 'sg552', 'ak47', 'knife', 'p90',
  'grenade',
] as const;

describe('frag weapon presentation', () => {
  it('maps every CS 1.6 frag weapon to a safe viewmodel name', () => {
    for (const weapon of CS_FRAG_WEAPONS) {
      expect(fragWeaponViewModel(weapon)).toMatch(/^[a-z0-9_]+$/);
      expect(fragWeaponLabel(weapon)).not.toBe('');
    }
  });

  it('handles GoldSrc DeathMsg names that differ from model filenames', () => {
    expect(fragWeaponViewModel('mp5navy')).toBe('mp5');
    expect(fragWeaponViewModel('grenade')).toBe('hegrenade');
    expect(fragWeaponLabel('mp5navy')).toBe('MP5');
    expect(fragWeaponLabel('glock18')).toBe('GLOCK');
    expect(fragWeaponLabel('grenade')).toBe('HE GRENADE');
  });
});
