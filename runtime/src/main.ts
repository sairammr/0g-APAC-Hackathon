import 'dotenv/config';
import pino from 'pino';
import { tick, indicators } from './market.js';
import { decide as momDecide } from './strategies/momentum.js';
import { decide as mrDecide } from './strategies/meanRev.js';
import { decide as mmDecide } from './strategies/marketMaker.js';
import { decide as mgrDecide, readChildPerf } from './strategies/manager.js';
import { signIntent, submitChildIntent, nextNonce, buildSwap, buildApprove, type Intent } from './intent.js';
import { publishSnapshot } from './snapshot.js';
import { netValue, computeSharpeE6, balanceOf } from './pnl.js';
import { pub, addr, abis } from './chain.js';
import { insertEquity, insertTick, insertSnapshot, equitySeries, getLatestBrainRoot, listPendingTransfers, markTransferDone, markTransferFailed } from './db.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { reKeyAndTransfer } from './transfer.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

const MANAGER_ID = BigInt(process.env.MANAGER_ID || 2);
const CHILDREN: { id: bigint; strat: 'momentum' | 'meanRev' | 'marketMaker' }[] = [
  { id: BigInt(process.env.MOM_ID || 3), strat: 'momentum' },
  { id: BigInt(process.env.MR_ID  || 4), strat: 'meanRev' },
  { id: BigInt(process.env.MM_ID  || 5), strat: 'marketMaker' },
];

const DUSD = (process.env.DUSD || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const DRISK = (process.env.DRISK || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const ROUTER = (process.env.UNI_ROUTER || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const DEX_AVAILABLE = DUSD !== '0x0000000000000000000000000000000000000000'
  && DRISK !== '0x0000000000000000000000000000000000000000'
  && ROUTER !== '0x0000000000000000000000000000000000000000';

const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS || 60_000);
const SNAPSHOT_EVERY_MS = Number(process.env.SNAPSHOT_EVERY_MS || 6 * 3600 * 1000);
const TRANSFER_POLL_MS = Number(process.env.TRANSFER_POLL_MS || 15_000);
const DB_ENABLED = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Brain encryption private key. Defaults to the operator's EOA private key —
// SeedDemo.s.sol registers operator-derived pubkey as the brain pubkey for
// every minted iNFT. Override with BRAIN_PRIVKEY if you used a different
// key in the seed step.
const BRAIN_PRIVKEY_HEX = (process.env.BRAIN_PRIVKEY || process.env.PRIVATE_KEY || '').replace(/^0x/, '');
const BRAIN_PRIVKEY = BRAIN_PRIVKEY_HEX ? Buffer.from(BRAIN_PRIVKEY_HEX, 'hex') : null;

let lastSnapshotAt = 0;
const lastActionByChild: Record<string, string> = {};

// Paper portfolio state: each agent starts with 1.0e18 wei (1 ETH-equivalent
// notional) of cash + 0 risk position. buy/sell decisions move cash↔position
// at the current market price. This lets us write a real equity time series
// per tick even without an on-chain DEX.
const PAPER_START = 10n ** 18n;
const paperCash: Record<string, bigint> = {};
const paperRisk: Record<string, bigint> = {}; // risk asset units (e6-scaled)
function paperInit(id: string) {
  if (paperCash[id] === undefined) { paperCash[id] = PAPER_START; paperRisk[id] = 0n; }
}
function paperApply(id: string, action: string, sizeBps: number, price: number) {
  paperInit(id);
  if (action === 'hold' || sizeBps === 0) return;
  // Price scaled to e6 to keep bigint math safe.
  const priceE6 = BigInt(Math.max(1, Math.floor(price * 1e6)));
  if (action === 'buy') {
    const spend = (paperCash[id] * BigInt(sizeBps)) / 10000n;
    paperCash[id] -= spend;
    paperRisk[id] += (spend * 1_000_000n) / priceE6;
  } else if (action === 'sell') {
    const sell = (paperRisk[id] * BigInt(sizeBps)) / 10000n;
    paperRisk[id] -= sell;
    paperCash[id] += (sell * priceE6) / 1_000_000n;
  }
}
function paperEquity(id: string, price: number): bigint {
  paperInit(id);
  const priceE6 = BigInt(Math.max(1, Math.floor(price * 1e6)));
  return paperCash[id] + (paperRisk[id] * priceE6) / 1_000_000n;
}

async function getWallet(tokenId: bigint): Promise<`0x${string}`> {
  return pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'walletOf', args: [tokenId],
  }) as Promise<`0x${string}`>;
}

