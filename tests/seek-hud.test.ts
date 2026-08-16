import { describe, expect, it } from 'vitest';
import { hiddenSeekHudCommands } from '/@/demo/seek-hud';

describe('hidden seek HUD presentation', () => {
  it('expires transient native messages while demo packets are fast-forwarded', () => {
    expect(hiddenSeekHudCommands(true)).toEqual([
      'hud_saytext_time 0',
      'hud_deathnotice_time 0',
      'scr_centertime 0',
      'hud_centerid 0',
    ]);
  });

  it('restores chat, current killfeed, center text and player IDs for visible preroll', () => {
    expect(hiddenSeekHudCommands(false)).toEqual([
      'hud_saytext_time 5',
      'hud_deathnotice_time 6',
      'scr_centertime 2',
      'hud_centerid 1',
    ]);
  });
});
