import { describe, it, expect } from 'vitest';
import { generateKeypair, encryptToPubkey, decryptWithPrivkey } from '../src/brainKey';

describe('brainKey', () => {
  it('round-trips a payload', async () => {
    const kp = generateKeypair();
    const ct = await encryptToPubkey(kp.publicKey, Buffer.from('hello brain'));
    const pt = await decryptWithPrivkey(kp.privateKey, ct);
    expect(pt.toString('utf8')).toBe('hello brain');
  });

  it('different keys produce different ciphertexts', async () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const a = await encryptToPubkey(kp1.publicKey, Buffer.from('x'));
    const b = await encryptToPubkey(kp2.publicKey, Buffer.from('x'));
    expect(Buffer.compare(a, b)).not.toBe(0);
  });
});
