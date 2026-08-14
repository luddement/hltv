const VIEW_MODEL_ALIASES: Record<string, string> = {
  grenade: 'hegrenade',
  mp5navy: 'mp5',
};

const DISPLAY_ALIASES: Record<string, string> = {
  glock18: 'GLOCK',
  grenade: 'HE GRENADE',
  mp5navy: 'MP5',
};

export const normalizeFragWeapon = (weapon: string): string =>
  weapon.toLowerCase().replace(/[^a-z0-9_]/g, '');

export const fragWeaponLabel = (weapon: string): string => {
  const normalized = normalizeFragWeapon(weapon);
  return DISPLAY_ALIASES[normalized] ?? normalized.toUpperCase();
};

export const fragWeaponViewModel = (weapon: string): string => {
  const normalized = normalizeFragWeapon(weapon);
  return VIEW_MODEL_ALIASES[normalized] ?? normalized;
};
