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

/**
 * Tömmer klientens interna HUD-köer på riktigt: chatten (CHudSayText), gammal
 * killfeed, center-meddelanden och statusraden. Registreras av den patchade
 * CS-klienten från och med cs16-client-hltv-v15.
 *
 * Behövs eftersom noll livstid bara hindrar NYA rader från att ligga kvar.
 * De gamla står orörda i klientens buffer och ritas ut igen så fort tiderna
 * återställs — vilket är precis vad som syntes som kvarhängande chatt.
 */
export const CLEAR_TRANSIENT_HUD_COMMAND = 'hltv_clear_transient_hud';
