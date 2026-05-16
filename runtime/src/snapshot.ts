import { uploadBytes } from './storage.js';
import { wallet, pub, addr, abis } from './chain.js';
import { parseAbi } from 'viem';

const dasAbi = parseAbi(['function epochNumber() view returns (uint256)']);
const DASIGNERS_PRECOMPILE = '0x0000000000000000000000000000000000001000' as `0x${string}`;

export type SnapshotInput = {
  tokenId: bigint;
  prevBrainRoot: `0x${string}`;
  currBrainRoot: `0x${string}`;
  realizedPnL: bigint;
  sharpeE6: number;
  memoryDiff: Buffer;          // encrypted by caller before passing
  actions: Array<{ ts: number; target: string; calldata: string; tx: string }>;
};

export type SnapshotResult = {
  root: `0x${string}`;
  tx: `0x${string}` | null;
  daEpoch: bigint;
  attestorError?: string;
};

/**
 * Compose a snapshot blob, upload to 0G Storage (may fall back to the
 * content-addressed stub), then anchor the metadata on-chain via
 * SnapshotAttestor.submit.
 *
 * The encoded blob is JSON-with-base64 memoryDiff so it stays a single Buffer
 * for the storage layer. The actions[] field is metadata only and is left
 * plaintext (calldata/tx hashes are public on-chain anyway).
 */
export async function publishSnapshot(s: SnapshotInput): Promise<SnapshotResult> {
  // 1. Compose blob (plaintext metadata; encrypted memory diff inside as base64)
  const blob = Buffer.from(JSON.stringify({
    tokenId: s.tokenId.toString(),
    prevBrainRoot: s.prevBrainRoot,
    currBrainRoot: s.currBrainRoot,
    realizedPnL: s.realizedPnL.toString(),
    sharpeE6: s.sharpeE6,
    memoryDiff: s.memoryDiff.toString('base64'),
    actions: s.actions,
    ts: Math.floor(Date.now() / 1000),
  }));

  // 2. Upload (may fall back to stub)
  const { root } = await uploadBytes(blob);

  // 3. Read DA epoch. Prefer the DASigners precompile (epochNumber()); if that
  //    reverts (some testnet deployments expose a different ABI or disable the
  //    precompile entirely) fall back to the current EVM block number, which
  //    is itself a valid monotonic anchor for lineage replay.
  let epoch: bigint = 0n;
  try {
    epoch = await pub.readContract({
      address: DASIGNERS_PRECOMPILE,
      abi: dasAbi,
      functionName: 'epochNumber',
      args: [],
    }) as bigint;
  } catch {
    try { epoch = await pub.getBlockNumber(); } catch { epoch = 0n; }
  }

  // 4. Anchor on-chain. If submit reverts (e.g. storage root not committed
  // because of a stub fallback, or operator out of gas), return tx=null with
  // the reason — caller still gets a complete lineage row to persist locally.
  let tx: `0x${string}` | null = null;
  let attestorError: string | undefined;
  try {
    tx = await wallet.writeContract({
      address: addr.SnapshotAttestor,
      abi: abis.att,
      functionName: 'submit',
      args: [s.tokenId, {
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        storageRoot: root,
        prevBrainRoot: s.prevBrainRoot,
        currBrainRoot: s.currBrainRoot,
        realizedPnL: s.realizedPnL,
        sharpeE6: BigInt(s.sharpeE6),
        daEpoch: epoch,
        daQuorumId: 0n,
      }],
    });
  } catch (e: any) {
    attestorError = e?.shortMessage || e?.message || String(e);
  }
  return { root, tx, daEpoch: epoch, attestorError };
}
