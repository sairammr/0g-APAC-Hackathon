import { infer, type InferResult } from '../llm.js';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; sma50: number; balance: bigint };

const SYS = `You are a mean-reversion trader. Given price + SMA20 + SMA50 + your balance, output STRICT JSON.
Schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 0..5000>,"rationale":"<one short sentence>"}
Rules:
- price << sma20 (gap > 2%): buy.
- price >> sma20 (gap > 2%): sell.
- Otherwise hold.`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const tee = await infer(SYS, `price=${s.price} sma20=${s.sma20} sma50=${s.sma50} balance=${s.balance}`);
  const decision = JSON.parse(tee.text) as Decision;
  if (!['buy', 'sell', 'hold'].includes(decision.action)) throw new Error('bad action');
  if (decision.sizeBps < 0 || decision.sizeBps > 5000) throw new Error('bad sizeBps');
  return { decision, tee };
}
