'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemoState, getContracts } from '@/lib/api';
import { mapManager, mapWorker, aggregate, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Corner, Chip, Button, KV, BulletCell, Footer } from '@/components/design/primitives';
import { addrUrl, short } from '@/lib/explorer';

type Beat = {
  range: string;
  title: string;
  desc: string;
};

const BEATS: Beat[] = [
  { range: '0:00 – 0:15', title: 'Hook', desc: 'Agents are not subscriptions. They are assets.' },
  { range: '0:15 – 0:45', title: 'Problem', desc: 'You cannot verify, audit, transfer, or compose an AI trader today.' },
  { range: '0:45 – 1:15', title: 'Solution', desc: 'iNFT² — every agent (and every fund) is an NFT with an encrypted brain.' },
  { range: '1:15 – 2:30', title: 'Live demo', desc: 'A four-agent loop trading on 0G, ticking every 60 s, snapshotted every 6 h.' },
  { range: '2:30 – 2:45', title: 'Scale', desc: 'One manager today. Trees of trees tomorrow.' },
  { range: '2:45 – 3:00', title: 'Ask', desc: 'Mainnet allocation + the first three composing managers.' },
];

export default function PitchPage() {
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
        if (state?.manager) setManager(mapManager(state.manager, [], 0));
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
  const chainId = contracts?.chainId ?? 16602;

  return (
    <div className="page">
      {/* ════════════════════════════ HOOK ════════════════════════════ */}
      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-7" style={{ padding: '56px 40px 40px' }}>
          <Eyebrow dot>0:00 – 0:15 · Hook</Eyebrow>
          <h1
            className="editorial cursive"
            style={{ margin: '28px 0 0', maxWidth: '14ch', lineHeight: 0.95 }}
          >
            An agent is an asset.
            <br />
            <span style={{ color: 'var(--ink-3)' }}>Not a subscription.</span>
          </h1>
          <p className="body-l" style={{ marginTop: 28, maxWidth: '52ch' }}>
            Every AI trading agent you can buy today is a SaaS login. You don&rsquo;t own the
            model, the wallet, or the decision history. You can&rsquo;t resell it. You can&rsquo;t
            stack it. <em>iNFT² fixes that on 0G.</em>
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
            <Button variant="solid" onClick={() => router.push('/demo')}>Jump to the live demo</Button>
            <Button onClick={() => router.push('/audit')}>See the audit ledger</Button>
          </div>
          <p className="mono small" style={{ marginTop: 28, color: 'var(--ink-3)' }}>
            0G APAC Hackathon · Track 2 · Tenori Labs · chainId {chainId} · 21/21 forge · 14/14 vitest
          </p>
        </div>

        <div
          className="cell span-5 tint-1"
          style={{
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 540,
          }}
        >
          <div>
            <Corner>PITCH · 3 MIN</Corner>
            <Eyebrow style={{ color: 'rgba(11,12,10,.7)' }}>The script</Eyebrow>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {BEATS.map((b, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '88px 1fr',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: i === 0 ? '1px solid rgba(11,12,10,.25)' : '1px solid rgba(11,12,10,.15)',
                  alignItems: 'baseline',
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'rgba(11,12,10,.6)' }}>
                  {b.range}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 500 }}>{b.title}</p>
                  <p className="small" style={{ margin: '2px 0 0', color: 'rgba(11,12,10,.7)' }}>
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════ PROBLEM ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-7" style={{ padding: 40 }}>
          <Eyebrow>0:15 – 0:45 · Problem</Eyebrow>
          <h2 className="editorial cursive" style={{ margin: '20px 0 16px', maxWidth: '18ch' }}>
            You cannot own a trader you cannot verify, audit, transfer, or compose.
          </h2>
          <p className="body" style={{ maxWidth: '54ch' }}>
            Owning an AI trading agent today means trusting an opaque pile of code on someone
            else&rsquo;s server. The four things that make something an asset — provenance,
            transferability, composability, and lineage — are all missing.
          </p>
        </div>
        <div className="cell span-5" style={{ padding: 0 }}>
          <BulletCell
            n="01"
            title="Unverifiable inference"
            desc="No way to prove the trade decision was actually made in a TEE."
          />
          <BulletCell
            n="02"
            title="Untransferable brain"
            desc="The model weights and memory leak with the seller's key on every sale."
          />
          <BulletCell
            n="03"
            title="Uncomposable"
            desc="An agent can't own another agent. Funds of agents don't exist on-chain."
          />
          <BulletCell
            n="04"
            title="Unauditable"
            desc="Decisions live in a private DB. There's no replay-from-genesis."
            last
          />
        </div>
      </div>

      {/* ════════════════════════════ SOLUTION ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-5" style={{ padding: 40 }}>
          <Eyebrow dot>0:45 – 1:15 · Solution</Eyebrow>
          <h2 className="editorial cursive" style={{ margin: '20px 0 16px', maxWidth: '14ch' }}>
            Every agent is an iNFT. Every fund is an iNFT that owns iNFTs.
          </h2>
          <p className="body" style={{ maxWidth: '44ch' }}>
            ERC-7857 iNFT + ERC-6551 token-bound account + EIP-712 intents + 0G Compute
            TEE-attested inference + 0G Storage encrypted brain blobs. The recursion comes for
            free: a TBA can hold tokens, including other iNFTs.
          </p>
          <div style={{ marginTop: 24 }}>
            <KV
              pairs={[
                ['Brain', 'secp256k1 ECDH + AES-256-GCM'],
                ['Storage', '0G Storage Merkle root'],
                ['Inference', '0G Compute · TEE attested'],
                ['Wallet', 'ERC-6551 (deterministic)'],
                ['Intent', 'EIP-712, nonce-protected'],
                ['Sale', 'transferWithReKey · atomic re-encrypt'],
              ]}
            />
          </div>
        </div>
        <div className="cell span-7" style={{ padding: 32 }}>
          <Eyebrow>Architecture · one screen</Eyebrow>
          <pre
            className="mono"
            style={{
              margin: '16px 0 0',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
          >{`┌──── Frontend (Next.js 14 · Privy · viem) ────┐
│   /demo   /agent/[id]   /agent/[id]/buy      │
└──────────────────┬───────────────────────────┘
                   │ REST
┌──────────────────▼───────────────────────────┐
│   Backend (Fastify) + Supabase               │
│   indexer  ·  snapshot fetcher               │
└──────┬─────────────────────┬─────────────────┘
       │ writes/reads        │ event watch + storage GET
┌──────▼──────┐       ┌──────▼──────────────────┐
│  Supabase   │       │  0G Chain + 0G Storage  │
│  ledger     │       │  chainId ${chainId}            │
└─────────────┘       └──────┬──────────────────┘
                             │
┌────────────────────────────┼─────────────────┐
│      Runtime loop  (runtime/src/main.ts)     │
│  tick → decide() via 0G Compute (TEE)        │
│       → signIntent (EIP-712)                 │
│       → AgentController.execute on 0G Chain  │
│  every 6h: rebalance + publishSnapshot →     │
│            0G Storage + 0G DA epoch          │
└──────────────────────────────────────────────┘`}</pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <Chip tone="ok">21/21 forge</Chip>
            <Chip tone="ok">14/14 vitest</Chip>
            <Chip tone="tint-1">ERC-7857</Chip>
            <Chip tone="tint-2">ERC-6551</Chip>
            <Chip tone="tint-3">EIP-712</Chip>
          </div>
        </div>
      </div>

      {/* ════════════════════════════ DEMO ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-12 ink" style={{ padding: 40 }}>
          <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>1:15 – 2:30 · Live demo · 75 s</Eyebrow>
          <h2 className="display-m cursive" style={{ margin: '16px 0 28px', color: 'var(--bg)', maxWidth: '20ch' }}>
            Show <span style={{ color: 'var(--c-1)' }}>one flow</span> beautifully.
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 0,
              borderTop: '1px solid rgba(236,238,233,.22)',
            }}
          >
            {[
              ['01', 'Open /demo', 'Hero shows live PnL for the four-agent subtree. Recursion diagram on the right.'],
              ['02', 'Watch a tick', 'Manager → child intent. Row appears with TEE attestation chip + chainscan tx link.'],
              ['03', 'Inspect an agent', 'Click Pulse. Decisions table, equity curve, full snapshot lineage in sidebar.'],
              ['04', 'Open a snapshot', 'prev → curr brain root, storage root, DA epoch, 4/4 verifiability checks PASS.'],
              ['05', 'Walk the buy flow', 'Buyer pubkey from Privy, re-key in TEE, atomic transferWithReKey. Seller key is dead.'],
            ].map(([n, title, desc]) => (
              <div
                key={n}
                style={{
                  padding: '28px 22px',
                  borderRight: '1px solid rgba(236,238,233,.18)',
                }}
              >
                <p
                  className="mono"
                  style={{ fontSize: 11, color: 'rgba(236,238,233,.55)', letterSpacing: '0.06em' }}
                >
                  {n}
                </p>
                <p
                  className="display-s"
                  style={{ margin: '10px 0 10px', color: 'var(--bg)', letterSpacing: '-0.02em', fontSize: 20 }}
                >
                  {title}
                </p>
                <p style={{ color: 'rgba(236,238,233,.7)', fontSize: 12.5, lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 28,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              className="btn solid"
              style={{ background: 'var(--c-1)', color: '#0B0C0A', borderColor: 'var(--c-1)' }}
              onClick={() => router.push('/demo')}
            >
              <span>Open /demo</span>
              <span className="arrow">→</span>
            </button>
            <button
              className="btn"
              style={{ background: 'transparent', color: 'var(--bg)', borderColor: 'rgba(236,238,233,.4)' }}
              onClick={() => manager && router.push(`/agent/${manager.tokenId}`)}
            >
              <span>Inspect Helios</span>
              <span className="arrow">→</span>
            </button>
            {workers[0] ? (
              <button
                className="btn"
                style={{ background: 'transparent', color: 'var(--bg)', borderColor: 'rgba(236,238,233,.4)' }}
                onClick={() => router.push(`/agent/${workers[0].tokenId}/buy`)}
              >
                <span>Walk the buy flow</span>
                <span className="arrow">→</span>
              </button>
            ) : null}
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(236,238,233,.55)' }}>
              ★ wow moment · step 05 atomic re-key
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════ DEMO LIVE NUMBERS ════════════════════ */}
      <div className="bento">
        <div className="cell span-3" style={{ padding: 28 }}>
          <Eyebrow>Live · subtree PnL</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 56 }}>
            {agg.pnlBps >= 0 ? '+' : '−'}
            {(Math.abs(agg.pnlBps) / 100).toFixed(2)}
            <span style={{ fontSize: '0.45em', color: 'var(--ink-3)' }}>%</span>
          </p>
          <p className="mono small" style={{ marginTop: 6 }}>4 agents · 1 manager + 3 workers</p>
        </div>
        <div className="cell span-3" style={{ padding: 28 }}>
          <Eyebrow>Tick cadence</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 56 }}>60<span style={{ fontSize: '0.45em', color: 'var(--ink-3)' }}>s</span></p>
          <p className="mono small" style={{ marginTop: 6 }}>decide → sign → on-chain · &lt; 5 s end-to-end</p>
        </div>
        <div className="cell span-3" style={{ padding: 28 }}>
          <Eyebrow>Snapshot cadence</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 56 }}>6<span style={{ fontSize: '0.45em', color: 'var(--ink-3)' }}>h</span></p>
          <p className="mono small" style={{ marginTop: 6 }}>storage root + DA epoch on-chain</p>
        </div>
        <div className="cell span-3" style={{ padding: 28 }}>
          <Eyebrow>TEE share</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 56 }}>&gt;99<span style={{ fontSize: '0.45em', color: 'var(--ink-3)' }}>%</span></p>
          <p className="mono small" style={{ marginTop: 6 }}>target: every inference attested</p>
        </div>
      </div>

      {/* ════════════════════════════ SCALE ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-7" style={{ padding: 40 }}>
          <Eyebrow>2:30 – 2:45 · Scale</Eyebrow>
          <h2 className="editorial cursive" style={{ margin: '20px 0 16px', maxWidth: '18ch' }}>
            One manager today. Trees of trees tomorrow.
          </h2>
          <p className="body" style={{ maxWidth: '54ch' }}>
            v1 ships with depth-1 recursion: one manager iNFT owning three worker iNFTs. The same
            primitives — TBA holds iNFTs, parent signs intents — extend to depth 3+ without a
            contract change. A fund of funds is just a manager whose children are managers.
          </p>
          <div style={{ marginTop: 24 }}>
            <KV
              pairs={[
                ['Today', '1 manager + 3 workers · depth 1'],
                ['v1 target', '≤ 3 hops, audited'],
                ['Architecture limit', 'Bound by gas only · ~$0.01 / tick'],
                ['Cross-chain', 'Out of scope — all on 0G'],
              ]}
            />
          </div>
        </div>
        <div
          className="cell span-5 tint-2"
          style={{
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 360,
          }}
        >
          <div>
            <Corner>SCALE</Corner>
            <Eyebrow style={{ color: 'rgba(11,12,10,.7)' }}>Why the architecture supports it</Eyebrow>
          </div>
          <div>
            <p className="display-l cursive" style={{ margin: '0 0 12px', fontSize: 52 }}>recursion is free</p>
            <p className="mono small" style={{ color: 'rgba(11,12,10,.7)' }}>
              A token-bound account holds tokens. Tokens are iNFTs. So a TBA holds iNFTs. The
              recursion lives in ERC-6551 — we did not invent it. We just used it.
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════ BUSINESS ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-12" style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <BulletCell
              n="REV · 01"
              title="Mint primary"
              desc="Initial issuance of each iNFT — model archetype + seed weights. One-time."
            />
            <BulletCell
              n="REV · 02"
              title="Re-key royalty"
              desc="Every transferWithReKey pays a basis-point royalty to the original minter. Recurring on every sale."
            />
            <BulletCell
              n="REV · 03"
              title="Manager carry"
              desc="A fund-of-agents manager iNFT takes a performance fee on aggregated child PnL at each snapshot."
              last
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════ ASK ════════════════════════════ */}
      <div className="bento">
        <div className="cell span-7 ink" style={{ padding: 40 }}>
          <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>2:45 – 3:00 · The ask</Eyebrow>
          <h2
            className="display-m cursive"
            style={{ margin: '16px 0 16px', color: 'var(--bg)', maxWidth: '18ch' }}
          >
            Three things we need <span style={{ color: 'var(--c-1)' }}>to ship next.</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {[
              ['Mainnet allocation', 'Six contracts redeployed on 0G mainnet (chainId 16661) with operator funding for 48-h soak.'],
              ['Composing managers', 'Three early manager iNFTs from real strategy teams. We provide the wrapping; they bring the alpha.'],
              ['Storage SDK fix', 'A green path for 0G Storage uploader on Galileo — replace our content-addressed stub with the SDK.'],
            ].map(([title, desc], i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr',
                  gap: 16,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(236,238,233,.18)',
                }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'rgba(236,238,233,.55)', paddingTop: 2 }}>
                  0{i + 1}
                </span>
                <div>
                  <p style={{ margin: 0, color: 'var(--bg)', fontWeight: 500 }}>{title}</p>
                  <p style={{ margin: '4px 0 0', color: 'rgba(236,238,233,.72)', fontSize: 13, lineHeight: 1.55 }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cell span-5" style={{ padding: 40 }}>
          <Eyebrow dot>Submission checklist</Eyebrow>
          <div style={{ marginTop: 18 }}>
            <KV
              pairs={[
                ['Track', '0G APAC Hackathon · Track 2'],
                ['Team', 'Tenori Labs'],
                ['Chain', `0G Galileo · chainId ${chainId}`],
                ['Forge tests', '21 / 21 green'],
                ['Vitest tests', '14 / 14 green'],
                [
                  'iNFT² contract',
                  contracts?.iNFT2 ? (
                    <a className="link" href={addrUrl(contracts.iNFT2) || '#'} target="_blank" rel="noreferrer">
                      {short(contracts.iNFT2, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                [
                  'AgentController',
                  contracts?.AgentController ? (
                    <a className="link" href={addrUrl(contracts.AgentController) || '#'} target="_blank" rel="noreferrer">
                      {short(contracts.AgentController, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                [
                  'SnapshotAttestor',
                  contracts?.SnapshotAttestor ? (
                    <a className="link" href={addrUrl(contracts.SnapshotAttestor) || '#'} target="_blank" rel="noreferrer">
                      {short(contracts.SnapshotAttestor, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            <Button variant="solid" onClick={() => router.push('/demo')}>Run the demo</Button>
            <Button onClick={() => router.push('/audit')}>Open the audit ledger</Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
