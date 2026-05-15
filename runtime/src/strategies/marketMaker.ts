import { infer, type InferResult } from '../llm.js';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; balance: bigint; lastAction: string };

const SYS = `You are a market-maker. You alternate small buys and sells around the mid to capture spread. Respond with strict JSON only.
JSON schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 100..1000>,"rationale":"<one short sentence>"}
Rules: alternate buy/sell with respect to lastAction; never exceed sizeBps=1000.`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const tee = await infer(SYS, `price=${s.price} sma20=${s.sma20} balance=${s.balance} lastAction=${s.lastAction}`);
  const decision = JSON.parse(tee.text) as Decision;
  if (!['buy', 'sell', 'hold'].includes(decision.action)) throw new Error('bad action');
  if (decision.sizeBps < 100 || decision.sizeBps > 1000) throw new Error('bad sizeBps for mm');
  return { decision, tee };
}
