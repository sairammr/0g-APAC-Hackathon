'use client';
import { useEffect, useState } from 'react';
import { getSnapshots } from '@/lib/api';
import { storageUrl, txUrl, short } from '@/lib/explorer';

export default function SnapshotTimeline({ tokenId }: { tokenId: number | string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { getSnapshots(tokenId).then(setRows); }, [tokenId]);
  if (rows.length === 0) return <div className="text-zinc-500 italic">No snapshots yet.</div>;
  return (
    <div className="space-y-2">
      {rows.map(r => {
        const blob = storageUrl(r.storage_root);
        const curr = storageUrl(r.curr_brain_root);
        const prev = storageUrl(r.prev_brain_root);
        const submitTx = txUrl(r.submit_tx_hash);
        return (
          <div key={r.id} className="border-l-2 border-zinc-300 pl-3 py-1">
            <div className="text-xs text-zinc-500">{new Date(r.ts * 1000).toLocaleString()}</div>
            <div className="text-sm">
              Sharpe {((r.sharpe_e6 ?? 0) / 1e6).toFixed(2)} · PnL{' '}
              {(Number(r.realized_pnl || 0) / 1e18).toFixed(2)} dUSD
              {r.da_epoch && (
                <span className="ml-2 text-xs text-zinc-500">DA epoch {r.da_epoch}</span>
              )}
            </div>
            <div className="text-xs flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {blob ? (
                <a href={blob} target="_blank" rel="noreferrer"
                   className="text-blue-600 hover:underline">
                  blob {short(r.storage_root)}
                </a>
              ) : (
                <span className="text-zinc-400">blob {short(r.storage_root)}</span>
              )}
              {curr && (
                <a href={curr} target="_blank" rel="noreferrer"
                   className="text-blue-600 hover:underline">
                  brain→ {short(r.curr_brain_root)}
                </a>
              )}
              {prev && (
                <a href={prev} target="_blank" rel="noreferrer"
                   className="text-zinc-500 hover:underline">
                  prev← {short(r.prev_brain_root)}
                </a>
              )}
              {submitTx && (
                <a href={submitTx} target="_blank" rel="noreferrer"
                   className="text-blue-600 hover:underline">
                  attest tx {short(r.submit_tx_hash)}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
