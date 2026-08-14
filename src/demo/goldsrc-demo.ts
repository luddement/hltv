const HEADER_SIZE = 544;
const DIRECTORY_ENTRY_SIZE = 92;

export type DemoDirectoryEntry = {
  type: number;
  description: string;
  flags: number;
  cdTrack: number;
  playbackTime: number;
  frameCount: number;
  offset: number;
  fileLength: number;
};

export const DEMO_COMPATIBILITY_PROFILES = {
  'cs-goldsrc-46': {
    label: 'GoldSrc protocol 46',
    legacyScoreboard: true,
  },
  'cs-goldsrc-47': {
    label: 'GoldSrc protocol 47',
    legacyScoreboard: false,
  },
  'cs-goldsrc-48': {
    label: 'GoldSrc protocol 48',
    legacyScoreboard: false,
  },
} as const;

export type DemoCompatibilityProfile = keyof typeof DEMO_COMPATIBILITY_PROFILES;

export type GoldSrcDemo = {
  name: string;
  size: number;
  magic: string;
  demoProtocol: number;
  networkProtocol: number;
  mapName: string;
  gameDirectory: string;
  mapChecksum: number;
  directoryOffset: number;
  duration: number;
  frameCount: number;
  isHltv: boolean;
  compatibilityProfile: DemoCompatibilityProfile;
  directory: DemoDirectoryEntry[];
};

export type DemoSource =
  | { kind: 'url'; name: string; url: string }
  | { kind: 'file'; name: string; file: File };

const readCString = (
  bytes: Uint8Array,
  offset: number,
  maxLength: number,
): string => {
  const end = bytes.indexOf(0, offset);
  const safeEnd = end === -1 || end > offset + maxLength ? offset + maxLength : end;
  return new TextDecoder('latin1').decode(bytes.subarray(offset, safeEnd));
};

const parseHeader = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new Error('Filen är för liten för att vara ett GoldSrc-demo.');
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const magic = readCString(bytes, 0, 8);

  if (magic !== 'HLDEMO') {
    throw new Error(`Okänt demoformat: ${magic || 'saknar signatur'}.`);
  }

  return {
    magic,
    demoProtocol: view.getInt32(8, true),
    networkProtocol: view.getInt32(12, true),
    mapName: readCString(bytes, 16, 260),
    gameDirectory: readCString(bytes, 276, 260),
    mapChecksum: view.getUint32(536, true),
    directoryOffset: view.getInt32(540, true),
  };
};

