type TransientHudCvar = {
  name: string;
  visibleValue: string;
};

// Demo packets are still consumed while rendering is disabled for a seek.
// Give transient native HUD queues a zero lifetime during that hidden phase,
// then restore their normal timings for the visible three-second preroll.
const TRANSIENT_HUD_CVARS: readonly TransientHudCvar[] = [
  { name: 'hud_saytext_time', visibleValue: '5' },
  { name: 'hud_deathnotice_time', visibleValue: '6' },
  { name: 'scr_centertime', visibleValue: '2' },
  { name: 'hud_centerid', visibleValue: '1' },
];

export const hiddenSeekHudCommands = (hidden: boolean): string[] =>
  TRANSIENT_HUD_CVARS.map(({ name, visibleValue }) =>
    `${name} ${hidden ? '0' : visibleValue}`);
