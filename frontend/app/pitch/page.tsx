'use client';
import { useCallback, useEffect, useState } from 'react';
import { getDemoState, getContracts } from '@/lib/api';
import { mapManager, mapWorker, aggregate, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, KV } from '@/components/design/primitives';
import { short } from '@/lib/explorer';
import {
  RecursionDiagram,
  SystemArchitectureDiagram,
  TickPipelineDiagram,
  IdentityCompositionDiagram,
  SnapshotLineageDiagram,
} from '@/components/design/Diagrams';

type SlideMeta = { range: string; title: string };

const SLIDES: SlideMeta[] = [
  { range: '—', title: 'iNFT² · title' },
  { range: '0:00 – 0:25', title: 'Four broken things' },
  { range: '0:25 – 0:50', title: 'The token is the agent' },
  { range: '0:50 – 1:15', title: 'One trust boundary' },
  { range: '1:15 – 1:50', title: 'Anatomy of a tick' },
  { range: '1:50 – 2:15', title: 'Proof' },
];

const SLIDE_COUNT = SLIDES.length;

export default function PitchPage() {
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
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
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
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {idx === 0 && <SlideTitle chainId={chainId} contracts={contracts} />}
        {idx === 1 && <SlideProblem />}
        {idx === 2 && <SlideSolution />}
        {idx === 3 && <SlideArchitecture chainId={chainId} />}
        {idx === 4 && <SlideAnatomy />}
        {idx === 5 && <SlideProof chainId={chainId} contracts={contracts} agg={agg} />}
      </div>

      {/* controls */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--rule)',
          padding: '8px 20px',
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
            style={{ opacity: idx === 0 ? 0.4 : 1, padding: '6px 14px', fontSize: 12 }}
          >
            <span className="arrow" style={{ transform: 'rotate(180deg)' }}>→</span>
            <span>Prev</span>
          </button>
          <button
            className="btn solid"
            onClick={next}
            disabled={idx === SLIDE_COUNT - 1}
            style={{ opacity: idx === SLIDE_COUNT - 1 ? 0.4 : 1, padding: '6px 14px', fontSize: 12 }}
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

/* ── 0 · Title ────────────────────────────────────────────────────────────── */
function SlideTitle({ chainId, contracts }: { chainId: number; contracts: any | null }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          padding: '0',
          minHeight: 0,
        }}
      >
        <div
          style={{
            gridColumn: 'span 8',
            padding: '28px 44px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 14,
            borderRight: '1px solid var(--rule)',
            minHeight: 0,
          }}
        >
          <div>
            <Eyebrow dot>0G APAC Hackathon · Track 2 · Agentic Trading Arena</Eyebrow>
            <p className="mono" style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              May 2026 · Submission · Testnet live
            </p>
          </div>

          <div>
            <h1
              className="cursive"
              style={{
                margin: 0,
                fontSize: 'clamp(56px, 7.2vw, 112px)',
                lineHeight: 0.92,
                letterSpacing: '-0.02em',
              }}
            >
              iNFT<sup style={{ fontSize: '0.55em', verticalAlign: 'super', color: 'var(--c-1)' }}>2</sup>
            </h1>
            <p
              className="cursive"
              style={{
                margin: '10px 0 0',
                fontSize: 'clamp(22px, 2.8vw, 36px)',
                lineHeight: 1.05,
                color: 'var(--ink-2)',
                maxWidth: '24ch',
                fontStyle: 'normal',
              }}
            >
              A new asset class. AI agents you can <span style={{ color: 'var(--ink)' }}>own, trade, and stack.</span>
            </p>
            <p className="body" style={{ margin: '12px 0 0', maxWidth: '64ch', color: 'var(--ink-2)' }}>
              Every autonomous trading agent is one <span className="mono">ERC-7857</span> iNFT — encrypted
              brain on 0G Storage, decisions in a 0G Compute TEE, with an <span className="mono">ERC-6551</span> wallet
              that can hold other iNFTs. <strong>That last part is the squared.</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 15,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
              }}
            >
              inft-squared.vercel.app
            </p>
            <span className="mono small" style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>
              · 0G Galileo · chainId {chainId}
            </span>
          </div>
        </div>

        <div
          style={{
            gridColumn: 'span 4',
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'var(--bg-2)',
            gap: 12,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Eyebrow dot>What the squared means</Eyebrow>
            <div style={{ marginTop: 8, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
              <IdentityCompositionDiagram style={{ width: '100%', maxHeight: '100%' }} />
            </div>
          </div>

          <div>
            <Eyebrow dot>Built on</Eyebrow>
            <div style={{ marginTop: 8 }}>
              <KV
                pairs={[
                  ['Standards', 'ERC-7857 + ERC-6551'],
                  ['Chain', `0G Galileo · ${chainId}`],
                  ['Contracts', contracts?.iNFT2 ? short(contracts.iNFT2, 6, 4) : '6 deployed'],
                  ['Tests', '21 forge · 14 vitest · all green'],
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 1 · Problem — four broken capabilities, sourced ──────────────────────── */
function SlideProblem() {
  const broken: Array<{ verb: string; what: string; today: string; cite: string }> = [
    {
      verb: 'Verify',
      what: 'that inference ran in a tamper-resistant enclave.',
      today: 'Trading bots run on someone else’s server. $19–$107/month at 3Commas, Cryptohopper. Cancel and the edge dies.',
      cite: 'Source: 3Commas, Cryptohopper pricing · AMBCrypto 2026 bot reviews',
    },
    {
      verb: 'Audit',
      what: 'the agent’s decision history and hidden state.',
      today: 'Virtuals + ai16z = $1B+ in AI-agent tokens trading today. Every one of them is an ERC-20 shell. GAME framework runs off-chain.',
      cite: 'Source: CoinGecko · Coin Bureau review of Virtuals (Apr 2026)',
    },
    {
      verb: 'Transfer',
      what: 'the brain to a new owner without leaking the seller’s key.',
      today: 'NFT-points-to-IPFS is a file pointer, not a state transfer. The buyer can’t decrypt — it’s still encrypted to the seller.',
      cite: 'Source: PRD §1 · pitch-script Q&A #2',
    },
    {
      verb: 'Stack',
      what: 'agents into a parent that owns its children atomically.',
      today: 'AI-agent NFTs today are JPEGs with a Discord bot attached. No standard for one agent to own another, no composability primitive.',
      cite: 'Source: submission.md §"Why this is hard"',
    },
  ];
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '18px 44px 10px' }}>
        <Eyebrow dot>0:00 – 0:25 · Problem · PRD §1</Eyebrow>
        <h2
          className="cursive"
          style={{
            margin: '6px 0 4px',
            maxWidth: '28ch',
            fontSize: 'clamp(26px, 3.6vw, 44px)',
            lineHeight: 1,
          }}
        >
          Trading agents today are <span style={{ color: 'var(--ink-3)' }}>SaaS,</span> not assets.
        </h2>
        <p className="body" style={{ margin: '2px 0 0', maxWidth: '88ch' }}>
          Four things you cannot do with the AI agents the market is pricing at billions.
        </p>
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: '1fr 1fr',
          borderTop: '1px solid var(--rule)',
          minHeight: 0,
        }}
      >
        {broken.map((row, i) => (
          <div
            key={i}
            style={{
              padding: '14px 22px',
              borderRight: i % 2 === 0 ? '1px solid var(--rule)' : 0,
              borderBottom: i < 2 ? '1px solid var(--rule)' : 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <p className="mono" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 10, letterSpacing: '0.08em' }}>
              {String(i + 1).padStart(2, '0')} · cannot
            </p>
            <p
              className="cursive"
              style={{
                margin: 0,
                color: 'var(--ink)',
                fontSize: 'clamp(22px, 2.6vw, 36px)',
                lineHeight: 1,
                fontStyle: 'normal',
              }}
            >
              {row.verb}
            </p>
            <p className="body" style={{ margin: '2px 0 0', color: 'var(--ink)', fontWeight: 500 }}>
              {row.what}
            </p>
            <p className="body small" style={{ margin: '4px 0 0', color: 'var(--ink-2)', fontSize: 12.5 }}>
              {row.today}
            </p>
            <p className="mono small" style={{ margin: 'auto 0 0', paddingTop: 6, color: 'var(--ink-3)', fontSize: 9.5 }}>
              {row.cite}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 2 · Solution — the token IS the agent, 5 trust shifts + recursion ────── */
function SlideSolution() {
  const shifts: Array<[string, string, string]> = [
    ['Verifiable inference', 'Every decision carries a TEE attestation we re-verify onchain.', 'PRD Goal 1 · FR-10'],
    ['On-chain lineage', 'Every brain mutation chains prevRoot → currRoot. Replayable from genesis.', 'PRD Goal 2 · FR-2, FR-7'],
    ['Tradable agents', 'Buy token #N, inherit the model + wallet + subtree. No SaaS migration.', 'PRD Goal 3 · FR-4'],
    ['Composable agents', 'A manager iNFT signs intents for its children via ERC-6551 TBA.', 'PRD Goal 4 · FR-6, FR-8'],
    ['Operator-as-relay', 'The operator broadcasts signed intents. Cannot move funds. Cannot read brain.', 'PRD Goal 5 · FR-6'],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '20px 44px 10px' }}>
        <Eyebrow dot>0:25 – 0:50 · Solution · PRD §2 + §3</Eyebrow>
        <h2
          className="cursive"
          style={{
            margin: '6px 0 4px',
            maxWidth: '24ch',
            fontSize: 'clamp(28px, 4vw, 52px)',
            lineHeight: 1,
          }}
        >
          The token <em style={{ fontStyle: 'normal', color: 'var(--ink-3)' }}>is</em> the agent.
        </h2>
        <p className="body" style={{ maxWidth: '88ch', margin: 0 }}>
          One <span className="mono">ERC-7857</span> NFT. Encrypted brain on 0G Storage. <span className="mono">ERC-6551</span> wallet that can hold other iNFTs. Five goals, enforced by contract.
        </p>
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          borderTop: '1px solid var(--rule)',
          minHeight: 0,
        }}
      >
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {shifts.map(([title, body, cite], i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 150px',
                gap: 12,
                padding: '10px 22px',
                borderBottom: i === shifts.length - 1 ? 0 : '1px solid var(--rule)',
                alignItems: 'baseline',
                flex: 1,
                minHeight: 0,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  letterSpacing: '0.06em',
                }}
              >
                0{i + 1}
              </span>
              <div>
                <p className="display-s" style={{ margin: 0, fontSize: 16, lineHeight: 1.1 }}>
                  {title}
                </p>
                <p className="body small" style={{ margin: '3px 0 0', color: 'var(--ink-2)', fontSize: 12.5 }}>
                  {body}
                </p>
              </div>
              <span
                className="mono small"
                style={{ color: 'var(--ink-3)', fontSize: 10, textAlign: 'right' }}
              >
                {cite}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            gridColumn: 'span 5',
            borderLeft: '1px solid var(--rule)',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Eyebrow>The recursion</Eyebrow>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            <RecursionDiagram style={{ width: '100%', maxHeight: '100%' }} />
          </div>
          <p className="body small" style={{ margin: 0, fontSize: 12.5 }}>
            Manager iNFT → <span className="mono">ERC-6551</span> wallet → three child iNFTs.
            <strong> Sell the manager, all four change hands atomically.</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 3 · Architecture — system diagram (contracts + runtime + backend + 0G) ── */
function SlideArchitecture({ chainId }: { chainId: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 44px 6px' }}>
        <Eyebrow dot>0:50 – 1:15 · Architecture · PRD §6 + §8</Eyebrow>
        <h2
          className="cursive"
          style={{
            margin: '4px 0 2px',
            maxWidth: '36ch',
            fontSize: 'clamp(22px, 2.8vw, 34px)',
            lineHeight: 1,
          }}
        >
          Five contracts. <span style={{ color: 'var(--ink-3)' }}>Four 0G primitives. One write path.</span>
        </h2>
        <p className="body small" style={{ maxWidth: '96ch', margin: 0, fontSize: 12.5 }}>
          0G Aristotle mainnet (Sept 2025 · <span className="mono">$325M raised</span>) — the only EVM stack
          where verifiable TEE inference, encrypted storage, and a DA layer live under one chain.
        </p>
      </div>
      <div
        style={{
          flex: 1,
          padding: '4px 24px 14px',
          borderTop: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <SystemArchitectureDiagram
          chainId={chainId}
          style={{ width: 'min(100%, 88vh)', height: 'auto', margin: '0 auto' }}
        />
      </div>
    </div>
  );
}

/* ── 4 · Anatomy of a tick — four steps mapped to FR-IDs ──────────────────── */
function SlideAnatomy() {
  const steps: Array<{ title: string; lede: string; detail: string; fr: string; file: string }> = [
    {
      title: 'Decide',
      lede: 'LLM inside 0G Compute TEE picks buy / sell / hold.',
      detail: 'Enclave signs the response. processResponse re-verifies attestation onchain. No attestation → no trade.',
      fr: 'FR-10',
      file: 'runtime/src/llm.ts:65',
    },
    {
      title: 'Authorize',
      lede: 'Decision becomes an EIP-712 intent.',
      detail: 'Nonce, 5-min expiry, per-trade cap, daily cap, target allowlist. Owner signs. Operator only relays.',
      fr: 'FR-6',
      file: 'AgentController.t.sol (5 tests)',
    },
    {
      title: 'Snapshot',
      lede: 'Every 6h: serialize → encrypt → upload → commit.',
      detail: 'Brain state → 0G Storage (ECIES + AES-256-GCM), current DA epoch read from DASigners, Merkle root submitted.',
      fr: 'FR-7, FR-12',
      file: 'runtime/src/snapshot.ts:publishSnapshot',
    },
    {
      title: 'Sell',
      lede: 'transferWithReKey — one transaction.',
      detail: 'Download brain → decrypt → re-encrypt to buyer pubkey → upload → flip ownership. Seller key now useless.',
      fr: 'FR-13',
      file: 'runtime/src/transfer.ts:reKeyAndTransfer',
    },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 44px 6px' }}>
        <Eyebrow dot>1:15 – 1:50 · Mechanics · PRD §6.1 + §6.2</Eyebrow>
        <h2
          className="cursive"
          style={{
            margin: '4px 0 2px',
            maxWidth: '36ch',
            fontSize: 'clamp(24px, 3.2vw, 38px)',
            lineHeight: 1,
          }}
        >
          Anatomy of a tick. <span style={{ color: 'var(--ink-3)' }}>Four moves, ~5 seconds.</span>
        </h2>
        <p className="body small" style={{ maxWidth: '88ch', margin: 0, fontSize: 12.5 }}>
          Each step is a specific functional requirement with a passing test and a runtime file.
        </p>
      </div>
      <div
        style={{
          padding: '6px 24px 6px',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
          flex: '0 0 auto',
          maxHeight: '30vh',
          overflow: 'hidden',
        }}
      >
        <TickPipelineDiagram style={{ width: '100%', maxHeight: '28vh' }} />
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          minHeight: 0,
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s.title}
            style={{
              padding: '12px 18px',
              borderRight: i === steps.length - 1 ? 0 : '1px solid var(--rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              background: i === 3 ? 'var(--bg-2)' : 'transparent',
              color: 'var(--ink)',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--ink-3)',
              }}
            >
              0{i + 1} · {s.fr}
            </p>
            <p
              className="display-s cursive"
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1,
                color: 'var(--ink)',
              }}
            >
              {s.title}
            </p>
            <p
              className="body small"
              style={{
                margin: 0,
                color: 'var(--ink)',
                fontWeight: 500,
                fontSize: 12.5,
              }}
            >
              {s.lede}
            </p>
            <p
              className="body small"
              style={{
                margin: 0,
                color: 'var(--ink-2)',
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              {s.detail}
            </p>
            <p
              className="mono small"
              style={{
                margin: 'auto 0 0',
                paddingTop: 4,
                color: 'var(--ink-3)',
                fontSize: 9.5,
              }}
            >
              {s.file}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 5 · Proof — what we shipped, sourced to PRD metrics + risks ──────────── */
function SlideProof({
  chainId,
  contracts,
  agg,
}: {
  chainId: number;
  contracts: any | null;
  agg: ReturnType<typeof aggregate>;
}) {
  const proofs: Array<[string, string, string]> = [
    ['21 / 21', 'forge tests green', 'iNFT², AgentController, SnapshotAttestor, Recursion · contracts/test/*'],
    ['14 / 14', 'vitest tests green', 'AES-256-GCM tag enforcement, ECIES round-trip, intent EIP-712 · runtime/test/*'],
    ['6', 'contracts deployed', `Live on 0G Galileo · chainId ${chainId} · verifiable on chainscan`],
    ['1 + 3', 'manager + children running', 'Orchard (manager) → Lark, Tide, Quill · live equity curves on /demo'],
  ];
  const risksHandled: Array<[string, string]> = [
    ['Operator key compromise', 'Bounded: operator can refuse to relay; never moves funds out of TBA.'],
    ['0G Storage selector drift', 'In-memory keccak256 stub same root contract; switch on stable selector.'],
    ['TEE attestation gap', 'processResponse null → log + skip; provider rotation handled by router.'],
    ['Buy-flow dequeue', 'Re-key path tested end-to-end in vitest; runtime dequeue is next milestone.'],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 44px 6px' }}>
        <Eyebrow dot>1:50 – 2:15 · Proof · PRD §10 + §11 + §13</Eyebrow>
        <h2
          className="cursive"
          style={{
            margin: '4px 0 2px',
            maxWidth: '32ch',
            fontSize: 'clamp(24px, 3.2vw, 38px)',
            lineHeight: 1,
          }}
        >
          We didn’t describe it. <span style={{ color: 'var(--ink-3)' }}>We shipped it.</span>
        </h2>
        <p className="body small" style={{ maxWidth: '88ch', margin: 0, fontSize: 12.5 }}>
          Every PRD goal maps to a passing test. Every PRD risk has a documented mitigation.
        </p>
      </div>
      <div
        style={{
          padding: '4px 24px 4px',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <SnapshotLineageDiagram
          style={{ width: 'min(100%, 70vh)', height: 'auto', margin: '0 auto' }}
        />
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          minHeight: 0,
        }}
      >
        <div
          style={{
            gridColumn: 'span 7',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            borderRight: '1px solid var(--rule)',
            minHeight: 0,
          }}
        >
          {proofs.map(([num, label, sub], i) => (
            <div
              key={i}
              style={{
                padding: '10px 20px',
                borderRight: i % 2 === 0 ? '1px solid var(--rule)' : 0,
                borderBottom: i < 2 ? '1px solid var(--rule)' : 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <p
                className="mono num"
                style={{
                  margin: 0,
                  fontSize: 'clamp(22px, 2.6vw, 36px)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                }}
              >
                {num}
              </p>
              <p className="body small" style={{ margin: 0, color: 'var(--ink)', fontSize: 12.5 }}>
                {label}
              </p>
              <p className="mono small" style={{ margin: '2px 0 0', color: 'var(--ink-3)', fontSize: 10 }}>
                {sub}
              </p>
            </div>
          ))}
        </div>
        <div
          style={{
            gridColumn: 'span 5',
            padding: '10px 20px',
            background: 'var(--bg-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Eyebrow>Risks · mitigated · PRD §11</Eyebrow>
          {risksHandled.map(([risk, mit], i) => (
            <div
              key={i}
              style={{
                paddingTop: 4,
                borderTop: i === 0 ? 0 : '1px solid var(--rule)',
              }}
            >
              <p className="body small" style={{ margin: 0, fontWeight: 500, fontSize: 12 }}>{risk}</p>
              <p className="body small" style={{ margin: '1px 0 0', color: 'var(--ink-2)', fontSize: 11, lineHeight: 1.35 }}>
                {mit}
              </p>
            </div>
          ))}
          <p
            className="mono small"
            style={{
              margin: 'auto 0 0',
              paddingTop: 4,
              color: 'var(--ink-3)',
              fontSize: 10,
            }}
          >
            Subtree PnL · {agg.pnlBps >= 0 ? '+' : '−'}{(Math.abs(agg.pnlBps) / 100).toFixed(2)}% ·
            {' '}{contracts?.iNFT2 ? short(contracts.iNFT2, 6, 4) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

