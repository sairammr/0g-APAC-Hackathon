import { wallet, addr, abis, account } from './chain.js';
import { uploadBytes, downloadBytes } from './storage.js';
import { encryptToPubkey, decryptWithPrivkey } from './brainKey.js';

const types = {
  Transfer: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'newBrainRoot', type: 'bytes32' },
    { name: 'newURI', type: 'string' },
  ],
} as const;

const DOMAIN = {
  name: 'iNFT2',
  version: '1',
  chainId: 16602, // Galileo testnet — matches block.chainid used by iNFT2.sol's EIP712
  verifyingContract: addr.iNFT2,
} as const;

/**
 * ERC-7857 re-encryption transfer (v1: operator-as-oracle).
 *
 * The operator (this code) holds the per-token privkey, decrypts the brain,
 * re-encrypts to the buyer's pubkey, uploads the new blob, and signs an
 * EIP-712 attestation that iNFT2.transferWithReKey will verify.
 */
export async function reKeyAndTransfer(
  tokenId: bigint,
  fromAddr: `0x${string}`,
  toAddr: `0x${string}`,
  currentBrainRoot: `0x${string}`,
  currentPrivkey: Buffer,
  buyerPubkey: Uint8Array,
): Promise<{ tx: `0x${string}`; newRoot: `0x${string}` }> {
  // 1. Download current encrypted brain blob
  const enc = await downloadBytes(currentBrainRoot);

  // 2. Decrypt with current operator privkey (synchronous)
  const plaintext = decryptWithPrivkey(currentPrivkey, enc);

  // 3. Re-encrypt to buyer pubkey (synchronous)
  const ct = encryptToPubkey(buyerPubkey, plaintext);

  // 4. Upload re-encrypted blob
  const { root } = await uploadBytes(ct);
  const newURI = `0g://${root.slice(2)}`;

  // 5. Sign EIP-712 transfer digest (operator acts as oracle here)
  const sig = await wallet.signTypedData({
    account,
    domain: DOMAIN,
    types,
    primaryType: 'Transfer',
    message: { tokenId, from: fromAddr, to: toAddr, newBrainRoot: root, newURI },
  });

  // 6. Submit transferWithReKey
  const sealedKey = `0x${Buffer.from(buyerPubkey).toString('hex')}` as `0x${string}`;
  const tx = await wallet.writeContract({
    address: addr.iNFT2,
    abi: abis.inft,
    functionName: 'transferWithReKey',
    args: [fromAddr, toAddr, tokenId, root, newURI, sealedKey, sig],
  });
  return { tx, newRoot: root };
}
