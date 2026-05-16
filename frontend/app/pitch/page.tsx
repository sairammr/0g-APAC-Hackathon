'use client';
import { CSSProperties, ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemoState, getContracts } from '@/lib/api';
import { mapManager, mapWorker, aggregate, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Corner, Button, KV } from '@/components/design/primitives';
import { addrUrl, short } from '@/lib/explorer';
import {
  ArchitectureDiagram,
  RecursionDiagram,
  IntentFlowDiagram,
  SnapshotLineageDiagram,
  ReKeyDiagram,
  TrustModelDiagram,
} from '@/components/design/Diagrams';

type SlideMeta = { range: string; title: string };

const SLIDES: SlideMeta[] = [
  { range: '0:00 – 0:15', title: 'Hook' },
  { range: '0:15 – 0:45', title: 'Problem' },
  { range: '0:45 – 1:15', title: 'Solution' },
  { range: '1:15 – 1:45', title: 'Architecture' },
  { range: '1:45 – 2:05', title: 'Recursion' },
  { range: '2:05 – 2:25', title: 'Intent flow' },
  { range: '2:25 – 2:35', title: 'Audit lineage' },
  { range: '2:35 – 2:45', title: 'Atomic re-key' },
  { range: '2:45 – 2:50', title: 'Trust model' },
  { range: '—',           title: 'Business model' },
  { range: '2:50 – 3:00', title: 'Ask' },
];

const SLIDE_COUNT = SLIDES.length;

