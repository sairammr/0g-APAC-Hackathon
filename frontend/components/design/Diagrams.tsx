'use client';
import { CSSProperties, ReactNode } from 'react';

const STROKE = 'currentColor';
const FONT_MONO = 'var(--font-mono)';
const FONT_DISPLAY = 'var(--font-display)';

function Caption({ children }: { children: ReactNode }) {
  return (
    <p
      className="mono"
      style={{
        margin: '14px 0 0',
        fontSize: 10.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
      }}
    >
      {children}
    </p>
  );
}

/* ─────────────── Architecture (Frontend ⇄ Backend ⇄ Runtime ⇄ 0G) ─────────────── */
export function ArchitectureDiagram({ chainId = 16602, style }: { chainId?: number; style?: CSSProperties }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 880 460" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        {/* row 1 — frontend */}
        <g>
          <rect x="60" y="20" width="760" height="74" fill="var(--bg)" stroke={STROKE} />
          <text x="80" y="46" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
            FRONTEND · NEXT.JS 14 · PRIVY · VIEM
          </text>
          <g fontFamily={FONT_DISPLAY} fontSize="13" fill="var(--ink)">
            <rect x="80" y="58" width="120" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="140" y="75" textAnchor="middle">/demo</text>
            <rect x="210" y="58" width="160" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="290" y="75" textAnchor="middle">/agent/[id]</text>
            <rect x="380" y="58" width="160" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="460" y="75" textAnchor="middle">/audit · /pitch</text>
            <rect x="550" y="58" width="140" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="620" y="75" textAnchor="middle">/create</text>
            <rect x="700" y="58" width="100" height="26" fill="var(--c-1)" stroke={STROKE} />
            <text x="750" y="75" textAnchor="middle" fill="#0B0C0A">Buy flow</text>
          </g>
        </g>

        {/* arrow 1 */}
        <g>
          <line x1="440" y1="94" x2="440" y2="120" stroke={STROKE} strokeOpacity="0.45" strokeDasharray="2 4" />
          <text x="450" y="111" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)">REST · GET /api/*</text>
        </g>

        {/* row 2 — backend */}
        <g>
          <rect x="60" y="124" width="760" height="74" fill="var(--bg)" stroke={STROKE} />
          <text x="80" y="150" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
            BACKEND · FASTIFY · SUPABASE LEDGER
          </text>
          <g fontFamily={FONT_DISPLAY} fontSize="13" fill="var(--ink)">
            <rect x="80" y="162" width="160" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="160" y="179" textAnchor="middle">REST api</text>
            <rect x="250" y="162" width="160" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="330" y="179" textAnchor="middle">indexer</text>
            <rect x="420" y="162" width="200" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="520" y="179" textAnchor="middle">snapshot fetcher</text>
            <rect x="630" y="162" width="160" height="26" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.25" />
            <text x="710" y="179" textAnchor="middle">attestation cache</text>
          </g>
        </g>

        {/* split arrows down to 0G chain + runtime */}
        <g stroke={STROKE} strokeOpacity="0.45" fill="none" strokeDasharray="2 4">
          <path d="M 220 198 L 220 224 L 180 224 L 180 240" />
          <path d="M 660 198 L 660 224 L 700 224 L 700 240" />
        </g>

        {/* row 3 — 0g */}
        <g>
          <rect x="60" y="240" width="380" height="86" fill="var(--c-1)" stroke={STROKE} />
          <text x="80" y="266" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" letterSpacing="1.2">
            0G CHAIN · chainId {chainId}
          </text>
          <g fontFamily={FONT_MONO} fontSize="11" fill="#0B0C0A">
            <text x="80" y="289">iNFT2 · ERC-721 + brain root lineage</text>
            <text x="80" y="306">AgentController · EIP-712 intents · policy</text>
            <text x="80" y="323">SnapshotAttestor · per-token snapshot log</text>
          </g>

          <rect x="460" y="240" width="360" height="86" fill="var(--c-2)" stroke={STROKE} />
          <text x="480" y="266" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" letterSpacing="1.2">
            0G STORAGE · 0G DA
          </text>
          <g fontFamily={FONT_MONO} fontSize="11" fill="#0B0C0A">
            <text x="480" y="289">brain blob · AES-256-GCM · secp256k1 ECDH</text>
            <text x="480" y="306">snapshot blob · prev → curr lineage</text>
            <text x="480" y="323">attestations · DA-anchored every 6h</text>
          </g>
        </g>

        {/* runtime row */}
        <g>
          <rect x="60" y="352" width="760" height="84" fill="var(--ink)" />
          <text x="80" y="378" fontFamily={FONT_MONO} fontSize="10" fill="var(--bg)" opacity="0.7" letterSpacing="1.2">
            RUNTIME LOOP · runtime/src/main.ts · 60s tick / 6h snapshot
          </text>
          <g fontFamily={FONT_MONO} fontSize="11" fill="var(--bg)">
            <text x="80" y="402">decide()  →  0G Compute (TEE attested · GLM-5-FP8)</text>
            <text x="80" y="420">signIntent (EIP-712)  →  AgentController.execute  →  TBA call</text>
            <text x="500" y="402">publishSnapshot  →  0G Storage</text>
            <text x="500" y="420">epoch anchor  →  0G DA  →  SnapshotAttestor.submit</text>
          </g>
        </g>

        {/* dashed line connecting runtime to row 3 */}
        <g stroke={STROKE} strokeOpacity="0.55" strokeDasharray="2 4" fill="none">
          <path d="M 220 326 L 220 352" />
          <path d="M 660 326 L 660 352" />
        </g>
      </svg>
      <Caption>End-to-end · request flow + write path · TEE attested · 6h anchored</Caption>
    </div>
  );
}

