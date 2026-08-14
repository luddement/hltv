export type HLViewerHandle = {
  readonly game: unknown;
  load(name: string): void;
  setTitle(title: string): void;
  getTitle(): string;
};

export const HLViewer: {
  init(
    rootSelector: string,
    params: {
      paths: {
        base: string;
        replays: string;
        maps: string;
        wads: string;
        skies: string;
        sounds: string;
      };
    },
  ): HLViewerHandle | null;
};

export class Replay {
  static parseIntoChunks(buffer: ArrayBuffer): unknown;
  static parseAnalysisFrames(
    buffer: ArrayBuffer,
    onProgress?: (progress: {
      currentBytes: number;
      totalBytes: number;
      demoTime: number;
      packetOrdinal: number;
      directoryEntry: number;
      directoryCount: number;
    }) => void,
  ): {
    header: {
      demoProtocol: number;
      netProtocol: number;
      mapName: string;
      modName: string;
      mapCrc: number;
      dirOffset: number;
    };
    directories: Array<{
      id: number;
      name: string;
      flags: number;
      cdTrack: number;
      time: number;
      frames: number;
      offset: number;
      length: number;
    }>;
    frames: Array<{
      time: number;
      tick: number;
      packetOrdinal: number;
      directoryEntry: number;
      byteOffset: number;
      inputButtons?: number;
      entitySlots?: number[];
      positionSlots?: number[];
      angleSlots?: number[];
      playerEntities?: Array<{
        slot: number;
        position: [number, number, number] | null;
        angles: [number, number, number] | null;
      }>;
      messages: Array<{
        type: number;
        data: Record<string, unknown> & {
          index?: number;
          name?: string;
          payload?: Uint8Array;
        };
      }>;
    }>;
    customMessages: Array<{
      index: number;
      size: number;
      name: string;
    } | undefined>;
  };
}
