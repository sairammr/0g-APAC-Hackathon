# iNFT-squared (iNFT^2)

> Recursive intelligent NFTs on 0G. An agent that owns agents. A fund-of-agents as a single composable, transferable token.

**Track 2 — Agentic Trading Arena. 0G APAC Hackathon.**

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Why this matters](#2-why-this-matters)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Repo layout](#4-repo-layout)
5. [0G primitives we use](#5-0g-primitives-we-use)
6. [Deployed addresses (Galileo testnet)](#6-deployed-addresses-galileo-testnet)
7. [Recursion model](#7-recursion-model)
8. [Trust model](#8-trust-model)
9. [Prerequisites](#9-prerequisites)
10. [Setup and install](#10-setup-and-install)
11. [Deploy to testnet](#11-deploy-to-testnet)
12. [Run locally](#12-run-locally)
13. [Testing](#13-testing)
14. [Environment variables](#14-environment-variables)
15. [Design decisions and quirks](#15-design-decisions-and-quirks)
16. [Known follow-ups](#16-known-follow-ups)
17. [Submission](#17-submission)
18. [License](#18-license)

---

## 1. What it is

iNFT-squared turns an autonomous trading agent into a single tradable token whose encrypted brain (model weights, prompts, memory, strategy state) lives in **0G Storage** and runs inside a **0G Compute** TEE.

Every agent token (an **ERC-7857 iNFT**) owns its own on-chain wallet (an **ERC-6551 token-bound account**). Because that wallet is just another address, **one iNFT can own other iNFTs.** That is the squared.

The reference deployment is a 4-token tree:

```
Manager iNFT (#2)
  +-- Momentum child iNFT (#3)
  +-- Mean-reversion child iNFT (#4)
  +-- Market-making child iNFT (#5)
```

The manager rebalances by signing EIP-712 intents. Each child trades from its own TBA. Sales transfer the brain by **re-encrypting** it to the buyer on-chain in the same transaction as the ERC-721 transfer, so the seller can no longer decrypt the strategy state.

## 2. Why this matters

Existing "AI agent NFTs" are JPEGs with a Discord bot attached. To make agents a real asset class you need all of these working together on one chain:

- **Brain confidentiality** — the buyer cannot see the seller's weights.
- **Atomic ownership transfer** — re-encryption, key handoff, and ERC-721 transfer happen in one transaction or none.
- **Verifiable execution** — proof the trade came from the model the token claims.
- **Composable wallets** — agents need to hold capital and other agents.
- **Public auditability** — without leaking the strategy.

0G is the first chain that ships TEE compute, encrypted storage, DA, and an EVM from a single team. iNFT-squared is the first product that treats all four as one composable substrate, and the recursion is what only becomes possible once you have them all.

## 3. Architecture at a glance

```
+-------------------- Frontend (Next.js 14 + Privy) --------------------+
|  /  /demo  /create  /agent/[id]  /agent/[id]/buy                      |
|  /agent/[id]/snapshot/[sid]  /audit  /pitch                           |
+---------------------------------+-------------------------------------+
                                  | REST (Privy embedded wallet)
+---------------------------------v-------------------------------------+
|              Backend (Fastify) -- backend/src/main.ts                 |
|   /api/demo-state    /api/agent/:id                                   |
|   /api/agent/:id/lineage    /api/agent/:id/snapshots                  |
|   POST /api/transfer/initiate                                         |
+--------+----------------------------------------+---------------------+
         | writes                                 | reads via indexer
+--------v---------+               +--------------v---------------------+
|   Supabase       |               |   Chain indexer                    |
|   agents         | <-------------|   backend/src/indexer/chain.ts     |
|   snapshots      |               |   backend/src/indexer/snapshots.ts |
|   intents        |               +--------------+---------------------+
|   transfers      |                              | event watch
|   equity, ticks  |                              |
+------------------+                              |
                                                  |
+-------------------------------------------------+---------------------+
|          Runtime loop -- runtime/src/main.ts                          |
|                                                                       |
|   every tick:                                                         |
|     market.ts -> child.decide() {momentum, meanRev, marketMaker}      |
|                  via 0G Compute Router (TEE, verify_tee: true)        |
|                  signIntent (EIP-712) -> AgentController              |
|                                                                       |
|   every 6h:                                                           |
|     manager.decide() reads Sharpe of children, signs new weights;     |
|     snapshot.publish() -> 0G Storage; SnapshotAttestor.submit(epoch)  |
+----------------------------+------------------------------------------+
                             |
                             v
                  0G Galileo (chainId 16602)
```

## 4. Repo layout

```
0g-APAC-Hackathon/
  contracts/          Foundry workspace (Solidity 0.8.20, OZ 4.9.6)
    src/              iNFT2, AgentController, SnapshotAttestor,
                      BrainKeyRegistry, ERC6551Registry, ERC6551Account
    test/             21 forge tests
    script/           Deploy.s.sol, SeedDemo.s.sol, DeployDEX.s.sol
    deployments/      Canonical deployment records (testnet.json)

  runtime/            TypeScript loop (pnpm run loop)
    src/
      main.ts         Tick loop + 6h snapshot scheduler
      market.ts       Synthetic price walk (seeded)
      llm.ts          0G Compute Router client + TEE attestation check
      brainKey.ts     ECIES (secp256k1 + AES-GCM) for brain blobs
      intent.ts       EIP-712 child-intent signing
      transfer.ts     Brain re-key on sale (transferWithReKey flow)
      snapshot.ts     0G Storage publish + on-chain attestation
      storage.ts      0G Storage upload / download (with stub fallback)
      chain.ts        viem clients + ABIs
      pnl.ts          PnL, Sharpe
      db.ts           Supabase writer
      strategies/     momentum, meanRev, marketMaker, manager
    test/             vitest specs

  backend/            Fastify API + chain indexer
    src/
      main.ts         HTTP server
      indexer/        Event watcher: chain.ts, snapshots.ts
      db/             Supabase client + types
      attestation.ts  Snapshot attestation verifier
    supabase/migrations/   0001_init, 0002_snapshot_tx, 0003_tick_provider

  frontend/           Next.js 14 App Router
    app/
      page.tsx                       Landing
      demo/                          6-step guided demo
      create/                        Mint flow
      agent/[id]/                    Live agent dashboard
      agent/[id]/buy/                transferWithReKey UI
      agent/[id]/snapshot/[sid]/     Snapshot explorer
      audit/                         Global lineage browser
      pitch/                         11-slide deck
    components/design/   Chrome, WalletConnect, Diagrams, AttestationModal

  docs/                  Architecture notes, PRDs
  submission.md          HackQuest submission copy
  README.md              This file
```

## 5. 0G primitives we use

| 0G primitive | How we use it | Code |
|---|---|---|
| 0G Chain (Galileo, chainId 16602) | Hosts all six contracts. EIP-712 intents and snapshot attestations land here. | `contracts/src/*` |
| 0G Storage | Stores every encrypted brain blob (ECIES) and every periodic full snapshot. Content-addressed by Merkle root. | `runtime/src/storage.ts`, `runtime/src/snapshot.ts` |
| 0G Compute | TEE-attested LLM inference for every strategy. Uses the 0G Compute Router (OpenAI-compatible) with `verify_tee: true` and a `processResponse` attestation check. | `runtime/src/llm.ts`, `runtime/src/strategies/*` |
| 0G DA (DASigners precompile at `0x...1000`) | Reads the current DA epoch and embeds it in every snapshot, so any indexer can verify the snapshot landed in DA. | `runtime/src/snapshot.ts` |
| ERC-7857 iNFT | Brain blob lineage and `transferWithReKey`. | `contracts/src/iNFT2.sol`, `contracts/src/BrainKeyRegistry.sol` |
| ERC-6551 TBA | Token-bound account per iNFT (canonical 4-word footer). Lets a parent iNFT hold child iNFTs. | `contracts/src/ERC6551Registry.sol`, `contracts/src/ERC6551Account.sol` |

## 6. Deployed addresses (Galileo testnet)

Network: 0G Galileo, chainId **16602**
RPC: `https://evmrpc-testnet.0g.ai`
Explorer: `https://chainscan-galileo.0g.ai`

| Contract | Address | Explorer |
|---|---|---|
| iNFT2 (ERC-7857) | `0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b` | [view](https://chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b) |
| AgentController | `0xD5Bf7BB2c0F18d357535b4B44A0E5190731ecbba` | [view](https://chainscan-galileo.0g.ai/address/0xD5Bf7BB2c0F18d357535b4B44A0E5190731ecbba) |
| SnapshotAttestor | `0x52C4B4C41b8cB742981AD6ac2e6612894d55e27f` | [view](https://chainscan-galileo.0g.ai/address/0x52C4B4C41b8cB742981AD6ac2e6612894d55e27f) |
| BrainKeyRegistry | `0x277D737bB2706E01BEaD9eA305162C16249973e5` | [view](https://chainscan-galileo.0g.ai/address/0x277D737bB2706E01BEaD9eA305162C16249973e5) |
| ERC6551Account (impl) | `0x44e8987708370BaC3Fc146063Ddd3144F82CdCc8` | [view](https://chainscan-galileo.0g.ai/address/0x44e8987708370BaC3Fc146063Ddd3144F82CdCc8) |
| ERC6551Registry | `0xC8a286097394631C49D0ED9A414a9D8c89b21F75` | [view](https://chainscan-galileo.0g.ai/address/0xC8a286097394631C49D0ED9A414a9D8c89b21F75) |
| Operator EOA | `0x2931be85049AB879831506007258E1A104F09bB5` | [view](https://chainscan-galileo.0g.ai/address/0x2931be85049AB879831506007258E1A104F09bB5) |

Seeded subtree:

| Role | Token ID | Token-bound wallet |
|---|---|---|
| Manager | 2 | `0x3cF56B1eECdDEC8c1a1AF65D097ba96B8Ae03EBF` |
| Momentum child | 3 | `0xf47d7C9D3ab16c3Ee1e110E012b968523743Fea4` |
| Mean-reversion child | 4 | `0x4098E662C2D674064fF6605CFCCafd89EBbAe2A9` |
| Market-maker child | 5 | `0x5498071Acc7CD4c7948808AEaC3674f8DaC8f764` |

Canonical record: [`contracts/deployments/testnet.json`](contracts/deployments/testnet.json).

Mainnet (chainId 16661) deployment is pending. See [Known follow-ups](#16-known-follow-ups).

## 7. Recursion model

```
iNFT(#2) -- owns --> TBA(#2)  -- holds --> iNFT(#3), iNFT(#4), iNFT(#5)
                                                |          |          |
                                              TBA(#3)    TBA(#4)    TBA(#5)
                                                |          |          |
                                              dUSD/dRISK ...        ...
```

- Each iNFT has a unique ERC-6551 wallet computed deterministically from `(salt, chainId, tokenContract, tokenId)`.
- The manager iNFT's TBA is the owner of the three child iNFTs.
- Selling token #2 transfers the whole subtree in one ERC-721 transfer. The children move with the parent because their owner (the manager's TBA) now answers to a new operator key.
- Selling a child detaches only that branch. The brain is re-encrypted to the buyer's pubkey during transfer (`transferWithReKey` in `iNFT2.sol`), so the seller can no longer decrypt it.
- Depth is capped at 3 to keep recursion gas bounded.

## 8. Trust model

What the operator (us) can and cannot do:

| Action | Requires | Mitigation |
|---|---|---|
| Submit a child intent on behalf of an iNFT | EIP-712 signature from the iNFT's owner key | Signatures recoverable on-chain. Bad routes get rejected by `AgentController.executeChildIntent`. |
| Read a brain blob in plaintext | The current owner's secp256k1 private key | Operator only ever holds ciphertext and the ephemeral pubkey. The owner key is generated client-side by Privy and never leaves the wallet. |
| Censor an inference call | Yes — by refusing to dispatch | Inference is verifiable: each response carries a TEE attestation that `processResponse` checks. A censored call is no worse than a missed tick. |
| Forge a snapshot | No | Snapshots are committed by `SnapshotAttestor`; lineage chains prev brain root to curr brain root. Tampering breaks the chain publicly. |
| Steal funds | No | The operator wallet is not a token owner. It only co-signs intents the iNFT owner authorized; the controller routes funds back into the iNFT's TBA. |

Trust assumption: **the iNFT owner's private key, the 0G TEE attestation, and the storage Merkle-root binding are all sound.** Everything else is replayable from public state.

## 9. Prerequisites

- **Foundry** (any recent) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **Node 20 or newer** and **pnpm 9 or newer**
- **A funded operator EOA** on Galileo (~0.1 0G). Faucet: [faucet.0g.ai](https://faucet.0g.ai)
- **A Supabase project** (free tier is fine). You will use the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **A Privy app** (any plan). You will use the `App ID`.
- **A 0G Compute API key** for the Router. Create one at [pc.0g.ai](https://pc.0g.ai) (testnet: [pc.testnet.0g.ai](https://pc.testnet.0g.ai)) with the `inference` scope.

## 10. Setup and install

```bash
git clone https://github.com/sairammr/0g-APAC-Hackathon
cd 0g-APAC-Hackathon
git submodule update --init --recursive

# install dependencies in each package
(cd contracts && forge install)
(cd runtime  && pnpm install)
(cd backend  && pnpm install)
(cd frontend && pnpm install)
```

## 11. Deploy to testnet

If you want to use the existing deployment, skip this section.

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY and ZG_RPC=https://evmrpc-testnet.0g.ai

forge script script/Deploy.s.sol \
  --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy

forge script script/SeedDemo.s.sol \
  --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy
```

Both scripts emit a JSON record to `contracts/deployments/testnet.json`. The runtime, backend, and frontend all read addresses from there, so there is one source of truth.

Apply the Supabase schema:

```bash
cd backend
# either via supabase CLI:
supabase db push
# or paste the SQL files in supabase/migrations/ into the Supabase SQL editor
```

## 12. Run locally

You need three processes running. Open three terminals.

**1. Runtime loop**

```bash
cd runtime
cp .env.example .env
# set ZG_RPC, OPERATOR_PRIVATE_KEY, ZG_API_KEY,
#     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#     MANAGER_ID=2, MOM_ID=3, MR_ID=4, MM_ID=5
pnpm run loop
```

**2. Backend API**

```bash
cd backend
cp .env.example .env
# set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ZG_RPC
pnpm run dev
```

**3. Frontend**

```bash
cd frontend
cp .env.local.example .env.local
# set NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_RPC_URL=https://evmrpc-testnet.0g.ai,
#     NEXT_PUBLIC_API_URL=http://localhost:3001
pnpm run dev
```

Open `http://localhost:3000`.

For production: `pnpm run build && pnpm run start` in the frontend.

## 13. Testing

```bash
cd contracts && forge test -vv       # 21 forge tests
cd ../runtime  && pnpm test          # 14 vitest specs
cd ../backend  && pnpm test
cd ../frontend && pnpm run build     # type-check via the build
```

Highlights:
- `runtime/test/brainKey.test.ts` — ECIES roundtrip, AES-GCM tag enforcement, KDF determinism.
- `runtime/test/market.test.ts` — deterministic synthetic walk (seed via `MARKET_SEED`).
- `contracts/test/Recursion.t.sol` — manager iNFT executing a child intent via its TBA at depth 2.
- `contracts/test/iNFT2.t.sol` — `transferWithReKey` atomicity.

## 14. Environment variables

Each package ships an `.env.example`. The key variables:

**`contracts/.env`**
- `PRIVATE_KEY` — deployer EOA
- `ZG_RPC` — `https://evmrpc-testnet.0g.ai`

**`runtime/.env`**
- `ZG_RPC`
- `OPERATOR_PRIVATE_KEY` — relayer EOA
- `ZG_API_KEY` — 0G Compute Router key (scope `inference`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `MANAGER_ID`, `MOM_ID`, `MR_ID`, `MM_ID` — token IDs from the seed (2, 3, 4, 5)
- `MARKET_SEED` — optional, seeds the synthetic price walk
- `DUSD`, `DRISK`, `UNI_ROUTER` — optional. If set, the runtime routes intents through a real DEX instead of the synthetic walk.

**`backend/.env`**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ZG_RPC`

**`frontend/.env.local`**
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_API_URL`

## 15. Design decisions and quirks

- **OpenZeppelin pinned to v4.9.6.** v5 changed `Ownable`'s constructor and breaks our import.
- **Storage stub fallback.** The live `@0glabs/0g-ts-sdk@0.3.3` upload emits a function selector (`0xef3e12dc`) that the deployed Galileo flow contract does not accept (it expects `0xbc8c11f8`). We fall back to a content-addressed in-memory stub that preserves the same Merkle-root contract surface, so the rest of the system is unaffected. Tracked in [follow-ups](#16-known-follow-ups).
- **0G Compute SDK interop.** `@0gfoundation/0g-compute-ts-sdk@0.8.3` has a broken ESM named export, so `runtime/src/llm.ts` uses `createRequire` to load it.
- **Privy + Farcaster.** `@privy-io/react-auth@3.26.0` has an unconditional import of `@farcaster/mini-app-solana` that is not declared as a dependency. We alias it to `false` in `frontend/next.config.mjs`.
- **No DEX on Galileo.** The runtime defaults to a synthetic seeded price walk. Wire `DUSD`, `DRISK`, and `UNI_ROUTER` if you have a DEX deployment. Otherwise the system simulates fills.
- **EIP-712 chainId is 16602.** Hard-coded in `runtime/src/intent.ts` and `runtime/src/transfer.ts`. Mainnet rollout requires bumping it.
- **All four agents share one operator EOA.** That EOA only broadcasts owner-signed intents. It is not a token owner and cannot move funds without a fresh owner signature.

## 16. Known follow-ups

1. **Storage live-upload selector fix.** Either upstream a patched ABI in `@0glabs/0g-ts-sdk`, shell out to the Go `0g-storage-client` binary, or wait for a Galileo flow contract upgrade. Until then the stub is canonical.
2. **Mainnet (16661) deploy and verify.** Pending operator funding. Bump the chainId constant and re-deploy.
3. **48-hour soak test.** Requires a long-running runtime container (Railway / Fly).
4. **Real DEX integration.** Once a DEX is live on Galileo, wire the env vars and remove the synthetic-walk fallback.

## 17. Submission

- Track 2 — Agentic Trading Arena
- Submission copy: [`submission.md`](submission.md)
- Pitch deck: `/pitch` (in the deployed frontend; 11 slides)
- Guided demo: `/demo` (in the deployed frontend; 6 steps)

Tags: `#0GHackathon` `#BuildOn0G` `@0G_labs` `@0g_CN` `@0g_Eco` `@HackQuest_`

## 18. License

MIT. See [`LICENSE`](LICENSE) if present, otherwise treat as MIT.
