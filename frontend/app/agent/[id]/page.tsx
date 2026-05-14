'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAgent } from '@/lib/api';
import PnLChart from '@/components/PnLChart';
import SnapshotTimeline from '@/components/SnapshotTimeline';
import { LoginButton } from '@/components/LoginButton';

export default function AgentPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    getAgent(id).then(setData).catch(console.error);
  }, [id]);

  if (!data) return <div className="p-8">Loading…</div>;
  const { agent, intents } = data;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agent #{id}</h1>
        <LoginButton />
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <div className="border rounded p-3">
          <div className="text-zinc-500">Owner</div>
          <div className="font-mono break-all">{agent?.owner || '—'}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-zinc-500">6551 wallet</div>
          <div className="font-mono break-all">{agent?.wallet || '—'}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-zinc-500">Role</div>
          <div>{agent?.role ?? 'unknown'}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-zinc-500">Strategy</div>
          <div>{agent?.strategy ?? '—'}</div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">P&amp;L</h2>
        <PnLChart tokenId={id} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Snapshots</h2>
        <SnapshotTimeline tokenId={id} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Recent intents</h2>
        <ul className="space-y-1 text-sm">
          {(intents ?? []).slice(0, 20).map((it: any) => (
            <li key={it.id} className="border-b border-zinc-200 py-1 flex justify-between">
              <span className="font-mono">{(it.target || '').slice(0, 10)}…</span>
              <a href={`https://chainscan-galileo.0g.ai/tx/${it.tx_hash}`}
                 className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                {(it.tx_hash || '').slice(0, 12)}…
              </a>
            </li>
          ))}
          {(!intents || intents.length === 0) && (
            <li className="text-zinc-500 italic">No intents yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
