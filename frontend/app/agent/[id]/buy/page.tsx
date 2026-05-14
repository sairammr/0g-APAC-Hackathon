'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { LoginButton } from '@/components/LoginButton';

export default function BuyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const [pubkey, setPubkey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function buy() {
    if (!address) return;
    setBusy(true);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/transfer/initiate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokenId: id, buyer: address, buyerPubkey: pubkey }),
      });
      const j = await r.json();
      setStatus(j.status || j.error || 'queued');
    } catch (e: any) {
      setStatus(e?.message ?? 'failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase iNFT² #{id}</h1>
        <LoginButton />
      </header>
      <p className="text-sm">
        You will receive: the manager NFT, the contents of its 6551 wallet, all child traders,
        and the full brain lineage.
      </p>
      {!authenticated && (
        <p className="text-sm text-zinc-500">Connect a wallet to continue.</p>
      )}
      <label className="block">
        <span className="text-sm">Your secp256k1 public key (uncompressed, hex starting with 04…)</span>
        <input
          value={pubkey}
          onChange={e => setPubkey(e.target.value)}
          className="border rounded w-full p-2 font-mono text-sm mt-1"
          placeholder="04..."
        />
      </label>
      <button
        onClick={buy}
        disabled={busy || !pubkey || !authenticated}
        className="px-6 py-3 bg-black text-white rounded disabled:bg-zinc-300"
      >
        {busy ? 'Re-encrypting…' : 'Buy'}
      </button>
      {status && (
        <div className="text-sm text-zinc-700">Status: <span className="font-mono">{status}</span></div>
      )}
    </div>
  );
}
