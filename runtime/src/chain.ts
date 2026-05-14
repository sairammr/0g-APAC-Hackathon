import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';
import inftJson from '../abi/iNFT2.json' with { type: 'json' };
import ctrlJson from '../abi/AgentController.json' with { type: 'json' };
import attJson from '../abi/SnapshotAttestor.json' with { type: 'json' };
import keysJson from '../abi/BrainKeyRegistry.json' with { type: 'json' };
import registryJson from '../abi/ERC6551Registry.json' with { type: 'json' };
import accountJson from '../abi/ERC6551Account.json' with { type: 'json' };
import deployments from '../deployments/testnet.json' with { type: 'json' };

export const zgGalileo = defineChain({
  id: 16602,
  name: '0G Galileo',
  network: '0g-galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan-galileo.0g.ai' } },
});

if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

export const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
export const wallet = createWalletClient({ account, chain: zgGalileo, transport: http() });
export const pub    = createPublicClient({ chain: zgGalileo, transport: http() });

export const addr = {
  iNFT2: deployments.iNFT2 as `0x${string}`,
  AgentController: deployments.AgentController as `0x${string}`,
  SnapshotAttestor: deployments.SnapshotAttestor as `0x${string}`,
  BrainKeyRegistry: deployments.BrainKeyRegistry as `0x${string}`,
  ERC6551Registry: deployments.ERC6551Registry as `0x${string}`,
  ERC6551Account: deployments.ERC6551Account as `0x${string}`,
};

export const abis = {
  inft: inftJson.abi as readonly unknown[],
  ctrl: ctrlJson.abi as readonly unknown[],
  att: attJson.abi as readonly unknown[],
  keys: keysJson.abi as readonly unknown[],
  registry: registryJson.abi as readonly unknown[],
  account: accountJson.abi as readonly unknown[],
} as const;
