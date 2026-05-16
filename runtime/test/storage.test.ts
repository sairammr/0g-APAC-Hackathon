import { describe, it, expect, beforeAll } from 'vitest';

describe('storage stub', () => {
  beforeAll(() => { process.env.STORAGE_STUB = 'true'; });

  it('round-trips bytes in stub mode', async () => {
    const { uploadBytes, downloadBytes } = await import('../src/storage.js');
    const payload = Buffer.from('hello stub ' + Date.now());
    const { root, tx } = await uploadBytes(payload);
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(tx).toBe('0xstub');
    const back = await downloadBytes(root);
    expect(back.equals(payload)).toBe(true);
  });

  it('returns deterministic root for same content', async () => {
    const { uploadBytes } = await import('../src/storage.js');
    const a = await uploadBytes(Buffer.from('same'));
    const b = await uploadBytes(Buffer.from('same'));
    expect(a.root).toBe(b.root);
  });
});
