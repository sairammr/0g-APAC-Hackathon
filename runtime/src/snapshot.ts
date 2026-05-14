import { uploadBytes } from './storage.js';
import { wallet, pub, addr, abis } from './chain.js';
import { parseAbi } from 'viem';

const dasAbi = parseAbi(['function getEpochNumber(uint256) view returns (uint256)']);
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

/**
 * Compose a snapshot blob, upload to 0G Storage (may fall back to the
 * content-addressed stub), then anchor the metadata on-chain via
 * SnapshotAttestor.submit.
 *
 * The encoded blob is JSON-with-base64 memoryDiff so it stays a single Buffer
 * for the storage layer. The actions[] field is metadata only and is left
 * plaintext (calldata/tx hashes are public on-chain anyway).
 */
export async function publishSnapshot(s: SnapshotInput): Promise<{ root: `0x${string}`; tx: `0x${string}` }> {
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

  // 3. Read current epoch from DASigners precompile.
  //    The precompile may not be callable from EVM via standard ABI on Galileo;
  //    if it reverts, fall back to epoch 0.
  let epoch: bigint = 0n;
  try {
    epoch = await pub.readContract({
      address: DASIGNERS_PRECOMPILE,
      abi: dasAbi,
      functionName: 'getEpochNumber',
      args: [await pub.getBlockNumber()],
    }) as bigint;
  } catch (e: any) {
    console.warn('[snapshot] DASigners epoch read failed, defaulting to 0:', e?.shortMessage || e?.message);
  }

  // 4. Anchor on-chain. Let failures propagate — main.ts has a per-iteration
  // try/catch and we don't want to silently hide submission failures.
  const tx = await wallet.writeContract({
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
  return { root, tx };
}
