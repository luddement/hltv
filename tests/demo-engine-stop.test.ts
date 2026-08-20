import { describe, expect, it } from 'vitest';
import DemoEngine from '../src/services/demo-engine';

type TestEngine = {
  xash?: { running: boolean; quit: () => void };
  stop: () => void;
};

describe('demo engine shutdown', () => {
  it('accepts Emscripten numeric exit sentinels after demo EOF', () => {
    const engine = DemoEngine as unknown as TestEngine;
    engine.xash = { running: true, quit: () => { throw Number.POSITIVE_INFINITY; } };
    expect(() => engine.stop()).not.toThrow();
  });

  it('preserves real JavaScript shutdown failures', () => {
    const engine = DemoEngine as unknown as TestEngine;
    engine.xash = { running: true, quit: () => { throw new Error('shutdown failed'); } };
    expect(() => engine.stop()).toThrow('shutdown failed');
  });
});
