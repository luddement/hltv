import type { DeathEvent } from '/@/analysis/schema';

type Vector3 = readonly [number, number, number];

const BSP_LUMP_COUNT = 15;
const BSP_HEADER_SIZE = 4 + BSP_LUMP_COUNT * 8;
const PLANE_LUMP = 1;
const NODE_LUMP = 5;
const LEAF_LUMP = 10;
const MODEL_LUMP = 14;
const PLANE_SIZE = 20;
const NODE_SIZE = 24;
const LEAF_SIZE = 28;
const MODEL_SIZE = 64;
const SOLID_CONTENTS = -2;
const MAX_TRACE_DEPTH = 4_096;

type Lump = { offset: number; length: number };
type Plane = { normal: Vector3; distance: number };
type Node = { plane: number; children: readonly [number, number] };

const finiteVector = (value: number[] | null): value is [number, number, number] =>
  value?.length === 3 && value.every(Number.isFinite);

const vector = (value: Vector3, zOffset = 0): [number, number, number] =>
  [value[0], value[1], value[2] + zOffset];

const dot = (point: Vector3, normal: Vector3): number =>
  point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2];

const mix = (start: Vector3, end: Vector3, fraction: number): [number, number, number] => [
  start[0] + (end[0] - start[0]) * fraction,
  start[1] + (end[1] - start[1]) * fraction,
  start[2] + (end[2] - start[2]) * fraction,
];

const angleDelta = (left: number, right: number): number =>
  Math.abs((left - right + 540) % 360 - 180);

const aimedAtVictim = (start: Vector3, end: Vector3, angles: Vector3): boolean => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const targetYaw = Math.atan2(dy, dx) * 180 / Math.PI;
  const targetPitch = -Math.atan2(dz, Math.hypot(dx, dy)) * 180 / Math.PI;
  return angleDelta(angles[1], targetYaw) <= 12
    && angleDelta(angles[0], targetPitch) <= 12;
};

const canPenetrateWall = (weapon: string): boolean =>
  !['grenade', 'hegrenade', 'knife', 'world', 'trigger_hurt']
    .includes(weapon.toLowerCase());

export class GoldSrcBspTracer {
  private readonly planes: Plane[];
  private readonly nodes: Node[];
  private readonly leafContents: number[];
  private readonly headNode: number;

  constructor(buffer: ArrayBuffer) {
    if (buffer.byteLength < BSP_HEADER_SIZE) throw new Error('The BSP header is incomplete.');
    const view = new DataView(buffer);
    const lumps = Array.from({ length: BSP_LUMP_COUNT }, (_, index): Lump => {
      const offset = view.getInt32(4 + index * 8, true);
      const length = view.getInt32(8 + index * 8, true);
      if (offset < 0 || length < 0 || offset + length > buffer.byteLength) {
        throw new Error(`BSP lump ${index} is outside the file.`);
      }
      return { offset, length };
    });
    const planeLump = lumps[PLANE_LUMP];
    const nodeLump = lumps[NODE_LUMP];
    const leafLump = lumps[LEAF_LUMP];
    const modelLump = lumps[MODEL_LUMP];
    if (planeLump.length % PLANE_SIZE
      || nodeLump.length % NODE_SIZE
      || leafLump.length % LEAF_SIZE
      || modelLump.length < MODEL_SIZE) {
      throw new Error('The BSP collision tree has invalid lump sizes.');
    }
    this.planes = Array.from({ length: planeLump.length / PLANE_SIZE }, (_, index) => {
      const offset = planeLump.offset + index * PLANE_SIZE;
      return {
        normal: [
          view.getFloat32(offset, true),
          view.getFloat32(offset + 4, true),
          view.getFloat32(offset + 8, true),
        ],
        distance: view.getFloat32(offset + 12, true),
      };
    });
    this.nodes = Array.from({ length: nodeLump.length / NODE_SIZE }, (_, index) => {
      const offset = nodeLump.offset + index * NODE_SIZE;
      return {
        plane: view.getInt32(offset, true),
        children: [view.getInt16(offset + 4, true), view.getInt16(offset + 6, true)],
      };
    });
    this.leafContents = Array.from(
      { length: leafLump.length / LEAF_SIZE },
      (_, index) => view.getInt32(leafLump.offset + index * LEAF_SIZE, true),
    );
    this.headNode = view.getInt32(modelLump.offset + 36, true);
    if (!this.nodes[this.headNode]) throw new Error('The BSP world model head node is missing.');
  }

