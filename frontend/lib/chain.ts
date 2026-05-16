import { defineChain } from 'viem';
export const zg = defineChain({
  id: 16602, name: '0G Galileo', network: '0g-galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan-galileo.0g.ai' } },
});
