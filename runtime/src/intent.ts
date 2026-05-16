import { wallet, pub, addr, abis, account } from './chain.js';
import { encodeFunctionData } from 'viem';

export type Intent = {
  tokenId: bigint;
  nonce: bigint;
  target: `0x${string}`;
  value: bigint;
  callData: `0x${string}`;
  expiry: bigint;
};

const types = {
  Intent: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'callData', type: 'bytes' },
    { name: 'expiry', type: 'uint64' },
  ],
} as const;

const DOMAIN = {
  name: 'iNFT2-AgentController',
  version: '1',
  chainId: 16602, // Galileo testnet — NOTE: spec said 16661 (mainnet); we're on testnet
  verifyingContract: addr.AgentController,
} as const;

export async function signIntent(i: Intent): Promise<`0x${string}`> {
  return wallet.signTypedData({ account, domain: DOMAIN, types, primaryType: 'Intent', message: i });
}

export async function nextNonce(tokenId: bigint): Promise<bigint> {
  return pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'nextNonce', args: [tokenId],
  }) as Promise<bigint>;
}

export async function submitIntent(i: Intent, sig: `0x${string}`): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'executeIntent', args: [i, sig],
  });
}

export async function submitChildIntent(parentId: bigint, i: Intent, sig: `0x${string}`): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'executeChildIntent', args: [parentId, i, sig],
  });
}

// Swap helper: build calldata for UniswapV2Router02.swapExactTokensForTokens
export function buildSwap(
  amountIn: bigint, amountOutMin: bigint,
  path: `0x${string}`[], to: `0x${string}`, deadline: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function', name: 'swapExactTokensForTokens', stateMutability: 'nonpayable',
      inputs: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'path', type: 'address[]' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
      outputs: [{ type: 'uint256[]' }],
    }],
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, amountOutMin, path, to, deadline],
  });
}

export function buildApprove(spender: `0x${string}`, amt: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function', name: 'approve', stateMutability: 'nonpayable',
      inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'approve', args: [spender, amt],
  });
}
