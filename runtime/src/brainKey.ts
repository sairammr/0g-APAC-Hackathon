import { getPublicKey, getSharedSecret, utils } from '@noble/secp256k1';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from 'node:crypto';

export type Keypair = { privateKey: Uint8Array; publicKey: Uint8Array };

export function generateKeypair(): Keypair {
  const privateKey = utils.randomSecretKey();
  const publicKey = getPublicKey(privateKey, false); // uncompressed 65 bytes
  return { privateKey, publicKey };
}

// ECIES: ephemeral ECDH -> AES-GCM(key=KDF(shared)) || ephemeralPubkey || iv || ciphertext+tag
export async function encryptToPubkey(recipientPub: Uint8Array, plaintext: Uint8Array): Promise<Buffer> {
  const ephemeral = utils.randomSecretKey();
  const ephPub = getPublicKey(ephemeral, false);
  const shared = getSharedSecret(ephemeral, recipientPub, true).slice(1); // strip 0x02/03
  const key = shared.slice(0, 32); // KDF: use first 32 bytes -- for production, use HKDF
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ct = cipher.encrypt(plaintext);
  return Buffer.concat([Buffer.from(ephPub), iv, Buffer.from(ct)]);
}

export async function decryptWithPrivkey(privateKey: Uint8Array, blob: Buffer): Promise<Buffer> {
  const ephPub = blob.subarray(0, 65);
  const iv = blob.subarray(65, 65 + 12);
  const ct = blob.subarray(65 + 12);
  const shared = getSharedSecret(privateKey, ephPub, true).slice(1);
  const key = shared.subarray(0, 32);
  const cipher = gcm(key, iv);
  const pt = cipher.decrypt(ct);
  return Buffer.from(pt);
}
