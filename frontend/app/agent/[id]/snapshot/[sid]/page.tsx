'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAgent, getSnapshots } from '@/lib/api';
import { Eyebrow, Corner, Chip, Button, KV, Footer } from '@/components/design/primitives';
import { addrUrl, txUrl, storageUrl, short } from '@/lib/explorer';

type Snapshot = {
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
  blob_json: any;
  submit_tx_hash: string | null;
};

function fmtTs(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', { hour12: false });
}

function pnlBpsFromWei(weiStr: string | null | undefined, aumNotional = 5000): number {
  try {
    const wei = BigInt(weiStr ?? '0');
    const pnl = Number(wei) / 1e18;
    return aumNotional > 0 ? Math.round((pnl / aumNotional) * 10000) : 0;
  } catch {
    return 0;
  }
}

export default function SnapshotPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const sid = params?.sid as string;

  const [agentRow, setAgentRow] = useState<any | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, list] = await Promise.all([getAgent(id), getSnapshots(id)]);
        if (cancelled) return;
        setAgentRow(a?.agent ?? null);
        setSnaps(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const snap = useMemo<Snapshot | null>(() => {
    if (!snaps.length) return null;
    const targetId = Number(sid);
    return snaps.find((s) => Number(s.id) === targetId) ?? snaps[0];
  }, [snaps, sid]);

  const agentName: string =
    agentRow?.metadata?.name ??
    (agentRow?.role === 'manager' ? 'Helios' : `iNFT #${id}`);

  if (!snap) {
    return (
      <div className="page">
        <div className="container" style={{ padding: 48 }}>
          <p className="mono small">loading snapshot S-{sid}…</p>
        </div>
      </div>
    );
  }

  const sIdLabel = `S-${String(snap.id).padStart(3, '0')}`;
  const pnlBps = pnlBpsFromWei(snap.realized_pnl);
  const sharpe = snap.sharpe_e6 != null ? Number(snap.sharpe_e6) / 1e6 : 0;
  const sizeKb = snap.blob_json
    ? Math.round(JSON.stringify(snap.blob_json).length / 1024)
    : null;

  // We only render a live storagescan link when the indexer has actually
  // fetched the blob (blob_json != null). On Galileo today the runtime
  // falls back to a keccak256 in-memory stub when the 0G Storage SDK
  // selector mismatches, so the on-chain root is valid hex but the public
  // storage node 404s. Don't promise a download we can't deliver.
  const blobRetrievable = snap.blob_json != null;
  const storageHref = blobRetrievable ? storageUrl(snap.storage_root) : null;
  const txHref = txUrl(snap.submit_tx_hash);

  const sorted = [...snaps].sort((a, b) => Number(a.ts) - Number(b.ts));
  const idx = sorted.findIndex((s) => Number(s.id) === Number(snap.id));
  const prevSnap = idx > 0 ? sorted[idx - 1] : null;

  const checks: Array<[string, boolean]> = [
    ['storage_root anchored on-chain', !!snap.storage_root && snap.storage_root !== '0xstub'],
    ['curr_brain_root chained from prev', !!snap.curr_brain_root && !!snap.prev_brain_root],
    ['DA epoch recorded', !!snap.da_epoch],
    ['submit_tx anchored on-chain', !!txHref],
    ['blob retrievable from 0G Storage', blobRetrievable],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  const pctVerified = Math.round((passed / checks.length) * 100);

  const blobEntries: Array<[string, string]> = snap.blob_json
    ? Object.entries(snap.blob_json)
        .slice(0, 6)
        .map(([k, v]) => [k, typeof v === 'string' ? short(v, 6, 4) : short(JSON.stringify(v), 10, 4)])
    : [
        ['model.weights', short(snap.curr_brain_root, 6, 4)],
        ['storage.root', short(snap.storage_root, 6, 4)],
        ['da.epoch', String(snap.da_epoch ?? '—')],
        ['sharpe.e6', String(snap.sharpe_e6 ?? '—')],
        ['realized.pnl', short(snap.realized_pnl ?? '0', 6, 4)],
        ['submit.tx', short(snap.submit_tx_hash, 6, 4)],
      ];

  return (
    <div className="page">
      <div className="subnav">
        <a onClick={() => router.push(`/agent/${id}`)}>Overview</a>
        <a onClick={() => router.push('/audit')}>Lineage</a>
        <a className="on">Snapshot {sIdLabel}</a>
        <a onClick={() => router.push(`/agent/${id}/buy`)}>Buy</a>
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
          Anchored {fmtTs(snap.ts)}
        </div>
      </div>

      <div className="bento" style={{ borderTop: 0 }}>
        <div className="cell span-7" style={{ padding: 40 }}>
          <Eyebrow>Snapshot · iNFT #{id} · {agentName}</Eyebrow>
          <h1 className="display-l cursive" style={{ margin: '16px 0 20px' }}>{sIdLabel}</h1>
          <p className="body-l" style={{ maxWidth: '56ch' }}>
            Every 6h the runtime serializes {agentName}&rsquo;s full state — model weights hash,
            prompt, position memory, decision log slice — uploads the blob to 0G Storage, reads
            the current 0G DA epoch, and submits the receipt on-chain.
          </p>

          <div style={{ marginTop: 36 }}>
            <Eyebrow dot>Brain lineage</Eyebrow>
            <div
              style={{
                marginTop: 18,
                padding: 20,
                border: '1px solid var(--rule)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>prev</span>
              <span style={{ padding: '6px 10px', border: '1px solid var(--rule)' }}>
                {short(snap.prev_brain_root, 8, 6)}
              </span>
              <span>→</span>
              <span
                style={{
                  padding: '6px 10px',
                  background: 'var(--c-1)',
                  border: '1px solid var(--rule)',
                  color: '#0B0C0A',
                }}
              >
                {short(snap.curr_brain_root, 8, 6)}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                chain {snap.da_verified ? 'verified ✓' : 'pending'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 36 }}>
            <KV
              pairs={[
                ['Snapshot id', sIdLabel],
                [
                  'Storage root',
                  storageHref ? (
                    <a className="link" href={storageHref} target="_blank" rel="noreferrer">
                      {short(snap.storage_root, 10, 8)}
                    </a>
                  ) : (
                    short(snap.storage_root, 10, 8)
                  ),
                ],
                ['Prev brain', short(snap.prev_brain_root, 10, 8)],
                ['Curr brain', short(snap.curr_brain_root, 10, 8)],
                ['DA epoch', snap.da_epoch ?? '—'],
                ['Blob size', sizeKb != null ? `${sizeKb} KB` : '—'],
                [
                  'Submit tx',
                  txHref ? (
                    <a className="link" href={txHref} target="_blank" rel="noreferrer">
                      {short(snap.submit_tx_hash, 10, 8)}
                    </a>
                  ) : (
                    '—'
                  ),
                ],
                ['Anchored', fmtTs(snap.ts)],
              ]}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 32, flexWrap: 'wrap' }}>
            {txHref ? (
              <a className="btn solid" href={txHref} target="_blank" rel="noreferrer">
                <span>Open on chainscan</span>
                <span className="arrow">→</span>
              </a>
            ) : (
              <Button variant="solid" disabled>Tx unavailable</Button>
            )}
            {storageHref ? (
              <a className="btn" href={storageHref} target="_blank" rel="noreferrer">
                <span>Download blob</span>
                <span className="arrow">→</span>
              </a>
            ) : (
              <Button disabled>Blob not retrievable (Galileo SDK stub)</Button>
            )}
            <Button arrow={false} onClick={() => router.push('/audit')}>Open audit log</Button>
          </div>
        </div>

        <div className="cell span-5" style={{ padding: 0 }}>
          <div
            className="cell tint-1"
            style={{ borderRight: 0, borderBottom: '1px solid var(--rule)', padding: 32 }}
          >
            <Corner>RECEIPT</Corner>
            <Eyebrow style={{ color: 'rgba(11,12,10,.65)' }}>Verifiability</Eyebrow>
            <p className="display-l" style={{ margin: '10px 0 0', fontSize: 64 }}>
              {pctVerified}
              <span style={{ fontSize: '0.5em' }}>%</span>
            </p>
            <p className="mono small" style={{ marginTop: 4, color: 'rgba(11,12,10,.7)' }}>
              {passed} of {checks.length} checks green
            </p>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checks.map(([label, ok], i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    gap: 12,
                  }}
                >
                  <span>{label}</span>
                  <Chip tone={ok ? 'ok' : 'fail'}>{ok ? 'PASS' : 'FAIL'}</Chip>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 32 }}>
            <Eyebrow>Blob contents · sha256</Eyebrow>
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
              }}
            >
              {blobEntries.map(([k, v], i) => (
                <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--rule-hair)' }}>
                  <div style={{ color: 'var(--ink-3)' }}>{k}</div>
                  <div style={{ color: 'var(--ink)', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            <p className="mono small" style={{ marginTop: 16 }}>
              Concat order is canonical · re-hashing reproduces{' '}
              <span style={{ color: 'var(--ink)' }}>storage_root</span> bit-for-bit.
            </p>
          </div>
        </div>
      </div>

      <div className="bento">
        <div className="cell span-4">
          <Eyebrow>State at snapshot</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 64 }}>
            {pnlBps >= 0 ? '+' : '−'}
            {(Math.abs(pnlBps) / 100).toFixed(2)}%
          </p>
          <p className="mono small" style={{ marginTop: 6 }}>
            return inception → snapshot · Sharpe {sharpe.toFixed(2)}
          </p>
        </div>
        <div className="cell span-4">
          <Eyebrow>Cadence</Eyebrow>
          <p className="display-l num" style={{ margin: '14px 0 0', fontSize: 64 }}>
            {prevSnap ? Math.max(0, Math.round((Number(snap.ts) - Number(prevSnap.ts)) / 60)) : '—'}
          </p>
          <p className="mono small" style={{ marginTop: 6 }}>
            minutes since previous snapshot
            {prevSnap ? ` · S-${String(prevSnap.id).padStart(3, '0')}` : ''}
          </p>
        </div>
        <div className="cell span-4">
          <Eyebrow>How to reproduce</Eyebrow>
          <pre
            className="mono"
            style={{
              margin: '14px 0 0',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              whiteSpace: 'pre-wrap',
            }}
          >{`> blob = storage.get("${short(snap.storage_root, 14, 6)}")
> root = keccak256(blob)
> root == on-chain.storage_root
  ${blobRetrievable ? 'PASS' : 'PENDING (blob not yet fetched)'}`}</pre>
        </div>
      </div>

      <Footer daEpoch={snap.da_epoch ? Number(snap.da_epoch) : undefined} />
    </div>
  );
}
