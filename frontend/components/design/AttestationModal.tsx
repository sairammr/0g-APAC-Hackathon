'use client';
import { useEffect, useState } from 'react';
import { Chip, Eyebrow } from './primitives';
import { getAttestation } from '@/lib/api';
import { addrUrl, short } from '@/lib/explorer';

type Attestation = {
  tick: {
    id: number;
    tokenId: string;
    ts: number;
    action: string;
    sizeBps: number | null;
    teeVerified: boolean | null;
    chatId: string | null;
    txHash: string | null;
  };
  provider: {
    address: string;
    url: string;
    model: string;
    verifiability: string;
    teeSignerAddress: string;
    teeSignerAcknowledged: boolean;
  };
  inferenceContract: string;
  ledgerContract: string;
  explorer: string;
  chatSignatureUrl: string;
  raReportUrl: string;
};

type SigPreview = {
  text?: string;
  signature?: string;
  signing_address?: string;
  signing_algo?: string;
  provider_type?: string;
  request_hash?: string;
  raw?: string;
};

export function AttestationModal({
  tickId,
  onClose,
}: {
  tickId: number | string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Attestation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sig, setSig] = useState<SigPreview | null>(null);
  const [sigErr, setSigErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    setSig(null);
    setSigErr(null);
    (async () => {
      try {
        const d = await getAttestation(tickId);
        if (cancelled) return;
        if (d?.error) {
          setErr(d.error);
          return;
        }
        setData(d as Attestation);
        // Best-effort: fetch the signature payload so the user sees the
        // raw signed receipt inline instead of having to download it.
        try {
          const r = await fetch(d.chatSignatureUrl);
          if (r.ok) {
            const j = await r.json().catch(() => null);
            if (!cancelled && j) setSig(j as SigPreview);
          } else if (!cancelled) {
            setSigErr(`HTTP ${r.status}`);
          }
        } catch (e: any) {
          if (!cancelled) setSigErr(e?.message ?? 'fetch failed');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const providerType = sig?.provider_type ?? '—';
  const isCentralized = (providerType || '').includes('centralized');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 22, 24, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--rule)',
          maxWidth: 760,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 80px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <Eyebrow dot>Signed receipt · 0G Compute</Eyebrow>
            <p className="mono small" style={{ marginTop: 4, color: 'var(--ink-3)' }}>
              tick #{tickId} · attested at provider, signer registered on-chain
            </p>
          </div>
          <button
            onClick={onClose}
            className="mono"
            style={{
              background: 'none',
              border: '1px solid var(--rule)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            close ✕
          </button>
        </div>

        {err && (
          <div style={{ padding: 28 }} className="mono small">
            <Chip tone="fail">error</Chip>
            <p style={{ marginTop: 10 }}>{err}</p>
          </div>
        )}

        {!err && !data && (
          <div style={{ padding: 28 }} className="mono small">
            loading attestation…
          </div>
        )}

        {data && (
          <>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--rule)' }}>
              <Eyebrow>Decision</Eyebrow>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 14,
                  marginTop: 10,
                }}
              >
                <KvRow k="action" v={data.tick.action} />
                <KvRow
                  k="size"
                  v={data.tick.sizeBps != null ? `${(data.tick.sizeBps / 100).toFixed(1)}%` : '—'}
                />
                <KvRow
                  k="receipt"
                  v={
                    data.tick.teeVerified === true ? (
                      <Chip tone="ok">verified</Chip>
                    ) : data.tick.teeVerified === false ? (
                      <Chip tone="fail">invalid</Chip>
                    ) : (
                      <Chip tone="warn">unsigned</Chip>
                    )
                  }
                />
              </div>
            </div>

            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--rule)' }}>
              <Eyebrow>On-chain registration</Eyebrow>
              <p className="mono small" style={{ color: 'var(--ink-3)', marginTop: 6 }}>
                Provider and its signer key are registered on the 0G InferenceServing contract.
                Every response is signed by the registered key.
              </p>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                <LinkRow
                  label="provider"
                  addr={data.provider.address}
                  href={addrUrl(data.provider.address) ?? '#'}
                />
                <LinkRow
                  label="signer key"
                  addr={data.provider.teeSignerAddress}
                  href={addrUrl(data.provider.teeSignerAddress) ?? '#'}
                />
                <LinkRow
                  label="InferenceServing contract"
                  addr={data.inferenceContract}
                  href={addrUrl(data.inferenceContract) ?? '#'}
                />
              </div>
            </div>

            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--rule)' }}>
              <Eyebrow>Signed receipt (off-chain, signature anchored on-chain)</Eyebrow>
              <p className="mono small" style={{ color: 'var(--ink-3)', marginTop: 6 }}>
                Hosted by the provider, signed by the on-chain key. Anyone can recover the
                signing address from the signature and check it matches the registered key.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  gap: 12,
                  marginTop: 12,
                  fontSize: 12,
                }}
                className="mono"
              >
                <span style={{ color: 'var(--ink-3)' }}>chat_id</span>
                <span style={{ wordBreak: 'break-all' }}>{data.tick.chatId ?? '—'}</span>

                <span style={{ color: 'var(--ink-3)' }}>signing_addr</span>
                <span style={{ wordBreak: 'break-all' }}>
                  {sig?.signing_address ?? '—'}
                  {sig?.signing_address && (
                    <SignerMatch
                      sigAddr={sig.signing_address}
                      regAddr={data.provider.teeSignerAddress}
                    />
                  )}
                </span>

                <span style={{ color: 'var(--ink-3)' }}>provider_type</span>
                <span>
                  {providerType}
                  {isCentralized && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: 'var(--ink-3)',
                        fontSize: 11,
                      }}
                    >
                      (model runs on centralized backend; provider signs the response)
                    </span>
                  )}
                </span>

                <span style={{ color: 'var(--ink-3)' }}>signature</span>
                <span style={{ wordBreak: 'break-all', fontSize: 11 }}>
                  {sig?.signature ?? (sigErr ? `failed: ${sigErr}` : '—')}
                </span>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <a
                  className="link mono"
                  style={{ fontSize: 11 }}
                  href={data.chatSignatureUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  open raw signature payload →
                </a>
              </div>
            </div>

            <div style={{ padding: '20px 28px' }}>
              <Eyebrow>What this proves</Eyebrow>
              <ul
                className="mono small"
                style={{
                  marginTop: 10,
                  paddingLeft: 18,
                  color: 'var(--ink-3)',
                  lineHeight: 1.7,
                }}
              >
                <li>
                  Provider <span style={{ color: 'var(--ink)' }}>{short(data.provider.address)}</span>{' '}
                  is registered on 0G InferenceServing with the signer key{' '}
                  <span style={{ color: 'var(--ink)' }}>
                    {short(data.provider.teeSignerAddress)}
                  </span>
                  .
                </li>
                <li>
                  The chat response was signed by that key. We verified it via{' '}
                  <span style={{ color: 'var(--ink)' }}>broker.inference.processResponse</span>{' '}
                  before persisting <span style={{ color: 'var(--ink)' }}>tee_verified=true</span>.
                </li>
                {isCentralized && (
                  <li style={{ color: 'var(--ink-2)' }}>
                    Honesty note: this provider routes to a centralized model backend. The
                    signature proves <em>who</em> served the response, not that the model ran
                    inside a TEE.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <p className="mono small" style={{ color: 'var(--ink-3)' }}>
        {k}
      </p>
      <div style={{ marginTop: 4 }}>{v}</div>
    </div>
  );
}

function LinkRow({ label, addr, href }: { label: string; addr: string; href: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span className="mono small" style={{ color: 'var(--ink-3)' }}>
        {label}
      </span>
      <a className="link mono" style={{ fontSize: 12 }} href={href} target="_blank" rel="noreferrer">
        {addr} ↗
      </a>
    </div>
  );
}

function SignerMatch({ sigAddr, regAddr }: { sigAddr: string; regAddr: string }) {
  const match = sigAddr.toLowerCase() === regAddr.toLowerCase();
  return (
    <span style={{ marginLeft: 8 }}>
      {match ? <Chip tone="ok">matches on-chain key</Chip> : <Chip tone="fail">mismatch</Chip>}
    </span>
  );
}
