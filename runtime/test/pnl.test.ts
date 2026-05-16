import { describe, it, expect } from 'vitest';
import { computeSharpeE6 } from '../src/pnl.js';

describe('sharpe', () => {
  it('returns 0 for constant returns', () => {
    expect(computeSharpeE6([1n, 1n, 1n, 1n])).toBe(0);
  });
  it('positive for trending up', () => {
    const s = computeSharpeE6([100n, 110n, 120n, 130n]);
    expect(s).toBeGreaterThan(0);
  });
});
