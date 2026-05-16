import { signIntent, nextNonce, type Intent } from '../src/intent.js';
import { account, addr } from '../src/chain.js';
import { recoverTypedDataAddress } from 'viem';

const tokenId = 2n;
const nonce = await nextNonce(tokenId);
const intent: Intent = {
  tokenId,
  nonce,
  target: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  value: 0n,
  callData: '0x' as `0x${string}`,
  expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
};
const sig = await signIntent(intent);
console.log('sig:', sig);

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

const recovered = await recoverTypedDataAddress({
  domain: { name: 'iNFT2-AgentController', version: '1', chainId: 16602, verifyingContract: addr.AgentController },
  types,
  primaryType: 'Intent',
  message: intent,
  signature: sig,
});
console.log('recovered:', recovered, 'expected:', account.address);
if (recovered.toLowerCase() !== account.address.toLowerCase()) throw new Error('recovery mismatch');
console.log('OK');
