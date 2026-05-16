import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We deliberately type the client as `any` because we don't generate
// Supabase typed schemas here; without that, the default `never`-shaped
// row types reject our inserts.
let _client: any = null;
export function db(): any {
  if (!_client) {
    if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
    _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _client;
}

export async function insertEquity(tokenId: bigint, value: bigint) {
  const { error } = await db().from('equity').insert({
    token_id: tokenId.toString(),
    ts: Math.floor(Date.now() / 1000),
    value: value.toString(),
  });
  if (error) throw error;
}

export async function insertTick(row: {
  tokenId: bigint;
  action: string;
  sizeBps: number;
  txHash?: string;
  teeVerified?: boolean | null;
  chatId?: string | null;
}) {
  const { error } = await db().from('ticks').insert({
    token_id: row.tokenId.toString(),
    ts: Math.floor(Date.now() / 1000),
    action: row.action,
    size_bps: row.sizeBps,
    tx_hash: row.txHash ?? null,
    tee_verified: row.teeVerified ?? null,
    chat_id: row.chatId ?? null,
  });
  if (error) throw error;
}

export async function insertSnapshot(row: {
  tokenId: bigint;
  storageRoot: string;
  prevBrainRoot: string;
  currBrainRoot: string;
  realizedPnL: bigint;
  sharpeE6: number;
  daEpoch: bigint;
  txHash?: string | null;
}) {
  const { error } = await db().from('snapshots').upsert({
    token_id: row.tokenId.toString(),
    ts: Math.floor(Date.now() / 1000),
    storage_root: row.storageRoot,
    realized_pnl: row.realizedPnL.toString(),
    sharpe_e6: row.sharpeE6,
    da_epoch: row.daEpoch.toString(),
    da_verified: !!row.txHash,
    prev_brain_root: row.prevBrainRoot,
    curr_brain_root: row.currBrainRoot,
    submit_tx_hash: row.txHash ?? null,
  }, { onConflict: 'token_id,storage_root' });
  if (error) throw error;
}

export async function getLatestBrainRoot(tokenId: bigint): Promise<string | null> {
  const { data, error } = await db()
    .from('snapshots')
    .select('curr_brain_root')
    .eq('token_id', tokenId.toString())
    .order('ts', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0];
  return row?.curr_brain_root ?? null;
}

export async function equitySeries(tokenId: bigint): Promise<bigint[]> {
  const { data, error } = await db()
    .from('equity')
    .select('value')
    .eq('token_id', tokenId.toString())
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => BigInt(r.value as string));
}

export type PendingTransfer = {
  id: number;
  token_id: string;
  from_addr: string;
  to_addr: string;
  new_brain_root: string; // hex of buyer pubkey, abused as a queue field; see backend/main.ts
};

export async function listPendingTransfers(): Promise<PendingTransfer[]> {
  const { data, error } = await db()
    .from('transfers')
    .select('id, token_id, from_addr, to_addr, new_brain_root')
    .eq('tx_hash', 'pending');
  if (error) throw error;
  return (data ?? []) as PendingTransfer[];
}

export async function markTransferDone(id: number, txHash: string, newBrainRoot: string) {
  const { error } = await db().from('transfers').update({
    tx_hash: txHash,
    new_brain_root: newBrainRoot,
  }).eq('id', id);
  if (error) throw error;
}

export async function markTransferFailed(id: number, reason: string) {
  const { error } = await db().from('transfers').update({
    tx_hash: `error:${reason.slice(0, 200)}`,
  }).eq('id', id);
  if (error) throw error;
}