/* ─────────────── Recursion (Manager TBA holds child iNFTs) ─────────────── */
export function RecursionDiagram({ style }: { style?: CSSProperties }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 880 360" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        {/* owner */}
        <g>
          <rect x="320" y="14" width="240" height="48" fill="var(--bg-2)" stroke={STROKE} />
          <text x="340" y="36" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
            OWNER · EOA / SAFE
          </text>
          <text x="340" y="54" fontFamily={FONT_MONO} fontSize="12" fill="var(--ink)">0xA11C…E3aF</text>
        </g>

        {/* line down to manager */}
        <line x1="440" y1="62" x2="440" y2="92" stroke={STROKE} strokeOpacity="0.5" />

        {/* manager */}
        <g>
          <rect x="290" y="92" width="300" height="62" fill="var(--ink)" />
          <text x="310" y="116" fontFamily={FONT_MONO} fontSize="10" fill="var(--bg)" opacity="0.7" letterSpacing="1.2">
            MANAGER iNFT  ·  #42
          </text>
          <text x="310" y="139" fontFamily={FONT_DISPLAY} fontSize="20" fill="var(--bg)">
            Orchard
          </text>
          <text x="580" y="139" textAnchor="end" fontFamily={FONT_MONO} fontSize="12" fill="var(--bg)">
            +3.84%
          </text>
        </g>

        {/* TBA below manager */}
        <line x1="440" y1="154" x2="440" y2="186" stroke={STROKE} strokeOpacity="0.6" strokeDasharray="3 3" />
        <text x="450" y="178" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)">
          ERC-6551 registry · deterministic
        </text>

        <g>
          <rect x="290" y="186" width="300" height="44" fill="var(--bg)" stroke={STROKE} />
          <text x="305" y="208" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)">
            TBA  ·  0xT8A…F1
          </text>
          <text x="305" y="222" fontFamily={FONT_MONO} fontSize="11" fill="var(--ink)">
            holds {`{ USDC · RISK · iNFT #43 · iNFT #44 · iNFT #45 }`}
          </text>
        </g>

        {/* arrows down to 3 children */}
        <g stroke={STROKE} strokeOpacity="0.45" strokeDasharray="2 4" fill="none">
          <path d="M 440 230 C 440 260, 160 270, 160 280" />
          <path d="M 440 230 L 440 280" />
          <path d="M 440 230 C 440 260, 720 270, 720 280" />
        </g>

        {/* 3 children */}
        {[
          { x: 60, accent: 'var(--c-1)', label: 'MOMENTUM · #43', name: 'Lark', pnl: '+5.20%', w: '40%' },
          { x: 340, accent: 'var(--c-2)', label: 'MEAN-REV · #44', name: 'Tide', pnl: '+2.91%', w: '35%' },
          { x: 620, accent: 'var(--c-3)', label: 'MARKET-MAKER · #45', name: 'Quill', pnl: '+0.87%', w: '25%' },
        ].map((c, i) => (
          <g key={i}>
            <rect x={c.x} y="280" width="200" height="62" fill={c.accent} stroke={STROKE} />
            <text x={c.x + 14} y="302" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" letterSpacing="1.2">
              {c.label}
            </text>
            <text x={c.x + 14} y="325" fontFamily={FONT_DISPLAY} fontSize="18" fill="#0B0C0A">
              {c.name}
            </text>
            <text x={c.x + 186} y="325" textAnchor="end" fontFamily={FONT_MONO} fontSize="11" fill="#0B0C0A">
              {c.pnl}
            </text>
            <rect x={c.x + 80} y="244" width="44" height="20" fill="var(--bg)" stroke={STROKE} strokeOpacity="0.5" />
            <text x={c.x + 102} y="258" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink)">
              {c.w}
            </text>
          </g>
        ))}
      </svg>
      <Caption>Recursion lives in ERC-6551 · selling the manager sells the subtree atomically</Caption>
    </div>
  );
}