const parseDirectory = (buffer: ArrayBuffer): DemoDirectoryEntry[] => {
  if (buffer.byteLength < 4) {
    throw new Error('Demots katalog är trasig eller avklippt.');
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const count = view.getInt32(0, true);

  if (count < 0 || count > 1024) {
    throw new Error(`Orimligt antal demosektioner: ${count}.`);
  }

  const requiredSize = 4 + count * DIRECTORY_ENTRY_SIZE;
  if (buffer.byteLength < requiredSize) {
    throw new Error('Demots sektionskatalog är ofullständig.');
  }

  return Array.from({ length: count }, (_, index) => {
    const offset = 4 + index * DIRECTORY_ENTRY_SIZE;
    return {
      type: view.getInt32(offset, true),
      description: readCString(bytes, offset + 4, 64),
      flags: view.getInt32(offset + 68, true),
      cdTrack: view.getInt32(offset + 72, true),
      playbackTime: view.getFloat32(offset + 76, true),
      frameCount: view.getInt32(offset + 80, true),
      offset: view.getInt32(offset + 84, true),
      fileLength: view.getInt32(offset + 88, true),
    };
  });
};

const selectCompatibilityProfile = (
  demoProtocol: number,
  networkProtocol: number,
  gameDirectory: string,
): DemoCompatibilityProfile => {
  if (demoProtocol !== 5) {
    throw new Error(`Demoformat ${demoProtocol} stöds inte ännu.`);
  }
  if (gameDirectory.toLowerCase() !== 'cstrike') {
    throw new Error(`Spelmodden ${gameDirectory || 'okänd'} stöds inte ännu.`);
  }

  const profile = `cs-goldsrc-${networkProtocol}` as DemoCompatibilityProfile;
  if (!(profile in DEMO_COMPATIBILITY_PROFILES)) {
    throw new Error(`GoldSrc-nätprotokoll ${networkProtocol} stöds inte ännu.`);
  }
  return profile;
};

const combineInspection = (
  name: string,
  size: number,
  headerBuffer: ArrayBuffer,
  directoryBuffer: ArrayBuffer,
): GoldSrcDemo => {
  const header = parseHeader(headerBuffer);
  const directory = parseDirectory(directoryBuffer);

  if (header.directoryOffset < HEADER_SIZE || header.directoryOffset >= size) {
    throw new Error('Demots katalogpekare ligger utanför filen.');
  }

  return {
    name,
    size,
    ...header,
    duration: Math.max(0, ...directory.map((entry) => entry.playbackTime)),
    frameCount: Math.max(0, ...directory.map((entry) => entry.frameCount)),
    // File type is established from decoded svc_hltv/svc_director messages
    // during analysis. A normal POV demo can contain *hltv in another
    // spectator's userinfo and must not be classified from that string.
    isHltv: false,
    compatibilityProfile: selectCompatibilityProfile(
      header.demoProtocol,
      header.networkProtocol,
      header.gameDirectory,
    ),
    directory,
  };
};

const getUrlSize = async (url: string): Promise<number> => {
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (!response.ok) {
    throw new Error(`Kunde inte läsa demot (${response.status}).`);
  }

  const contentRange = response.headers.get('content-range');
  const rangeSize = contentRange?.match(/\/(\d+)$/)?.[1];
  const contentLength = response.headers.get('content-length');
  const size = Number(rangeSize ?? contentLength);

  if (!Number.isFinite(size) || size < HEADER_SIZE) {
    throw new Error('Servern rapporterade en ogiltig demostorlek.');
  }

  return size;
};

const fetchRange = async (
  url: string,
  start: number,
  end: number,
): Promise<ArrayBuffer> => {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
  });
  if (!response.ok) {
    throw new Error(`Kunde inte läsa byte ${start}–${end} från demot.`);
  }
  return response.arrayBuffer();
};

export const inspectDemoUrl = async (
  name: string,
  url: string,
): Promise<GoldSrcDemo> => {
  const size = await getUrlSize(url);
  const scanEnd = Math.min(size - 1, HEADER_SIZE - 1);
  const scanBuffer = await fetchRange(url, 0, scanEnd);
  const header = parseHeader(scanBuffer.slice(0, HEADER_SIZE));
  const countBuffer = await fetchRange(
    url,
    header.directoryOffset,
    header.directoryOffset + 3,
  );
  const count = new DataView(countBuffer).getInt32(0, true);
  const directoryEnd = header.directoryOffset + 4 + count * DIRECTORY_ENTRY_SIZE - 1;
  const directoryBuffer = await fetchRange(url, header.directoryOffset, directoryEnd);

  return combineInspection(
    name,
    size,
    scanBuffer.slice(0, HEADER_SIZE),
    directoryBuffer,
  );
};

export const inspectDemoFile = async (file: File): Promise<GoldSrcDemo> => {
  const headerBuffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const header = parseHeader(headerBuffer);
  const countBuffer = await file
    .slice(header.directoryOffset, header.directoryOffset + 4)
    .arrayBuffer();
  const count = new DataView(countBuffer).getInt32(0, true);
  const directoryBuffer = await file
    .slice(
      header.directoryOffset,
      header.directoryOffset + 4 + count * DIRECTORY_ENTRY_SIZE,
    )
    .arrayBuffer();
  return combineInspection(
    file.name,
    file.size,
    headerBuffer,
    directoryBuffer,
  );
};

export const readDemoSource = async (source: DemoSource): Promise<ArrayBuffer> => {
  if (source.kind === 'file') {
    return source.file.arrayBuffer();
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Kunde inte hämta demot (${response.status}).`);
  }
  return response.arrayBuffer();
};

export const formatBytes = (bytes: number): string => {
  const mib = bytes / 1024 / 1024;
  return `${mib.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
};

export const formatDuration = (seconds: number): string => {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
