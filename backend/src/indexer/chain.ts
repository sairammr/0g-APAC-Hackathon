import { createPublicClient, http, parseAbiItem, defineChain } from 'viem';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { supabase } from '../db/supabase.js';
import 'dotenv/config';

// Read deployments via fs (works in tsx + ESM without JSON-import flags).
const __dirname = dirname(fileURLToPath(import.meta.url));
const deploymentsPath = resolve(__dirname, '../../../runtime/deployments/testnet.json');
const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8')) as {
  iNFT2: `0x${string}`;
  SnapshotAttestor: `0x${string}`;
  AgentController: `0x${string}`;
};

const zgGalileo = defineChain({
  id: 16602,
  name: '0G Galileo',
  network: '0g-galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai'] } },
});

const pub = createPublicClient({ chain: zgGalileo, transport: http() });

const events = {
  BrainUpdated: parseAbiItem(
    'event BrainUpdated(uint256 indexed tokenId, bytes32 prevRoot, bytes32 newRoot, string uri)'
  ),
  Transfer: parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
  ),
  SnapshotPublished: parseAbiItem(
    'event SnapshotPublished(uint256 indexed tokenId, uint256 timestamp, bytes32 storageRoot, int256 sharpeE6, uint256 daEpoch)'
  ),
  IntentExecuted: parseAbiItem(
    'event IntentExecuted(uint256 indexed parentId, uint256 indexed childId, address indexed target, uint256 value, bytes32 callHash)'
  ),
  BrainReKeyed: parseAbiItem(
    'event BrainReKeyed(uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newRoot)'
  ),
};

const META_KEY = 'last_indexed_block';
const CHUNK = 500n;

const eventAddress: Record<string, `0x${string}`> = {
  BrainUpdated: deployments.iNFT2,
  Transfer: deployments.iNFT2,
  BrainReKeyed: deployments.iNFT2,
  SnapshotPublished: deployments.SnapshotAttestor,
  IntentExecuted: deployments.AgentController,
};

export async function startIndexer() {
  let fromBlock = await getLastIndexedBlock();
  const head = await pub.getBlockNumber();
  while (fromBlock <= head) {
    const toBlock = fromBlock + CHUNK > head ? head : fromBlock + CHUNK;
    await indexRange(fromBlock, toBlock);
    fromBlock = toBlock + 1n;
    await setLastIndexedBlock(fromBlock);
  }

  pub.watchEvent({
    address: deployments.iNFT2,
    event: events.BrainUpdated,
    onLogs: async (logs) => {
      for (const l of logs) await onBrainUpdated(l as any);
    },
  });
  pub.watchEvent({
    address: deployments.iNFT2,
    event: events.Transfer,
    onLogs: async (logs) => {
      for (const l of logs) await onTransfer(l as any);
    },
  });
  pub.watchEvent({
    address: deployments.SnapshotAttestor,
    event: events.SnapshotPublished,
    onLogs: async (logs) => {
      for (const l of logs) await onSnapshot(l as any);
    },
  });
  pub.watchEvent({
    address: deployments.AgentController,
    event: events.IntentExecuted,
    onLogs: async (logs) => {
      for (const l of logs) await onIntent(l as any);
    },
  });
  pub.watchEvent({
    address: deployments.iNFT2,
    event: events.BrainReKeyed,
    onLogs: async (logs) => {
      for (const l of logs) await onReKey(l as any);
    },
  });
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  const dispatch: Record<string, (l: any) => Promise<void>> = {
    BrainUpdated: onBrainUpdated,
    Transfer: onTransfer,
    SnapshotPublished: onSnapshot,
    IntentExecuted: onIntent,
    BrainReKeyed: onReKey,
  };
  for (const [name, ev] of Object.entries(events)) {
    let logs: any[] = [];
    try {
      logs = await pub.getLogs({ address: eventAddress[name], event: ev as any, fromBlock, toBlock });
    } catch (e: any) {
      console.warn(
        `[indexer] getLogs(${name}) failed for ${fromBlock}-${toBlock}:`,
        e?.shortMessage || e?.message
      );
      continue;
    }
    for (const l of logs) {
      try {
        await dispatch[name]!(l);
      } catch (e: any) {
        console.warn(`[indexer] ${name} handler failed:`, e?.message);
      }
    }
  }
}

async function onBrainUpdated(log: any) {
  const { tokenId, newRoot, uri } = log.args;
  const { error } = await supabase().from('agents').upsert(
    {
      token_id: tokenId.toString(),
      brain_root: newRoot,
      brain_uri: uri,
    },
    { onConflict: 'token_id' }
  );
  if (error) throw error;
}

async function onTransfer(log: any) {
  const { from, to, tokenId } = log.args;
  await supabase().from('transfers').insert({
    token_id: tokenId.toString(),
    from_addr: from,
    to_addr: to,
    new_brain_root: '',
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
  await supabase().from('agents').upsert(
    {
      token_id: tokenId.toString(),
      owner: to,
    },
    { onConflict: 'token_id' }
  );
}

async function onSnapshot(log: any) {
  const { tokenId, timestamp, storageRoot, sharpeE6, daEpoch } = log.args;
  await supabase().from('snapshots').insert({
    token_id: tokenId.toString(),
    ts: Number(timestamp),
    storage_root: storageRoot,
    realized_pnl: '0',
    sharpe_e6: Number(sharpeE6),
    da_epoch: daEpoch.toString(),
    da_verified: false,
  });
}

async function onIntent(log: any) {
  const { childId, target, value, callHash } = log.args;
  await supabase().from('intents').insert({
    token_id: childId.toString(),
    nonce: '0',
    target,
    value: value.toString(),
    call_data: callHash,
    expiry: '0',
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
}

async function onReKey(log: any) {
  const { tokenId, from, to, newRoot } = log.args;
  await supabase().from('transfers').insert({
    token_id: tokenId.toString(),
    from_addr: from,
    to_addr: to,
    new_brain_root: newRoot,
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
}

async function getLastIndexedBlock(): Promise<bigint> {
  const { data } = await supabase()
    .from('indexer_meta')
    .select('value')
    .eq('key', META_KEY)
    .maybeSingle();
  return data ? BigInt((data as any).value) : 0n;
}

async function setLastIndexedBlock(b: bigint) {
  await supabase()
    .from('indexer_meta')
    .upsert({ key: META_KEY, value: b.toString() }, { onConflict: 'key' });
}