/* ─────────────── Intent flow (decide → sign → relay → exec) ─────────────── */
export function IntentFlowDiagram({ style }: { style?: CSSProperties }) {
  const steps = [
    { n: '01', who: 'Runtime', what: 'observe(market)', sub: '60s tick · price + vol' },
    { n: '02', who: '0G Compute', what: 'decide()', sub: 'GLM-5 · TEE · verify_tee:true' },
    { n: '03', who: 'Owner key', what: 'signIntent', sub: 'EIP-712 · nonce + expiry' },
    { n: '04', who: 'Operator', what: 'relay', sub: 'AgentController.executeIntent' },
    { n: '05', who: 'TBA', what: 'execute(call)', sub: 'allowlist · cap · daily vol' },
    { n: '06', who: '0G Chain', what: 'commit', sub: 'IntentExecuted event' },
  ];

  return (
    <div style={style}>
      <svg viewBox="0 0 880 200" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        {/* spine */}
        <line x1="40" y1="100" x2="840" y2="100" stroke={STROKE} strokeOpacity="0.4" strokeDasharray="3 4" />

        {steps.map((s, i) => {
          const x = 40 + (i + 0.5) * (800 / steps.length);
          const accent = ['var(--bg-2)', 'var(--c-1)', 'var(--bg-2)', 'var(--bg-2)', 'var(--c-2)', 'var(--ink)'][i];
          const ink = i === 5 ? 'var(--bg)' : '#0B0C0A';
          return (
            <g key={i}>
              <rect x={x - 60} y="58" width="120" height="84" fill={accent} stroke={STROKE} />
              <text x={x} y="78" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={ink} opacity="0.7" letterSpacing="1.2">
                {s.n} · {s.who}
              </text>
              <text x={x} y="100" textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fill={ink}>
                {s.what}
              </text>
              <text x={x} y="120" textAnchor="middle" fontFamily={FONT_MONO} fontSize="9.5" fill={ink} opacity={i === 5 ? 0.75 : 0.55}>
                {s.sub}
              </text>

              {/* arrow head */}
              {i < steps.length - 1 ? (
                <polygon
                  points={`${x + 60 + 14},96 ${x + 60 + 14},104 ${x + 60 + 22},100`}
                  fill={STROKE}
                  fillOpacity="0.5"
                />
              ) : null}
            </g>
          );
        })}

        {/* labels */}
        <text x="40" y="34" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
          PER-TICK INTENT PATH · 60s cadence · ~5s wall-clock end-to-end
        </text>
        <text x="40" y="180" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)">
          The operator never holds owner keys. Cannot move funds, cannot read the brain.
        </text>
      </svg>
      <Caption>Owner signs · operator relays · contract enforces · chain commits</Caption>
    </div>
  );
}

/* ─────────────── Snapshot lineage (prev → curr brain, storage root, DA epoch) ─────────────── */
export function SnapshotLineageDiagram({ style }: { style?: CSSProperties }) {
  const snaps = [
    { label: 'S-001', root: '0x9a…ec', pnl: '+0.18%', da: 4421 },
    { label: 'S-002', root: '0x71…b3', pnl: '+0.42%', da: 4427 },
    { label: 'S-003', root: '0xc4…0d', pnl: '−0.05%', da: 4433 },
    { label: 'S-004', root: '0xe2…7a', pnl: '+1.10%', da: 4439 },
  ];

  return (
    <div style={style}>
      <svg viewBox="0 0 880 240" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        <text x="40" y="30" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
          BRAIN LINEAGE · prev root → curr root · 6h cadence
        </text>

        {snaps.map((s, i) => {
          const x = 40 + i * 210;
          return (
            <g key={i}>
              <rect x={x} y="60" width="180" height="100" fill="var(--bg)" stroke={STROKE} />
              <text x={x + 14} y="84" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)" letterSpacing="1">
                {s.label}
              </text>
              <text x={x + 14} y="106" fontFamily={FONT_DISPLAY} fontSize="13" fill="var(--ink)">
                brain {s.root}
              </text>
              <text x={x + 14} y="124" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)">
                pnl {s.pnl}
              </text>
              <text x={x + 14} y="142" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)">
                DA epoch {s.da}
              </text>

              {/* prev link */}
              {i > 0 ? (
                <g>
                  <line
                    x1={x - 30}
                    y1="110"
                    x2={x - 2}
                    y2="110"
                    stroke={STROKE}
                    strokeOpacity="0.5"
                    strokeDasharray="3 3"
                  />
                  <polygon points={`${x - 8},106 ${x - 8},114 ${x - 2},110`} fill={STROKE} fillOpacity="0.55" />
                </g>
              ) : null}

              {/* storage chip */}
              <rect x={x + 14} y="172" width="76" height="24" fill="var(--c-1)" stroke={STROKE} />
              <text x={x + 52} y="188" textAnchor="middle" fontFamily={FONT_MONO} fontSize="9.5" fill="#0B0C0A">
                0G Storage
              </text>

              {/* DA chip */}
              <rect x={x + 96} y="172" width="76" height="24" fill="var(--c-2)" stroke={STROKE} />
              <text x={x + 134} y="188" textAnchor="middle" fontFamily={FONT_MONO} fontSize="9.5" fill="#0B0C0A">
                0G DA
              </text>
            </g>
          );
        })}

        <text x="40" y="222" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)">
          Replay any range from genesis · every prev → curr link verifiable on-chain
        </text>
      </svg>
      <Caption>Append-only ledger of agent thought · auditable end-to-end</Caption>
    </div>
  );
}

