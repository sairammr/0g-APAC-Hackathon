'use client';
import { useEffect, useState } from 'react';
import { getSnapshots } from '@/lib/api';

export default function SnapshotTimeline({ tokenId }: { tokenId: number | string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { getSnapshots(tokenId).then(setRows); }, [tokenId]);
  if (rows.length === 0) return <div className="text-zinc-500 italic">No snapshots yet.</div>;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="border-l-2 border-zinc-300 pl-3 py-1">
          <div className="text-xs text-zinc-500">{new Date(r.ts * 1000).toLocaleString()}</div>
          <div className="text-sm">
            Sharpe {((r.sharpe_e6 ?? 0) / 1e6).toFixed(2)} · PnL{' '}
            {(Number(r.realized_pnl || 0) / 1e18).toFixed(2)} dUSD
          </div>
          <a href={`https://chainscan-galileo.0g.ai/tx/${r.storage_root}`}
             className="text-xs text-blue-600 hover:underline" target="_blank" rel="noreferrer">
            root {String(r.storage_root || '').slice(0, 10)}…
          </a>
        </div>
      ))}
    </div>
  );
}
