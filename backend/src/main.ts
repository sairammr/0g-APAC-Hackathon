import Fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn } from 'node:child_process';
import { startIndexer } from './indexer/chain.js';
import { processUnfetched } from './indexer/snapshots.js';
import { supabase } from './db/supabase.js';
import { getProviderInfo, chatSignatureUrl, raReportUrl } from './attestation.js';
import { createPublicClient, http, defineChain, parseAbi } from 'viem';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const RUNTIME_DIR = fileURLToPath(new URL('../../runtime', import.meta.url));

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

app.get('/api/attestation/:tickId', async (req: any, reply: any) => {
  const tickId = req.params.tickId as string;
  const { data: tick, error } = (await supabase()
    .from('ticks')
    .select('*')
    .eq('id', tickId)
    .maybeSingle()) as { data: any; error: any };
  if (error) return reply.code(500).send({ error: error.message });
  if (!tick) return reply.code(404).send({ error: 'tick not found' });
  if (!tick.chat_id) {
    return reply.code(409).send({
      error: 'tick has no chat_id — predates TEE attestation rollout',
      tick: { id: tick.id, ts: tick.ts, tee_verified: tick.tee_verified },
    });
  }

  const info = await getProviderInfo();
  return {
    tick: {
      id: tick.id,
      tokenId: tick.token_id,
      ts: tick.ts,
      action: tick.action,
      sizeBps: tick.size_bps,
      teeVerified: tick.tee_verified,
      chatId: tick.chat_id,
      txHash: tick.tx_hash,
    },
    provider: {
      address: info.provider,
      url: info.url,
      model: info.model,
      verifiability: info.verifiability,
      teeSignerAddress: info.teeSignerAddress,
      teeSignerAcknowledged: info.teeSignerAcknowledged,
    },
    inferenceContract: '0xa79F4c8311FF93C06b8CfB403690cc987c93F91E',
    ledgerContract: '0xE70830508dAc0A97e6c087c75f402f9Be669E406',
    explorer: 'https://chainscan-galileo.0g.ai',
    chatSignatureUrl: chatSignatureUrl(info.url, tick.chat_id),
    raReportUrl: raReportUrl(info.url),
  };
});

// Create a fresh manager+3-children tree for a buyer. The actual mint logic
// lives in runtime/scripts/createTree.ts because it has the operator
// PRIVATE_KEY and the chain client already wired. We invoke it as a child
// process and capture the trailing `RESULT=<json>` line.
app.post('/api/create-tree', async (req: any, reply: any) => {
  const { owner, pubkey } = req.body as { owner?: string; pubkey?: string };
  if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    return reply.code(400).send({ error: 'owner must be 0x-prefixed 20-byte address' });
  }
  const cleanPub = (pubkey || '').replace(/^0x/, '');
  if (!/^04[0-9a-fA-F]{128}$/.test(cleanPub)) {
    return reply.code(400).send({ error: 'pubkey must be uncompressed secp256k1 (130 hex starting with 04)' });
  }

  const result = await new Promise<{ ok: true; data: any } | { ok: false; err: string }>((resolve) => {
    const child = spawn(
      'pnpm',
      ['tsx', 'scripts/createTree.ts', '--owner', owner, '--pubkey', '0x' + cleanPub],
      { cwd: RUNTIME_DIR, env: { ...process.env } },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => { stdout += b.toString(); });
    child.stderr.on('data', (b) => { stderr += b.toString(); app.log.info({ tag: 'createTree' }, b.toString().trim()); });
    const killer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, err: 'createTree timed out after 180s' });
    }, 180_000);
    child.on('close', (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        resolve({ ok: false, err: stderr.trim().split('\n').slice(-5).join(' | ') || `exit ${code}` });
        return;
      }
      const line = stdout.split('\n').reverse().find((l) => l.startsWith('RESULT='));
      if (!line) {
        resolve({ ok: false, err: 'createTree produced no RESULT= line' });
        return;
      }
      try {
        const parsed = JSON.parse(line.slice('RESULT='.length));
        resolve({ ok: true, data: parsed });
      } catch (e: any) {
        resolve({ ok: false, err: 'failed to parse RESULT: ' + (e?.message ?? 'unknown') });
      }
    });
  });

  if (!result.ok) return reply.code(500).send({ error: result.err });
  return result.data;
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