const ZERO_ROOT = ('0x' + '00'.repeat(32)) as `0x${string}`;

async function getBrainRoots(tokenId: bigint): Promise<{ prev: `0x${string}`; curr: `0x${string}` }> {
  try {
    const [curr, prev] = await Promise.all([
      pub.readContract({
        address: addr.iNFT2, abi: abis.inft,
        functionName: 'latestBrainRoot', args: [tokenId],
      }) as Promise<`0x${string}`>,
      pub.readContract({
        address: addr.iNFT2, abi: abis.inft,
        functionName: 'prevBrainRoot', args: [tokenId],
      }) as Promise<`0x${string}`>,
    ]);
    return { prev, curr };
  } catch {
    return { prev: ZERO_ROOT, curr: ZERO_ROOT };
  }
}

async function runChild(child: { id: bigint; strat: string }, market: { price: number; sma20: number; sma50: number }) {
  const wallet = await getWallet(child.id);
  const equityBefore = DEX_AVAILABLE
    ? await netValue(wallet, DUSD, DRISK, market.price)
    : 0n;

  let decision;
  let tee;
  if (child.strat === 'momentum') {
    const r = await momDecide({ ...market, balance: equityBefore });
    decision = r.decision; tee = r.tee;
  } else if (child.strat === 'meanRev') {
    const r = await mrDecide({ ...market, balance: equityBefore });
    decision = r.decision; tee = r.tee;
  } else {
    const r = await mmDecide({
      price: market.price, sma20: market.sma20, balance: equityBefore,
      lastAction: lastActionByChild[child.id.toString()] || 'hold',
    });
    decision = r.decision; tee = r.tee;
  }

  log.info({ child: child.id.toString(), decision, teeVerified: tee.teeVerified }, 'child decision');
  lastActionByChild[child.id.toString()] = decision.action;

  // Apply decision to paper portfolio and record equity for every tick.
  paperApply(child.id.toString(), decision.action, decision.sizeBps, market.price);
  const eqNow = paperEquity(child.id.toString(), market.price);

  if (DB_ENABLED) {
    try {
      await insertTick({
        tokenId: child.id,
        action: decision.action,
        sizeBps: decision.sizeBps,
        teeVerified: tee.teeVerified,
        chatId: tee.chatId,
      });
    } catch (e: any) {
      log.warn({ err: e?.message }, 'db insertTick failed');
    }
    try {
      await insertEquity(child.id, eqNow);
    } catch (e: any) {
      log.warn({ err: e?.message }, 'db insertEquity failed');
    }
  }

  if (decision.action === 'hold' || decision.sizeBps === 0) return;
  if (!DEX_AVAILABLE) {
    log.info({ child: child.id.toString() }, 'no DEX configured; skipping swap submission');
    return;
  }

  // Build swap intent
  const tokenIn  = decision.action === 'buy' ? DUSD : DRISK;
  const tokenOut = decision.action === 'buy' ? DRISK : DUSD;
  const balIn = await balanceOf(tokenIn, wallet);
  const amountIn = (balIn * BigInt(decision.sizeBps)) / 10000n;
  if (amountIn === 0n) return;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const path: `0x${string}`[] = [tokenIn, tokenOut];

  const nApprove = await nextNonce(child.id);
  const approveIntent: Intent = {
    tokenId: child.id, nonce: nApprove, target: tokenIn, value: 0n,
    callData: buildApprove(ROUTER, amountIn), expiry: deadline,
  };
  const approveSig = await signIntent(approveIntent);
  const txA = await submitChildIntent(MANAGER_ID, approveIntent, approveSig);
  log.info({ tx: txA }, 'approve submitted');

  const nSwap = nApprove + 1n;
  const swapIntent: Intent = {
    tokenId: child.id, nonce: nSwap, target: ROUTER, value: 0n,
    callData: buildSwap(amountIn, 0n, path, wallet, deadline),
    expiry: deadline,
  };
  const swapSig = await signIntent(swapIntent);
  const txS = await submitChildIntent(MANAGER_ID, swapIntent, swapSig);
  log.info({ tx: txS, action: decision.action, sizeBps: decision.sizeBps }, 'swap submitted');

  if (DB_ENABLED) {
    try {
      await insertTick({ tokenId: child.id, action: decision.action, sizeBps: decision.sizeBps, txHash: txS });
      const equityAfter = await netValue(wallet, DUSD, DRISK, market.price);
      await insertEquity(child.id, equityAfter);
    } catch (e: any) {
      log.warn({ err: e?.message }, 'db post-swap write failed');
    }
  }
}

