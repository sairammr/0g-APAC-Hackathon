/**
 * Mint a full agent tree (1 manager + 3 children) for a buyer in one shot.
 *
 * Used by the backend's POST /api/create-tree endpoint, spawned via
 * child_process. Designed to be self-contained: takes --owner and --pubkey
 * (the buyer's address and uncompressed secp256k1 pubkey), mints four iNFTs
 * encrypted to that pubkey, registers operator + policy, and prints a single
 * JSON line at the end so the caller can parse the result.
 *
 * Usage:
 *   pnpm tsx scripts/createTree.ts --owner 0x... --pubkey 0x04...
 *
 * Final stdout line (the only one prefixed with "RESULT="):
 *   RESULT={"managerId":"6","children":[{"id":"7","role":"momentum","wallet":"0x..."},...],"txs":["0x...","0x..."]}
 */
import 'dotenv/config';
import { wallet, pub, addr, abis, account } from '../src/chain.js';
import { uploadBytes } from '../src/storage.js';
import { encryptToPubkey } from '../src/brainKey.js';
import { db } from '../src/db.js';

type Spec = { role: string; brainTag: string; uri: string };

const SPECS: Spec[] = [
  { role: 'manager',     brainTag: 'manager-v1',     uri: '0g://mgr' },
  { role: 'momentum',    brainTag: 'momentum-v1',    uri: '0g://mom' },
  { role: 'meanRev',     brainTag: 'meanRev-v1',     uri: '0g://mr'  },
  { role: 'marketMaker', brainTag: 'marketMaker-v1', uri: '0g://mm'  },
];

type Args = { owner: `0x${string}`; pubkey: `0x${string}` };

function parseArgs(argv: string[]): Args {
  const out: any = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--owner') { out.owner = v; i++; }
    else if (k === '--pubkey') { out.pubkey = v; i++; }
  }
  if (!out.owner) throw new Error('--owner required');
  if (!out.pubkey) throw new Error('--pubkey required');
  return out;
}

async function mintOne(spec: Spec, owner: `0x${string}`, pubkeyBytes: Buffer): Promise<{
  id: string; role: string; wallet: string; brainRoot: string; mintTx: string;
}> {
  const brainPlaintext = Buffer.from(JSON.stringify({
    role: spec.role,
    brainTag: spec.brainTag,
    createdAt: Date.now(),
  }));
  const encrypted = encryptToPubkey(pubkeyBytes, brainPlaintext);
  const { root: brainRoot } = await uploadBytes(encrypted);

  const mintTx = await wallet.writeContract({
    address: addr.iNFT2,
    abi: abis.inft,
    functionName: 'mint',
    args: [owner, brainRoot, spec.uri, ('0x' + pubkeyBytes.toString('hex')) as `0x${string}`],
  });
  await pub.waitForTransactionReceipt({ hash: mintTx });

  const nextId = await pub.readContract({
    address: addr.iNFT2, abi: abis.inft, functionName: 'nextId', args: [],
  }) as bigint;
  const tokenId = nextId - 1n;

  const tbaWallet = await pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'walletOf', args: [tokenId],
  }) as `0x${string}`;

  // Create the ERC-6551 wallet (best-effort: idempotent on the contract side).
  try {
    await wallet.writeContract({
      address: addr.ERC6551Registry, abi: abis.registry,
      functionName: 'createAccount',
      args: [addr.ERC6551Account, ('0x' + '00'.repeat(32)) as `0x${string}`, 16602n, addr.iNFT2, tokenId],
    });
  } catch {
    // already exists — fine
  }

  // Operator + policy so the runtime can drive this agent.
  await wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'setOperator', args: [tokenId, account.address],
  });
  await wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'setPolicy',
    args: [tokenId, {
      allowedTargets: [] as `0x${string}`[],
      maxValuePerTx:  1_000_000_000_000_000_000n,
      maxDailyVolume: 10_000_000_000_000_000_000n,
      snapshotMaxAge: 0n,
    }],
  });

  // Mirror into Supabase so the UI sees the new tree immediately.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await db().from('agents').upsert({
        token_id: tokenId.toString(),
        owner,
        role: spec.role === 'manager' ? 'manager' : 'trader',
        brain_root: brainRoot,
        brain_uri: spec.uri,
        metadata: { wallet: tbaWallet, strat: spec.role },
      });
    } catch {
      // non-fatal: the indexer will pick it up later
    }
  }

  return { id: tokenId.toString(), role: spec.role, wallet: tbaWallet, brainRoot, mintTx };
}

async function main() {
  const { owner, pubkey } = parseArgs(process.argv.slice(2));
  const pubkeyHex = pubkey.replace(/^0x/, '');
  if (!/^04[0-9a-fA-F]{128}$/.test(pubkeyHex)) {
    throw new Error('pubkey must be uncompressed secp256k1 (130 hex chars starting with 04)');
  }
  const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');

  const minted: Array<Awaited<ReturnType<typeof mintOne>>> = [];
  for (const spec of SPECS) {
    const m = await mintOne(spec, owner, pubkeyBytes);
    minted.push(m);
    console.error(`[createTree] minted ${spec.role} → token ${m.id} (tx ${m.mintTx})`);
  }

  const [mgr, ...children] = minted;
  const result = {
    owner,
    managerId: mgr.id,
    managerWallet: mgr.wallet,
    children: children.map((c) => ({ id: c.id, role: c.role, wallet: c.wallet })),
    txs: minted.map((m) => m.mintTx),
  };
  // Single machine-readable line at the very end so the backend can parse it.
  process.stdout.write('RESULT=' + JSON.stringify(result) + '\n');
}

main().catch((e) => {
  process.stderr.write(`[createTree] FAILED: ${e?.message || e}\n`);
  process.exit(1);
});
