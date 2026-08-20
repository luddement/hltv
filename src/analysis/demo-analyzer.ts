import type { GoldSrcDemo } from '/@/demo/goldsrc-demo';
import { Replay } from '/@/vendor/hlviewer/hlviewer.js';
import type { AnalysisProgress } from '/@/analysis/analysis-worker-protocol';
import { RoundAliveReducer } from '/@/analysis/round-alive-reducer';
import { buildHighlightAnalysis, type ObservedShot } from '/@/analysis/highlight-analyzer';
import type {
  BombEvent,
  DeathEvent,
  DemoAnalysisIndex,
  EvidenceValue,
  HistoryEntry,
  PlayerIdentity,
  PlayerSession,
  ReplayEvent,
  ReplayEventBase,
  RoundEndEvent,
  RoundSummary,
  RoundStartEvent,
  TeamChangeEvent,
} from '/@/analysis/schema';

export const ANALYZER_VERSION = '2.5.11';

const PARSER_VERSION = 'hlviewer-0.8.5-hltv-analysis-7';
const ENGINE_WASM_VERSION = '7a00694ccae22b8cbb3254033a602a6ac750f7c27e6909ba1e23e6a13ac8f2c4';
const CLIENT_WASM_VERSION = '77a2a892a598c6c14a5214fe41a92a85ac38af099665f7660bcc33e4f47c2995';
const ANALYSIS_CONFIG = {
  roundStartMinimumSeconds: 60,
  roundStartResetIncreaseSeconds: 30,
  roundStartDebounceMs: 5_000,
  roundEndAudioTokens: ['%!MRAD_terwin', '%!MRAD_ctwin'],
} as const;

const MAX_GOLDSRC_PLAYERS = 32;

export type ParsedAnalysis = ReturnType<typeof Replay.parseAnalysisFrames>;
export type AnalysisFrame = ParsedAnalysis['frames'][number];
type AnalysisMessage = AnalysisFrame['messages'][number];

type MutablePlayerState = {
  identity: PlayerIdentity;
  session: PlayerSession;
};