async function runManager() {
  try {
    const perf = await readChildPerf(CHILDREN.map(c => c.id));
    const { alloc, tee } = await mgrDecide(perf);
    log.info({ weights: alloc.weights, rationale: alloc.rationale, teeVerified: tee.teeVerified }, 'manager allocation');
  } catch (e: any) {
    log.warn({ err: e?.shortMessage || e?.message }, 'manager step failed (likely no snapshots yet)');
  }
}

async function snapshotAll(price: number) {
  const ids = [MANAGER_ID, ...CHILDREN.map(c => c.id)];
  for (const id of ids) {
    try {
      const wallet = await getWallet(id);
      const series = DB_ENABLED ? await equitySeries(id) : [];
      const sharpe = computeSharpeE6(series);
      const equity = DEX_AVAILABLE ? await netValue(wallet, DUSD, DRISK, price) : 0n;
      const realizedPnL = series.length > 0 ? equity - series[0] : 0n;
      // Real lineage chain: prev = the previous snapshot's curr from the DB
      // (falls back to the contract's stored root on first ever snapshot, or
      // zero if neither exists). curr = keccak256 of (prev || ts || equity)
      // which guarantees a different root per snapshot AND threads each
      // snapshot's content into the next root deterministically.
      const dbPrev = DB_ENABLED ? await getLatestBrainRoot(id).catch(() => null) : null;
      const contractRoots = await getBrainRoots(id);
      const prevBrainRoot = (dbPrev as `0x${string}` | null) ?? contractRoots.curr ?? ZERO_ROOT;
      const seed = Buffer.concat([
        Buffer.from(prevBrainRoot.slice(2), 'hex'),
        Buffer.from(BigInt(Math.floor(Date.now() / 1000)).toString(16).padStart(16, '0'), 'hex'),
        Buffer.from(equity.toString(16).padStart(64, '0'), 'hex'),
      ]);
      const currBrainRoot = ('0x' + Buffer.from(keccak_256(seed)).toString('hex')) as `0x${string}`;
      const res = await publishSnapshot({
        tokenId: id,
        prevBrainRoot,
        currBrainRoot,
        realizedPnL,
        sharpeE6: sharpe,
        memoryDiff: Buffer.alloc(0),
        actions: [],
      });
      if (DB_ENABLED) {
        try {
          await insertSnapshot({
            tokenId: id,
            storageRoot: res.root,
            prevBrainRoot,
            currBrainRoot,
            realizedPnL,
            sharpeE6: sharpe,
            daEpoch: res.daEpoch,
            txHash: res.tx,
          });
        } catch (e: any) {
          log.warn({ id: id.toString(), err: e?.message }, 'db insertSnapshot failed');
        }
      }
      log.info({ id: id.toString(), sharpe, pnL: realizedPnL.toString(), root: res.root, tx: res.tx, daEpoch: res.daEpoch.toString(), attestorErr: res.attestorError }, 'snapshot published');
    } catch (e: any) {
      log.warn({ id: id.toString(), err: e?.shortMessage || e?.message }, 'snapshot failed');
    }
  }
}

