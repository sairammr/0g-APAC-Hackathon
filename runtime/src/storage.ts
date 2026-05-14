import { Indexer, MemData } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import 'dotenv/config';

const RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = process.env.STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai';

if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const indexer = new Indexer(INDEXER_URL);

/**
 * Upload an arbitrary Buffer payload to 0G Storage and return the
 * Merkle root + on-chain submission tx hash. Bytes are stored as-is —
 * encrypt at the brainKey layer before calling this.
 */
export async function uploadBytes(data: Buffer): Promise<{ root: `0x${string}`; tx: string }> {
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
  return { root: root as `0x${string}`, tx: res.txHash };
}

/**
 * Download a payload from 0G Storage by Merkle root. The SDK only exposes
 * `download(root, filePath, proof)` — it writes to disk, so we round-trip
 * through a temp file and return the raw Buffer.
 */
export async function downloadBytes(root: string): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'zg-dl-'));
  const fp = join(dir, 'blob');
  try {
    const err = await indexer.download(root, fp, true);
    if (err) throw err;
    return readFileSync(fp);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
