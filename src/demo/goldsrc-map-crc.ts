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

export const goldSrcMapChecksum = (buffer: ArrayBuffer): number => {
  if (buffer.byteLength < BSP_HEADER_SIZE) {
    throw new Error('BSP-filen är för liten för att innehålla en giltig header.');
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let checksum = 0xffffffff;

  // This mirrors Xash/GoldSrc CRC32_MapFile: entities are excluded and the
  // running CRC is compared without the conventional final XOR.
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

  return checksum >>> 0;
};

export const formatGoldSrcChecksum = (checksum: number): string =>
  (checksum >>> 0).toString(16).padStart(8, '0');