export default function PitchPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
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
    return () => { cancelled = true; };
  }, []);

  const go = useCallback((next: number) => {
    setIdx(() => Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
  }, []);
  const next = useCallback(() => go(idx + 1), [go, idx]);
  const prev = useCallback(() => go(idx - 1), [go, idx]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          go(0);
          break;
        case 'End':
          e.preventDefault();
          go(SLIDE_COUNT - 1);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go]);

  const agg = aggregate(manager, workers);
  const chainId = contracts?.chainId ?? 16602;
  const meta = SLIDES[idx];

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 60px)',
      }}
    >
      <div
        key={idx}
        className="deck-stage"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          borderTop: '1px solid var(--rule)',
          animation: 'deckFade 280ms ease',
        }}
      >
        {idx === 0 && <SlideHook chainId={chainId} />}
        {idx === 1 && <SlideProblem />}
        {idx === 2 && <SlideSolution />}
        {idx === 3 && <SlideArchitecture chainId={chainId} />}
        {idx === 4 && <SlideRecursion />}
        {idx === 5 && <SlideIntentFlow />}
        {idx === 6 && <SlideAuditLineage />}
        {idx === 7 && <SlideAtomicReKey />}
        {idx === 8 && <SlideTrustModel />}
        {idx === 9 && <SlideBusiness />}
        {idx === 10 && (
          <SlideAsk
            chainId={chainId}
            contracts={contracts}
            agg={agg}
            onGoDemo={() => router.push('/demo')}
            onGoAudit={() => router.push('/audit')}
          />
        )}
      </div>

      {/* controls */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--rule)',
          padding: '12px 24px',
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) auto minmax(220px, 1fr)',
          alignItems: 'center',
          gap: 24,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {String(idx + 1).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}
          </span>
          <span style={{ fontWeight: 500 }}>{meta.title}</span>
          <span className="mono small" style={{ color: 'var(--ink-3)' }}>{meta.range}</span>
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              title={`${i + 1}. ${s.title}`}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              style={{
                width: i === idx ? 28 : 10,
                height: 10,
                borderRadius: 0,
                border: '1px solid var(--rule)',
                background: i === idx ? 'var(--ink)' : 'transparent',
                cursor: 'pointer',
                transition: 'width 180ms ease, background 180ms ease',
                padding: 0,
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={prev}
            disabled={idx === 0}
            style={{ opacity: idx === 0 ? 0.4 : 1, padding: '10px 18px' }}
          >
            <span className="arrow" style={{ transform: 'rotate(180deg)' }}>→</span>
            <span>Prev</span>
          </button>
          <button
            className="btn solid"
            onClick={next}
            disabled={idx === SLIDE_COUNT - 1}
            style={{ opacity: idx === SLIDE_COUNT - 1 ? 0.4 : 1, padding: '10px 18px' }}
          >
            <span>Next</span>
            <span className="arrow">→</span>
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          top: 80,
          right: 24,
          padding: '6px 10px',
          background: 'var(--bg-2)',
          border: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          letterSpacing: '0.04em',
          zIndex: 15,
          pointerEvents: 'none',
        }}
      >
        ← →   ·   space   ·   home / end
      </div>

      <style jsx global>{`
        @keyframes deckFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────── slides ─────────────────────────────── */

const stageStyle: CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: 0,
};

function SlideShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...stageStyle, ...style }}>{children}</div>;
}

/* ── 1 · Hook ───────────────────────────────────────────────────────── */
function SlideHook({ chainId }: { chainId: number }) {
  return (
    <SlideShell>
      <div style={{ gridColumn: 'span 7', padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Eyebrow dot>0:00 – 0:15 · Hook</Eyebrow>
        <h1
          className="editorial cursive"
          style={{ margin: '24px 0 0', maxWidth: '14ch', fontSize: 'clamp(56px, 9vw, 140px)', lineHeight: 0.95 }}
        >
          An agent is an asset.
          <br />
          <span style={{ color: 'var(--ink-3)' }}>Not a subscription.</span>
        </h1>
        <p className="body-l" style={{ marginTop: 36, maxWidth: '52ch' }}>
          Every AI trading agent you can buy today is a SaaS login. You don&rsquo;t own the
          model, the wallet, or the decision history. You can&rsquo;t resell it. You can&rsquo;t
          stack it. <em>iNFT² is the alternative — agents you actually own, fully on 0G.</em>
        </p>
        <p className="mono small" style={{ marginTop: 36, color: 'var(--ink-3)' }}>
          0G APAC Hackathon · Track 2 · Tenori Labs · chainId {chainId} · 21/21 forge · 14/14 vitest
        </p>
      </div>
      <div
        className="tint-1"
        style={{
          gridColumn: 'span 5',
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderLeft: '1px solid var(--rule)',
        }}
      >
        <div>
          <Corner>iNFT² · 3 MIN PITCH</Corner>
          <Eyebrow style={{ color: 'rgba(11,12,10,.7)' }}>Tenori Labs</Eyebrow>
        </div>
        <div>
          <p className="display-l cursive" style={{ margin: '0 0 12px', fontSize: 80 }}>iNFT²</p>
          <p className="mono small" style={{ color: 'rgba(11,12,10,.7)' }}>
            ERC-7857 × ERC-6551 × 0G Compute · TEE-attested fund of agents
          </p>
        </div>
      </div>
    </SlideShell>
  );
}

/* ── 2 · Problem ────────────────────────────────────────────────────── */
function SlideProblem() {
  const cards: Array<[string, string, string]> = [
    ['01', 'Unverifiable inference', "No way to prove the trade decision was actually made in a TEE."],
    ['02', 'Untransferable brain', "The model weights and memory leak with the seller's key on every sale."],
    ['03', 'Uncomposable', "An agent can't own another agent. Funds of agents don't exist on-chain."],
    ['04', 'Unauditable', "Decisions live in a private DB. There's no replay-from-genesis."],
  ];
  return (
    <SlideShell>
      <div style={{ gridColumn: 'span 7', padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Eyebrow>0:15 – 0:45 · Problem</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '20px 0 24px', maxWidth: '18ch', fontSize: 'clamp(40px, 5.6vw, 88px)', lineHeight: 1 }}>
          You cannot own a trader you cannot verify, audit, transfer, or compose.
        </h2>
        <p className="body" style={{ maxWidth: '54ch' }}>
          Owning an AI trading agent today means trusting an opaque pile of code on someone
          else&rsquo;s server. The four things that make something an asset — provenance,
          transferability, composability, and lineage — are all missing.
        </p>
      </div>
      <div style={{ gridColumn: 'span 5', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column' }}>
        {cards.map(([n, t, d], i) => (
          <div
            key={n}
            style={{
              flex: 1,
              padding: '22px 28px',
              borderBottom: i === cards.length - 1 ? 0 : '1px solid var(--rule)',
            }}
          >
            <p className="mono" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 11 }}>{n}</p>
            <p className="display-s" style={{ margin: '6px 0 8px', fontSize: 22 }}>{t}</p>
            <p className="small" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

/* ── 3 · Solution ───────────────────────────────────────────────────── */
function SlideSolution() {
  const pillars: Array<[string, string, string]> = [
    ['01', 'ERC-7857 brain', 'Encrypted to the owner. Re-keyed on every sale. Lineage chained.'],
    ['02', 'ERC-6551 wallet', 'A token-bound account per iNFT. Holds USDC, RISK — and other iNFTs.'],
    ['03', 'EIP-712 intent', 'Owner signs. Operator relays. Contract enforces policy.'],
    ['04', '0G Compute TEE', 'Every decide() runs in an attested enclave. We store the proof, not faith.'],
    ['05', '0G Storage + DA', 'Brain blobs and 6h snapshots are content-addressed and DA-anchored.'],
    ['06', 'transferWithReKey', 'Brain re-encrypted to buyer inside TEE before the deed flips. Atomic.'],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 56px 18px' }}>
        <Eyebrow dot>0:45 – 1:15 · Solution</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '22ch', fontSize: 'clamp(40px, 5.6vw, 84px)', lineHeight: 1 }}>
          Six primitives. One asset. <span style={{ color: 'var(--ink-3)' }}>Composable by design.</span>
        </h2>
        <p className="body" style={{ maxWidth: '56ch' }}>
          We don&rsquo;t invent a token. We compose six existing standards into a primitive that
          finally feels like ownership.
        </p>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--rule)' }}>
        {pillars.map(([n, t, d], i) => (
          <div
            key={n}
            style={{
              padding: '32px 32px',
              borderRight: (i + 1) % 3 === 0 ? 0 : '1px solid var(--rule)',
              borderBottom: i < 3 ? '1px solid var(--rule)' : 0,
            }}
          >
            <p className="mono" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 11 }}>{n}</p>
            <p className="display-s" style={{ margin: '10px 0 12px', fontSize: 26 }}>{t}</p>
            <p className="body" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 4 · Architecture diagram ───────────────────────────────────────── */
function SlideArchitecture({ chainId }: { chainId: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 8px' }}>
        <Eyebrow dot>1:15 – 1:45 · Architecture</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '24ch', fontSize: 'clamp(36px, 4.8vw, 64px)', lineHeight: 1 }}>
          One screen, four layers, no boxes outside 0G.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderTop: '1px solid var(--rule)' }}>
        <div style={{ gridColumn: 'span 8', padding: '32px 40px', display: 'flex', alignItems: 'center', borderRight: '1px solid var(--rule)' }}>
          <ArchitectureDiagram chainId={chainId} style={{ width: '100%' }} />
        </div>
        <div style={{ gridColumn: 'span 4', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          <Eyebrow>Read this diagram</Eyebrow>
          <p className="body" style={{ margin: 0 }}>
            Top: the user touches the frontend. Middle: backend indexes chain + storage so reads
            are sub-200ms. Bottom: a single runtime loop is the only writer — it decides, signs,
            executes, and anchors. Every box runs on 0G.
          </p>
          <KV
            pairs={[
              ['Chain', `0G · ${chainId}`],
              ['Inference', 'GLM-5-FP8 · TEE'],
              ['Cadence', '60s tick · 6h snap'],
              ['Latency', '<5s decide → on-chain'],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ── 5 · Recursion ──────────────────────────────────────────────────── */
function SlideRecursion() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 8px' }}>
        <Eyebrow dot>1:45 – 2:05 · Recursion</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '22ch', fontSize: 'clamp(36px, 4.8vw, 64px)', lineHeight: 1 }}>
          An agent that owns agents. Sell the manager, sell the fund.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderTop: '1px solid var(--rule)' }}>
        <div style={{ gridColumn: 'span 4', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, borderRight: '1px solid var(--rule)' }}>
          <p className="body">
            A token-bound account holds tokens. Tokens are iNFTs. So an iNFT&rsquo;s TBA can hold
            other iNFTs. The recursion lives in ERC-6551 — we didn&rsquo;t invent it, we put it
            on-thesis.
          </p>
          <KV
            pairs={[
              ['Today', '1 manager + 3 children'],
              ['Depth', '≤ 3 hops (gas-bound)'],
              ['Rebalance', 'every 6h, on-snapshot'],
              ['Sale', 'one tx · subtree atomic'],
            ]}
          />
        </div>
        <div style={{ gridColumn: 'span 8', padding: 32, display: 'flex', alignItems: 'center' }}>
          <RecursionDiagram style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

/* ── 6 · Intent flow ────────────────────────────────────────────────── */
function SlideIntentFlow() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 8px' }}>
        <Eyebrow dot>2:05 – 2:25 · Intent flow</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '22ch', fontSize: 'clamp(36px, 4.8vw, 64px)', lineHeight: 1 }}>
          Owner signs. Operator relays. Contract enforces.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderTop: '1px solid var(--rule)' }}>
        <div style={{ gridColumn: 'span 12', padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IntentFlowDiagram style={{ width: '100%', maxWidth: 1080 }} />
        </div>
        <div style={{ gridColumn: 'span 12', padding: '28px 56px 40px', borderTop: '1px solid var(--rule)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            <div>
              <Eyebrow>What the operator can</Eyebrow>
              <p className="body" style={{ marginTop: 8 }}>
                Broadcast pre-signed intents that hit a policy allowlist. Nothing else.
              </p>
            </div>
            <div>
              <Eyebrow>What the operator cannot</Eyebrow>
              <p className="body" style={{ marginTop: 8 }}>
                Move funds from the TBA. Read the brain. Sign on the owner&rsquo;s behalf.
              </p>
            </div>
            <div>
              <Eyebrow>What the contract enforces</Eyebrow>
              <p className="body" style={{ marginTop: 8 }}>
                Nonce, expiry, target allowlist, per-tx cap, daily cap. On chain. No off-chain trust.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 7 · Audit lineage ──────────────────────────────────────────────── */
function SlideAuditLineage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 8px' }}>
        <Eyebrow dot>2:25 – 2:35 · Audit lineage</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '22ch', fontSize: 'clamp(36px, 4.8vw, 64px)', lineHeight: 1 }}>
          Replay any agent, from genesis, in public.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderTop: '1px solid var(--rule)' }}>
        <div style={{ gridColumn: 'span 8', padding: 32, display: 'flex', alignItems: 'center', borderRight: '1px solid var(--rule)' }}>
          <SnapshotLineageDiagram style={{ width: '100%' }} />
        </div>
        <div style={{ gridColumn: 'span 4', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          <p className="body">
            Every six hours we publish a snapshot: previous brain root, current brain root,
            realized PnL, storage root for the blob, the DA epoch that anchored it. The chain
            is the index. The blob is the body. Anyone can prove the brain that traded yesterday
            is the brain that signed today.
          </p>
          <KV
            pairs={[
              ['Cadence', '6h'],
              ['On-chain', 'SnapshotAttestor'],
              ['Storage', '0G Storage'],
              ['Anchor', '0G DA epoch'],
              ['Replay', 'public · deterministic'],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ── 8 · Atomic re-key ──────────────────────────────────────────────── */
function SlideAtomicReKey() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="ink" style={{ padding: '40px 56px 8px', color: 'var(--bg)' }}>
        <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>2:35 – 2:45 · The wow moment</Eyebrow>
        <h2
          className="display-m cursive"
          style={{ margin: '14px 0 8px', maxWidth: '22ch', color: 'var(--bg)', fontSize: 'clamp(40px, 5.4vw, 84px)' }}
        >
          The brain re-keys <span style={{ color: 'var(--c-1)' }}>before</span> the deed flips.
        </h2>
        <p className="body" style={{ color: 'rgba(236,238,233,.75)', maxWidth: '60ch' }}>
          The seller&rsquo;s key is dead the instant the buyer&rsquo;s wallet receives the iNFT.
          Ownership + key + brain — all flip together, atomically, on chain.
        </p>
      </div>
      <div className="ink" style={{ flex: 1, padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
        <ReKeyDiagram style={{ width: '100%', maxWidth: 1080 }} />
      </div>
    </div>
  );
}

/* ── 9 · Trust model ────────────────────────────────────────────────── */
function SlideTrustModel() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 8px' }}>
        <Eyebrow dot>2:45 – 2:50 · Trust</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 8px', maxWidth: '22ch', fontSize: 'clamp(36px, 4.8vw, 64px)', lineHeight: 1 }}>
          Least privilege, enforced by the contract.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderTop: '1px solid var(--rule)' }}>
        <div style={{ gridColumn: 'span 12', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrustModelDiagram style={{ width: '100%', maxWidth: 1080 }} />
        </div>
      </div>
    </div>
  );
}

/* ── 10 · Business model ────────────────────────────────────────────── */
function SlideBusiness() {
  const streams: Array<[string, string, string]> = [
    ['REV · 01', 'Mint primary', 'Initial issuance of each iNFT — model archetype + seed weights. One-time.'],
    ['REV · 02', 'Re-key royalty', 'Every transferWithReKey pays a basis-point royalty to the original minter. Recurring on every sale.'],
    ['REV · 03', 'Manager carry', 'A fund-of-agents manager iNFT takes a performance fee on aggregated child PnL at each snapshot.'],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '40px 56px 16px' }}>
        <Eyebrow dot>Business model</Eyebrow>
        <h2 className="editorial cursive" style={{ margin: '14px 0 0', maxWidth: '20ch', fontSize: 'clamp(40px, 5.4vw, 80px)', lineHeight: 1 }}>
          Three lines, all on-chain.
        </h2>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--rule)' }}>
        {streams.map(([n, title, desc], i) => (
          <div
            key={n}
            style={{
              padding: '40px 32px',
              borderRight: i === streams.length - 1 ? 0 : '1px solid var(--rule)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
            }}
          >
            <p className="mono" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 11 }}>{n}</p>
            <p className="display-s" style={{ margin: '12px 0 14px', fontSize: 32 }}>{title}</p>
            <p className="body" style={{ margin: 0, maxWidth: '32ch' }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 11 · Ask ───────────────────────────────────────────────────────── */
function SlideAsk({
  chainId,
  contracts,
  agg,
  onGoDemo,
  onGoAudit,
}: {
  chainId: number;
  contracts: any | null;
  agg: ReturnType<typeof aggregate>;
  onGoDemo: () => void;
  onGoAudit: () => void;
}) {
  const asks: Array<[string, string]> = [
    ['Mainnet allocation', 'Six contracts redeployed on 0G mainnet (chainId 16661) with operator funding for 48-h soak.'],
    ['Composing managers', 'Three early manager iNFTs from real strategy teams. We provide the wrapping; they bring the alpha.'],
    ['Storage SDK fix', 'A green path for 0G Storage uploader on Galileo — replace our content-addressed stub with the SDK.'],
  ];
  return (
    <SlideShell>
      <div className="ink" style={{ gridColumn: 'span 7', padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>2:50 – 3:00 · The ask</Eyebrow>
        <h2
          className="display-m cursive"
          style={{ margin: '14px 0 28px', color: 'var(--bg)', maxWidth: '18ch', fontSize: 'clamp(44px, 5.6vw, 88px)', lineHeight: 1 }}
        >
          Three things we need <span style={{ color: 'var(--c-1)' }}>to ship next.</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {asks.map(([title, desc], i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr',
                gap: 16,
                paddingTop: 14,
                borderTop: '1px solid rgba(236,238,233,.18)',
              }}
            >
              <span className="mono" style={{ fontSize: 12, color: 'rgba(236,238,233,.55)', paddingTop: 2 }}>0{i + 1}</span>
              <div>
                <p style={{ margin: 0, color: 'var(--bg)', fontWeight: 500, fontSize: 18 }}>{title}</p>
                <p style={{ margin: '4px 0 0', color: 'rgba(236,238,233,.72)', fontSize: 14, lineHeight: 1.55 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ gridColumn: 'span 5', padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid var(--rule)' }}>
        <Eyebrow dot>Submission checklist</Eyebrow>
        <div style={{ marginTop: 18 }}>
          <KV
            pairs={[
              ['Track', '0G APAC Hackathon · Track 2'],
              ['Team', 'Tenori Labs'],
              ['Chain', `0G Galileo · chainId ${chainId}`],
              ['Subtree PnL', `${agg.pnlBps >= 0 ? '+' : '−'}${(Math.abs(agg.pnlBps) / 100).toFixed(2)}%`],
              ['Forge tests', '21 / 21 green'],
              ['Vitest tests', '14 / 14 green'],
              [
                'iNFT² contract',
                contracts?.iNFT2 ? (
                  <a className="link" href={addrUrl(contracts.iNFT2) || '#'} target="_blank" rel="noreferrer">
                    {short(contracts.iNFT2, 8, 6)}
                  </a>
                ) : '—',
              ],
              [
                'AgentController',
                contracts?.AgentController ? (
                  <a className="link" href={addrUrl(contracts.AgentController) || '#'} target="_blank" rel="noreferrer">
                    {short(contracts.AgentController, 8, 6)}
                  </a>
                ) : '—',
              ],
              [
                'SnapshotAttestor',
                contracts?.SnapshotAttestor ? (
                  <a className="link" href={addrUrl(contracts.SnapshotAttestor) || '#'} target="_blank" rel="noreferrer">
                    {short(contracts.SnapshotAttestor, 8, 6)}
                  </a>
                ) : '—',
              ],
            ]}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <Button variant="solid" onClick={onGoDemo}>Run the demo</Button>
          <Button onClick={onGoAudit}>Open the audit ledger</Button>
        </div>
        <p className="mono small" style={{ marginTop: 18, color: 'var(--ink-3)' }}>
          Chips below scroll through the deck · arrow keys also work.
        </p>
      </div>
    </SlideShell>
  );
}
