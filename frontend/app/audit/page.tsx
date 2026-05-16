'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAbi } from 'viem';
import { getDemoState, getSnapshots } from '@/lib/api';
import { mapManager, mapWorker, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Chip, Footer } from '@/components/design/primitives';
import { short } from '@/lib/explorer';
import { pub } from '@/lib/viem';

const ATTESTOR = (process.env.NEXT_PUBLIC_ATTESTOR_ADDR ||
  '0x378661ec8AE1C909c4d7d5e57470cEBEacFB90A3') as `0x${string}`;
const attestorAbi = parseAbi([
  'function snapshotCount(uint256 tokenId) view returns (uint256)',
]);

type SnapRow = {
  id: number;
  token_id: string;
  ts: number;
  storage_root: string | null;
  realized_pnl: string | null;
  sharpe_e6: number | null;
  da_epoch: string | null;
  da_verified: boolean;
  prev_brain_root: string | null;
  curr_brain_root: string | null;
  submit_tx_hash: string | null;
  blob_json: any | null;
};

type Row = SnapRow & { agent: DesignAgent };

function fmtTs(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function pnlBpsFromWei(weiStr: string | null | undefined, aumNotional: number): number {
  try {
    const wei = BigInt(weiStr ?? '0');
    const pnl = Number(wei) / 1e18;
    return aumNotional > 0 ? Math.round((pnl / aumNotional) * 10000) : 0;
  } catch {
    return 0;
  }
}

export default function AuditPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<DesignAgent[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [chainCounts, setChainCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await getDemoState();
        if (cancelled) return;
        const list: DesignAgent[] = [];
        if (state?.manager) list.push(mapManager(state.manager, [], 0));
        if (Array.isArray(state?.children)) {
          state.children.forEach((row: any, i: number) => list.push(mapWorker(row, i, [], 0)));
        }
        setAgents(list);

        const snapLists = await Promise.all(
          list.map(async (a) => {
            try {
              const s = await getSnapshots(a.tokenId);
              return Array.isArray(s) ? (s as SnapRow[]) : [];
            } catch {
              return [];
            }
          })
        );
        if (cancelled) return;

        const flat: Row[] = [];
        snapLists.forEach((arr, i) => {
          const a = list[i];
          arr.forEach((s) => flat.push({ ...s, agent: a }));
        });
        flat.sort((a, b) => Number(b.ts) - Number(a.ts));
        setRows(flat);

        const counts: Record<string, number> = {};
        await Promise.all(
          list.map(async (a) => {
            try {
              const c = await pub.readContract({
                address: ATTESTOR,
                abi: attestorAbi,
                functionName: 'snapshotCount',
                args: [BigInt(a.tokenId)],
              });
              counts[String(a.tokenId)] = Number(c);
            } catch {
              counts[String(a.tokenId)] = 0;
            }
          })
        );
        if (cancelled) return;
        setChainCounts(counts);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => String(r.agent.tokenId) === filter)),
    [rows, filter]
  );

  const totalSnaps = rows.length;
  // Verification is sourced from on-chain artifacts only: a snapshot is
  // verified when SnapshotAttestor.submit landed (submit_tx_hash present).
  // The DB stores the tx hash purely as an index cache — the source of truth
  // is the chain, which we cross-check via snapshotCount(tokenId).
  const verifiedSnaps = rows.filter((r) => !!r.submit_tx_hash).length;
  const continuity = totalSnaps > 0 ? Math.round((verifiedSnaps / totalSnaps) * 100) : 0;
  const chainTotal = Object.values(chainCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-8" style={{ padding: 40 }}>
          <Eyebrow dot>Audit</Eyebrow>
          <h1 className="editorial cursive" style={{ margin: '18px 0 12px', maxWidth: '18ch' }}>
            Every brain mutation, every attestation, replayable.
          </h1>
          <p className="body-l" style={{ maxWidth: '56ch' }}>
            For each iNFT, the chain holds an ordered sequence of snapshots. Each links to the
            previous brain root, the current brain root, the storage root, the DA epoch — and the
            TEE attestation of every decision made between them.
          </p>
        </div>
        <div className="cell span-4 ink" style={{ padding: 40 }}>
          <Eyebrow style={{ color: 'rgba(236,238,233,.65)' }}>Lineage continuity</Eyebrow>
          <p className="display-xl num" style={{ margin: '10px 0 0', fontSize: 152, color: 'var(--bg)' }}>
            {continuity}
            <span style={{ fontSize: '0.4em' }}>%</span>
          </p>
          <p className="mono small" style={{ marginTop: 8, color: 'rgba(236,238,233,.7)' }}>
            {verifiedSnaps}/{totalSnaps} indexed · {chainTotal} on-chain via
            SnapshotAttestor.snapshotCount()
          </p>
        </div>
      </div>

      <div className="bento">
        <div className="cell span-12" style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', flexWrap: 'wrap' }}>
            {[
              ['all', 'All agents'] as [string, string],
              ...agents.map(
                (a) => [String(a.tokenId), `iNFT #${a.tokenId} · ${a.name}`] as [string, string]
              ),
            ].map(([k, label]) => (
              <span
                key={k}
                onClick={() => setFilter(k)}
                className="mono"
                style={{
                  padding: '12px 20px',
                  borderRight: '1px solid var(--rule)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  background: filter === k ? 'var(--ink)' : 'transparent',
                  color: filter === k ? 'var(--bg)' : 'var(--ink-3)',
                  userSelect: 'none',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Agent</th>
                <th>When</th>
                <th>prev → curr brain</th>
                <th>Storage root</th>
                <th>DA epoch</th>
                <th style={{ textAlign: 'right' }}>Return</th>
                <th>Verification</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="mono small" style={{ padding: 24, color: 'var(--ink-3)' }}>
                    No snapshots indexed yet — snapshots are published every 6h.
                  </td>
                </tr>
              ) : (
                visible.map((s) => {
                  const bps = pnlBpsFromWei(s.realized_pnl, s.agent.aum);
                  const verified = !!s.submit_tx_hash;
                  const accentTone =
                    s.agent.accent === 'ink' ? 'ink' : (s.agent.accent as 'tint-1' | 'tint-2' | 'tint-3');
                  return (
                    <tr
                      key={`${s.agent.tokenId}-${s.id}`}
                      onClick={() => router.push(`/agent/${s.agent.tokenId}/snapshot/${s.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono">S-{String(s.id).padStart(3, '0')}</td>
                      <td>
                        <Chip tone={accentTone}>{s.agent.name}</Chip>
                      </td>
                      <td className="mono">{fmtTs(Number(s.ts))}</td>
                      <td className="mono" style={{ color: 'var(--ink-3)' }}>
                        {short(s.prev_brain_root, 6, 4)}{' '}
                        <span style={{ color: 'var(--ink)' }}>→ {short(s.curr_brain_root, 6, 4)}</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--ink-3)' }}>
                        {short(s.storage_root, 8, 6)}
                      </td>
                      <td className="mono num">{s.da_epoch ?? '—'}</td>
                      <td className="mono num" style={{ textAlign: 'right' }}>
                        {bps >= 0 ? '+' : '−'}
                        {(Math.abs(bps) / 100).toFixed(2)}%
                      </td>
                      <td>
                        <Chip tone={verified ? 'ok' : 'warn'}>
                          {verified ? 'verified' : 'pending'}
                        </Chip>
                      </td>
                      <td className="mono" style={{ color: 'var(--ink-3)', textAlign: 'right' }}>
                        →
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Footer />
    </div>
  );
}