/* ─────────────── Atomic re-key on sale ─────────────── */
export function ReKeyDiagram({ style }: { style?: CSSProperties }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 880 290" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        <text x="40" y="28" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
          transferWithReKey · atomic · seller key dies the instant ownership flips
        </text>

        {/* seller */}
        <g>
          <rect x="40" y="60" width="200" height="70" fill="var(--bg-2)" stroke={STROKE} />
          <text x="56" y="82" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1">SELLER</text>
          <text x="56" y="104" fontFamily={FONT_DISPLAY} fontSize="14" fill="var(--ink)">old brain pubkey</text>
          <text x="56" y="120" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)">0xS3LL…2c4</text>
        </g>

        {/* TEE re-key */}
        <g>
          <rect x="290" y="50" width="300" height="160" fill="var(--c-1)" stroke={STROKE} />
          <text x="306" y="74" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" letterSpacing="1.2">
            OPERATOR · INSIDE TEE
          </text>
          <text x="306" y="100" fontFamily={FONT_DISPLAY} fontSize="14" fill="#0B0C0A">
            1 · fetch blob from 0G Storage
          </text>
          <text x="306" y="120" fontFamily={FONT_DISPLAY} fontSize="14" fill="#0B0C0A">
            2 · decrypt under seller key
          </text>
          <text x="306" y="140" fontFamily={FONT_DISPLAY} fontSize="14" fill="#0B0C0A">
            3 · re-encrypt to buyer pubkey
          </text>
          <text x="306" y="160" fontFamily={FONT_DISPLAY} fontSize="14" fill="#0B0C0A">
            4 · upload new blob → new root
          </text>
          <text x="306" y="186" fontFamily={FONT_MONO} fontSize="10.5" fill="#0B0C0A" opacity="0.7">
            attested · plaintext never leaves enclave
          </text>
        </g>

        {/* buyer */}
        <g>
          <rect x="640" y="60" width="200" height="70" fill="var(--c-2)" stroke={STROKE} />
          <text x="656" y="82" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" letterSpacing="1">BUYER</text>
          <text x="656" y="104" fontFamily={FONT_DISPLAY} fontSize="14" fill="#0B0C0A">new brain pubkey</text>
          <text x="656" y="120" fontFamily={FONT_MONO} fontSize="10.5" fill="#0B0C0A" opacity="0.7">0xB04…9aF</text>
        </g>

        {/* connecting lines */}
        <g stroke={STROKE} strokeOpacity="0.55" fill="none">
          <line x1="240" y1="95" x2="290" y2="95" />
          <polygon points="282,91 282,99 290,95" fill={STROKE} fillOpacity="0.55" />
          <line x1="590" y1="95" x2="640" y2="95" />
          <polygon points="632,91 632,99 640,95" fill={STROKE} fillOpacity="0.55" />
        </g>

        {/* chain commit */}
        <g>
          <rect x="40" y="234" width="800" height="40" fill="var(--ink)" />
          <text x="60" y="258" fontFamily={FONT_MONO} fontSize="11" fill="var(--bg)">
            iNFT2.transferWithReKey(id, buyer, newRoot, sealedKey, proof) · one tx · ownership + key + brain all flip together
          </text>
        </g>

        {/* down arrows */}
        <line x1="440" y1="210" x2="440" y2="234" stroke={STROKE} strokeOpacity="0.5" />
        <polygon points="436,228 444,228 440,234" fill={STROKE} fillOpacity="0.55" />
      </svg>
      <Caption>The brain is re-keyed before the deed flips · no replay window · no leaked secrets</Caption>
    </div>
  );
}

