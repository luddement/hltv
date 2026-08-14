import { readFileSync } from 'node:fs';

const BSP_LUMP_COUNT = 15;
const BSP_HEADER_SIZE = 4 + BSP_LUMP_COUNT * 8;

const crcTable = new Uint32Array(256);
for (let value = 0; value < crcTable.length; value += 1) {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crcTable[value] = crc >>> 0;
}

export const goldSrcMapChecksum = (buffer) => {
  if (buffer.byteLength < BSP_HEADER_SIZE) {
    throw new Error('BSP-filen är för liten för att innehålla en giltig header.');
  }

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let checksum = 0xffffffff;

  // GoldSrc deliberately excludes the entities lump (index 0), allowing a
  // server to alter entity text without changing the multiplayer map CRC.
  for (let index = 1; index < BSP_LUMP_COUNT; index += 1) {
    const offset = view.getInt32(4 + index * 8, true);
    const length = view.getInt32(8 + index * 8, true);
    if (offset < 0 || length < 0 || offset + length > bytes.byteLength) {
      throw new Error(`BSP-lump ${index} ligger utanför filen.`);
    }
    for (let position = offset; position < offset + length; position += 1) {
      checksum = crcTable[(checksum ^ bytes[position]) & 0xff] ^ (checksum >>> 8);
    }
  }

  // CRC32_MapFile compares the running CRC directly; it does not apply the
  // conventional final XOR used by most generic CRC32 helpers.
  return checksum >>> 0;
};

export const goldSrcMapChecksumFile = (filePath) =>
  goldSrcMapChecksum(readFileSync(filePath));

export const formatGoldSrcChecksum = (checksum) =>
  (checksum >>> 0).toString(16).padStart(8, '0');