const sha256 = async (value: ArrayBuffer | string): Promise<string> => {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const readCString = (payload: ArrayLike<number>, offset = 0): string => {
  const bytes: number[] = [];
  for (let index = offset; index < payload.length; index += 1) {
    const byte = payload[index];
    if (byte === 0) break;
    bytes.push(byte);
  }
  return new TextDecoder('latin1').decode(new Uint8Array(bytes));
};

const readUint16 = (payload: ArrayLike<number>, offset = 0): number =>
  (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);

const weaponFromEventResource = (resource: string | undefined): string | undefined => {
  const match = resource?.toLowerCase().match(/^events\/([^/]+)\.sc$/);
  if (!match || ['createexplo', 'createsmoke', 'decal_reset'].includes(match[1])) return undefined;
  if (match[1] === 'mp5n') return 'mp5navy';
  if (match[1] === 'elite_left' || match[1] === 'elite_right') return 'elite';
  return match[1];
};

const parseInfoString = (value: string): Record<string, string> => {
  const parts = value.split('\\');
  const result: Record<string, string> = {};
  for (let index = parts[0] ? 0 : 1; index + 1 < parts.length; index += 2) {
    result[parts[index]] = parts[index + 1];
  }
  return result;
};

const closeHistory = <T>(history: HistoryEntry<T>[], atMs: number): void => {
  const current = history.at(-1);
  if (current && current.toMs === null) current.toMs = atMs;
};

const updateHistory = <T>(
  history: HistoryEntry<T>[],
  value: T,
  atMs: number,
  evidence: 'observed' | 'derived',
): void => {
  const current = history.at(-1);
  if (current?.value === value) return;
  closeHistory(history, atMs);
  history.push({ fromMs: atMs, toMs: null, value, evidence });
};

const currentHistoryValue = <T>(history: HistoryEntry<T>[]): T | undefined =>
  history.at(-1)?.value;

const eventBase = (
  eventId: string,
  frame: AnalysisFrame,
  message: AnalysisMessage,
  messageOrdinal: number,
  roundId: string | null,
): ReplayEventBase => ({
  eventId,
  demoTimeMs: Math.max(0, Math.round(frame.time * 1_000)),
  packetOrdinal: frame.packetOrdinal,
  directoryEntry: frame.directoryEntry,
  byteOffset: frame.byteOffset,
  roundId,
  evidence: 'observed',
  source: {
    rawMessage: typeof message.data.name === 'string'
      ? message.data.name
      : `svc_${message.type}`,
    messageOrdinal,
  },
});

const cacheIdentity = async (demoHash: string, profile: string): Promise<string> => {
  const configHash = await sha256(JSON.stringify(ANALYSIS_CONFIG));
  return [
    demoHash,
    'schema-2',
    ANALYZER_VERSION,
    PARSER_VERSION,
    profile,
    ENGINE_WASM_VERSION,
    CLIENT_WASM_VERSION,
    configHash,
  ].join(':');
};

export type PreparedAnalysis = {
  demoHash: string;
  cacheId: string;
};

export const prepareAnalysisIdentity = async (
  buffer: ArrayBuffer,
  compatibilityProfile: string,
): Promise<PreparedAnalysis> => {
  const demoHash = await sha256(buffer);
  return {
    demoHash,
    cacheId: await cacheIdentity(demoHash, compatibilityProfile),
  };
};

export const analyzeDemo = (
  buffer: ArrayBuffer,
  demo: GoldSrcDemo,
  identity: PreparedAnalysis,
  onProgress?: (progress: AnalysisProgress) => void,
): DemoAnalysisIndex => {
  onProgress?.({
    phase: 'parsing',
    current: 0,
    total: demo.directory.reduce((total, entry) => total + entry.fileLength, 0),
    directoryEntry: 0,
    directoryCount: demo.directory.length,
  });
  const parsed = Replay.parseAnalysisFrames(buffer, (progress) => {
    onProgress?.({
      phase: 'parsing',
      current: progress.currentBytes,
      total: progress.totalBytes,
      demoTimeMs: Math.max(0, Math.round(progress.demoTime * 1_000)),
      directoryEntry: progress.directoryEntry,
      directoryCount: progress.directoryCount,
    });
  });
  return normalizeParsedAnalysis(parsed, demo, identity, onProgress);
};

export const normalizeParsedAnalysis = (
  parsed: ParsedAnalysis,
  demo: GoldSrcDemo,
  identity: PreparedAnalysis,
  onProgress?: (progress: AnalysisProgress) => void,
): DemoAnalysisIndex => {
  if (parsed.header.demoProtocol !== demo.demoProtocol
    || parsed.header.netProtocol !== demo.networkProtocol
    || parsed.header.mapName !== demo.mapName
    || (parsed.header.mapCrc >>> 0) !== demo.mapChecksum) {
    throw new Error('Demot ändrades mellan inspektion och analys.');
  }

  const players: PlayerIdentity[] = [];
  const activeSlots = new Map<number, MutablePlayerState>();
  const roundState = new RoundAliveReducer();
  const events: ReplayEvent[] = [];
  let eventSequence = 0;
  let sessionSequence = 0;
  let unknownPlayerReferences = 0;
  let focusPlayerSlot: number | null = null;
  let decodedHltvMessages = 0;
  const focusPlayerIds = new Set<string>();
  const eventResources = new Map<number, string>();
  const observedShots: ObservedShot[] = [];
  const legacyTimerRoundIds = new Set<string>();
  let previousRoundTimeSeconds: number | null = null;
  let sawMatchRestart = false;

  const nextEventId = (): string => `event-${++eventSequence}`;
  const playerForSlot = (slot: number): MutablePlayerState | undefined =>
    activeSlots.get(slot);

  const forgetRounds = (removedRounds: RoundSummary[]): void => {
    const removedIds = new Set(removedRounds.map((round) => round.roundId));
    if (!removedIds.size) return;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (!event.roundId || !removedIds.has(event.roundId)) continue;
      if (event.type === 'round_start' || event.type === 'round_end') events.splice(index, 1);
      else event.roundId = null;
    }
  };

  const closeSession = (slot: number, atMs: number): void => {
    const state = activeSlots.get(slot);
    if (!state) return;
    state.session.leftAtMs = atMs;
    closeHistory(state.session.names, atMs);
    closeHistory(state.session.teams, atMs);
    roundState.leavePlayer(state.identity.playerId);
    activeSlots.delete(slot);
  };

  onProgress?.({ phase: 'indexing', current: 0, total: parsed.frames.length });
  for (const [frameIndex, frame] of parsed.frames.entries()) {
    const atMs = Math.max(0, Math.round(frame.time * 1_000));
    frame.messages.forEach((message, messageOrdinal) => {
      if (message.type === 43 && Array.isArray(message.data)) {
        for (const resource of message.data) {
          if (!resource || typeof resource !== 'object') continue;
          const entry = resource as Record<string, unknown>;
          const index = Number(entry.index);
          const name = String(entry.name ?? '');
          if (entry.type === 5 && Number.isInteger(index) && name) eventResources.set(index, name);
        }
        return;
      }

      if (message.type === 3 || message.type === 21) {
        const shotEvents = message.type === 3 && Array.isArray(message.data.events)
          ? message.data.events
          : message.type === 21
            ? [message.data]
            : [];
        for (const rawEvent of shotEvents) {
          if (!rawEvent || typeof rawEvent !== 'object') continue;
          const event = rawEvent as Record<string, unknown>;
          const eventIndex = Number(message.type === 21 ? event.eventIndex : event.index);
          const weapon = weaponFromEventResource(eventResources.get(eventIndex));
          if (!weapon) continue;
          const delta = event.delta && typeof event.delta === 'object'
            ? event.delta as Record<string, unknown>
            : event.eventData && typeof event.eventData === 'object'
              ? event.eventData as Record<string, unknown>
              : undefined;
          const explicitSlot = Number(delta?.entindex ?? 0);
          const packetIndex = Number(event.packetIndex);
          // svc_event packet indices are zero-based, unlike the one-based
          // player slots used by DeathMsg and explicit event entindex values.
          const slot = Number.isInteger(explicitSlot) && explicitSlot > 0
            ? explicitSlot
            : Number.isInteger(packetIndex) && packetIndex >= 0
              ? packetIndex + 1
              : 0;
          if (Number.isInteger(slot) && slot > 0) observedShots.push({ demoTimeMs: atMs, slot, weapon });
        }
        return;
      }

      if (message.type === 11) {
        const playerIndex = Number(message.data.playerIndex);
        if (Number.isInteger(playerIndex) && playerIndex >= 0) {
          focusPlayerSlot = playerIndex + 1;
          const player = activeSlots.get(focusPlayerSlot);
          if (player) focusPlayerIds.add(player.identity.playerId);
        }
        return;
      }

      if (message.type === 50 || message.type === 51) {
        decodedHltvMessages += 1;
        return;
      }

      if (message.type === 13) {
        const slot = Number(message.data.clientIndex) + 1;
        const userId = Number(message.data.clientUserId);
        const infoString = String(message.data.clientUserInfo ?? '');
        if (!Number.isInteger(slot) || slot < 1 || slot > MAX_GOLDSRC_PLAYERS) return;
        if (!infoString) {
          const current = activeSlots.get(slot);
          // A real disconnect clears the same user id that owns the slot. A
          // parser-recovery false positive must not evict a verified player.
          if (current?.session.userId === userId) closeSession(slot, atMs);
          return;
        }

        const info = parseInfoString(infoString);
        if (!infoString.startsWith('\\')
          || !info.name
          || info.name.length > 32
          || /[\x00-\x1f\x7f]/.test(info.name)) return;
        let state = activeSlots.get(slot);
        if (!state || state.session.userId !== userId) {
          closeSession(slot, atMs);
          const ordinal = ++sessionSequence;
          const session: PlayerSession = {
            sessionId: `session-${ordinal}`,
            slot,
            userId,
            joinedAtMs: atMs,
            leftAtMs: null,
            names: [],
            teams: [],
          };
          const identityEntry: PlayerIdentity = {
            playerId: `player-${ordinal}`,
            steamId: { value: null, evidence: 'unknown' },
            sessions: [session],
          };
          state = { identity: identityEntry, session };
          players.push(identityEntry);
          activeSlots.set(slot, state);
          roundState.joinPlayer(identityEntry.playerId);
          if (slot === focusPlayerSlot) focusPlayerIds.add(identityEntry.playerId);
        }
        if (info.name) updateHistory(state.session.names, info.name, atMs, 'observed');
        return;
      }

      if (message.type < 64 || !message.data.payload) return;
      const payload = message.data.payload;
      const name = String(message.data.name ?? '');

      if (name === 'TextMsg' && payload.length >= 2) {
        const token = readCString(payload, 1).toLowerCase();
        if (token.startsWith('#game_will_restart_in')) {
          const currentRound = roundState.currentRound;
          const removedRounds = currentRound
            && legacyTimerRoundIds.has(currentRound.roundId)
            ? [roundState.discardCurrentRound()].filter((round): round is RoundSummary => Boolean(round))
            : [];
          forgetRounds(removedRounds);
          sawMatchRestart = true;
        }
        return;
      }

      if (name === 'TeamInfo' && payload.length >= 2) {
        const slot = payload[0];
        const team = readCString(payload, 1);
        const player = playerForSlot(slot);
        if (player && team) {
          updateHistory(player.session.teams, team, atMs, 'observed');
          roundState.setTeam(player.identity.playerId, team);
        }
        const teamEvent: TeamChangeEvent = {
          ...eventBase(nextEventId(), frame, message, messageOrdinal, roundState.currentRound?.roundId ?? null),
          type: 'team_change',
          playerId: player?.identity.playerId ?? null,
          slot,
          team,
        };
        events.push(teamEvent);
        return;
      }

      if (name === 'RoundTime' && payload.length >= 2) {
        const roundTimeSeconds = readUint16(payload);
        const timerReset = previousRoundTimeSeconds === null
          || roundTimeSeconds - previousRoundTimeSeconds >= ANALYSIS_CONFIG.roundStartResetIncreaseSeconds;
        previousRoundTimeSeconds = roundTimeSeconds;
        const previousRound = roundState.currentRound;
        const previousStart = previousRound?.startTimeMs ?? -Infinity;
        const minimumSeconds = sawMatchRestart
          ? ANALYSIS_CONFIG.roundStartMinimumSeconds
          : 120;
        if (roundTimeSeconds >= minimumSeconds
          && (roundTimeSeconds >= 120 || timerReset || previousRound?.endTimeMs !== null)
          && atMs - previousStart >= ANALYSIS_CONFIG.roundStartDebounceMs) {
          const activeRound = roundState.startRound(atMs);
          if (roundTimeSeconds < 120) legacyTimerRoundIds.add(activeRound.roundId);
          const roundEvent: RoundStartEvent = {
            ...eventBase(nextEventId(), frame, message, messageOrdinal, activeRound.roundId),
            evidence: 'derived',
            type: 'round_start',
            roundId: activeRound.roundId,
            roundTimeSeconds,
          };
          events.push(roundEvent);
        }
        return;
      }

      if (name === 'DeathMsg' && payload.length >= 4) {
        const killerSlot = payload[0];
        const victimSlot = payload[1];
        const headshotFlag = payload[2];
        const weaponTerminator = payload.indexOf(0, 3);
        const weapon = weaponTerminator >= 4 ? readCString(payload, 3) : '';
        // A malformed legacy packet can accidentally resemble a registered
        // DeathMsg after parser recovery. GoldSrc player slots are 1–32 (with
        // killer 0 reserved for the world), and the remaining fixed fields
        // must still have their canonical shape before this can be a frag.
        if (killerSlot > MAX_GOLDSRC_PLAYERS
          || victimSlot < 1
          || victimSlot > MAX_GOLDSRC_PLAYERS
          || headshotFlag > 1
          || weapon.length < 2
          || weapon.length > 31
          || !/^[a-z0-9_]+$/i.test(weapon)) return;
        const killer = killerSlot ? playerForSlot(killerSlot) : undefined;
        const victim = playerForSlot(victimSlot);
        if (killerSlot && !killer) unknownPlayerReferences += 1;
        if (!victim) unknownPlayerReferences += 1;
        const killerTeam = killer && currentHistoryValue(killer.session.teams);
        const victimTeam = victim && currentHistoryValue(victim.session.teams);
        const worldKill = killerSlot === 0;
        const suicide = !worldKill && killerSlot === victimSlot;
        const teamKill: EvidenceValue<boolean> = weapon === 'teammate'
          ? { value: true, evidence: 'observed' }
          : worldKill || suicide
            ? { value: false, evidence: 'derived' }
          : killerTeam && victimTeam
            ? { value: killerTeam === victimTeam, evidence: 'derived' }
            : { value: null, evidence: 'unknown' };
        const eventId = nextEventId();
        const aliveBefore = roundState.recordDeath(
          eventId,
          victim?.identity.playerId ?? null,
        );
        const killerEntity = frame.playerEntities?.find((entry) => entry.slot === killerSlot);
        const victimEntity = frame.playerEntities?.find((entry) => entry.slot === victimSlot);
        const death: DeathEvent = {
          ...eventBase(eventId, frame, message, messageOrdinal, roundState.currentRound?.roundId ?? null),
          type: 'death',
          killerPlayerId: killer?.identity.playerId ?? null,
          victimPlayerId: victim?.identity.playerId ?? null,
          killerSlot,
          victimSlot,
          weapon,
          headshot: headshotFlag !== 0,
          teamKill,
          worldKill,
          suicide,
          aliveBefore,
          entityObservation: {
            killer: {
              entity: frame.entitySlots?.includes(killerSlot) ?? false,
              position: frame.positionSlots?.includes(killerSlot) ?? false,
              angles: frame.angleSlots?.includes(killerSlot) ?? false,
              positionValue: killerEntity?.position ?? null,
              angleValue: killerEntity?.angles ?? null,
              evidence: 'derived',
            },
            victim: {
              entity: frame.entitySlots?.includes(victimSlot) ?? false,
              position: frame.positionSlots?.includes(victimSlot) ?? false,
              angles: frame.angleSlots?.includes(victimSlot) ?? false,
              positionValue: victimEntity?.position ?? null,
              angleValue: victimEntity?.angles ?? null,
              evidence: 'derived',
            },
          },
        };
        events.push(death);
        return;
      }

      if (name !== 'SendAudio' || payload.length < 2) return;
      const token = readCString(payload, 1);
      const winner = token.toLowerCase() === '%!mrad_terwin'
        ? 'TERRORIST' as const
        : token.toLowerCase() === '%!mrad_ctwin'
          ? 'CT' as const
          : null;
      if (winner) {
        const activeRound = roundState.endRound(atMs, winner);
        if (!activeRound) return;
        const roundEnd: RoundEndEvent = {
          ...eventBase(nextEventId(), frame, message, messageOrdinal, activeRound.roundId),
          evidence: 'derived',
          type: 'round_end',
          roundId: activeRound.roundId,
          winner: activeRound.winner,
        };
        events.push(roundEnd);
        return;
      }

      const bombType = token === '%!MRAD_BOMBPL'
        ? 'bomb_plant' as const
        : token === '%!MRAD_BOMBDEF'
          ? 'bomb_defuse' as const
          : token === '%!MRAD_BLOW'
            ? 'bomb_explode' as const
            : null;
      if (bombType) {
        const bombEvent: BombEvent = {
          ...eventBase(nextEventId(), frame, message, messageOrdinal, roundState.currentRound?.roundId ?? null),
          evidence: 'derived',
          type: bombType,
          playerId: null,
        };
        events.push(bombEvent);
      }
    });
    if (frameIndex % 256 === 0 || frameIndex + 1 === parsed.frames.length) {
      onProgress?.({
        phase: 'indexing',
        current: frameIndex + 1,
        total: parsed.frames.length,
        demoTimeMs: Math.max(0, Math.round(frame.time * 1_000)),
        directoryEntry: frame.directoryEntry,
        directoryCount: parsed.directories.length,
      });
    }
  }

  const durationMs = Math.max(0, Math.round(demo.duration * 1_000));
  for (const slot of Array.from(activeSlots.keys())) closeSession(slot, durationMs);

  const deathEvents = events.filter((event): event is DeathEvent => event.type === 'death');
  const isHltv = decodedHltvMessages > 0;
  const focusTeamHistory = players
    .filter((player) => focusPlayerIds.has(player.playerId))
    .flatMap((player) => player.sessions.flatMap((session) => session.teams))
    .sort((left, right) => left.fromMs - right.fromMs);
  const index: DemoAnalysisIndex = {
    schemaVersion: 2,
    analyzerVersion: ANALYZER_VERSION,
    cacheId: identity.cacheId,
    createdAt: new Date().toISOString(),
    demo: {
      sha256: identity.demoHash,
      name: demo.name,
      durationMs,
      demoProtocol: demo.demoProtocol,
      networkProtocol: demo.networkProtocol as 46 | 47 | 48,
      compatibilityProfile: demo.compatibilityProfile,
      mapName: demo.mapName,
      mapChecksum: demo.mapChecksum,
      isHltv,
      perspective: {
        kind: isHltv ? 'hltv' : 'pov',
        focusPlayerIds: isHltv ? [] : Array.from(focusPlayerIds),
      focusTeamHistory: isHltv ? [] : focusTeamHistory,
        evidence: isHltv
          ? 'observed'
          : focusPlayerIds.size && focusTeamHistory.length
            ? 'derived'
            : 'unknown',
      },
    },
    players,
    rounds: roundState.rounds,
    events,
    observedShots,
    moments: [],
    fragRatings: [],
    roundRatings: [],
    checkpoints: [],
    diagnostics: {
      status: 'complete',
      decodedPackets: (parsed.frames.at(-1)?.packetOrdinal ?? -1) + 1,
      registeredUserMessages: parsed.customMessages.filter(Boolean).length,
      normalizedEvents: events.length,
      deathEvents: deathEvents.length,
      roundCount: roundState.rounds.length,
      playerSessions: sessionSequence,
      unknownPlayerReferences,
      warnings: [],
    },
  };
  return { ...index, ...buildHighlightAnalysis(index, observedShots) };
};
