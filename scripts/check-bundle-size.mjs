/**
 * check-bundle-size.mjs — Verifies dist/index.js is under 1 MB.
 */

import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const LIMIT_BYTES = 1 * 1024 * 1024; // 1 MB

const distIndex = resolve(import.meta.dirname, '..', 'dist', 'index.js');

try {
  const { size } = await stat(distIndex);
  if (size > LIMIT_BYTES) {
    console.error(`[hiai-opencode] ERROR: dist/index.js is ${(size / 1024 / 1024).toFixed(2)} MB — exceeds 1 MB limit`);
    process.exit(1);
  }
  console.log(`[hiai-opencode] Bundle size OK: ${(size / 1024).toFixed(1)} KB (limit: 1 MB)`);
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error(`[hiai-opencode] ERROR: ${distIndex} not found — run \`bun run build\` first`);
    process.exit(1);
  }
  throw err;
}
