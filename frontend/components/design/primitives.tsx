'use client';
import { CSSProperties, ReactNode } from 'react';

export function UrlBar({ path, live = false }: { path: string; live?: boolean }) {
  return (
    <span className="urlbar">
      <span className={'dot' + (live ? ' live' : '')}></span>
      <span>inft2.0g {path}</span>
    </span>
  );
}

export function Eyebrow({ children, dot = false, style }: { children: ReactNode; dot?: boolean; style?: CSSProperties }) {
  return <p className={'eyebrow' + (dot ? ' dot' : '')} style={style}>{children}</p>;
}

export function Corner({ children }: { children: ReactNode }) {
  return <span className="corner">{children}</span>;
}

export function Chip({ tone, children }: { tone?: 'ok' | 'warn' | 'fail' | 'ink' | 'tint-1' | 'tint-2' | 'tint-3'; children: ReactNode }) {
  let cls = 'chip';
  if (tone === 'ok') cls += ' ok';
  if (tone === 'warn') cls += ' warn';
  if (tone === 'fail') cls += ' fail';
  if (tone === 'ink') cls += ' solid-ink';
  if (tone === 'tint-1') cls += ' tint-1';
  if (tone === 'tint-2') cls += ' tint-2';
  if (tone === 'tint-3') cls += ' tint-3';
  return (
    <span className={cls}>
      {tone === 'ok' || tone === 'warn' || tone === 'fail' ? <span className="dot"></span> : null}
      {children}
    </span>
  );
}

export function Button({
  variant = 'default',
  onClick,
  children,
  full,
  arrow = true,
  disabled,
  type = 'button',
}: {
  variant?: 'default' | 'solid' | 'tint';
  onClick?: () => void;
  children: ReactNode;
  full?: boolean;
  arrow?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const cls = 'btn' + (variant === 'solid' ? ' solid' : variant === 'tint' ? ' tint' : '');
  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      style={{ width: full ? '100%' : undefined, justifyContent: full ? 'space-between' : undefined }}
    >
      <span>{children}</span>
      {arrow ? <span className="arrow">→</span> : null}
    </button>
  );
}

export function PnlDisplay({
  bps,
  value,
  size = 'xl',
  showCurrency = true,
  prefix,
}: {
  bps: number;
  value?: number;
  size?: 'xl' | 'l' | 'm' | 's';
  showCurrency?: boolean;
  prefix?: string;
}) {
  const sign = bps >= 0 ? '+' : '−';
  const pct = (Math.abs(bps) / 100).toFixed(2);
  const cls =
    size === 'xl'
      ? 'display-xl num'
      : size === 'l'
      ? 'display-l num'
      : size === 'm'
      ? 'display-m num'
      : 'display-s num';
  return (
    <div className={cls}>
      <span className="sign">{sign}</span>
      <span>{pct}</span>
      <span className="pct">%</span>
      {showCurrency && typeof value === 'number' ? (
        <div className="mono small" style={{ marginTop: 12, fontSize: 12, letterSpacing: '0.04em' }}>
          {prefix || ''}{sign}${Math.abs(value).toFixed(2)} · last 30d
        </div>
      ) : null}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'rgba(11,12,10,.6)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p className="display-s num" style={{ margin: '6px 0 0', fontSize: 28, letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  );
}

export function KV({ pairs }: { pairs: Array<[string, ReactNode]> }) {
  return (
    <dl className="kv">
      {pairs.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BulletCell({ n, title, desc, last }: { n: string; title: string; desc: ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: 22, borderRight: last ? 0 : '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
      <p className="mono" style={{ margin: 0, color: 'var(--ink-3)', fontSize: 11 }}>{n}</p>
      <p className="display-s" style={{ margin: '6px 0 8px', fontSize: 22 }}>{title}</p>
      <p className="small" style={{ margin: 0 }}>{desc}</p>
    </div>
  );
}

export function Marquee({ items, accent }: { items: string[]; accent?: string }) {
  const doubled = [...items, ...items];
  return (
    <div
      className="marquee"
      style={{
        borderTop: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
        padding: '10px 0',
        background: accent || 'transparent',
      }}
    >
      <div className="marquee-track">
        {doubled.map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, letterSpacing: '0.02em' }}>{it}</span>
            <span style={{ opacity: 0.5 }}>✱</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Footer({ blockHeight, daEpoch }: { blockHeight?: number; daEpoch?: number }) {
  return (
    <div className="footer">
      <span>iNFT² · 0G Galileo · chainId 16602</span>
      <span>
        {blockHeight != null ? `Block ${blockHeight.toLocaleString()}` : 'Block —'} ·{' '}
        {daEpoch != null ? `DA epoch ${daEpoch.toLocaleString()}` : 'DA epoch —'}
      </span>
      <span className="credit">Built for 0G APAC Hackathon · Track 2</span>
    </div>
  );
}
