import { describe, it, expect } from 'vitest';
import { generateKeypair, encryptToPubkey, decryptWithPrivkey } from '../src/brainKey';

describe('brainKey', () => {
  it('round-trips a payload', () => {
    const kp = generateKeypair();
    const ct = encryptToPubkey(kp.publicKey, Buffer.from('hello brain'));
    const pt = decryptWithPrivkey(kp.privateKey, ct);
    expect(pt.toString('utf8')).toBe('hello brain');
  });

  it('same key and plaintext produce different ciphertexts (random IV)', () => {
    const kp = generateKeypair();
    const a = encryptToPubkey(kp.publicKey, Buffer.from('x'));
    const b = encryptToPubkey(kp.publicKey, Buffer.from('x'));
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('rejects decryption with wrong key', () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const ct = encryptToPubkey(kp1.publicKey, Buffer.from('secret'));
    expect(() => decryptWithPrivkey(kp2.privateKey, ct)).toThrow();
  });
});
