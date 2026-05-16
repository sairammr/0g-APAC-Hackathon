import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.MARKET_SEED = '42';
});

describe('market', () => {
  it('stepPrice is deterministic for a given seed', async () => {
    const { _internals } = await import('../src/market.js');
    const { xorshift32, stepPrice } = _internals;

    const rngA = xorshift32(42);
    const rngB = xorshift32(42);

    let pa = 10;
    let pb = 10;
    for (let i = 0; i < 10; i++) {
      pa = stepPrice(pa, rngA);
      pb = stepPrice(pb, rngB);
    }
    expect(pa).toBe(pb);
    expect(pa).toBeGreaterThan(0);
  });

  it('stepPrice keeps price within reasonable bounds tick-to-tick', async () => {
    const { _internals } = await import('../src/market.js');
    const { xorshift32, stepPrice } = _internals;
    const rng = xorshift32(123);
    let prev = 10;
    for (let i = 0; i < 50; i++) {
      const next = stepPrice(prev, rng);
      // log-return is in (-0.02, 0.02) so price ratio is within exp(±0.02) ≈ 1.0202
      const ratio = next / prev;
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
      prev = next;
    }
  });

  it('indicators returns price/SMAs that are positive', async () => {
    const { tick, indicators } = await import('../src/market.js');
    for (let i = 0; i < 5; i++) await tick();
    const ind = indicators();
    expect(ind.price).toBeGreaterThan(0);
    expect(ind.sma20).toBeGreaterThan(0);
    expect(ind.sma50).toBeGreaterThan(0);
  });

  it('tick returns DEX-looking reserves and unix ts', async () => {
    const { tick } = await import('../src/market.js');
    const t = await tick();
    expect(t.ts).toBeGreaterThan(1_600_000_000);
    expect(t.price).toBeGreaterThan(0);
    expect(t.reserve0).toBeGreaterThan(0n);
    expect(t.reserve1).toBeGreaterThan(0n);
  });

  it('window stays bounded; SMA50 still computable after >60 ticks', async () => {
    const { tick, indicators, _internals } = await import('../src/market.js');
    for (let i = 0; i < 100; i++) await tick();
    const ind = indicators();
    expect(ind.sma50).toBeGreaterThan(0);
    expect(_internals.WINDOW_MAX).toBe(60);
  });
});
