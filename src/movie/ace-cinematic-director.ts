import type { DeathEvent, HighlightMoment } from '/@/analysis/schema';

export type CinematicVector = [number, number, number];

export type AceCinematicPass = {
  id: string;
  label: string;
  mode: 'pov' | 'chase' | 'overview' | 'camera';
  startTimeMs: number;
  endTimeMs: number;
  targetSlot: number;
  from?: CinematicVector;
  to?: CinematicVector;
  lookAtFrom?: CinematicVector;
  lookAtTo?: CinematicVector;
  arcHeight?: number;
  rollDegrees?: number;
};

export type AceCinematicPlan = {
  killerPlayerId: string;
  killerSlot: number;
  deaths: DeathEvent[];
  passes: AceCinematicPass[];
  visibleDurationMs: number;
};

export type CinematicCameraFrame = {
  origin: CinematicVector;
  angles: CinematicVector;
};

const add = (left: CinematicVector, right: CinematicVector): CinematicVector => [
  left[0] + right[0], left[1] + right[1], left[2] + right[2],
];
const scale = (vector: CinematicVector, amount: number): CinematicVector => [
  vector[0] * amount, vector[1] * amount, vector[2] * amount,
];
const lerp = (from: CinematicVector, to: CinematicVector, amount: number): CinematicVector => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];
const average = (points: CinematicVector[]): CinematicVector => {
  if (!points.length) return [0, 0, 0];
  return scale(points.reduce(add, [0, 0, 0] as CinematicVector), 1 / points.length);
};
const finitePosition = (value: CinematicVector | null): value is CinematicVector =>
  Boolean(value?.every(Number.isFinite));
const elevated = (point: CinematicVector, z: number): CinematicVector => [
  point[0], point[1], point[2] + z,
];

const normalizedFightAxes = (
  killer: CinematicVector,
  victims: CinematicVector,
): { forward: CinematicVector; right: CinematicVector } => {
  const dx = victims[0] - killer[0];
  const dy = victims[1] - killer[1];
  const length = Math.hypot(dx, dy) || 1;
  const forward: CinematicVector = [dx / length, dy / length, 0];
  return { forward, right: [-forward[1], forward[0], 0] };
};

/**
 * Builds a repeatable in-player director pass from the entity positions that
 * were actually observed during an HLTV ace. Hidden rewinds are intentionally
 * excluded from visibleDurationMs.
 */
