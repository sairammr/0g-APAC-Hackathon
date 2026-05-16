'use client';

export function AsteriskGlyph({ size = 22, spin = true, stroke = 1.4 }: { size?: number; spin?: boolean; stroke?: number }) {
  const arms = 6;
  const lines = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const x = Math.cos(a) * 0.45;
    const y = Math.sin(a) * 0.45;
    lines.push(
      <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="currentColor" strokeWidth={stroke / 22} strokeLinecap="round" />
    );
  }
  return (
    <svg width={size} height={size} viewBox="-0.5 -0.5 1 1" style={{ display: 'inline-block', transformOrigin: 'center' }}>
      <g style={spin ? { animation: 'spin 14s linear infinite', transformOrigin: 'center' } : undefined}>{lines}</g>
    </svg>
  );
}

export function Mark({ size = 22, spin = true, sup = '²' }: { size?: number; spin?: boolean; sup?: string }) {
  return (
    <span className="mark">
      <AsteriskGlyph size={size} spin={spin} />
      <span className="name">iNFT<sup>{sup}</sup></span>
    </span>
  );
}
