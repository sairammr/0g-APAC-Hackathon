'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDemoState } from '@/lib/api';
import PnLChart from '@/components/PnLChart';
import SubtreeTree from '@/components/SubtreeTree';
import SnapshotTimeline from '@/components/SnapshotTimeline';
import { LoginButton } from '@/components/LoginButton';

export default function DemoPage() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try { setState(await getDemoState()); }
      catch (e) { console.error('load demo state failed', e); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!state) return <div className="p-8">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">iNFT² — agents that own agents</h1>
          <p className="text-zinc-500">Live fund-of-bots on 0G Galileo (chainId 16602).</p>
        </div>
        <LoginButton />
      </header>

      <SubtreeTree manager={state.manager} children={state.children ?? []} />

      {state.manager && (
        <>
          <section>
            <h2 className="text-xl font-semibold mb-2">Manager P&amp;L</h2>
            <PnLChart tokenId={state.manager.token_id} />
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-2">Snapshots</h2>
            <SnapshotTimeline tokenId={state.manager.token_id} />
          </section>
          <Link href={`/agent/${state.manager.token_id}/buy`}
                className="block w-full py-3 text-center bg-black text-white rounded hover:bg-zinc-800">
            Buy the manager (inherits the full subtree) →
          </Link>
        </>
      )}
    </div>
  );
}
