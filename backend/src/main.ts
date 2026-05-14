import Fastify from 'fastify';
import cors from '@fastify/cors';
import { startIndexer } from './indexer/chain.js';
import { processUnfetched } from './indexer/snapshots.js';
import { supabase } from './db/supabase.js';
import 'dotenv/config';

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

// Stub for D.6 buy flow — actual reKeyAndTransfer call will be wired to the runtime later.
app.post('/api/transfer/initiate', async (req: any) => {
  const { tokenId, buyer, buyerPubkey } = req.body as {
    tokenId: string;
    buyer: string;
    buyerPubkey: string;
  };
  if (!tokenId || !buyer || !buyerPubkey) {
    return { error: 'tokenId, buyer, buyerPubkey required' };
  }
  // v1: queue in Supabase; runtime poll-handler will pick it up. For now just acknowledge.
  await supabase().from('transfers').insert({
    token_id: tokenId,
    from_addr: '0x0000000000000000000000000000000000000000',
    to_addr: buyer,
    new_brain_root: '',
    tx_hash: 'pending',
    ts: Math.floor(Date.now() / 1000),
  });
  return { status: 'queued', tokenId, buyer };
});

// Boot indexer + snapshot fetcher in background; do not fail boot if they crash.
startIndexer().catch((e) => app.log.error({ err: e?.message }, 'indexer crashed'));
setInterval(
  () => processUnfetched().catch((e) => app.log.error({ err: e?.message }, 'snapshot fetch crashed')),
  30_000
);

await app.listen({ port: Number(process.env.PORT || 4000), host: '0.0.0.0' });
