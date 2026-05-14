import { pub } from './chain.js';
import { parseAbi } from 'viem';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

export async function balanceOf(token: `0x${string}`, holder: `0x${string}`): Promise<bigint> {
  return pub.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [holder] });
}

export async function netValue(
  wallet: `0x${string}`, usd: `0x${string}`, risk: `0x${string}`, price: number
): Promise<bigint> {
  const [usdBal, riskBal] = await Promise.all([balanceOf(usd, wallet), balanceOf(risk, wallet)]);
  const riskInUsd = BigInt(Math.floor(Number(riskBal) * price));
  return usdBal + riskInUsd;
}

/// Compute Sharpe x1e6 from absolute equity values
export function computeSharpeE6(values: bigint[]): number {
  if (values.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = Number(values[i - 1]);
    const curr = Number(values[i]);
    if (prev === 0) continue;
    returns.push((curr - prev) / prev);
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return Math.floor((mean / stddev) * 1e6);
}
