'use client';
import { useEffect, useState } from 'react';
import { getTicks } from '@/lib/api';
import { txUrl, short, computeReceiptLabel } from '@/lib/explorer';

type Tick = {
  id: number;
  ts: number;
  action: string;
  size_bps: number | null;
  tx_hash: string | null;
  tee_verified: boolean | null;
  chat_id: string | null;
};

export default function TickFeed({ tokenId }: { tokenId: number | string }) {
  const [rows, setRows] = useState<Tick[]>([]);
  useEffect(() => {
    const load = () => getTicks(tokenId).then(setRows).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [tokenId]);

  if (rows.length === 0) {
    return <div className="text-zinc-500 italic">No ticks yet.</div>;
  }

  return (
    <div className="space-y-1 text-sm">
      {rows.map((r) => {
        const tu = txUrl(r.tx_hash);
        const chat = computeReceiptLabel(r.chat_id);
        return (
          <div key={r.id} className="border-b border-zinc-200 py-1 flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-32 shrink-0">
              {new Date(r.ts * 1000).toLocaleTimeString()}
            </span>
            <span className={`w-12 shrink-0 font-mono ${
              r.action === 'buy' ? 'text-green-600' :
              r.action === 'sell' ? 'text-red-600' : 'text-zinc-500'
            }`}>
              {r.action}
            </span>
            <span className="w-16 shrink-0 text-xs text-zinc-500">
              {r.size_bps ? `${r.size_bps} bps` : ''}
            </span>
            <span className="shrink-0" title={r.tee_verified ? 'TEE attested' : 'TEE unverified'}>
              {r.tee_verified === true ? '🔒' : r.tee_verified === false ? '⚠️' : '·'}
            </span>
            {chat && (
              <span className="font-mono text-xs text-zinc-500" title={chat}>
                receipt {short(chat, 6, 4)}
              </span>
            )}
            <span className="ml-auto">
              {tu ? (
                <a href={tu} target="_blank" rel="noreferrer"
                   className="font-mono text-xs text-blue-600 hover:underline">
                  {short(r.tx_hash)}
                </a>
              ) : (
                <span className="font-mono text-xs text-zinc-400">
                  {r.tx_hash ? short(r.tx_hash) : 'no tx'}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
