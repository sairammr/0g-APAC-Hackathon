import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/llm.js', () => ({
  infer: vi.fn(async (_sys: string, _user: string) => ({
    text: JSON.stringify({ action: 'buy', sizeBps: 2500, rationale: 'test' }),
    teeVerified: true, providerAddr: '0xabc', chatId: 'cid', cost: null,
  })),
}));

describe('momentum strategy', () => {
  it('returns decision with TEE flag', async () => {
    const { decide } = await import('../src/strategies/momentum.js');
    const d = await decide({ price: 10, sma20: 9, sma50: 8, balance: 1000n });
    expect(d.decision.action).toBe('buy');
    expect(d.decision.sizeBps).toBe(2500);
    expect(d.tee.teeVerified).toBe(true);
  });
});

describe('meanRev strategy', () => {
  it('parses JSON output', async () => {
    const { decide } = await import('../src/strategies/meanRev.js');
    const d = await decide({ price: 9.5, sma20: 10, sma50: 10, balance: 500n });
    expect(d.decision.action).toBe('buy');
  });
});
