import { infer, type InferResult } from '../llm.js';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; sma50: number; balance: bigint };

const SYS = `You are a disciplined momentum trader. Given price + SMA20 + SMA50 + your balance, output STRICT JSON only.
Schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 0..5000>,"rationale":"<one short sentence>"}
Rules:
- If price > sma20 > sma50: bias buy. sizeBps proportional to gap.
- If price < sma20 < sma50: bias sell.
- Otherwise hold.
- Never sizeBps > 5000 (half of capital max per tick).`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const user = `price=${s.price} sma20=${s.sma20} sma50=${s.sma50} balance=${s.balance}`;
  const tee = await infer(SYS, user);
  const decision = JSON.parse(tee.text) as Decision;
  if (!['buy', 'sell', 'hold'].includes(decision.action)) throw new Error('bad action');
  if (decision.sizeBps < 0 || decision.sizeBps > 5000) throw new Error('bad sizeBps');
  return { decision, tee };
}
