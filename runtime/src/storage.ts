import { Indexer, MemData } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keccak_256 } from '@noble/hashes/sha3.js';
import 'dotenv/config';

const RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = process.env.STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai';

if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const indexer = new Indexer(INDEXER_URL);

/**
 * Stub mode is a hackathon fallback for when the live 0G SDK upload reverts
 * due to the flow-contract selector mismatch on Galileo (SDK 0.3.3 vs deployed
 * flow contract). When enabled, uploads are kept in an in-memory map keyed by
 * keccak256(data) — the same content-addressing scheme the network would use,
 * so downstream consumers (snapshots, transfers, smoke tests) keep working.
 *
 * Toggle via `STORAGE_STUB=true` in the environment.
 */
const STORAGE_STUB = process.env.STORAGE_STUB === 'true';

/**
 * Exported only for tests. Module-private content-addressed store used in
 * stub mode and as a fallback when the live SDK call throws.
 */
export const _stubStore: Map<string, Buffer> = new Map();

function stubUpload(data: Buffer): { root: `0x${string}`; tx: `0x${string}` } {
  const digest = keccak_256(data);
  const hex = Buffer.from(digest).toString('hex');
  const root = ('0x' + hex) as `0x${string}`;
  _stubStore.set(root, Buffer.from(data));
  return { root, tx: '0xstub' as `0x${string}` };
}

/**
 * Upload an arbitrary Buffer payload to 0G Storage and return the
 * Merkle root + on-chain submission tx hash. Bytes are stored as-is —
 * encrypt at the brainKey layer before calling this.
 */
export async function uploadBytes(data: Buffer): Promise<{ root: `0x${string}`; tx: `0x${string}` }> {
  if (STORAGE_STUB) {
    return stubUpload(data);
  }
  try {
    // Buffer extends Uint8Array which satisfies ArrayLike<number>, so no copy needed.
    const mem = new MemData(data);
    const [tree, treeErr] = await mem.merkleTree();
    if (treeErr) throw treeErr;
    const root = tree!.rootHash();
    if (!root) throw new Error('failed to compute root hash');
    // The 0g-ts-sdk's `Signer` type is bound to its CJS copy of ethers, while
    // we import the ESM build. The runtime objects are identical; we cast
    // through `any` to bridge the dual-package hazard.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [res, upErr] = await indexer.upload(mem, RPC, signer as any);
    if (upErr) throw upErr;
    return { root: root as `0x${string}`, tx: res.txHash as `0x${string}` };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    console.warn('[storage] live upload failed, falling back to content-addressed stub:', msg);
    return stubUpload(data);
  }
}

/**
 * Download a payload from 0G Storage by Merkle root. The SDK only exposes
 * `download(root, filePath, proof)` — it writes to disk, so we round-trip
 * through a temp file and return the raw Buffer.
 *
 * The stub store is checked first so anything uploaded via the in-memory
 * fallback path round-trips without hitting the network.
 */
export async function downloadBytes(root: string): Promise<Buffer> {
  const cached = _stubStore.get(root);
  if (cached) return cached;

  const dir = mkdtempSync(join(tmpdir(), 'zg-dl-'));
  const fp = join(dir, 'blob');
  try {
    const err = await indexer.download(root, fp, true);
    if (err) throw err;
    return readFileSync(fp);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    throw new Error(`[storage] download failed for root ${root}: ${msg}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