export const buildAceCinematicPlan = (
  moment: HighlightMoment,
  sourceDeaths: readonly DeathEvent[],
): AceCinematicPlan | undefined => {
  const deaths = moment.eventIds
    .map((eventId) => sourceDeaths.find((death) => death.eventId === eventId))
    .filter((death): death is DeathEvent => Boolean(death))
    .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
  if (deaths.length !== 5
    || deaths.some((death) => death.killerPlayerId !== moment.killerPlayerId)
    || !deaths[0]?.killerSlot) return undefined;

  const killerPositions = deaths
    .map((death) => death.entityObservation.killer.positionValue)
    .filter(finitePosition);
  const victimPositions = deaths
    .map((death) => death.entityObservation.victim.positionValue)
    .filter(finitePosition);
  if (!killerPositions.length || victimPositions.length < 3) return undefined;

  const killer = average(killerPositions);
  const victims = average(victimPositions);
  const fight = average([killer, victims]);
  const { forward, right } = normalizedFightAxes(killer, victims);
  const targetLow = elevated(fight, 30);
  const targetHigh = elevated(victims, 42);
  const startTimeMs = Math.max(0, deaths[0].demoTimeMs - 3_000);
  const endTimeMs = deaths.at(-1)!.demoTimeMs + 2_500;
  const targetSlot = deaths[0].killerSlot;

  const cameraPass = (
    id: string,
    label: string,
    from: CinematicVector,
    to: CinematicVector,
    lookAtFrom: CinematicVector,
    lookAtTo: CinematicVector,
    arcHeight = 0,
    rollDegrees = 0,
  ): AceCinematicPass => ({
    id, label, mode: 'camera', startTimeMs, endTimeMs, targetSlot,
    from, to, lookAtFrom, lookAtTo, arcHeight, rollDegrees,
  });

  const passes: AceCinematicPass[] = [
    { id: 'original-pov', label: 'Original secK POV', mode: 'pov', startTimeMs, endTimeMs, targetSlot },
    { id: 'hero-chase', label: 'Hero chase', mode: 'chase', startTimeMs, endTimeMs, targetSlot },
    { id: 'tactical-overview', label: 'Tactical bird\'s-eye', mode: 'overview', startTimeMs, endTimeMs, targetSlot },
    cameraPass(
      'gods-eye',
      'God\'s-eye · straight down',
      elevated(fight, 315),
      elevated(victims, 275),
      elevated(fight, 18),
      elevated(victims, 18),
    ),
    cameraPass(
      'crane-descent',
      'Crane descent',
      add(add(fight, scale(forward, -150)), [0, 0, 280]),
      add(add(fight, scale(forward, 70)), add(scale(right, -45), [0, 0, 125])),
      elevated(killer, 35),
      targetHigh,
      45,
      -2,
    ),
    cameraPass(
      'crossfire-dolly',
      'Crossfire dolly',
      add(add(fight, scale(right, 235)), [0, 0, 78]),
      add(add(fight, scale(right, -235)), [0, 0, 68]),
      elevated(killer, 34),
      targetHigh,
      28,
      1.5,
    ),
    cameraPass(
      'ground-rush',
      'Ground-level rush',
      add(add(killer, scale(forward, -95)), add(scale(right, -95), [0, 0, 27])),
      add(add(victims, scale(forward, 60)), add(scale(right, 85), [0, 0, 46])),
      elevated(killer, 30),
      targetLow,
      18,
      -1,
    ),
    cameraPass(
      'reverse-reveal',
      'Reverse-angle reveal',
      add(add(victims, scale(forward, 60)), add(scale(right, 85), [0, 0, 80])),
      add(add(victims, scale(forward, 25)), add(scale(right, 55), [0, 0, 58])),
      elevated(killer, 36),
      targetLow,
      18,
      2,
    ),
    cameraPass(
      'impact-push',
      'Impact push-in',
      add(add(victims, scale(forward, 60)), add(scale(right, 85), [0, 0, 74])),
      add(add(victims, scale(forward, 35)), add(scale(right, 65), [0, 0, 54])),
      elevated(killer, 34),
      targetHigh,
      12,
      -1,
    ),
    cameraPass(
      'orbit-finale',
      'Wide orbit',
      add(add(fight, scale(right, -270)), add(scale(forward, -80), [0, 0, 150])),
      add(add(fight, scale(right, 270)), add(scale(forward, 85), [0, 0, 115])),
      targetLow,
      targetHigh,
      65,
      -2.5,
    ),
    { id: 'final-pov', label: 'Final secK POV', mode: 'pov', startTimeMs, endTimeMs, targetSlot },
  ];

  return {
    killerPlayerId: moment.killerPlayerId,
    killerSlot: targetSlot,
    deaths,
    passes,
    visibleDurationMs: passes.reduce(
      (total, pass) => total + pass.endTimeMs - pass.startTimeMs,
      0,
    ),
  };
};

const easeInOut = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

export const cinematicCameraFrameAt = (
  pass: AceCinematicPass,
  demoTimeMs: number,
): CinematicCameraFrame | undefined => {
  if (pass.mode !== 'camera'
    || !pass.from || !pass.to || !pass.lookAtFrom || !pass.lookAtTo) return undefined;
  const durationMs = Math.max(1, pass.endTimeMs - pass.startTimeMs);
  const progress = easeInOut((demoTimeMs - pass.startTimeMs) / durationMs);
  const origin = lerp(pass.from, pass.to, progress);
  origin[2] += Math.sin(progress * Math.PI) * (pass.arcHeight ?? 0);
  const lookAt = lerp(pass.lookAtFrom, pass.lookAtTo, progress);
  const dx = lookAt[0] - origin[0];
  const dy = lookAt[1] - origin[1];
  const dz = lookAt[2] - origin[2];
  const horizontal = Math.hypot(dx, dy);
  const roll = Math.sin(progress * Math.PI * 2) * (pass.rollDegrees ?? 0);
  return {
    origin,
    angles: [
      -Math.atan2(dz, horizontal) * 180 / Math.PI,
      Math.atan2(dy, dx) * 180 / Math.PI,
      roll,
    ],
  };
};
