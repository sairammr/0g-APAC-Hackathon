'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemoState, getContracts, getSnapshots, getTicks, getEquity } from '@/lib/api';
import {
  mapManager,
  mapWorker,
  aggregate,
  buildEquitySeries,
  shortAddr,
  type DesignAgent,
} from '@/lib/adapter';
import { Eyebrow, Chip, PnlDisplay, KV, Footer } from '@/components/design/primitives';
import { EquityChart, Spark } from '@/components/design/charts';
import { RecursionTree } from '@/components/design/RecursionTree';
import { addrUrl, txUrl, storageUrl, short } from '@/lib/explorer';

type WorkerBundle = {
  agent: DesignAgent;
  snaps: any[];
  ticks: any[];
  equity: any[];
};

export default function DemoPage() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [manager, setManager] = useState<DesignAgent | null>(null);
  const [workers, setWorkers] = useState<WorkerBundle[]>([]);
  const [managerSnaps, setManagerSnaps] = useState<any[]>([]);
  const [managerEquity, setManagerEquity] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [state, c] = await Promise.all([getDemoState(), getContracts()]);
        if (cancelled || !state) return;
        setContracts(c);

        if (state.manager) {
          const [snaps, ticks, equity] = await Promise.all([
            getSnapshots(state.manager.token_id),
            getTicks(state.manager.token_id),
            getEquity(state.manager.token_id),
          ]);
          if (cancelled) return;
          setManager(mapManager(state.manager, snaps, (ticks ?? []).length));
          setManagerSnaps(snaps ?? []);
          setManagerEquity(equity ?? []);
        }

        if (Array.isArray(state.children)) {
          const bundles = await Promise.all(
            state.children.map(async (row: any, i: number) => {
              const [snaps, ticks, equity] = await Promise.all([
                getSnapshots(row.token_id),
                getTicks(row.token_id),
                getEquity(row.token_id),
              ]);
              return {
                agent: mapWorker(row, i, snaps, (ticks ?? []).length),
                snaps: snaps ?? [],
                ticks: ticks ?? [],
                equity: equity ?? [],
              } as WorkerBundle;
            })
          );
          if (cancelled) return;
          setWorkers(bundles);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const designWorkers = workers.map((w) => w.agent);
  const agg = aggregate(manager, designWorkers);
  const heroEquity = useMemo(() => buildEquitySeries(managerEquity, managerSnaps), [managerEquity, managerSnaps]);

  const stream = useMemo(() => {
    const all = workers.flatMap((w) => w.ticks.map((t) => ({ ...t, agent: w.agent })));
    all.sort((a, b) => Number(b.ts) - Number(a.ts));
    return all.slice(0, 18);
  }, [workers]);

  const nextSnapshot = useMemo(() => {
    const cycleMs = 6 * 60 * 60 * 1000;
    const epoch = Math.floor(now.getTime() / cycleMs) * cycleMs;
    return new Date(epoch + cycleMs);
  }, [now]);

  function fmtCountdown(target: Date) {
    const diff = Math.max(0, target.getTime() - now.getTime());
    const h = Math.floor(diff / 3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const verifiedCount = workers.reduce(
    (s, w) => s + w.ticks.filter((t) => t.tee_verified === true).length,
    0
  );
  const totalTicks = workers.reduce((s, w) => s + w.ticks.length, 0);
  const teeShare = totalTicks > 0 ? ((verifiedCount / totalTicks) * 100).toFixed(2) : '—';
  const latestDaEpoch = managerSnaps[0]?.da_epoch ?? '—';

  return (
    <div className="page">
      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-7" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '32px 40px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Eyebrow dot>Subtree · live</Eyebrow>
              <p className="mono small" style={{ marginTop: 8 }}>
                {manager?.name ?? 'Manager'} + {workers.length} workers · 30-day window
              </p>
            </div>
            <Chip tone="ok">{now.toLocaleTimeString('en-US', { hour12: false })} UTC</Chip>
          </div>
          <div style={{ padding: '12px 40px 18px' }}>
            <PnlDisplay bps={agg.pnlBps} value={agg.pnl} size="xl" />
          </div>
          <div style={{ flex: 1, minHeight: 220, padding: '0 12px 24px' }}>
            <EquityChart data={heroEquity} height={240} accent="var(--c-1)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--rule)' }}>
            {[
              ['AUM', `$${agg.aum.toLocaleString()}`],
              ['Sharpe', agg.sharpe.toFixed(2)],
              ['Ticks', agg.ticks.toLocaleString()],
              ['Snapshots', String(managerSnaps.length)],
            ].map(([k, v], i) => (
              <div key={i} style={{ padding: '18px 24px', borderRight: i < 3 ? '1px solid var(--rule)' : 0 }}>
                <p className="mono small" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {k}
                </p>
                <p className="display-s num" style={{ margin: '6px 0 0', fontSize: 28 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="cell span-5" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="cell tint-2" style={{ borderRight: 0, borderBottom: '1px solid var(--rule)', padding: 32 }}>
            <Eyebrow style={{ color: 'rgba(11,12,10,.65)' }}>Next snapshot</Eyebrow>
            <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 84 }}>{fmtCountdown(nextSnapshot)}</p>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p className="mono small" style={{ margin: 0, color: 'rgba(11,12,10,.7)' }}>
                anchored on-chain<br />every 6h
              </p>
              <p className="mono small" style={{ margin: 0, color: 'rgba(11,12,10,.7)' }}>
                DA epoch<br />
                <span style={{ color: '#0B0C0A', fontWeight: 500 }}>{String(latestDaEpoch)}</span>
              </p>
            </div>
          </div>
          <div style={{ padding: 32, flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Eyebrow>Recursion</Eyebrow>
            <div style={{ flex: 1 }}>
              {manager ? (
                <RecursionTree
                  manager={manager}
                  workers={designWorkers}
                  onSelect={(tid) => router.push(`/agent/${tid}`)}
                  compact
                />
              ) : (
                <div className="mono small">no manager indexed yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bento">
        {workers.length === 0 ? (
          <div className="cell span-12" style={{ padding: 32 }}>
            <p className="mono small">no worker agents indexed yet</p>
          </div>
        ) : (
          workers.map((w) => {
            const eq = buildEquitySeries(w.equity, w.snaps);
            return (
              <div
                key={w.agent.tokenId}
                className={'cell span-4 ' + w.agent.accent}
                style={{ padding: 28, cursor: 'pointer' }}
                onClick={() => router.push(`/agent/${w.agent.tokenId}`)}
              >
                <span className="corner">iNFT #{w.agent.tokenId}</span>
                <Eyebrow style={{ color: 'rgba(11,12,10,.65)' }}>{w.agent.kind}</Eyebrow>
                <p className="display-m" style={{ margin: '10px 0 4px', letterSpacing: '-0.025em' }}>
                  {w.agent.name}
                </p>
                <PnlDisplay bps={w.agent.pnlBps} value={w.agent.pnl} size="m" showCurrency={false} />
                <div style={{ height: 56, margin: '16px 0 12px', color: '#0B0C0A' }}>
                  {eq.length > 1 ? <Spark data={eq} /> : <div className="mono small" style={{ color: 'rgba(11,12,10,.6)' }}>no data yet</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(11,12,10,.25)', paddingTop: 12 }}>
                  <span className="mono small" style={{ color: 'rgba(11,12,10,.7)' }}>
                    Sharpe&nbsp;<span style={{ color: '#0B0C0A' }}>{w.agent.sharpe.toFixed(2)}</span>
                  </span>
                  <span className="mono small" style={{ color: 'rgba(11,12,10,.7)' }}>
                    Ticks&nbsp;<span style={{ color: '#0B0C0A' }}>{w.agent.ticks}</span>
                  </span>
                  <span className="mono small">→</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bento">
        <div className="cell span-9" style={{ padding: 0 }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--rule)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Eyebrow dot>Live tick stream</Eyebrow>
              <p className="mono small" style={{ marginTop: 6 }}>
                One row per <span style={{ color: 'var(--ink)' }}>decide()</span> · 60s cadence · TEE attested
              </p>
            </div>
            <Chip tone="ok">{totalTicks} indexed</Chip>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Decision</th>
                <th style={{ textAlign: 'right' }}>Size</th>
                <th>TEE</th>
                <th>Tx</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {stream.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mono" style={{ color: 'var(--ink-3)', padding: '24px 16px' }}>
                    waiting for runtime to emit ticks…
                  </td>
                </tr>
              ) : (
                stream.map((t, i) => {
                  const tu = txUrl(t.tx_hash);
                  const tone = t.tee_verified === true ? 'ok' : t.tee_verified === false ? 'fail' : 'warn';
                  const label = t.tee_verified === true ? 'TEE ✓' : t.tee_verified === false ? 'UNVERIFIED' : '—';
                  return (
                    <tr key={i}>
                      <td className="mono">
                        {new Date(Number(t.ts) * 1000).toLocaleTimeString('en-US', { hour12: false })}
                      </td>
                      <td>
                        <Chip tone={t.agent.accent as any}>{t.agent.name}</Chip>
                      </td>
                      <td className="mono">{t.action ?? '—'}</td>
                      <td className="mono num" style={{ textAlign: 'right' }}>
                        {t.size_bps != null ? `${(Number(t.size_bps) / 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <Chip tone={tone}>{label}</Chip>
                      </td>
                      <td className="mono">
                        {tu ? (
                          <a className="link" href={tu} target="_blank" rel="noreferrer">
                            {short(t.tx_hash)}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--ink-3)' }}>—</span>
                        )}
                      </td>
                      <td className="mono" style={{ color: 'var(--ink-3)' }}>
                        {t.chat_id ? short(t.chat_id, 8, 4) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="cell span-3" style={{ padding: 0 }}>
          <div style={{ padding: 24, borderBottom: '1px solid var(--rule)' }}>
            <Eyebrow>Chain</Eyebrow>
            <p className="display-s num" style={{ margin: '10px 0 0', fontSize: 24 }}>
              {contracts?.chainId ?? 16602}
            </p>
            <p className="mono small" style={{ marginTop: 4 }}>0G Galileo · testnet</p>
          </div>
          <div style={{ padding: 24, borderBottom: '1px solid var(--rule)' }}>
            <Eyebrow>TEE share</Eyebrow>
            <p className="display-s num" style={{ margin: '10px 0 0', fontSize: 24 }}>{teeShare}%</p>
            <p className="mono small" style={{ marginTop: 4 }}>last {totalTicks} ticks</p>
          </div>
          <div style={{ padding: 24, borderBottom: '1px solid var(--rule)' }}>
            <Eyebrow>Snapshots</Eyebrow>
            <p className="display-s num" style={{ margin: '10px 0 0', fontSize: 24 }}>{managerSnaps.length}</p>
            <p className="mono small" style={{ marginTop: 4 }}>manager · prev → curr verified</p>
          </div>
          <div style={{ padding: 24 }}>
            <Eyebrow>Contracts</Eyebrow>
            <div style={{ marginTop: 10 }}>
              <KV
                pairs={[
                  ['iNFT²', contracts?.iNFT2 ? (
                    <a className="link" href={addrUrl(contracts.iNFT2) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(contracts.iNFT2)}
                    </a>
                  ) : '—'],
                  ['Controller', contracts?.AgentController ? (
                    <a className="link" href={addrUrl(contracts.AgentController) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(contracts.AgentController)}
                    </a>
                  ) : '—'],
                  ['Attestor', contracts?.SnapshotAttestor ? (
                    <a className="link" href={addrUrl(contracts.SnapshotAttestor) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(contracts.SnapshotAttestor)}
                    </a>
                  ) : '—'],
                  ['Brain blob', manager?.brainRoot && storageUrl(manager.brainRoot) ? (
                    <a className="link" href={storageUrl(manager.brainRoot) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(manager.brainRoot)}
                    </a>
                  ) : '—'],
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <Footer daEpoch={typeof latestDaEpoch === 'string' ? Number(latestDaEpoch) || undefined : latestDaEpoch} />
    </div>
  );
}
