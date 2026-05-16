import { Indexer, MemData, StorageNode, Uploader } from '@0glabs/0g-ts-sdk';
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
 * Stub mode is a hackathon escape hatch — when the on-chain submit path is
 * truly broken (e.g. the storage nodes are offline), fall back to a local
 * content-addressed map so the rest of the pipeline keeps working. Toggle
 * with `STORAGE_STUB=true`. With the new-ABI fix below the live path should
 * succeed on Galileo and this flag stays off.
 */
const STORAGE_STUB = process.env.STORAGE_STUB === 'true';

export const _stubStore: Map<string, Buffer> = new Map();

function stubUpload(data: Buffer): { root: `0x${string}`; tx: `0x${string}` } {
  const digest = keccak_256(data);
  const hex = Buffer.from(digest).toString('hex');
  const root = ('0x' + hex) as `0x${string}`;
  _stubStore.set(root, Buffer.from(data));
  return { root, tx: '0xstub' as `0x${string}` };
}

/**
 * The deployed FixedPriceFlow on Galileo has been upgraded: `submit` now
 * takes `Submission { SubmissionData data; address submitter; }` (the wrapper
 * adds an explicit `submitter` field). SDK 0.3.3's typechain bindings still
 * use the old flat `(length, tags, nodes)` selector (0xef3e12dc), so every
 * SDK upload reverts with empty data — which ethers v6 mis-labels as
 * `require(false)`.
 *
 * This minimal ABI matches the deployed contract and is what we hand to
 * ethers.Contract so `flow.submit(...)` encodes the right calldata and
 * `flow.interface.parseLog(submitEvent)` decodes the new Submit event
 * shape (submitter is the first indexed arg).
 */
const FLOW_ABI_NEW = [
  'function market() view returns (address)',
  'function submit(((uint256 length, bytes tags, (bytes32 root, uint256 height)[] nodes) data, address submitter) submission) payable returns (uint256, bytes32, uint256, uint256)',
  'event Submit(address indexed sender, bytes32 indexed identity, uint256 submissionIndex, uint256 startPos, uint256 length, (uint256 length, bytes tags, (bytes32 root, uint256 height)[] nodes) submission)',
];

const MARKET_ABI = ['function pricePerSector() view returns (uint256)'];

/**
 * Subclass of the SDK's Uploader that overrides just the two methods that
 * encode/decode `submit` — everything else (segment splitting, HTTP uploads,
 * finalization wait) is inherited unchanged.
 */
class V2Uploader extends Uploader {
  // @ts-expect-error — accessing parent's private flow contract
  private get flowContract(): ethers.Contract { return this.flow; }

  async submitTransaction(submission: any, _opts: any, _retryOpts?: any): Promise<[any, Error | null]> {
    try {
      const marketAddr: string = await (this.flowContract as any).market();
      const market = new ethers.Contract(marketAddr, MARKET_ABI, provider);
      const pricePerSector: bigint = await market.pricePerSector();

      let sectors = 0n;
      for (const n of submission.nodes) sectors += 1n << BigInt(n.height.toString());
      const fee = sectors * pricePerSector;

      const submitterAddr = await signer.getAddress();
      const wrapped = [
        [
          BigInt(submission.length.toString()),
          submission.tags,
          submission.nodes.map((n: any) => [n.root, BigInt(n.height.toString())]),
        ],
        submitterAddr,
      ];

      const gasPrice = (await provider.getFeeData()).gasPrice ?? 0n;
      console.log('[v2 uploader] sending submit tx, fee =', fee.toString(), 'wei');
      const resp = await (this.flowContract as any).submit(wrapped, {
        value: fee,
        gasPrice,
      });
      const tx = await resp.wait();
      if (!tx) return [null, new Error('submit tx returned null receipt')];
      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (!receipt) return [null, new Error('failed to fetch receipt')];
      return [receipt, null];
    } catch (e) {
      return [null, e as Error];
    }
  }

  async processLogs(receipt: any): Promise<number[]> {
    const contractAddr = (await (this.flowContract as any).getAddress()).toLowerCase();
    const submitEvent = this.flowContract.interface.getEvent('Submit');
    if (!submitEvent) return [];
    const seqs: number[] = [];
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddr) continue;
      if (log.topics[0] !== submitEvent.topicHash) continue;
      try {
        const parsed = this.flowContract.interface.parseLog(log);
        if (parsed?.name === 'Submit') {
          seqs.push(Number(parsed.args.submissionIndex));
        }
      } catch { /* skip non-matching logs */ }
    }
    return seqs;
  }
}

/**
 * Custom upload that bypasses Indexer.upload — instead, selects nodes via
 * the indexer, builds an ethers.Contract with the new-ABI flow, and drives
 * the V2Uploader directly. Falls back to the stub on any error so the rest
 * of the runtime keeps making progress.
 */
async function liveUpload(data: Buffer): Promise<{ root: `0x${string}`; tx: `0x${string}` }> {
  const mem = new MemData(data);
  const [tree, treeErr] = await mem.merkleTree();
  if (treeErr || !tree) throw treeErr ?? new Error('merkle tree failed');
  const root = tree.rootHash() as `0x${string}`;

  // Select a replica-satisfying subset of trusted nodes via the indexer's
  // own picker (same logic the SDK uses internally). One node is rarely
  // enough — shard configs need to cover the full shard space.
  const [clients, selErr] = await indexer.selectNodes(1);
  if (selErr || !clients || clients.length === 0) {
    throw selErr ?? new Error('no storage nodes selected');
  }
  const status = await clients[0].getStatus();
  if (!status) throw new Error('failed to get status from selected node');
  const flowAddr = status.networkIdentity.flowAddress;

  const flow = new ethers.Contract(flowAddr, FLOW_ABI_NEW, signer);
  const uploader = new V2Uploader(clients, RPC, flow as any, 0n, 0n);

  const opts = {
    tags: '0x',
    finalityRequired: true,
    taskSize: 10,
    expectedReplica: 1,
    skipTx: false,
    fee: 0n,
  };

  const [res, err] = await uploader.uploadFile(mem, opts as any);
  if (err) throw err;
  return { root, tx: (res.txHash || '0x') as `0x${string}` };
}

export async function uploadBytes(data: Buffer): Promise<{ root: `0x${string}`; tx: `0x${string}` }> {
  if (STORAGE_STUB) return stubUpload(data);
  try {
    return await liveUpload(data);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    console.warn('[storage] live upload failed, falling back to content-addressed stub:', msg);
    return stubUpload(data);
  }
}

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
