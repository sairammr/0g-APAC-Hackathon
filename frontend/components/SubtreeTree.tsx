'use client';
import Link from 'next/link';
import { addrUrl, short } from '@/lib/explorer';

function WalletLink({ addr }: { addr?: string }) {
  const u = addrUrl(addr);
  if (!addr) return null;
  return u ? (
    <a href={u} target="_blank" rel="noreferrer"
       className="text-xs font-mono text-zinc-500 hover:underline ml-2">{short(addr, 6, 4)}</a>
  ) : (
    <span className="text-xs font-mono text-zinc-400 ml-2">{short(addr, 6, 4)}</span>
  );
}

export default function SubtreeTree({ manager, children }: { manager: any; children: any[] }) {
  if (!manager) return <div className="text-zinc-500 italic">No manager yet.</div>;
  return (
    <div className="border rounded p-4 bg-zinc-50">
      <div className="font-semibold">
        <Link href={`/agent/${manager.token_id}`} className="hover:underline">
          Manager #{manager.token_id}
        </Link>
        <span className="text-xs text-zinc-500 ml-2">
          {manager.strategy ?? manager.metadata?.strat ?? 'allocator'}
        </span>
        <WalletLink addr={manager.wallet ?? manager.metadata?.wallet} />
      </div>
      <div className="ml-6 mt-2 space-y-1">
        {children.map(c => (
          <div key={c.token_id} className="text-sm">
            ↳{' '}
            <Link href={`/agent/${c.token_id}`} className="text-blue-600 hover:underline">
              {c.strategy ?? c.metadata?.strat ?? 'trader'} #{c.token_id}
            </Link>
            <WalletLink addr={c.wallet ?? c.metadata?.wallet} />
          </div>
        ))}
      </div>
    </div>
  );
}
