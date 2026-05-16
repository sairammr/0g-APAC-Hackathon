'use client';
import type { DesignAgent } from '@/lib/adapter';

export function RecursionTree({
  manager,
  workers,
  onSelect,
  current,
  compact = false,
}: {
  manager: DesignAgent;
  workers: DesignAgent[];
  onSelect?: (tokenId: number) => void;
  current?: number;
  compact?: boolean;
}) {
  const w = 800, h = compact ? 260 : 340;
  const cx = w / 2, cyA = compact ? 56 : 70;
  const yB = compact ? 200 : 270;
  const cols = workers.map((_, i) => (w / (workers.length + 1)) * (i + 1));
  const accents = ['var(--c-1)', 'var(--c-2)', 'var(--c-3)'];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {workers.map((wk, i) => {
        const x2 = cols[i];
        return (
          <g key={'c' + i}>
            <path
              d={`M ${cx} ${cyA + 30} C ${cx} ${cyA + 90}, ${x2} ${yB - 70}, ${x2} ${yB - 30}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <g transform={`translate(${(cx + x2) / 2}, ${(cyA + yB) / 2 - 6})`}>
              <rect x="-26" y="-9" width="52" height="18" fill="var(--bg)" stroke="currentColor" strokeOpacity="0.5" />
              <text x="0" y="3" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="currentColor">
                {(wk.weight * 100).toFixed(0)}%
              </text>
            </g>
          </g>
        );
      })}

      <g onClick={() => onSelect && onSelect(manager.tokenId)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
        <rect x={cx - 110} y={cyA - 26} width="220" height="60" fill="var(--ink)" />
        <text x={cx - 96} y={cyA - 8} fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--bg)" opacity="0.7" letterSpacing="1">
          MANAGER · iNFT #{manager.tokenId}
        </text>
        <text x={cx - 96} y={cyA + 18} fontFamily="var(--font-display)" fontSize="22" fill="var(--bg)" letterSpacing="-0.02em">
          {manager.name}
        </text>
        <text x={cx + 92} y={cyA + 18} textAnchor="end" fontFamily="var(--font-mono)" fontSize="12" fill="var(--bg)">
          {manager.pnlBps >= 0 ? '+' : '−'}{(Math.abs(manager.pnlBps) / 100).toFixed(2)}%
        </text>
        {current === manager.tokenId ? <rect x={cx - 110} y={cyA - 26} width="220" height="60" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
      </g>

      {workers.map((wk, i) => {
        const x = cols[i];
        const isCurrent = current === wk.tokenId;
        return (
          <g key={wk.tokenId} onClick={() => onSelect && onSelect(wk.tokenId)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x={x - 95} y={yB - 28} width="190" height="64" fill={accents[i % 3]} stroke="currentColor" />
            <text x={x - 82} y={yB - 10} fontFamily="var(--font-mono)" fontSize="9.5" fill="#0B0C0A" opacity="0.7" letterSpacing="1">
              {wk.kind.toUpperCase()} · #{wk.tokenId}
            </text>
            <text x={x - 82} y={yB + 16} fontFamily="var(--font-display)" fontSize="22" fill="#0B0C0A" letterSpacing="-0.02em">
              {wk.name}
            </text>
            <text x={x + 78} y={yB + 16} textAnchor="end" fontFamily="var(--font-mono)" fontSize="12" fill="#0B0C0A">
              {wk.pnlBps >= 0 ? '+' : '−'}{(Math.abs(wk.pnlBps) / 100).toFixed(2)}%
            </text>
            {isCurrent ? <rect x={x - 95} y={yB - 28} width="190" height="64" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
          </g>
        );
      })}
    </svg>
  );
}
