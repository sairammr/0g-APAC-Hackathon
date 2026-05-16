'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAgent, getDemoState, getEquity, getTicks } from '@/lib/api';
import { mapManager, mapWorker, buildEquitySeries, shortAddr, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Corner, Chip, Button, PnlDisplay, KV, Stat, Footer } from '@/components/design/primitives';
import { EquityChart } from '@/components/design/charts';
import { addrUrl, txUrl, storageUrl, short } from '@/lib/explorer';

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [agent, setAgent] = useState<DesignAgent | null>(null);
  const [agentRaw, setAgentRaw] = useState<any | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [ticks, setTicks] = useState<any[]>([]);
  const [equity, setEquity] = useState<any[]>([]);
  const [siblings, setSiblings] = useState<DesignAgent[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, t, e, demo] = await Promise.all([
          getAgent(id),
          getTicks(id),
          getEquity(id),
          getDemoState(),
        ]);
        if (cancelled) return;
        const role = a?.agent?.role;
        const tickCount = (t ?? []).length;
        const designAgent =
          role === 'manager'
            ? mapManager(a.agent, a.snapshots, tickCount)
            : mapWorker(
                a.agent,
                Math.max(0, (demo?.children ?? []).findIndex((c: any) => String(c.token_id) === String(id))),
                a.snapshots,
                tickCount
              );
        setAgent(designAgent);
        setAgentRaw(a.agent);
        setSnapshots(a.snapshots ?? []);
        setTicks(t ?? []);
        setEquity(e ?? []);
        if (Array.isArray(demo?.children)) {
          setSiblings(demo.children.map((row: any, i: number) => mapWorker(row, i, [], 0)));
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const eqSeries = useMemo(() => buildEquitySeries(equity, snapshots), [equity, snapshots]);

  if (!agent || !agentRaw) {
    return (
      <div className="page">
        <div className="container" style={{ padding: 48 }}>
          <p className="mono small">loading agent #{id}…</p>
        </div>
      </div>
    );
  }

  const isManager = agent.role === 'manager';
  const wallet = agentRaw?.metadata?.wallet ?? agentRaw?.wallet ?? null;
  const accentClass = agent.accent === 'ink' ? 'ink' : agent.accent;

  return (
    <div className="page">
      <div className="subnav">
        <a className="on">Overview</a>
        <a onClick={() => router.push('/audit')}>Lineage</a>
        {snapshots[0] ? (
          <a onClick={() => router.push(`/agent/${agent.tokenId}/snapshot/${snapshots[0].id}`)}>
            Latest snapshot
          </a>
        ) : null}
        <a onClick={() => router.push(`/agent/${agent.tokenId}/buy`)}>Buy</a>
        <div
          style={{
            marginLeft: 'auto',
            padding: '12px 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {isManager ? `MANAGER · #${agent.tokenId}` : `WORKER · #${agent.tokenId}`}
        </div>
      </div>

      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-7" style={{ padding: 40 }}>
          <Eyebrow>
            {agent.kind} · iNFT #{agent.tokenId}
          </Eyebrow>
          <h1 className="display-l cursive" style={{ margin: '18px 0 18px' }}>
            {agent.name}
          </h1>
          <p className="body-l" style={{ maxWidth: '56ch' }}>
            {agent.desc}
          </p>
          <div style={{ marginTop: 36 }}>
            <KV
              pairs={[
                [
                  'Owner',
                  agent.owner ? (
                    <a className="link" href={addrUrl(agent.owner) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(agent.owner, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                [
                  'Token-bound wallet',
                  wallet ? (
                    <a className="link" href={addrUrl(wallet) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(wallet, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                [
                  'Brain blob (0G Storage)',
                  agent.brainRoot && storageUrl(agent.brainRoot) ? (
                    <a className="link" href={storageUrl(agent.brainRoot) || '#'} target="_blank" rel="noreferrer">
                      {shortAddr(agent.brainRoot, 10, 8)}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--ink-3)' }}>{agent.brainRoot ?? '—'}</span>
                  ),
                ],
                ['Parent', isManager ? '— (root)' : `iNFT #${siblings[0]?.tokenId ?? '?'}`],
                ['Weight', isManager ? '1.00' : `${(agent.weight * 100).toFixed(0)}%`],
                ['Ticks indexed', agent.ticks.toLocaleString()],
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            <Button variant="solid" onClick={() => router.push(`/agent/${agent.tokenId}/buy`)}>
              Buy iNFT #{agent.tokenId}
            </Button>
            <Button onClick={() => router.push('/audit')}>Audit lineage</Button>
          </div>
        </div>

        <div
          className={'cell span-5 ' + accentClass}
          style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <Corner>30D · LIVE</Corner>
            <Eyebrow style={{ color: agent.accent === 'ink' ? 'rgba(236,238,233,.6)' : 'rgba(11,12,10,.65)' }}>
              Return
            </Eyebrow>
          </div>
          <div>
            <PnlDisplay bps={agent.pnlBps} value={agent.pnl} size="xl" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 14,
                marginTop: 28,
                paddingTop: 24,
                borderTop:
                  agent.accent === 'ink' ? '1px solid rgba(236,238,233,.25)' : '1px solid rgba(11,12,10,.25)',
              }}
            >
              <Stat label="Sharpe" value={agent.sharpe.toFixed(2)} />
              <Stat label="AUM" value={`$${agent.aum.toLocaleString()}`} />
              <Stat label="Cadence" value="60s" />
            </div>
          </div>
        </div>
      </div>

      <div className="bento">
        <div className="cell span-12" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow dot>Equity · all available data</Eyebrow>
            <Chip tone="ok">{equity.length} samples</Chip>
          </div>
          <div style={{ height: 320, padding: '0 0 12px' }}>
            <EquityChart data={eqSeries} height={320} accent={agent.accent === 'ink' ? 'var(--ink)' : 'var(--c-1)'} />
          </div>
        </div>
      </div>

      <div className="bento">
        <div className="cell span-8" style={{ padding: 0 }}>
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
              <Eyebrow dot>Recent decisions</Eyebrow>
              <p className="mono small" style={{ marginTop: 6 }}>
                Last {Math.min(22, ticks.length)} of {agent.ticks.toLocaleString()} · every row carries a TEE attestation
              </p>
            </div>
            <Chip tone="ok">{ticks.filter((t) => t.tee_verified).length}/{ticks.length} verified</Chip>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th style={{ textAlign: 'right' }}>Size</th>
                <th>TEE</th>
                <th>Tx</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {ticks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mono" style={{ color: 'var(--ink-3)', padding: '24px 16px' }}>
                    no ticks indexed yet
                  </td>
                </tr>
              ) : (
                ticks.slice(0, 22).map((t, i) => {
                  const tu = txUrl(t.tx_hash);
                  const tone = t.tee_verified === true ? 'ok' : t.tee_verified === false ? 'fail' : 'warn';
                  return (
                    <tr key={i}>
                      <td className="mono">
                        {new Date(Number(t.ts) * 1000).toLocaleTimeString('en-US', { hour12: false })}
                      </td>
                      <td className="mono">{t.action ?? '—'}</td>
                      <td className="mono num" style={{ textAlign: 'right' }}>
                        {t.size_bps != null ? `${(Number(t.size_bps) / 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <Chip tone={tone}>{t.tee_verified === true ? '✓' : t.tee_verified === false ? '!' : '—'}</Chip>
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

        <div className="cell span-4" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule)' }}>
            <Eyebrow dot>Snapshot lineage</Eyebrow>
            <p className="mono small" style={{ marginTop: 6 }}>
              {snapshots.length} on-chain anchors · prev → curr verified
            </p>
          </div>
          <div>
            {snapshots.length === 0 ? (
              <div style={{ padding: '14px 24px' }} className="mono small">
                no snapshots yet
              </div>
            ) : (
              snapshots.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/agent/${agent.tokenId}/snapshot/${s.id}`)}
                  style={{ padding: '14px 24px', borderBottom: '1px solid var(--rule-hair)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--ink)' }}>
                      S-{String(s.id).padStart(3, '0')}
                    </p>
                    <p className="mono small" style={{ margin: 0 }}>
                      {new Date(Number(s.ts) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                      {new Date(Number(s.ts) * 1000).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </p>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="mono small" style={{ color: 'var(--ink-3)' }}>
                      {s.prev_brain_root ? shortAddr(s.prev_brain_root, 8, 4) : '—'}
                    </span>
                    <span className="mono small">→</span>
                    <span className="mono small" style={{ color: 'var(--ink)' }}>
                      {s.curr_brain_root ? shortAddr(s.curr_brain_root, 8, 4) : '—'}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span className="mono small" style={{ color: 'var(--ink-3)' }}>
                      DA #{s.da_epoch ?? '—'}
                    </span>
                    <Chip tone={s.da_verified ? 'ok' : 'warn'}>
                      {s.da_verified ? 'VERIFIED' : 'PENDING'}
                    </Chip>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
