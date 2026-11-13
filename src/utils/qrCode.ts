/**
 * Lightweight, self-contained QR Code generator in pure TypeScript.
 * Generates an SVG path or 2D boolean grid for arbitrary URLs / strings
 * without external dependencies.
 */

// Galois Field GF(256) tables for Reed-Solomon encoding
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x & 128 ? 0x11d : 0);
}
EXP_TABLE[255] = EXP_TABLE[0];

function gexp(n: number): number {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

function gfMul(xVal: number, yVal: number): number {
  if (xVal === 0 || yVal === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[xVal] + LOG_TABLE[yVal]) % 255];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], gexp(i));
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCalculateEcc(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const remainder = new Uint8Array(eccLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < eccLen - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[eccLen - 1] = gfMul(gen[eccLen], factor);
  }
  return remainder;
}

// Version table for Medium error correction (EC Level M)
// Format: [version, totalCodewords, dataCodewords, ecCodewords, ecBlocks]
const VERSION_TABLE: Array<{ version: number; size: number; total: number; data: number; ec: number; blocks: number }> = [
  { version: 1, size: 21, total: 26, data: 16, ec: 10, blocks: 1 },
  { version: 2, size: 25, total: 44, data: 28, ec: 16, blocks: 1 },
  { version: 3, size: 29, total: 70, data: 44, ec: 26, blocks: 1 },
  { version: 4, size: 33, total: 100, data: 64, ec: 18, blocks: 2 },
  { version: 5, size: 37, total: 134, data: 86, ec: 24, blocks: 2 },
  { version: 6, size: 41, total: 172, data: 108, ec: 16, blocks: 4 },
  { version: 7, size: 45, total: 196, data: 124, ec: 18, blocks: 4 },
];

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  let cfg = VERSION_TABLE.find((v) => v.data >= dataLen + 3);
  if (!cfg) {
    cfg = VERSION_TABLE[VERSION_TABLE.length - 1];
  }

  const { version, size, total, data: maxData, ec, blocks } = cfg;

  // 1. Bitstream packing: Mode (0100 for Byte mode) + count + data + terminator + padding
  const bits: number[] = [0, 1, 0, 0];
  const countBits = 8;
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((dataLen >> i) & 1);
  }
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }

  // Terminator
  const totalDataBits = maxData * 8;
  while (bits.length < totalDataBits && bits.length % 8 !== 0) {
    bits.push(0);
  }
  while (bits.length < Math.min(totalDataBits, bits.length + 4)) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes: 0xEC, 0x11 alternating
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    const pad = padPatterns[padIdx % 2];
    for (let i = 7; i >= 0; i--) bits.push((pad >> i) & 1);
    padIdx++;
  }

  // Convert bits to data codewords
  const dataCodewords = new Uint8Array(maxData);
  for (let i = 0; i < maxData; i++) {
    let val = 0;
    for (let j = 0; j < 8; j++) {
      val = (val << 1) | bits[i * 8 + j];
    }
    dataCodewords[i] = val;
  }

  // 2. Interleave EC Blocks
  const dataBlockSize = Math.floor(maxData / blocks);
  const ecPerBlock = Math.floor(ec / blocks);
  const finalCodewords = new Uint8Array(total);

  let outIdx = 0;
  const ecBlockList: Uint8Array[] = [];
  for (let b = 0; b < blocks; b++) {
    const blockData = dataCodewords.slice(b * dataBlockSize, (b + 1) * dataBlockSize);
    ecBlockList.push(rsCalculateEcc(blockData, ecPerBlock));
  }

  // Interleave data
  for (let i = 0; i < dataBlockSize; i++) {
    for (let b = 0; b < blocks; b++) {
      finalCodewords[outIdx++] = dataCodewords[b * dataBlockSize + i];
    }
  }
  // Interleave EC
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < blocks; b++) {
      finalCodewords[outIdx++] = ecBlockList[b][i];
    }
  }

  // 3. Matrix setup
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array(size).fill(null));

  // Finder patterns
  const addFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBlack =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[row][col] = isBlack;
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[4 * version + 9][8] = true;

  // Format info area reservation
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // Data bits filling (zigzag right-to-left, bottom-to-top)
  const fullBits: number[] = [];
  for (let i = 0; i < total; i++) {
    const val = finalCodewords[i];
    for (let j = 7; j >= 0; j--) {
      fullBits.push((val >> j) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (matrix[row][col] === null) {
          const bit = bitIdx < fullBits.length ? fullBits[bitIdx++] : 0;
          // Apply mask 0: (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          matrix[row][col] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // Write format info for EC Level M + Mask 0 (Format String: 101010000010010)
  const formatString = '101010000010010';
  for (let i = 0; i < 6; i++) matrix[8][i] = formatString[i] === '1';
  matrix[8][7] = formatString[6] === '1';
  matrix[8][8] = formatString[7] === '1';
  matrix[7][8] = formatString[8] === '1';
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatString[i] === '1';

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatString[i] === '1';
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatString[i] === '1';

  return matrix.map((row) => row.map((cell) => Boolean(cell)));
}

/**
 * Generates an SVG path data string ("M...h...v...") representing all dark modules.
 */
export function getQrSvgPath(text: string, moduleSize = 4, quietZone = 2): { path: string; totalSize: number } {
  const matrix = generateQrMatrix(text);
  const count = matrix.length;
  const totalSize = (count + quietZone * 2) * moduleSize;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const xPos = (c + quietZone) * moduleSize;
        const yPos = (r + quietZone) * moduleSize;
        path += `M${xPos},${yPos}h${moduleSize}v${moduleSize}h-${moduleSize}z `;
      }
    }
  }

  return { path, totalSize };
}