async function loopOnce() {
  try {
    const m = await tick();
    const ind = indicators();
    log.info({ price: m.price, sma20: ind.sma20, sma50: ind.sma50 }, 'tick');

    for (const c of CHILDREN) {
      try {
        await runChild(c, ind);
      } catch (e: any) {
        log.error({ child: c.id.toString(), err: e?.shortMessage || e?.message }, 'child step failed');
      }
    }
    await runManager();
    if (Date.now() - lastSnapshotAt > SNAPSHOT_EVERY_MS) {
      await snapshotAll(m.price);
      lastSnapshotAt = Date.now();
    }
  } catch (e: any) {
    log.error({ err: e?.message, stack: e?.stack }, 'loop error');
  }
}

async function processOnePendingTransfer() {
  if (!DB_ENABLED || !BRAIN_PRIVKEY) return;
  let pending: Awaited<ReturnType<typeof listPendingTransfers>>;
  try {
    pending = await listPendingTransfers();
  } catch (e: any) {
    log.warn({ err: e?.message }, 'transfer queue read failed');
    return;
  }
  for (const row of pending) {
    const tokenId = BigInt(row.token_id);
    const buyerPubkeyHex = row.new_brain_root.replace(/^0x/, '');
    if (!buyerPubkeyHex || buyerPubkeyHex.length !== 130) {
      await markTransferFailed(row.id, 'invalid buyer pubkey').catch(() => {});
      continue;
    }
    try {
      const currentBrainRoot = await pub.readContract({
        address: addr.iNFT2, abi: abis.inft,
        functionName: 'latestBrainRoot', args: [tokenId],
      }) as `0x${string}`;
      const fromAddr = await pub.readContract({
        address: addr.iNFT2, abi: abis.inft,
        functionName: 'ownerOf', args: [tokenId],
      }) as `0x${string}`;
      const buyerPubkey = Buffer.from(buyerPubkeyHex, 'hex');
      const { tx, newRoot } = await reKeyAndTransfer(
        tokenId, fromAddr, row.to_addr as `0x${string}`,
        currentBrainRoot, BRAIN_PRIVKEY, buyerPubkey,
      );
      await markTransferDone(row.id, tx, newRoot);
      log.info({ tokenId: tokenId.toString(), buyer: row.to_addr, tx }, 'transfer completed');
    } catch (e: any) {
      log.error({ tokenId: tokenId.toString(), err: e?.shortMessage || e?.message }, 'transfer failed');
      await markTransferFailed(row.id, e?.shortMessage || e?.message || 'unknown').catch(() => {});
    }
  }
}

async function transferLoop() {
  while (true) {
    try { await processOnePendingTransfer(); } catch (e: any) {
      log.error({ err: e?.message }, 'transferLoop error');
    }
    await new Promise(r => setTimeout(r, TRANSFER_POLL_MS));
  }
}

async function main() {
  log.info({
    manager: MANAGER_ID.toString(),
    children: CHILDREN.map(c => `${c.id}:${c.strat}`),
    dexAvailable: DEX_AVAILABLE,
    dbEnabled: DB_ENABLED,
    brainKeyLoaded: !!BRAIN_PRIVKEY,
    tickIntervalMs: TICK_INTERVAL_MS,
    transferPollMs: TRANSFER_POLL_MS,
  }, 'starting iNFT² runtime');

  // Kick off transfer queue drain in parallel with the trading loop.
  if (DB_ENABLED && BRAIN_PRIVKEY) {
    transferLoop().catch(e => log.error({ err: e?.message }, 'transferLoop crashed'));
  }

  while (true) {
    await loopOnce();
    await new Promise(r => setTimeout(r, TICK_INTERVAL_MS));
  }
}

main().catch(e => { log.error(e); process.exit(1); });
