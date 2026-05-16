'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemoState, getContracts } from '@/lib/api';
import { mapManager, mapWorker, aggregate, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Corner, Button, PnlDisplay, Stat, KV, Marquee, Footer } from '@/components/design/primitives';
import { RecursionTree } from '@/components/design/RecursionTree';
import { addrUrl, short } from '@/lib/explorer';

export default function LandingPage() {
  const router = useRouter();
  const [manager, setManager] = useState<DesignAgent | null>(null);
  const [workers, setWorkers] = useState<DesignAgent[]>([]);
  const [contracts, setContracts] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [state, c] = await Promise.all([getDemoState(), getContracts()]);
        if (cancelled) return;
        if (state?.manager) {
          setManager(mapManager(state.manager, [], 0));
        }
        if (Array.isArray(state?.children)) {
          setWorkers(state.children.map((row: any, i: number) => mapWorker(row, i, [], 0)));
        }
        setContracts(c);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agg = aggregate(manager, workers);

  return (
    <div className="page">
      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-7" style={{ padding: '56px 40px 40px' }}>
          <Eyebrow dot>iNFT² · ERC-7857 × ERC-6551 · 0G Galileo</Eyebrow>
          <h1 className="editorial cursive" style={{ margin: '28px 0 0', maxWidth: '16ch' }}>
            An agent is an asset.
            <br />
            <span style={{ color: 'var(--ink-3)' }}>Not a subscription.</span>
          </h1>
          <p className="body-l" style={{ marginTop: 28, maxWidth: '54ch' }}>
            Every trading agent — and every fund of agents — is an NFT whose hidden state (its
            &ldquo;brain&rdquo;) is encrypted to the owner&rsquo;s key, lives on 0G Storage, and
            is re-keyed atomically on sale. Inference is TEE-attested. Children are owned by
            their parents. <em>Compose, audit, transfer.</em>
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
            <Button variant="solid" onClick={() => router.push('/demo')}>Watch the live four-agent loop</Button>
            <Button onClick={() => manager && router.push(`/agent/${manager.tokenId}`)}>Inspect an agent</Button>
          </div>
          <p className="mono small" style={{ marginTop: 28, color: 'var(--ink-3)' }}>
            Testnet live · chainId {contracts?.chainId ?? 16602} · 21/21 forge tests · 14/14 vitest
          </p>
        </div>

        <div
          className="cell span-5 tint-1"
          style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 540 }}
        >
          <div>
            <Corner>FUND · LIVE</Corner>
            <Eyebrow style={{ color: 'rgba(11,12,10,.7)' }}>Combined return · subtree</Eyebrow>
          </div>
          <div>
            <PnlDisplay bps={agg.pnlBps} value={agg.pnl} size="xl" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 14,
                marginTop: 28,
                paddingTop: 24,
                borderTop: '1px solid rgba(11,12,10,.25)',
              }}
            >
              <Stat label="AUM" value={`$${agg.aum.toLocaleString()}`} />
              <Stat label="Sharpe" value={agg.sharpe.toFixed(2)} />
              <Stat label="Ticks" value={agg.ticks.toLocaleString()} />
            </div>
          </div>
        </div>
      </div>

      <Marquee
        items={[
          'TEE-attested inference via 0G Compute',
          'Brain blobs on 0G Storage',
          'ERC-7857 transferWithReKey',
          'ERC-6551 token-bound accounts',
          'EIP-712 signed intents',
          '60s tick cadence',
          '6h snapshot cadence',
          'Galileo chainId 16602',
        ]}
      />

      <div className="bento">
        <div className="cell span-4">
          <Eyebrow>01 · The brain</Eyebrow>
          <h3 className="display-s" style={{ margin: '16px 0 14px', maxWidth: '14ch' }}>
            Encrypted to the owner&rsquo;s pubkey.
          </h3>
          <p className="body">
            Model state, prompts, position memory — sealed with secp256k1 ECDH + AES-256-GCM.
            Stored on 0G Storage. Rotated on every <span className="mono">updateBrain()</span>;
            previous root is chained.
          </p>
          <div style={{ marginTop: 24 }}>
            <KV
              pairs={[
                ['Cipher', 'AES-256-GCM'],
                ['KDF', 'secp256k1 ECDH'],
                ['Storage', '0G Storage'],
                ['Lineage', 'prev → curr root'],
              ]}
            />
          </div>
        </div>
        <div className="cell span-4">
          <Eyebrow>02 · The wallet</Eyebrow>
          <h3 className="display-s" style={{ margin: '16px 0 14px', maxWidth: '14ch' }}>
            A token-bound account, deterministic.
          </h3>
          <p className="body">
            Every iNFT has an ERC-6551 wallet computed from{' '}
            <span className="mono">(salt, chainId, tc, tid)</span>. It can hold tokens —
            including other iNFTs. The recursion lives here.
          </p>
          <div style={{ marginTop: 24 }}>
            <KV
              pairs={[
                ['Standard', 'ERC-6551'],
                [
                  'Registry',
                  contracts?.ERC6551Registry ? (
                    <a className="link" href={addrUrl(contracts.ERC6551Registry) || '#'} target="_blank" rel="noreferrer">
                      {short(contracts.ERC6551Registry, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                ['Holds', 'USDC, RISK, iNFTs'],
                ['Recursion', '≤ 3 hops'],
              ]}
            />
          </div>
        </div>
        <div className="cell span-4">
          <Eyebrow>03 · The intent</Eyebrow>
          <h3 className="display-s" style={{ margin: '16px 0 14px', maxWidth: '14ch' }}>
            Signed by the owner, relayed by us.
          </h3>
          <p className="body">
            Each trade is an EIP-712 intent: nonce + expiry + cap + target allowlist. The
            operator can relay; it can never move funds out of the TBA or read the brain.
          </p>
          <div style={{ marginTop: 24 }}>
            <KV
              pairs={[
                ['Standard', 'EIP-712'],
                [
                  'Controller',
                  contracts?.AgentController ? (
                    <a className="link" href={addrUrl(contracts.AgentController) || '#'} target="_blank" rel="noreferrer">
                      {short(contracts.AgentController, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                ['Allowlist', 'DEX routers only'],
                ['Replay', 'nonce-protected'],
              ]}
            />
          </div>
        </div>
      </div>

      {manager && workers.length > 0 ? (
        <div className="bento">
          <div className="cell span-5">
            <Eyebrow dot>The recursion</Eyebrow>
            <h2 className="editorial cursive" style={{ margin: '20px 0 16px', maxWidth: '12ch' }}>
              Agents that own agents.
            </h2>
            <p className="body" style={{ maxWidth: '44ch' }}>
              {manager.name} is a manager iNFT. Its TBA holds {workers.length} worker iNFTs.
              Selling {manager.name} sells the fund. The manager signs EIP-712 intents for each
              child; children only trust their parent.
            </p>
            <div style={{ marginTop: 28 }}>
              <KV
                pairs={[
                  ['Manager', `${manager.name} · iNFT #${manager.tokenId}`],
                  ['Children', `${workers.length} workers`],
                  ['Tree depth', '1 (≤ 3 in v1)'],
                  ['Rebalance', 'every 6h, attested'],
                ]}
              />
            </div>
          </div>
          <div className="cell span-7" style={{ display: 'flex', alignItems: 'center', padding: 32 }}>
            <RecursionTree manager={manager} workers={workers} onSelect={(tid) => router.push(`/agent/${tid}`)} />
          </div>
        </div>
      ) : null}

      <div className="bento">
        <div className="cell span-12 ink" style={{ padding: 40 }}>
          <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>What happens on sale</Eyebrow>
          <h2 className="display-m cursive" style={{ margin: '16px 0 28px', color: 'var(--bg)', maxWidth: '18ch' }}>
            transferWithReKey&nbsp;&mdash;&nbsp;<span style={{ color: 'var(--c-1)' }}>atomic</span>.
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              borderTop: '1px solid rgba(236,238,233,.22)',
            }}
          >
            {[
              ['01', 'Buyer commits', 'Buyer signs a Privy-derived secp256k1 pubkey and posts it to the transfer queue.'],
              ['02', 'Operator re-keys', 'Operator downloads the blob, decrypts to memory, re-encrypts to the buyer pubkey, uploads.'],
              ['03', 'Oracle signs', 'Oracle co-signs the digest binding new storage root to the new owner.'],
              ['04', 'Ownership flips', 'iNFT2.transferWithReKey commits new root + new owner in one tx. Seller key is dead.'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ padding: '32px 28px', borderRight: '1px solid rgba(236,238,233,.18)' }}>
                <p className="mono" style={{ fontSize: 11, color: 'rgba(236,238,233,.55)', letterSpacing: '0.06em' }}>
                  {n}
                </p>
                <p className="display-s" style={{ margin: '10px 0 12px', color: 'var(--bg)', letterSpacing: '-0.02em' }}>
                  {title}
                </p>
                <p style={{ color: 'rgba(236,238,233,.7)', fontSize: 13, lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <button
              className="btn solid"
              style={{ background: 'var(--c-1)', color: '#0B0C0A', borderColor: 'var(--c-1)' }}
              onClick={() => workers[0] && router.push(`/agent/${workers[0].tokenId}/buy`)}
            >
              <span>Walk through the buy flow</span>
              <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
