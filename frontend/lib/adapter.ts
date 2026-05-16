// Maps backend DB rows (agents/snapshots/ticks/equity) into the editorial
// design's display model (Helios/Pulse/Ebb/Quill).
//
// The design assumes 4 specific agents; the deployment has manager #2 +
// children #3/#4/#5. Names/colors/descriptions are filled from the
// `metadata.strat` value (momentum/meanRev/marketMaker) or fall back to
// position-in-children order so the page renders even without metadata.

export type DesignAccent = 'ink' | 'tint-1' | 'tint-2' | 'tint-3';

export type DesignAgent = {
  tokenId: number;
  name: string;
  role: 'manager' | 'worker';
  kind: string;
  desc: string;
  accent: DesignAccent;
  weight: number;
  pnlBps: number;
  pnl: number;
  aum: number;
  sharpe: number;
  ticks: number;
  brainRoot: string | null;
  owner: string | null;
  wallet: string | null;
  raw: any;
};

const STRAT_LABELS: Record<string, { kind: string; name: string; desc: string }> = {
  momentum: {
    kind: 'Momentum',
    name: 'Pulse',
    desc: 'Trades EMA(12,26) breakouts with a hard stop. Sized 25–55% per signal.',
  },
  meanRev: {
    kind: 'Mean-Reversion',
    name: 'Ebb',
    desc: 'Fades 2σ deviations off a 90-bar Bollinger band, exits to mid.',
  },
  meanrev: {
    kind: 'Mean-Reversion',
    name: 'Ebb',
    desc: 'Fades 2σ deviations off a 90-bar Bollinger band, exits to mid.',
  },
  marketMaker: {
    kind: 'Market-Making',
    name: 'Quill',
    desc: 'Posts a two-sided 8bp ladder around mid, reprices on imbalance.',
  },
  marketmaker: {
    kind: 'Market-Making',
    name: 'Quill',
    desc: 'Posts a two-sided 8bp ladder around mid, reprices on imbalance.',
  },
};

const FALLBACK_WORKERS = [
  { kind: 'Momentum', name: 'Pulse', desc: 'Trades 60s breakouts of an EMA(12,26) crossover with a hard 1.5% stop.' },
  { kind: 'Mean-Reversion', name: 'Ebb', desc: 'Fades 2σ deviations off a 90-bar Bollinger band, exits to mid.' },
  { kind: 'Market-Making', name: 'Quill', desc: 'Posts a two-sided 8bp ladder around mid, reprices on imbalance.' },
];

const ACCENTS: DesignAccent[] = ['tint-1', 'tint-2', 'tint-3'];

const MANAGER_LABEL = {
  kind: 'Fund-of-Agents',
  name: 'Helios',
  desc: 'Allocates capital across momentum, mean-reversion and market-making children. Rebalances on attested child Sharpe.',
};

function pnlFromSnapshots(snaps: any[] | undefined | null): { pnlBps: number; pnl: number; sharpe: number } {
  if (!snaps || snaps.length === 0) return { pnlBps: 0, pnl: 0, sharpe: 0 };
  const sorted = [...snaps].sort((a, b) => Number(a.ts) - Number(b.ts));
  const latest = sorted[sorted.length - 1];
  const pnlWei = BigInt(latest.realized_pnl ?? '0');
  const pnl = Number(pnlWei) / 1e18;
  // The design's pnlBps is the % return on AUM. We don't have AUM on chain;
  // fall back to a notional 5000 USD per worker / 10000 USD per manager scale.
  const aumNotional = 5000;
  const pnlBps = aumNotional > 0 ? Math.round((pnl / aumNotional) * 10000) : 0;
  const sharpe = latest.sharpe_e6 ? Number(latest.sharpe_e6) / 1e6 : 0;
  return { pnlBps, pnl, sharpe };
}

export function mapManager(row: any, snaps: any[] | undefined, ticksCount: number): DesignAgent {
  const tokenId = Number(row?.token_id ?? 0);
  const meta = row?.metadata ?? {};
  const { pnlBps, pnl, sharpe } = pnlFromSnapshots(snaps);
  return {
    tokenId,
    name: meta.name || MANAGER_LABEL.name,
    role: 'manager',
    kind: MANAGER_LABEL.kind,
    desc: MANAGER_LABEL.desc,
    accent: 'ink',
    weight: 1,
    pnlBps,
    pnl,
    aum: 10000,
    sharpe,
    ticks: ticksCount,
    brainRoot: row?.brain_root ?? null,
    owner: row?.owner ?? null,
    wallet: meta.wallet ?? null,
    raw: row,
  };
}

export function mapWorker(row: any, idx: number, snaps: any[] | undefined, ticksCount: number): DesignAgent {
  const tokenId = Number(row?.token_id ?? 0);
  const meta = row?.metadata ?? {};
  const strat = (meta.strat ?? meta.strategy ?? '').toString();
  const label =
    STRAT_LABELS[strat] ?? STRAT_LABELS[strat.toLowerCase()] ?? FALLBACK_WORKERS[idx % FALLBACK_WORKERS.length];
  const { pnlBps, pnl, sharpe } = pnlFromSnapshots(snaps);
  return {
    tokenId,
    name: meta.name || label.name,
    role: 'worker',
    kind: label.kind,
    desc: label.desc,
    accent: ACCENTS[idx % ACCENTS.length],
    weight: 1 / 3,
    pnlBps,
    pnl,
    aum: 5000,
    sharpe,
    ticks: ticksCount,
    brainRoot: row?.brain_root ?? null,
    owner: row?.owner ?? null,
    wallet: meta.wallet ?? null,
    raw: row,
  };
}

export function aggregate(manager: DesignAgent | null, workers: DesignAgent[]) {
  const pnl = workers.reduce((s, w) => s + w.pnl, 0) + (manager?.pnl ?? 0);
  const aum = (manager?.aum ?? 0) + workers.reduce((s, w) => s + w.aum, 0);
  const sharpe = manager?.sharpe ?? workers[0]?.sharpe ?? 0;
  const ticks = manager?.ticks ?? Math.max(0, ...workers.map((w) => w.ticks));
  const pnlBps = aum > 0 ? Math.round((pnl / aum) * 10000) : 0;
  return { pnl, aum, sharpe, ticks, pnlBps };
}

// Build an equity series for the design chart.
// Prefer real equity rows (wei, big numeric strings); fall back to snapshot
// realized_pnl. Always normalised to a unitless series starting at 1.0 so the
// chart shape is comparable regardless of scale.
export function buildEquitySeries(equityRows: any[] | null, snaps: any[] | null): number[] {
  if (equityRows && equityRows.length > 1) {
    const sorted = [...equityRows].sort((a, b) => Number(a.ts) - Number(b.ts));
    const first = Number(BigInt(sorted[0].value)) || 1;
    return sorted.map((r) => Number(BigInt(r.value)) / first);
  }
  if (snaps && snaps.length > 0) {
    const sorted = [...snaps].sort((a, b) => Number(a.ts) - Number(b.ts));
    return sorted.map((s) => 1 + Number(BigInt(s.realized_pnl ?? '0')) / 1e18 / 5000);
  }
  return [];
}

export function shortAddr(s: string | null | undefined, head = 6, tail = 4): string {
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
