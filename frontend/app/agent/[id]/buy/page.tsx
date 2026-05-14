'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { hashMessage, recoverPublicKey } from 'viem';
import { LoginButton } from '@/components/LoginButton';

export default function BuyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const address = user?.wallet?.address;
  const [pubkey, setPubkey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function derivePubkey() {
    const wallet = wallets[0];
    if (!wallet) {
      setStatus('no embedded wallet');
      return;
    }
    setBusy(true);
    setStatus('signing message to derive pubkey…');
    try {
      const message = `Register secp256k1 pubkey for iNFT² purchase of token ${id} at ${Date.now()}`;
      const provider = await wallet.getEthereumProvider();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, wallet.address],
      }) as `0x${string}`;
      const hash = hashMessage(message);
      const recovered = await recoverPublicKey({ hash, signature });
      setPubkey(recovered);
      setStatus('pubkey derived');
    } catch (e: any) {
      setStatus(`derive failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!address || !pubkey) return;
    setBusy(true);
    setStatus('queueing transfer…');
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
        You will receive: the NFT, the contents of its 6551 wallet, all child traders,
        and the full brain lineage. The brain blob is re-encrypted to your key so the
        previous owner can no longer decrypt it.
      </p>
      {!authenticated && (
        <p className="text-sm text-zinc-500">Connect a wallet to continue.</p>
      )}
      {authenticated && (
        <div className="space-y-2">
          <button
            onClick={derivePubkey}
            disabled={busy}
            className="px-4 py-2 border rounded text-sm disabled:opacity-50"
          >
            {pubkey ? 'Re-derive pubkey' : 'Derive my secp256k1 pubkey (sign message)'}
          </button>
          {pubkey && (
            <div className="text-xs font-mono break-all text-zinc-600 bg-zinc-50 p-2 rounded">
              {pubkey}
            </div>
          )}
        </div>
      )}
      <button
        onClick={buy}
        disabled={busy || !pubkey || !authenticated}
        className="px-6 py-3 bg-black text-white rounded disabled:bg-zinc-300"
      >
        {busy ? 'Working…' : 'Buy'}
      </button>
      {status && (
        <div className="text-sm text-zinc-700">Status: <span className="font-mono">{status}</span></div>
      )}
    </div>
  );
}
