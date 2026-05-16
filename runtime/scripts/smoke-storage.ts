import { uploadBytes, downloadBytes } from '../src/storage.js';

// Use a payload >= 1 chunk (256 bytes) — the flow contract wants segment-aligned data.
const header = Buffer.from('hello from inft\u00b2 storage smoke ' + Date.now() + '\n');
const filler = Buffer.alloc(1024 - header.length, 0x41); // 'A' padding to 1KB
const payload = Buffer.concat([header, filler]);
console.log('payload header:', header.toString('utf8').trim(), '(total', payload.length, 'bytes)');

const { root, tx } = await uploadBytes(payload);
console.log('root:', root);
console.log('tx:  ', tx);

// 0G storage needs a moment to propagate after submission.
const MAX_ATTEMPTS = 12;
const WAIT_MS = 5000;
let back: Buffer | null = null;
let lastErr: unknown = null;
for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  await new Promise((r) => setTimeout(r, WAIT_MS));
  try {
    back = await downloadBytes(root);
    console.log(`download succeeded on attempt ${i}`);
    break;
  } catch (e) {
    lastErr = e;
    console.log(`attempt ${i}/${MAX_ATTEMPTS} failed: ${(e as Error)?.message ?? e}`);
  }
}

if (!back) {
  console.error('download never succeeded; last error:', lastErr);
  process.exit(2);
}

console.log('back:', back.subarray(0, 64).toString('utf8'), '...');
if (!back.equals(payload)) {
  console.error('round-trip mismatch');
  process.exit(1);
}
console.log('OK');
