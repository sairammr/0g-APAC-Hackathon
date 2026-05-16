import { infer, type InferResult } from '../llm.js';
import { pub, addr, abis } from '../chain.js';

export type ChildPerf = { tokenId: bigint; sharpeE6: bigint; pnL: bigint; freshAgeSec: number };
export type Allocation = { weights: Record<string, number>; rationale: string };

const SYS = `You allocate capital across child traders. Output STRICT JSON.
Schema: {"weights":{"<tokenId>":<bps 0..10000>,...},"rationale":"<one sentence>"}
Rules:
- Sum of weights must equal 10000.
- Favor children with higher rolling Sharpe.
- Penalize stale snapshots (freshAgeSec > 7200): cap weight at 1000.`;

export async function readChildPerf(tokenIds: bigint[]): Promise<ChildPerf[]> {
  return Promise.all(tokenIds.map(async id => {
    const snap: any = await pub.readContract({
      address: addr.SnapshotAttestor, abi: abis.att,
      functionName: 'latestFull', args: [id],
    });
    return {
      tokenId: id,
      sharpeE6: snap.sharpeE6 as bigint,
      pnL: snap.realizedPnL as bigint,
      freshAgeSec: Math.floor(Date.now() / 1000) - Number(snap.timestamp),
    };
  }));
}

export async function decide(perf: ChildPerf[]): Promise<{ alloc: Allocation; tee: InferResult }> {
  const user = JSON.stringify(perf.map(p => ({
    tokenId: p.tokenId.toString(),
    sharpe: Number(p.sharpeE6) / 1e6,
    pnL: p.pnL.toString(),
    freshAgeSec: p.freshAgeSec,
  })));
  const tee = await infer(SYS, user);
  const parsed = JSON.parse(tee.text);
  const weights: Record<string, number> = parsed.weights;
  const sum = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new Error(`weights sum=${sum}, need 10000`);
  return { alloc: { weights, rationale: parsed.rationale }, tee };
}