/* ─────────────── Trust model — who can do what ─────────────── */
export function TrustModelDiagram({ style }: { style?: CSSProperties }) {
  const rows: Array<[string, string, string, string]> = [
    ['Operator (relayer)', 'can', 'broadcast pre-signed intents on chain', 'limited'],
    ['Operator (relayer)', 'cannot', 'move funds out of TBA · read brain · forge intent', 'denied'],
    ['Owner', 'can', 'sign intents · rotate brain · sell · revoke operator', 'full'],
    ['Buyer', 'gets', 'fresh brain key the moment NFT lands in their wallet', 'atomic'],
    ['Anyone', 'can', 'replay snapshots · verify TEE proofs · audit lineage', 'public'],
  ];

  return (
    <div style={style}>
      <svg viewBox="0 0 880 250" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        <text x="40" y="26" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
          TRUST MODEL · who holds what authority
        </text>
        {rows.map((r, i) => {
          const y = 50 + i * 36;
          const isCannot = r[1] === 'cannot';
          const accent = isCannot ? '#f4d4d4' : r[1] === 'can' && i === 2 ? 'var(--c-1)' : r[1] === 'gets' ? 'var(--c-2)' : 'var(--bg-2)';
          const fg = '#0B0C0A';
          return (
            <g key={i}>
              <rect x="40" y={y} width="800" height="32" fill={accent} stroke={STROKE} strokeOpacity="0.4" />
              <text x="56" y={y + 21} fontFamily={FONT_DISPLAY} fontSize="13" fill={fg}>
                {r[0]}
              </text>
              <text x="220" y={y + 21} fontFamily={FONT_MONO} fontSize="11" fill={fg} opacity="0.6" letterSpacing="1">
                {r[1].toUpperCase()}
              </text>
              <text x="290" y={y + 21} fontFamily={FONT_DISPLAY} fontSize="13" fill={fg}>
                {r[2]}
              </text>
              <text x="824" y={y + 21} textAnchor="end" fontFamily={FONT_MONO} fontSize="10.5" fill={fg} opacity="0.7" letterSpacing="1">
                {r[3].toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      <Caption>Least-privilege by construction · enforced by the contract, not by the operator</Caption>
    </div>
  );
}

/* ─────────────── System architecture: contracts + runtime + backend + 0G ─────────────── */
export function SystemArchitectureDiagram({
  chainId = 16602,
  style,
}: {
  chainId?: number;
  style?: CSSProperties;
}) {
  const contracts = [
    { x: 30, w: 158, name: 'iNFT2', tag: 'ERC-7857' },
    { x: 198, w: 158, name: 'AgentController', tag: 'EIP-712' },
    { x: 366, w: 158, name: 'SnapshotAttestor', tag: 'lineage' },
    { x: 534, w: 158, name: 'BrainKeyRegistry', tag: 're-key' },
    { x: 702, w: 178, name: 'ERC6551 Reg + Acct', tag: 'TBA' },
  ];

  return (
    <div style={style}>
      <svg viewBox="0 0 1100 560" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        {/* ── Top band: 0G Chain (contracts) ── */}
        <g>
          <rect x="20" y="20" width="870" height="110" fill="var(--c-1)" stroke={STROKE} />
          <text x="40" y="44" fontFamily={FONT_MONO} fontSize="11" fill="#0B0C0A" letterSpacing="1.4">
            0G CHAIN · chainId {chainId} · 5 contracts deployed + verified
          </text>
          {contracts.map((c, i) => (
            <g key={i}>
              <rect x={c.x} y="58" width={c.w} height="58" fill="var(--bg)" stroke={STROKE} strokeOpacity="0.5" />
              <text
                x={c.x + c.w / 2}
                y="82"
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13.5"
                fill="var(--ink)"
              >
                {c.name}
              </text>
              <text
                x={c.x + c.w / 2}
                y="100"
                textAnchor="middle"
                fontFamily={FONT_MONO}
                fontSize="10"
                fill="var(--ink-3)"
                letterSpacing="1.2"
              >
                {c.tag.toUpperCase()}
              </text>
            </g>
          ))}
        </g>

        {/* ── Runtime ↔ Chain arrows ── */}
        <g stroke={STROKE} strokeOpacity="0.55" fill="none">
          {/* writes intents (up) */}
          <line x1="265" y1="190" x2="265" y2="132" />
          <polygon points="261,140 269,140 265,132" fill={STROKE} fillOpacity="0.6" />
          <text x="276" y="160" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)" letterSpacing="0.6">
            writes · EIP-712 intent · per tick
          </text>
          {/* commits root (up) */}
          <line x1="500" y1="190" x2="500" y2="132" strokeDasharray="3 4" />
          <polygon points="496,140 504,140 500,132" fill={STROKE} fillOpacity="0.6" />
          <text x="512" y="160" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)" letterSpacing="0.6">
            commits Merkle root · 6h
          </text>
        </g>

        {/* ── Middle: Runtime loop ── */}
        <g>
          <rect x="20" y="190" width="870" height="160" fill="var(--bg)" stroke={STROKE} />
          <text x="40" y="214" fontFamily={FONT_MONO} fontSize="11" fill="var(--ink-3)" letterSpacing="1.4">
            RUNTIME LOOP · runtime/src/main.ts · 60s tick · 6h snapshot
          </text>

          {/* Pipeline boxes inside runtime band */}
          {[
            { x: 36, label: 'observe', sub: 'market read · 60s', accent: 'var(--bg-2)' },
            { x: 200, label: 'TEE decide', sub: 'GLM-5-FP8 · verify_tee', accent: 'var(--c-1)' },
            { x: 364, label: 'owner sign', sub: 'EIP-712 · nonce · cap', accent: 'var(--bg-2)' },
            { x: 528, label: 'operator relay', sub: 'AgentController.execute', accent: 'var(--bg-2)' },
            { x: 692, label: 'TBA execute', sub: 'allowlist · target', accent: 'var(--c-2)' },
          ].map((p, i, arr) => (
            <g key={i}>
              <rect x={p.x} y="240" width="140" height="60" fill={p.accent} stroke={STROKE} strokeOpacity="0.5" />
              <text x={p.x + 70} y="266" textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fill="#0B0C0A">
                {p.label}
              </text>
              <text
                x={p.x + 70}
                y="284"
                textAnchor="middle"
                fontFamily={FONT_MONO}
                fontSize="9.5"
                fill="#0B0C0A"
                opacity="0.7"
              >
                {p.sub}
              </text>
              {i < arr.length - 1 && (
                <g>
                  <line
                    x1={p.x + 140}
                    y1="270"
                    x2={p.x + 158}
                    y2="270"
                    stroke={STROKE}
                    strokeOpacity="0.55"
                  />
                  <polygon points={`${p.x + 152},266 ${p.x + 152},274 ${p.x + 158},270`} fill={STROKE} fillOpacity="0.55" />
                </g>
              )}
            </g>
          ))}

          {/* Snapshot leg label inside runtime */}
          <text x="40" y="328" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)">
            every 6h →  serialize state · ECIES encrypt to owner · upload blob · read DA epoch · SnapshotAttestor.submit
          </text>
        </g>

        {/* ── Right column: 0G primitives ── */}
        <g>
          {[
            { y: 20, label: '0G COMPUTE', detail: 'TEE inference', sub: 'GLM-5-FP8 · processResponse' },
            { y: 130, label: '0G STORAGE', detail: 'encrypted brain', sub: 'ECIES + AES-256-GCM' },
            { y: 240, label: '0G DA', detail: 'epoch tag', sub: 'DASigners precompile' },
          ].map((p, i) => (
            <g key={i}>
              <rect x="910" y={p.y} width="170" height="98" fill="var(--ink)" />
              <text x="924" y={p.y + 26} fontFamily={FONT_MONO} fontSize="10.5" fill="var(--bg)" opacity="0.75" letterSpacing="1.3">
                {p.label}
              </text>
              <text x="924" y={p.y + 52} fontFamily={FONT_DISPLAY} fontSize="14" fill="var(--bg)">
                {p.detail}
              </text>
              <text x="924" y={p.y + 76} fontFamily={FONT_MONO} fontSize="10" fill="var(--bg)" opacity="0.62">
                {p.sub}
              </text>
            </g>
          ))}
        </g>

        {/* ── Arrows: Runtime → right column 0G primitives ── */}
        <g stroke={STROKE} strokeOpacity="0.55" fill="none">
          {/* to 0G Compute (decide) */}
          <line x1="800" y1="270" x2="910" y2="70" />
          <polygon points="906,62 914,72 902,72" fill={STROKE} fillOpacity="0.55" />
          <text x="820" y="142" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)" transform="rotate(-22 820 142)">
            verify_tee
          </text>

          {/* to 0G Storage (snapshot) */}
          <line x1="800" y1="328" x2="910" y2="180" strokeDasharray="3 4" />
          <polygon points="906,172 914,182 902,182" fill={STROKE} fillOpacity="0.55" />
          <text x="824" y="246" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)" transform="rotate(-18 824 246)">
            blob upload
          </text>

          {/* to 0G DA (snapshot epoch) */}
          <line x1="800" y1="338" x2="910" y2="288" strokeDasharray="3 4" />
          <polygon points="906,280 914,290 902,290" fill={STROKE} fillOpacity="0.55" />
          <text x="836" y="316" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)" transform="rotate(-12 836 316)">
            epoch read
          </text>
        </g>

        {/* ── Bottom: Backend band ── */}
        <g stroke={STROKE} strokeOpacity="0.55" fill="none">
          <line x1="100" y1="350" x2="100" y2="410" strokeDasharray="3 4" />
          <polygon points="96,402 104,402 100,410" fill={STROKE} fillOpacity="0.55" />
          <text x="110" y="380" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)">
            event watch · indexer cursor
          </text>
        </g>

        <g>
          <rect x="20" y="410" width="870" height="130" fill="var(--bg-2)" stroke={STROKE} />
          <text x="40" y="434" fontFamily={FONT_MONO} fontSize="11" fill="var(--ink-3)" letterSpacing="1.4">
            BACKEND · Fastify + Supabase ledger
          </text>

          {[
            { x: 36, label: 'REST api', sub: '/api/demo-state · /api/agent/:id · /api/snapshot/:id' },
            { x: 250, label: 'chain indexer', sub: 'viem watchEvent · iNFT2 + SnapshotAttestor + AgentController' },
            { x: 510, label: 'snapshot fetcher', sub: 'pulls blob JSON · writes da_verified' },
            { x: 730, label: 'Supabase', sub: 'agents · ticks · snapshots · transfers' },
          ].map((b, i) => (
            <g key={i}>
              <rect x={b.x} y="450" width={i === 0 ? 200 : i === 1 ? 240 : i === 2 ? 200 : 144} height="70" fill="var(--bg)" stroke={STROKE} strokeOpacity="0.45" />
              <text x={b.x + 12} y="474" fontFamily={FONT_DISPLAY} fontSize="13.5" fill="var(--ink)">
                {b.label}
              </text>
              <text x={b.x + 12} y="494" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)">
                {b.sub}
              </text>
              <text x={b.x + 12} y="510" fontFamily={FONT_MONO} fontSize="9" fill="var(--ink-3)" opacity="0.7">
                backend/src/{i === 0 ? 'main.ts' : i === 1 ? 'indexer/chain.ts' : i === 2 ? 'indexer/snapshots.ts' : 'db.ts'}
              </text>
            </g>
          ))}
        </g>

        {/* Backend → 0G Storage arrow (blob fetch) */}
        <g stroke={STROKE} strokeOpacity="0.55" fill="none">
          <path d="M 890 480 C 935 480, 935 230, 910 230" strokeDasharray="3 4" />
          <polygon points="906,226 914,226 910,218" fill={STROKE} fillOpacity="0.55" />
          <text x="920" y="404" fontFamily={FONT_MONO} fontSize="9" fill="var(--ink-3)" transform="rotate(-90 920 404)">
            blob fetch
          </text>
        </g>
      </svg>
      <Caption>Five contracts · one runtime · four 0G primitives · backend indexes from chain + storage</Caption>
    </div>
  );
}

