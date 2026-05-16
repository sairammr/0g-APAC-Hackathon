'use client';

export function Spark({
  data,
  width = 600,
  height = 80,
  strokeWidth = 1.25,
  fill = false,
  baseline = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
  baseline?: boolean;
}) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const startVal = data[0];
  const baseY = height - ((startVal - min) / range) * (height - 4) - 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="spark" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      {baseline ? <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="currentColor" strokeOpacity="0.18" strokeDasharray="2 4" /> : null}
      {fill ? <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="currentColor" fillOpacity="0.08" /> : null}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill="currentColor" />
    </svg>
  );
}

export function EquityChart({
  data,
  height = 280,
  accent = 'var(--ink)',
}: {
  data: number[];
  height?: number;
  accent?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        no equity data yet
      </div>
    );
  }
  const w = 1200, h = height;
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 30) - 15;
    return [x, y] as [number, number];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const yTicks = 5;
  const grid = [];
  for (let i = 0; i <= yTicks; i++) {
    const y = (h / yTicks) * i;
    grid.push(<line key={'g' + i} x1={0} y1={y} x2={w} y2={y} stroke="currentColor" strokeOpacity="0.08" />);
  }
  const startY = pts[0][1];
  const endY = pts[pts.length - 1][1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      {grid}
      <line x1={0} y1={startY} x2={w} y2={startY} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 5" />
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={accent} fillOpacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0] - 3} cy={endY} r="4" fill={accent} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
