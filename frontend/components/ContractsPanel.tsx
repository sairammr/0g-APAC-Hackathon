'use client';
import { useEffect, useState } from 'react';
import { getContracts } from '@/lib/api';
import { addrUrl, short } from '@/lib/explorer';

type Contracts = {
  chainId: number;
  rpc: string;
  iNFT2: string;
  AgentController: string;
  SnapshotAttestor: string;
  BrainKeyRegistry: string;
  ERC6551Registry: string;
  ERC6551Account: string;
};

const LABELS: Array<[keyof Contracts, string]> = [
  ['iNFT2', 'iNFT² (ERC-7857)'],
  ['AgentController', 'AgentController'],
  ['SnapshotAttestor', 'SnapshotAttestor'],
  ['BrainKeyRegistry', 'BrainKeyRegistry'],
  ['ERC6551Registry', '6551 Registry'],
  ['ERC6551Account', '6551 Account impl'],
];

export default function ContractsPanel() {
  const [c, setC] = useState<Contracts | null>(null);
  useEffect(() => { getContracts().then(setC).catch(() => {}); }, []);
  if (!c) return null;

  return (
    <section className="border rounded p-4 bg-white">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-semibold">Contracts</h2>
        <span className="text-xs text-zinc-500">0G Galileo · chainId {c.chainId}</span>
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {LABELS.map(([k, label]) => {
          const v = c[k] as string;
          const u = addrUrl(v);
          return (
            <li key={k} className="flex justify-between items-baseline">
              <span className="text-zinc-500">{label}</span>
              {u ? (
                <a href={u} target="_blank" rel="noreferrer"
                   className="font-mono text-blue-600 hover:underline">{short(v, 8, 6)}</a>
              ) : (
                <span className="font-mono text-zinc-400">—</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
