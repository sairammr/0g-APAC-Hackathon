/**
 * Mint a new iNFT² + register brain key + create ERC-6551 wallet + set
 * AgentController operator/policy.
 *
 * Usage:
 *   pnpm tsx scripts/createAgent.ts \
 *     --role momentum \
 *     --owner 0xYourAddress \
 *     --brain ./brain.json       # optional; default: empty JSON {}
 *
 * Output: prints tokenId, brain root, TBA wallet address. Writes the row into
 * Supabase `agents` if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set.
 *
 * Notes:
 *   • Requires PRIVATE_KEY (operator) to be funded on Galileo. The operator
 *     mints the NFT, so set the --owner flag if you want a different address
 *     to hold it (a transfer would still need to go through transferWithReKey,
 *     so for v1 the operator mints to itself and re-keys on sale).
 *   • Brain pubkey defaults to the operator's secp256k1 pubkey derived from
 *     PRIVATE_KEY. Override with --pubkey 0x04… if you want to mint for an
 *     external owner who'll provide their own key.
 *   • The script uses the live 0G Storage SDK first; if upload fails it
 *     transparently falls back to the in-memory stub (see storage.ts).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { getPublicKey } from '@noble/secp256k1';
import { wallet, pub, addr, abis, account } from '../src/chain.js';
import { uploadBytes } from '../src/storage.js';
import { encryptToPubkey } from '../src/brainKey.js';
import { db } from '../src/db.js';

type Args = {
  role: string;
  owner?: `0x${string}`;
  brain?: string;
  pubkey?: `0x${string}`;
  parent?: bigint;
  maxValuePerTx?: bigint;
  maxDailyVolume?: bigint;
};

function parseArgs(argv: string[]): Args {
  const out: any = { role: 'trader' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--role') { out.role = v; i++; }
    else if (k === '--owner') { out.owner = v as `0x${string}`; i++; }
    else if (k === '--brain') { out.brain = v; i++; }
    else if (k === '--pubkey') { out.pubkey = v as `0x${string}`; i++; }
    else if (k === '--parent') { out.parent = BigInt(v); i++; }
    else if (k === '--max-value') { out.maxValuePerTx = BigInt(v); i++; }
    else if (k === '--max-daily') { out.maxDailyVolume = BigInt(v); i++; }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

  // 1. Resolve brain pubkey.
  let pubkeyHex: string;
  if (args.pubkey) {
    pubkeyHex = args.pubkey.replace(/^0x/, '');
  } else {
    const operatorPriv = Buffer.from(process.env.PRIVATE_KEY.replace(/^0x/, ''), 'hex');
    pubkeyHex = Buffer.from(getPublicKey(operatorPriv, false)).toString('hex');
  }
  if (!/^04[0-9a-fA-F]{128}$/.test(pubkeyHex)) {
    throw new Error('pubkey must be uncompressed secp256k1 (130 hex chars starting with 04)');
  }
  const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');

  // 2. Resolve recipient.
  const owner = args.owner ?? account.address;

  // 3. Compose & encrypt brain blob.
  const brainPlaintext = args.brain
    ? readFileSync(args.brain)
    : Buffer.from(JSON.stringify({ role: args.role, createdAt: Date.now() }));
  const encryptedBlob = encryptToPubkey(pubkeyBytes, brainPlaintext);

  // 4. Upload to 0G Storage.
  console.log(`[createAgent] uploading encrypted brain (${encryptedBlob.length} bytes)…`);
  const { root: brainRoot } = await uploadBytes(encryptedBlob);
  const brainURI = `0g://${brainRoot.slice(2)}`;
  console.log(`[createAgent] brain root: ${brainRoot}`);
  console.log(`[createAgent] brain URI:  ${brainURI}`);

  // 5. Mint.
  console.log(`[createAgent] minting iNFT² to ${owner}…`);
  const mintTx = await wallet.writeContract({
    address: addr.iNFT2,
    abi: abis.inft,
    functionName: 'mint',
    args: [owner, brainRoot, brainURI, ('0x' + pubkeyHex) as `0x${string}`],
  });
  const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintTx });
  console.log(`[createAgent] mint tx: ${mintTx}`);

  // 6. Read back the assigned tokenId (nextId - 1 at the moment of mint).
  const nextId = await pub.readContract({
    address: addr.iNFT2, abi: abis.inft, functionName: 'nextId', args: [],
  }) as bigint;
  const tokenId = nextId - 1n;
  console.log(`[createAgent] token id: ${tokenId.toString()}`);

  // 7. Compute deterministic TBA address.
  const walletAddr = await pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'walletOf', args: [tokenId],
  }) as `0x${string}`;
  console.log(`[createAgent] TBA wallet (deterministic): ${walletAddr}`);

  // 8. Create the ERC-6551 wallet account if it doesn't exist yet.
  try {
    await wallet.writeContract({
      address: addr.ERC6551Registry, abi: abis.registry,
      functionName: 'createAccount',
      args: [addr.ERC6551Account, ('0x' + '00'.repeat(32)) as `0x${string}`, 16602n, addr.iNFT2, tokenId],
    });
    console.log(`[createAgent] TBA wallet account created`);
  } catch (e: any) {
    console.warn(`[createAgent] TBA wallet create skipped: ${e?.shortMessage ?? e?.message}`);
  }

  // 9. Set operator + policy on AgentController so the runtime can sign intents.
  await wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'setOperator', args: [tokenId, account.address],
  });
  console.log(`[createAgent] operator set to ${account.address}`);

  const policy = {
    allowedTargets: [] as `0x${string}`[],
    maxValuePerTx: args.maxValuePerTx ?? 1_000_000_000_000_000_000n, // 1 ether
    maxDailyVolume: args.maxDailyVolume ?? 10_000_000_000_000_000_000n, // 10 ether
    snapshotMaxAge: 0n,
  };
  await wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'setPolicy', args: [tokenId, policy],
  });
  console.log(`[createAgent] policy set`);

  // 10. Optionally write to Supabase.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await db().from('agents').upsert({
        token_id: tokenId.toString(),
        owner,
        role: args.role,
        brain_root: brainRoot,
        brain_uri: brainURI,
        metadata: { parent: args.parent?.toString() ?? null },
      });
      console.log(`[createAgent] supabase agents row upserted`);
    } catch (e: any) {
      console.warn(`[createAgent] supabase upsert failed: ${e?.message}`);
    }
  }

  // 11. If --parent is set, transfer the new NFT into the parent's TBA so it
  //     joins the subtree. The recursion check (AgentController._isInSubtree)
  //     will then see it.
  if (args.parent !== undefined) {
    const parentWallet = await pub.readContract({
      address: addr.AgentController, abi: abis.ctrl,
      functionName: 'walletOf', args: [args.parent],
    }) as `0x${string}`;
    console.warn(
      `[createAgent] --parent set: vanilla ERC-721 transfers are blocked by iNFT2 ` +
      `(use transferWithReKey). To attach this token to parent ${args.parent} (wallet ${parentWallet}), ` +
      `run reKeyAndTransfer with the parent's brain pubkey.`,
    );
  }

  console.log('');
  console.log('───────────────────────────────────────────────');
  console.log(`tokenId:    ${tokenId.toString()}`);
  console.log(`owner:      ${owner}`);
  console.log(`role:       ${args.role}`);
  console.log(`brain root: ${brainRoot}`);
  console.log(`wallet:     ${walletAddr}`);
  console.log('───────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
