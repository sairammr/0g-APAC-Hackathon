'use client';
import Link from 'next/link';

export default function SubtreeTree({ manager, children }: { manager: any; children: any[] }) {
  if (!manager) return <div className="text-zinc-500 italic">No manager yet.</div>;
  return (
    <div className="border rounded p-4 bg-zinc-50">
      <div className="font-semibold">
        <Link href={`/agent/${manager.token_id}`} className="hover:underline">
          Manager #{manager.token_id}
        </Link>
        <span className="text-xs text-zinc-500 ml-2">{manager.strategy ?? 'allocator'}</span>
      </div>
      <div className="ml-6 mt-2 space-y-1">
        {children.map(c => (
          <div key={c.token_id} className="text-sm">
            ↳{' '}
            <Link href={`/agent/${c.token_id}`} className="text-blue-600 hover:underline">
              {c.strategy ?? 'trader'} #{c.token_id}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
