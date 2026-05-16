import { infer } from '../src/llm.js';

const r = await infer(
  'You are a JSON-only assistant.',
  'Output exactly {"ok": true}'
);
console.log(r);