/* ─────────────── Tick pipeline — 4 phases (Decide / Authorize / Snapshot / Sell) ─────────────── */
export function TickPipelineDiagram({ style }: { style?: CSSProperties }) {
  const phases = [
    {
      label: 'DECIDE',
      detail: '0G Compute TEE',
      sub: 'verify_tee · processResponse',
      accent: 'var(--bg-2)',
      ink: 'var(--ink)',
    },
    {
      label: 'AUTHORIZE',
      detail: 'EIP-712 intent',
      sub: 'nonce · expiry · per-trade cap · daily cap · allowlist',
      accent: 'var(--c-1)',
      ink: '#0B0C0A',
    },
    {
      label: 'SNAPSHOT',
      detail: '6h cadence',
      sub: 'ECIES → 0G Storage · DA epoch · SnapshotAttestor.submit',
      accent: 'var(--c-2)',
      ink: '#0B0C0A',
    },
    {
      label: 'SELL',
      detail: 'transferWithReKey',
      sub: 'fetch → decrypt → re-encrypt → upload → flip ownership · 1 tx',
      accent: 'var(--ink)',
      ink: 'var(--bg)',
    },
  ];

  return (
    <div style={style}>
      <svg viewBox="0 0 1080 200" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        <text x="20" y="26" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)" letterSpacing="1.4">
          PER-TICK + LIFETIME PIPELINE · 4 phases · same intent surface
        </text>

        {/* Spine */}
        <line x1="20" y1="110" x2="1060" y2="110" stroke={STROKE} strokeOpacity="0.32" strokeDasharray="3 4" />

        {phases.map((p, i) => {
          const slot = (1040 - 20) / phases.length;
          const x = 20 + i * slot;
          return (
            <g key={i}>
              {/* phase number circle */}
              <circle cx={x + 22} cy="60" r="14" fill="var(--bg)" stroke={STROKE} />
              <text x={x + 22} y="64" textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill="var(--ink)">
                0{i + 1}
              </text>

              {/* box */}
              <rect x={x + 12} y="80" width={slot - 24} height="80" fill={p.accent} stroke={STROKE} />
              <text
                x={x + 28}
                y="104"
                fontFamily={FONT_MONO}
                fontSize="10.5"
                fill={p.ink}
                opacity="0.75"
                letterSpacing="1.3"
              >
                {p.label}
              </text>
              <text x={x + 28} y="128" fontFamily={FONT_DISPLAY} fontSize="14" fill={p.ink}>
                {p.detail}
              </text>
              <text x={x + 28} y="148" fontFamily={FONT_MONO} fontSize="9.5" fill={p.ink} opacity="0.7">
                {p.sub}
              </text>

              {/* arrow to next */}
              {i < phases.length - 1 && (
                <g>
                  <line x1={x + slot - 8} y1="120" x2={x + slot + 4} y2="120" stroke={STROKE} strokeOpacity="0.6" />
                  <polygon
                    points={`${x + slot - 2},116 ${x + slot - 2},124 ${x + slot + 6},120`}
                    fill={STROKE}
                    fillOpacity="0.6"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <Caption>One intent surface for all four phases · same key, same enclave, same audit trail</Caption>
    </div>
  );
}

/* ─────────────── Identity composition (mini visual for title slide) ─────────────── */
export function IdentityCompositionDiagram({ style }: { style?: CSSProperties }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 360 320" style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--ink)' }}>
        {/* outer token (iNFT) */}
        <rect x="20" y="20" width="320" height="280" fill="var(--bg)" stroke={STROKE} strokeWidth="1.5" />
        <text x="34" y="44" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--ink-3)" letterSpacing="1.3">
          iNFT · ERC-7857 · ONE TOKEN
        </text>

        {/* brain */}
        <rect x="34" y="60" width="140" height="62" fill="var(--c-1)" stroke={STROKE} />
        <text x="44" y="80" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" opacity="0.7" letterSpacing="1.2">
          BRAIN
        </text>
        <text x="44" y="100" fontFamily={FONT_DISPLAY} fontSize="13" fill="#0B0C0A">
          encrypted blob
        </text>
        <text x="44" y="116" fontFamily={FONT_MONO} fontSize="9.5" fill="#0B0C0A" opacity="0.7">
          0G Storage
        </text>

        {/* lineage */}
        <rect x="186" y="60" width="140" height="62" fill="var(--c-2)" stroke={STROKE} />
        <text x="196" y="80" fontFamily={FONT_MONO} fontSize="10" fill="#0B0C0A" opacity="0.7" letterSpacing="1.2">
          LINEAGE
        </text>
        <text x="196" y="100" fontFamily={FONT_DISPLAY} fontSize="13" fill="#0B0C0A">
          prev → curr root
        </text>
        <text x="196" y="116" fontFamily={FONT_MONO} fontSize="9.5" fill="#0B0C0A" opacity="0.7">
          0G DA epoch
        </text>

        {/* TBA wallet */}
        <rect x="34" y="140" width="292" height="50" fill="var(--ink)" />
        <text x="44" y="162" fontFamily={FONT_MONO} fontSize="10" fill="var(--bg)" opacity="0.7" letterSpacing="1.2">
          WALLET · ERC-6551 TBA · 0xT8A…F1
        </text>
        <text x="44" y="180" fontFamily={FONT_MONO} fontSize="10.5" fill="var(--bg)">
          holds USDC · RISK · and other iNFTs
        </text>

        {/* nested iNFTs (the squared) */}
        <text x="34" y="216" fontFamily={FONT_MONO} fontSize="10" fill="var(--ink-3)" letterSpacing="1.2">
          THE SQUARED · CHILDREN
        </text>
        {[
          { x: 34, label: '#43 Lark' },
          { x: 134, label: '#44 Tide' },
          { x: 234, label: '#45 Quill' },
        ].map((c, i) => (
          <g key={i}>
            <rect x={c.x} y="226" width="92" height="60" fill="var(--bg-2)" stroke={STROKE} strokeOpacity="0.5" />
            <text x={c.x + 46} y="252" textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="12" fill="var(--ink)">
              iNFT
            </text>
            <text x={c.x + 46} y="270" textAnchor="middle" fontFamily={FONT_MONO} fontSize="9.5" fill="var(--ink-3)">
              {c.label}
            </text>
          </g>
        ))}
      </svg>
      <Caption>One token · brain + lineage + wallet · wallet holds more iNFTs · that’s the squared</Caption>
    </div>
  );
}