  private contents(nodeIndex: number): number {
    if (nodeIndex >= 0) throw new Error('Expected a BSP leaf.');
    const leafIndex = -1 - nodeIndex;
    const contents = this.leafContents[leafIndex];
    if (contents === undefined) throw new Error('The BSP node points to an unknown leaf.');
    return contents;
  }

  private pointContents(point: Vector3): number {
    let nodeIndex = this.headNode;
    for (let depth = 0; depth < MAX_TRACE_DEPTH && nodeIndex >= 0; depth += 1) {
      const node = this.nodes[nodeIndex];
      const plane = node && this.planes[node.plane];
      if (!node || !plane) throw new Error('BSP-noden eller planet saknas.');
      nodeIndex = node.children[dot(point, plane.normal) - plane.distance >= 0 ? 0 : 1];
    }
    if (nodeIndex >= 0) throw new Error('The BSP tree exceeded the maximum depth.');
    return this.contents(nodeIndex);
  }

  private crossesSolid(
    nodeIndex: number,
    start: Vector3,
    end: Vector3,
    depth: number,
  ): boolean {
    if (depth > MAX_TRACE_DEPTH) throw new Error('The BSP ray exceeded the maximum depth.');
    if (nodeIndex < 0) return this.contents(nodeIndex) === SOLID_CONTENTS;
    const node = this.nodes[nodeIndex];
    const plane = node && this.planes[node.plane];
    if (!node || !plane) throw new Error('BSP-noden eller planet saknas.');
    const startDistance = dot(start, plane.normal) - plane.distance;
    const endDistance = dot(end, plane.normal) - plane.distance;
    if (startDistance >= 0 && endDistance >= 0) {
      return this.crossesSolid(node.children[0], start, end, depth + 1);
    }
    if (startDistance < 0 && endDistance < 0) {
      return this.crossesSolid(node.children[1], start, end, depth + 1);
    }
    const fraction = Math.max(0, Math.min(1, startDistance / (startDistance - endDistance)));
    const middle = mix(start, end, fraction);
    const firstSide = startDistance >= 0 ? 0 : 1;
    return this.crossesSolid(node.children[firstSide], start, middle, depth + 1)
      || this.crossesSolid(node.children[1 - firstSide], middle, end, depth + 1);
  }

  segmentBlocked(start: Vector3, end: Vector3): boolean {
    if (this.pointContents(start) === SOLID_CONTENTS
      || this.pointContents(end) === SOLID_CONTENTS) return false;
    return this.crossesSolid(this.headNode, start, end, 0);
  }
}

export const detectWallbangEventIds = (
  buffer: ArrayBuffer,
  deaths: readonly DeathEvent[],
): ReadonlySet<string> => {
  const tracer = new GoldSrcBspTracer(buffer);
  const eventIds = new Set<string>();
  for (const death of deaths) {
    const killer = death.entityObservation.killer;
    const victim = death.entityObservation.victim;
    if (!death.killerPlayerId
      || death.worldKill
      || death.suicide
      || !canPenetrateWall(death.weapon)
      || !finiteVector(killer.positionValue)
      || !finiteVector(killer.angleValue)
      || !finiteVector(victim.positionValue)) continue;
    const start = vector(killer.positionValue, 17);
    const target = vector(victim.positionValue, 17);
    if (!aimedAtVictim(start, target, killer.angleValue)) continue;
    const targetOffsets = [10, 17, 24];
    if (targetOffsets.every((offset) =>
      tracer.segmentBlocked(start, vector(victim.positionValue as Vector3, offset)))) {
      eventIds.add(death.eventId);
    }
  }
  return eventIds;
};
