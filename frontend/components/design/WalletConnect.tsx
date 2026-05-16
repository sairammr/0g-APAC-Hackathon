'use client';
import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function WalletConnect() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('.wallet-pop') && !t?.closest('.wallet-trigger')) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!ready) {
    return (
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          border: '1px solid var(--rule)',
          padding: '7px 12px',
          letterSpacing: '0.04em',
        }}
      >
        …
      </span>
    );
  }

  if (!authenticated) {
    return (
      <button
        className="ghost-btn wallet-trigger"
        onClick={login}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            background: 'var(--c-1)',
            border: '1px solid var(--rule)',
            display: 'inline-block',
          }}
        />
        <span>Connect</span>
      </button>
    );
  }

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'wallet';

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ghost-btn wallet-trigger"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            background: '#1f8a5b',
            borderRadius: 999,
            display: 'inline-block',
            boxShadow: '0 0 0 0 rgba(31,138,91,.4)',
            animation: 'pulse 2s infinite',
          }}
        />
        <span>{short}</span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      {open ? (
        <div
          className="wallet-pop"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 260,
            background: 'var(--bg)',
            border: '1px solid var(--rule)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.06)',
            zIndex: 200,
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Connected · 0G Galileo
            </p>
            <p
              className="mono"
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                wordBreak: 'break-all',
                color: 'var(--ink)',
              }}
            >
              {address}
            </p>
          </div>
          <button
            onClick={copy}
            className="mono"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              fontSize: 12,
              background: 'transparent',
              border: 0,
              borderBottom: '1px solid var(--rule)',
              color: 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy address'}
          </button>
          <a
            href={address ? `https://chainscan-galileo.0g.ai/address/${address}` : '#'}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{
              display: 'block',
              padding: '10px 16px',
              fontSize: 12,
              borderBottom: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          >
            View on chainscan ↗
          </a>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="mono"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              fontSize: 12,
              background: 'transparent',
              border: 0,
              color: '#b54545',
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
