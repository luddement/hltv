export type Evidence = 'observed' | 'derived' | 'unknown';

export type EvidenceValue<T> = {
  value: T | null;
  evidence: Evidence;
};

export type HistoryEntry<T> = {
  fromMs: number;
  toMs: number | null;
  value: T;
  evidence: Exclude<Evidence, 'unknown'>;
};

export type PlayerSession = {
  sessionId: string;
  slot: number;
  userId: number;
  joinedAtMs: number;
  leftAtMs: number | null;
  names: HistoryEntry<string>[];
  teams: HistoryEntry<string>[];
};

export type PlayerIdentity = {
  playerId: string;
  steamId: EvidenceValue<string>;
  sessions: PlayerSession[];
};

export type EventSource = {
  rawMessage: string;
  messageOrdinal: number;
};

export type ReplayEventBase = {
  eventId: string;
  demoTimeMs: number;
  packetOrdinal: number;
  directoryEntry: number;
  byteOffset: number;
  roundId: string | null;
  evidence: Exclude<Evidence, 'unknown'>;
  source: EventSource;
};

export type DeathEvent = ReplayEventBase & {
  type: 'death';
  killerPlayerId: string | null;
  victimPlayerId: string | null;
  killerSlot: number;
  victimSlot: number;
  weapon: string;
  headshot: boolean;
  teamKill: EvidenceValue<boolean>;
  worldKill: boolean;
  suicide: boolean;
  aliveBefore: {
    terrorists: EvidenceValue<number>;
    counterTerrorists: EvidenceValue<number>;
  };
  entityObservation: {
    killer: EntityObservation;
    victim: EntityObservation;
  };
};

export type EntityObservation = {
  entity: boolean;
  position: boolean;
  angles: boolean;
  positionValue: [number, number, number] | null;
  angleValue: [number, number, number] | null;
  evidence: 'derived';
};

export type RoundStartEvent = ReplayEventBase & {
  type: 'round_start';
  roundId: string;
  roundTimeSeconds: number;
};

export type RoundEndEvent = ReplayEventBase & {
  type: 'round_end';
  roundId: string;
  winner: EvidenceValue<'TERRORIST' | 'CT'>;
};

export type TeamChangeEvent = ReplayEventBase & {
  type: 'team_change';
  playerId: string | null;
  slot: number;
  team: string;
};

export type BombEvent = ReplayEventBase & {
  type: 'bomb_plant' | 'bomb_defuse' | 'bomb_explode';
  playerId: null;
};

/**
 * Observerad server-restart. Den här gränsen behövs för att skilja
 * warmup/knivrunda från den riktiga matchen i äldre HLTV-inspelningar.
 */
export type MatchRestartEvent = ReplayEventBase & {
  type: 'match_restart';
};

export type ReplayEvent =
  | DeathEvent
  | RoundStartEvent
  | RoundEndEvent
  | TeamChangeEvent
  | BombEvent
  | MatchRestartEvent;

export type RoundSummary = {
  roundId: string;
  number: number;
  startTimeMs: number;
  endTimeMs: number | null;
  winner: EvidenceValue<'TERRORIST' | 'CT'>;
  deathEventIds: string[];
};

export type HighlightMoment = {
  momentId: string;
  startTimeMs: number;
  endTimeMs: number;
  eventIds: string[];
  killerPlayerId: string;
  team: 'TERRORIST' | 'CT';
  rating: ScoreRating;
};

export type ScoreReason = {
  code: string;
  label: string;
  points: number;
  evidence: Exclude<Evidence, 'unknown'>;
};

export type ScoreRating = {
  score: number;
  confidence: number;
  reasons: ScoreReason[];
};

export type FragVisibility =
  | 'recorded_pov'
  | 'hltv_replay'
  | 'hltv_director'
  | 'killfeed_only'
  | 'unknown';

export type FragRating = ScoreRating & {
  eventId: string;
  team: 'TERRORIST' | 'CT';
  /** True när fragget ingår i ett komplett fem-kills-ace i samma rond. */
  ace: boolean;
  visibility: FragVisibility;
  reconstruction: EntityObservation;
};

export type RoundRating = ScoreRating & {
  roundId: string;
  team: 'TERRORIST' | 'CT';
  bestMomentId: string | null;
};

export type AnalysisPerspective = {
  kind: 'hltv' | 'pov';
  focusPlayerIds: string[];
  focusTeamHistory: HistoryEntry<string>[];
  evidence: Evidence;
};

export type ReplayCheckpointRef = {
  checkpointId: string;
  demoTimeMs: number;
};

export type AnalysisWarning = {
  message: string;
  byteOffset: number | null;
  packetOrdinal: number | null;
};

export type AnalysisDiagnostics = {
  status: 'complete' | 'partial';
  decodedPackets: number;
  registeredUserMessages: number;
  normalizedEvents: number;
  deathEvents: number;
  roundCount: number;
  playerSessions: number;
  unknownPlayerReferences: number;
  warnings: AnalysisWarning[];
};

// Observerade skott behövs för att poängsätta precision. De sparas i indexet så
// att fragpoängen kan räknas om utan att demot parsas på nytt.
export type ObservedShot = {
  demoTimeMs: number;
  slot: number;
  weapon: string;
};

export type DemoAnalysisIndex = {
  schemaVersion: 2;
  analyzerVersion: string;
  cacheId: string;
  createdAt: string;
  demo: {
    sha256: string;
    name: string;
    durationMs: number;
    demoProtocol: number;
    networkProtocol: 46 | 47 | 48;
    compatibilityProfile: string;
    mapName: string;
    mapChecksum: number;
    isHltv: boolean;
    perspective: AnalysisPerspective;
  };
  players: PlayerIdentity[];
  rounds: RoundSummary[];
  events: ReplayEvent[];
  observedShots: ObservedShot[];
  moments: HighlightMoment[];
  fragRatings: FragRating[];
  roundRatings: RoundRating[];
  checkpoints: ReplayCheckpointRef[];
  diagnostics: AnalysisDiagnostics;
};

export const isDeathEvent = (event: ReplayEvent): event is DeathEvent =>
  event.type === 'death';
