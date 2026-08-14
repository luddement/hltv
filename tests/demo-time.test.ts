import { describe, expect, it } from 'vitest';
import { formatDemoTime } from '../src/demo/demo-time';

describe('demo time presentation', () => {
  it('hides sub-second precision from the viewer HUD', () => {
    expect(formatDemoTime(1_522_233.3999999047)).toBe('25:22');
    expect(formatDemoTime(1_522_999.9)).toBe('25:22');
  });

  it('always pads seconds', () => {
    expect(formatDemoTime(61_004)).toBe('1:01');
  });
});
