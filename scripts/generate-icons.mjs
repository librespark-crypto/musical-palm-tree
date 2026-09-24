#!/usr/bin/env node
/**
 * Generates the PWA icons as real PNG files with zero dependencies
 * (raw RGBA rows -> zlib deflate -> PNG chunks).
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Brand mark: a rounded "rise" bar chart on a teal gradient square. */
function renderIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return;
    const index = (y * size + x) * 4;
    const alpha = a / 255;
    const existing = pixels[index + 3] / 255;
    const outAlpha = alpha + existing * (1 - alpha);
    pixels[index] = Math.round((r * alpha + pixels[index] * existing * (1 - alpha)) / (outAlpha || 1));
    pixels[index + 1] = Math.round((g * alpha + pixels[index + 1] * existing * (1 - alpha)) / (outAlpha || 1));
    pixels[index + 2] = Math.round((b * alpha + pixels[index + 2] * existing * (1 - alpha)) / (outAlpha || 1));
    pixels[index + 3] = Math.round(outAlpha * 255);
  };
  const inRoundedRect = (x, y, left, top, right, bottom, radius) => {
    if (x < left || x > right || y < top || y > bottom) return false;
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  const radius = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!inRoundedRect(x, y, 0, 0, size - 1, size - 1, radius)) continue;
      const t = (x / size) * 0.35 + (y / size) * 0.65;
      put(x, y, Math.round(11 + t * 12), Math.round(116 - t * 22), Math.round(110 - t * 20), 255);
    }
  }

  // Three ascending bars with a baseline, the "progress" motif.
  const barWidth = Math.round(size * 0.13);
  const gap = Math.round(size * 0.055);
  const baseline = Math.round(size * 0.74);
  const heights = [0.2, 0.34, 0.48];
  const startX = Math.round(size * 0.5 - (barWidth * 3 + gap * 2) / 2);
  heights.forEach((factor, index) => {
    const height = Math.round(size * factor);
    const left = startX + index * (barWidth + gap);
    const top = baseline - height;
    for (let y = top; y < baseline; y += 1) {
      for (let x = left; x < left + barWidth; x += 1) {
        const shading = 1 - (y - top) / (height * 2.2);
        put(x, y, 255, Math.round(236 * shading + 19), Math.round(210 * shading + 45), 255);
      }
    }
  });
  const lineY = Math.round(size * 0.8);
  const lineHeight = Math.max(2, Math.round(size * 0.035));
  for (let y = lineY; y < lineY + lineHeight; y += 1) {
    for (let x = Math.round(size * 0.22); x < Math.round(size * 0.78); x += 1) {
      put(x, y, 255, 255, 255, 210);
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
  ['favicon-32.png', 32, {}],
];

for (const [name, size, options] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, options));
  console.log('wrote', join('public/icons', name));
}
