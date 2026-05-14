# iNFT² — Recursive Intelligent NFTs on 0G

> A manager agent that owns child trading agents — each is an **ERC-7857 iNFT** (encrypted brain blob held in 0G Storage) paired with an **ERC-6551 token-bound account**. The manager rebalances its book by signing **EIP-712 intents** that the children execute. Inference runs on **0G Compute** (TEE-attested), brains live on **0G Storage**, snapshots are anchored on **0G Chain** and tagged with **0G DA** epochs. Sales transfer the brain by *decrypting and re-encrypting* to the buyer's pubkey on-chain.

---

## 1. What this is

iNFT² ("iNFT squared") is a recursive-NFT trading collective:

- **Manager iNFT** (token #2) periodically reads its three children's recent performance, decides a target weight vector, and emits EIP-712 *child intents*.
- **Three Worker iNFTs** (tokens #3, #4, #5) each run a strategy — momentum, mean-reversion, market-making — using prompts personalized by the encrypted brain blob stored in 0G Storage.
- **All four agents are tradable.** A buyer purchasing token #2 inherits the whole subtree; selling a child detaches only that branch. Brain blobs are re-keyed on transfer so the previous owner can no longer infer the strategy state.

This is the **Track 2 (Agentic Trading Arena)** submission — verifiable, owned-by-NFT trading agents running on TEE inference.

## 2. Live demo

- **Frontend:** *(to be filled after Vercel deploy)* `https://inft2.vercel.app/demo`
- **Backend API:** *(to be filled after Railway/Fly deploy)* `https://inft2-api.<host>/api/demo-state`
- **Runtime loop logs:** streamed from the deployed runtime container; cadence is one tick per minute, full snapshot every 6 h.
- **Chain explorer:** [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b)

## 3. Deployed addresses (0G Galileo testnet — chainId 16602)

| Contract | Address |
|---|---|
| BrainKeyRegistry | `0x277D737bB2706E01BEaD9eA305162C16249973e5` |
| iNFT2 (ERC-7857) | `0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b` |
| ERC6551Account (impl) | `0x44e8987708370BaC3Fc146063Ddd3144F82CdCc8` |
| ERC6551Registry | `0xC8a286097394631C49D0ED9A414a9D8c89b21F75` |
| SnapshotAttestor | `0x52C4B4C41b8cB742981AD6ac2e6612894d55e27f` |
| AgentController | `0xD5Bf7BB2c0F18d357535b4B44A0E5190731ecbba` |
| Operator EOA | `0x2931be85049AB879831506007258E1A104F09bB5` |

Seeded subtree:

| Role | Token ID | Token-bound wallet |
|---|---|---|
| Manager | 2 | `0x3cF56B1eECdDEC8c1a1AF65D097ba96B8Ae03EBF` |
| Momentum child | 3 | `0xf47d7C9D3ab16c3Ee1e110E012b968523743Fea4` |
| Mean-reversion child | 4 | `0x4098E662C2D674064fF6605CFCCafd89EBbAe2A9` |
| Market-maker child | 5 | `0x5498071Acc7CD4c7948808AEaC3674f8DaC8f764` |

Canonical record: [`contracts/deployments/testnet.json`](contracts/deployments/testnet.json).

> Mainnet (chainId 16661) deployment is pending — see §9.

## 4. Recursion model

The "²" is the recursion: an iNFT can own other iNFTs through its ERC-6551 account. Concretely:

```
iNFT(#2) ──owns──▶ TBA(#2)  ──holds──▶ iNFT(#3), iNFT(#4), iNFT(#5)
                                            │           │           │
                                          TBA(#3)     TBA(#4)     TBA(#5)
                                            │           │           │
                                          dUSD/dRISK  dUSD/dRISK  dUSD/dRISK
```

- Each iNFT has a unique ERC-6551 wallet computed deterministically from `(salt, chainId, tokenContract, tokenId)`.
- The manager's wallet *is the owner* of the three child iNFTs.
- Selling token #2 transfers everything beneath it in one ERC-721 transfer (the children move because their owner — the manager's TBA — now answers to a new operator key).
- Selling a child only detaches that branch; the brain is re-keyed to the buyer's pubkey during transfer so the seller can no longer decrypt it (`transferWithReKey` in `iNFT2.sol`).

## 5. 0G modules used

| 0G primitive | How we use it | Code |
|---|---|---|
| **0G Chain** (Galileo, 16602) | Hosts all six Solidity contracts; EIP-712 intents land here. | `contracts/src/*` |
| **0G Storage** | Stores every encrypted brain blob (ECIES on secp256k1) and every periodic full snapshot blob. Content-addressed by Merkle root. | `runtime/src/storage.ts`, `runtime/src/snapshot.ts` |
| **0G Compute** | TEE-attested LLM inference for each strategy (momentum / mean-rev / market-maker / manager). Uses 0G Compute Router (OpenAI-compatible) with `processResponse` TEE check. | `runtime/src/llm.ts`, `runtime/src/strategies/*.ts` |
| **0G DA** (DASigners precompile `0x…1000`) | Reads current DA epoch and embeds it in every snapshot so any indexer can verify the snapshot landed in DA. | `runtime/src/snapshot.ts` (`readEpoch()` with fallback) |
| **ERC-7857 iNFT** | Brain blob lineage + `transferWithReKey`. | `contracts/src/iNFT2.sol`, `contracts/src/BrainKeyRegistry.sol` |
| **ERC-6551 TBA** | Token-bound account per iNFT (canonical 4-word footer). | `contracts/src/ERC6551Account.sol`, `contracts/src/ERC6551Registry.sol` |

## 6. Architecture

```
┌──────────── Frontend (Next.js 14 + Privy) ────────────┐
│ /demo  /agent/[id]  /agent/[id]/buy                   │
└──────────────────────┬────────────────────────────────┘
                       │ REST  (signed by Privy embedded wallet)
┌──────────────────────▼────────────────────────────────┐
│   Backend (Fastify) — backend/src/main.ts             │
│  • /api/demo-state    /api/agent/:id                  │
│  • /api/agent/:id/lineage  /snapshots                 │
│  • POST /api/transfer/initiate                        │
└──────┬──────────────────────────────┬─────────────────┘
       │ writes                       │ reads
┌──────▼─────────┐         ┌──────────▼─────────────┐
│ Supabase       │         │ 0G Chain indexer       │
│  agents        │◀────────│ backend/src/indexer/   │
│  snapshots     │         │ chain.ts + snapshots.ts│
│  intents       │         └──────────┬─────────────┘
│  transfers     │                    │
│  equity, ticks │                    │ event watch
└────────────────┘                    │
                                      │
┌─────────────────────────────────────┼─────────────────┐
│         Runtime loop  (runtime/src/main.ts)           │
│                                                       │
│  tick()  ─▶  market.ts  ─▶  child.decide() {momentum, │
│                              meanRev, marketMaker}    │
│                            │ via 0G Compute Router    │
│                            ▼                          │
│                   signIntent(EIP-712) ─▶ AgentController
│                                                       │
│  every 6h: manager.decide() reads child Sharpe, signs │
│            new weights; publishSnapshot ─▶ 0G Storage │
│            then SnapshotAttestor.submit(epoch)        │
└──────────────────────┬────────────────────────────────┘
                       │
                       ▼
                  0G Galileo (chainId 16602)
```

Component map:

- `contracts/` — Foundry workspace (solc 0.8.20, OZ v4.9.6 pin). Deploy via `script/Deploy.s.sol`; seed via `script/SeedDemo.s.sol`.
- `runtime/` — TypeScript loop (`pnpm run loop`). Holds all crypto primitives (ECIES, EIP-712), the 0G integrations, and the strategy decide() functions.
- `backend/` — Fastify API + chain indexer. Supabase-backed (managed Postgres).
- `frontend/` — Next.js 14 App Router + Privy embedded wallet + viem.

## 7. Deploy instructions

### Prereqs

- `forge` (Foundry, any recent), `pnpm`, `node ≥ 20`.
- A funded operator EOA on Galileo (~0.1 0G). Faucet: [faucet.0g.ai](https://faucet.0g.ai).
- Supabase project (free tier ok).
- Privy app (any plan); copy the App ID.

### One-time

```bash
# clone
git clone https://github.com/<owner>/0g-APAC-Hackathon
cd 0g-APAC-Hackathon
git submodule update --init --recursive

# install
(cd contracts && forge install)
(cd runtime && pnpm install)
(cd backend && pnpm install)
(cd frontend && pnpm install)
```

### Contracts → testnet

```bash
cd contracts
cp .env.example .env   # set PRIVATE_KEY, ZG_RPC=https://evmrpc-testnet.0g.ai
forge script script/Deploy.s.sol --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy
forge script script/SeedDemo.s.sol --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy
```

Both scripts emit a JSON record to `contracts/deployments/testnet.json` — runtime, backend, and frontend all read from there.

### Database

```bash
# from backend/
supabase db push  # or apply migrations/0001_init.sql via Supabase SQL editor
```

### Runtime loop

```bash
cd runtime
cp .env.example .env
# set: ZG_RPC, OPERATOR_PRIVATE_KEY, ZG_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#      MANAGER_ID=2, MOM_ID=3, MR_ID=4, MM_ID=5
pnpm run loop
```

### Backend

```bash
cd backend
cp .env.example .env  # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ZG_RPC
pnpm run dev
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# set NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_API_URL
pnpm run dev      # local
pnpm run build && pnpm run start   # prod
```

## 8. Test instructions

```bash
# contracts
cd contracts && forge test -vv

# runtime (vitest)
cd runtime && pnpm test

# backend
cd backend && pnpm test

# frontend type-check
cd frontend && pnpm run build
```

Notable runtime tests: `brainKey.test.ts` covers ECIES roundtrip + AES-GCM tag enforcement + KDF determinism. `market.test.ts` exercises the synthetic price walk (deterministic via `MARKET_SEED`).

## 9. Reviewer notes

**Honest status of integrations:**

- **0G Chain** — fully live on Galileo (chainId 16602). All addresses above are reachable and verified.
- **0G Compute** — wired through `@0gfoundation/0g-compute-ts-sdk@0.8.3`. The SDK's ESM bundle has a broken named export, so we use a `createRequire` interop in `runtime/src/llm.ts`. `processResponse` is called for the TEE attestation check on every inference.
- **0G Storage** — the upload path falls back to a **content-addressed in-memory stub** when the live SDK call fails. The reason: `@0glabs/0g-ts-sdk@0.3.3` against the Galileo flow contract emits a function selector that the deployed flow impl doesn't accept (`0xef3e12dc` vs expected `0xbc8c11f8`). The stub preserves the same Merkle-root contract surface, so the rest of the system is unaffected. Tracked in §11.
- **0G DA** — read-only: `runtime/src/snapshot.ts` calls the DASigners precompile to read the current epoch and tags it onto every snapshot. If the call reverts we fall back to epoch `0` — the snapshot still lands, just without a DA tag.
- **Mainnet (16661)** — *not yet deployed.* All EIP-712 typed-data uses `chainId: 16602`; mainnet rollout requires re-deploying contracts and bumping the chainId constant in `runtime/src/{intent,transfer}.ts`.

**Where to look first:**

- `contracts/src/iNFT2.sol` — the ERC-7857 implementation with `transferWithReKey`.
- `runtime/src/brainKey.ts` — ECIES (secp256k1 ECDH + AES-GCM) for brain blob encryption.
- `runtime/src/intent.ts` — EIP-712 intent signing (the controller key never touches user funds; only signs child intents).
- `runtime/src/transfer.ts` — the brain re-key flow used when an iNFT is sold.
- `runtime/src/snapshot.ts` — periodic full-state publication to 0G Storage + on-chain attestation.

**Quirks you'll hit:**

- We pin OpenZeppelin to v4.9.6. v5 changed Ownable's constructor signature.
- The runtime defaults to a synthetic price walk (`market.ts`); there is no DEX on Galileo. If you wire `DUSD`/`DRISK`/`UNI_ROUTER` env vars to a real DEX deployment, the swap intent is submitted via the router. Otherwise the system simulates fills.
- `@privy-io/react-auth@3.26.0` has an unconditional import of `@farcaster/mini-app-solana` which isn't declared. We alias it to `false` in `next.config.mjs`.

## 10. Trust model

What the operator (us) can and cannot do:

| Action | Requires | Mitigation |
|---|---|---|
| Submit child intents on behalf of an iNFT | EIP-712 signature from the iNFT's owner key | Signatures are recoverable on-chain; bad routes get rejected by `AgentController.executeChildIntent`. |
| Read a brain blob in plaintext | Knowledge of the current owner's secp256k1 private key | Operator only ever holds *ciphertext* + ephemeral pubkey; private key is generated client-side via Privy and never leaves the wallet. |
| Censor an inference call | Yes, by refusing to dispatch | Inference is verifiable: each response includes a TEE attestation that's checked by `processResponse`. A censored call is no worse than a missed tick. |
| Forge a snapshot | No — snapshots are committed by `SnapshotAttestor` and signed by the operator; clients verify the storage root → blob hash → on-chain commitment chain. | Lineage is reproducible: anyone can re-derive Sharpe from `equity` table and check against `SnapshotAttestor` events. |
| Steal funds | No. The operator wallet is *not* a multisig owner or token owner. It only signs intents that the iNFT owner authorized; controller code routes funds back into the iNFT's TBA. | — |

The trust assumption is: **the iNFT owner's private key, the 0G TEE attestation, and the storage Merkle-root binding are all sound**. Everything else is replayable from public state.

## 11. Known follow-ups

1. **Storage live-upload selector fix.** Either upstream a patched ABI in `@0glabs/0g-ts-sdk`, shell out to the Go `0g-storage-client` binary, or wait for a Galileo flow contract upgrade. Until then the stub is canonical.
2. **Mainnet deploy + verify.** Pending operator funding on 16661.
3. **48 h soak test.** Will run post-deploy; needs Railway/Fly for the runtime container.

---

**Submission:** Track 2 — Agentic Trading Arena.
**Hashtags / tags:** `#0GHackathon` `#BuildOn0G` @0G_labs @0g_CN @0g_Eco @HackQuest_
