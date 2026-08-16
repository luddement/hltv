import { describe, expect, it } from 'vitest';
import { GoldSrcBspTracer } from '/@/demo/goldsrc-bsp-trace';

const collisionFixture = (): ArrayBuffer => {
  const headerSize = 124;
  const planesOffset = headerSize;
  const nodesOffset = planesOffset + 40;
  const leavesOffset = nodesOffset + 48;
  const modelsOffset = leavesOffset + 84;
  const buffer = new ArrayBuffer(modelsOffset + 64);
  const view = new DataView(buffer);
  view.setInt32(0, 30, true);
  const lump = (index: number, offset: number, length: number) => {
    view.setInt32(4 + index * 8, offset, true);
    view.setInt32(8 + index * 8, length, true);
  };
  lump(1, planesOffset, 40);
  lump(5, nodesOffset, 48);
  lump(10, leavesOffset, 84);
  lump(14, modelsOffset, 64);

  // Two x-planes create empty -> solid wall -> empty.
  view.setFloat32(planesOffset, 1, true);
  view.setFloat32(planesOffset + 12, 1, true);
  view.setFloat32(planesOffset + 20, 1, true);
  view.setFloat32(planesOffset + 32, -1, true);
  view.setInt32(nodesOffset, 0, true);
  view.setInt16(nodesOffset + 4, -1, true);
  view.setInt16(nodesOffset + 6, 1, true);
  view.setInt32(nodesOffset + 24, 1, true);
  view.setInt16(nodesOffset + 28, -2, true);
  view.setInt16(nodesOffset + 30, -3, true);
  view.setInt32(leavesOffset, -1, true);
  view.setInt32(leavesOffset + 28, -2, true);
  view.setInt32(leavesOffset + 56, -1, true);
  view.setInt32(modelsOffset + 36, 0, true);
  return buffer;
};

describe('GoldSrc BSP collision trace', () => {
  it('distinguishes a clear sightline from a segment crossing solid world geometry', () => {
    const tracer = new GoldSrcBspTracer(collisionFixture());
    expect(tracer.segmentBlocked([10, 0, 0], [5, 0, 0])).toBe(false);
    expect(tracer.segmentBlocked([10, 0, 0], [-10, 0, 0])).toBe(true);
  });
});
