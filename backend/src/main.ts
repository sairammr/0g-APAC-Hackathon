import Fastify from 'fastify';
import cors from '@fastify/cors';
import { startIndexer } from './indexer/chain.js';
import { processUnfetched } from './indexer/snapshots.js';
import { supabase } from './db/supabase.js';
import { createPublicClient, http, defineChain, parseAbi } from 'viem';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const deployments = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../contracts/deployments/testnet.json', import.meta.url)),
    'utf8',
  ),
);

const zg = defineChain({
  id: deployments.chainId,
  name: '0G Galileo',
  network: '0g-galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || deployments.rpc] } },
});
const pub = createPublicClient({ chain: zg, transport: http() });
const inftAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/api/agent/:id', async (req: any) => {
  const id = req.params.id as string;
  const [{ data: agent }, { data: snaps }, { data: its }] = await Promise.all([
    supabase().from('agents').select('*').eq('token_id', id).maybeSingle(),
    supabase()
      .from('snapshots')
      .select('*')
      .eq('token_id', id)
      .order('ts', { ascending: false })
      .limit(50),
    supabase()
      .from('intents')
      .select('*')
      .eq('token_id', id)
      .order('ts', { ascending: false })
      .limit(100),
  ]);
  return { agent, snapshots: snaps ?? [], intents: its ?? [] };
});

app.get('/api/demo-state', async () => {
  const [{ data: mgr }, { data: ch }] = await Promise.all([
    supabase().from('agents').select('*').eq('role', 'manager').limit(1),
    supabase().from('agents').select('*').eq('role', 'trader'),
  ]);
  return { manager: (mgr as any)?.[0] ?? null, children: ch ?? [] };
});

app.get('/api/agent/:id/lineage', async (req: any) => {
  const id = req.params.id as string;
  const { data } = await supabase()
    .from('snapshots')
    .select('ts, curr_brain_root, prev_brain_root')
    .eq('token_id', id)
    .order('ts', { ascending: true });
  return {
    lineage: ((data ?? []) as any[]).map((s) => ({
      ts: s.ts,
      root: s.curr_brain_root,
      prev: s.prev_brain_root,
    })),
  };
});

app.get('/api/agent/:id/snapshots', async (req: any) => {
  const id = req.params.id as string;
  const { data } = await supabase()
    .from('snapshots')
    .select('*')
    .eq('token_id', id)
    .order('ts', { ascending: false });
  return data ?? [];
});

app.get('/api/agent/:id/ticks', async (req: any) => {
  const id = req.params.id as string;
  const { data } = await supabase()
    .from('ticks')
    .select('*')
    .eq('token_id', id)
    .order('ts', { ascending: false })
    .limit(50);
  return data ?? [];
});

app.get('/api/agent/:id/equity', async (req: any) => {
  const id = req.params.id as string;
  const { data } = await supabase()
    .from('equity')
    .select('ts, value')
    .eq('token_id', id)
    .order('ts', { ascending: true })
    .limit(500);
  return data ?? [];
});

app.get('/api/contracts', async () => {
  return {
    chainId: deployments.chainId,
    rpc: deployments.rpc,
    iNFT2: deployments.iNFT2,
    AgentController: deployments.AgentController,
    SnapshotAttestor: deployments.SnapshotAttestor,
    BrainKeyRegistry: deployments.BrainKeyRegistry,
    ERC6551Registry: deployments.ERC6551Registry,
    ERC6551Account: deployments.ERC6551Account,
  };
});

// Buy flow: queue a re-keyed transfer for the runtime to execute.
// The buyer's uncompressed secp256k1 pubkey is stashed in `new_brain_root`
// during the pending state — the runtime overwrites it with the actual
// new brain Merkle root after reKeyAndTransfer succeeds.
app.post('/api/transfer/initiate', async (req: any) => {
  const { tokenId, buyer, buyerPubkey } = req.body as {
    tokenId: string;
    buyer: string;
    buyerPubkey: string;
  };
  if (!tokenId || !buyer || !buyerPubkey) {
    return { error: 'tokenId, buyer, buyerPubkey required' };
  }
  const cleanPubkey = buyerPubkey.replace(/^0x/, '');
  if (!/^04[0-9a-fA-F]{128}$/.test(cleanPubkey)) {
    return { error: 'buyerPubkey must be uncompressed secp256k1 (130 hex chars starting with 04)' };
  }

  let from: `0x${string}` = '0x0000000000000000000000000000000000000000';
  try {
    from = await pub.readContract({
      address: deployments.iNFT2 as `0x${string}`,
      abi: inftAbi,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    }) as `0x${string}`;
  } catch (e: any) {
    app.log.warn({ err: e?.shortMessage || e?.message, tokenId }, 'ownerOf failed; queueing with zero from');
  }

  await supabase().from('transfers').insert({
    token_id: tokenId,
    from_addr: from,
    to_addr: buyer,
    new_brain_root: cleanPubkey,
    tx_hash: 'pending',
    ts: Math.floor(Date.now() / 1000),
  });
  return { status: 'queued', tokenId, buyer, from };
});

// Boot indexer + snapshot fetcher in background; do not fail boot if they crash.
startIndexer().catch((e) => app.log.error({ err: e?.message }, 'indexer crashed'));
setInterval(
  () => processUnfetched().catch((e) => app.log.error({ err: e?.message }, 'snapshot fetch crashed')),
  30_000
);

await app.listen({ port: Number(process.env.PORT || 4000), host: '0.0.0.0' });
