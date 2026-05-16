import { Indexer } from '@0glabs/0g-ts-sdk';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { supabase } from '../db/supabase.js';
import 'dotenv/config';

const indexer = new Indexer(
  process.env.STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai'
);

export async function fetchAndStoreBlob(snapshotId: number, storageRoot: string) {
  const dir = mkdtempSync(join(tmpdir(), 'zg-snap-'));
  const fp = join(dir, 'blob');
  try {
    const err = await indexer.download(storageRoot, fp, true);
    if (err) throw err;
    const buf = readFileSync(fp);
    const parsed = JSON.parse(buf.toString('utf8'));
    const { error } = await supabase()
      .from('snapshots')
      .update({
        blob_json: parsed,
        da_verified: true,
        realized_pnl: parsed.realizedPnL,
        prev_brain_root: parsed.prevBrainRoot,
        curr_brain_root: parsed.currBrainRoot,
      })
      .eq('id', snapshotId);
    if (error) throw error;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function processUnfetched() {
  const { data, error } = await supabase()
    .from('snapshots')
    .select('id, storage_root')
    .is('blob_json', null);
  if (error) {
    console.error('select unfetched failed', error);
    return;
  }
  for (const r of (data ?? []) as any[]) {
    try {
      await fetchAndStoreBlob(r.id as number, r.storage_root as string);
    } catch (e: any) {
      console.error('fetch failed', r.id, e?.message || e);
    }
  }
}
