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
export function encryptToPubkey(recipientPub: Uint8Array, plaintext: Uint8Array): Buffer {
  const ephemeral = utils.randomSecretKey();
  const ephPub = getPublicKey(ephemeral, false);
  const key = getSharedSecret(ephemeral, recipientPub, true).slice(1, 33); // strip SEC 1 prefix byte (0x02 or 0x03)
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ct = cipher.encrypt(plaintext);
  return Buffer.concat([Buffer.from(ephPub), iv, Buffer.from(ct)]);
}

export function decryptWithPrivkey(privateKey: Uint8Array, blob: Buffer): Buffer {
  const ephPub = blob.subarray(0, 65);
  const iv = blob.subarray(65, 65 + 12);
  const ct = blob.subarray(65 + 12);
  const key = getSharedSecret(privateKey, ephPub, true).slice(1, 33); // strip SEC 1 prefix byte (0x02 or 0x03)
  const cipher = gcm(key, iv);
  const pt = cipher.decrypt(ct);
  return Buffer.from(pt);
}
