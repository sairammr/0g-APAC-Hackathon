# iNFT-squared (iNFT^2)

> Recursive intelligent NFTs on 0G. An agent that owns agents. A fund-of-agents as a single composable, transferable token.

**Track 2 — Agentic Trading Arena. 0G APAC Hackathon.**

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Why this matters](#2-why-this-matters)
3. [Quick links](#3-quick-links)
4. [Architecture](#4-architecture)
5. [Repo layout](#5-repo-layout)
6. [0G primitives we use](#6-0g-primitives-we-use)
7. [Deployed addresses](#7-deployed-addresses)
8. [Recursion model](#8-recursion-model)
9. [Trust model](#9-trust-model)
10. [Demo video](#10-demo-video)
11. [Prerequisites](#11-prerequisites)
12. [Setup and install](#12-setup-and-install)
13. [Deploy to testnet](#13-deploy-to-testnet)
14. [Run locally](#14-run-locally)
15. [Testing](#15-testing)
16. [License](#16-license)

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

One-sentence pitch (29 words): an ERC-7857 agent whose token-bound wallet can hold other ERC-7857 agents, turning a fund of TEE-running AI traders into one composable, transferable token on 0G.

## 2. Why this matters

Existing AI agent NFTs are JPEGs with a Discord bot attached. To make agents a real asset class you need all of these working together on one chain:

- **Brain confidentiality** — the buyer cannot see the seller's weights.
- **Atomic ownership transfer** — re-encryption, key handoff, and ERC-721 transfer happen in one transaction or none.
- **Verifiable execution** — proof the trade came from the model the token claims.
- **Composable wallets** — agents need to hold capital and other agents.
- **Public auditability** — without leaking the strategy.

0G is the first chain that ships TEE compute, encrypted storage, DA, and an EVM from a single team. iNFT-squared is the first product that treats all four as one composable substrate, and the recursion is what only becomes possible once you have them all.

## 3. Quick links

| Link | URL |
|---|---|
| Live frontend | https://inft-squared.vercel.app |
| GitHub repo | https://github.com/sairammr/0g-APAC-Hackathon |
| Primary on-chain (iNFT2) | https://chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b |
| Galileo explorer | https://chainscan-galileo.0g.ai |
| Galileo RPC | https://evmrpc-testnet.0g.ai |
| Galileo faucet | https://faucet.0g.ai |
| Pitch deck | `/pitch` (11 slides) |
| Guided demo | `/demo` (6 steps) |

## 4. Architecture

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

## 5. Repo layout

```
0g-APAC-Hackathon/
  contracts/          Foundry workspace (Solidity 0.8.20, OZ 4.9.6)
    src/              iNFT2, AgentController, SnapshotAttestor,
                      BrainKeyRegistry, ERC6551Registry, ERC6551Account
    test/             21 forge tests
    script/           Deploy.s.sol, SeedDemo.s.sol

  runtime/            TypeScript loop (pnpm run loop)
    src/
      main.ts         Tick loop + 6h snapshot scheduler
      llm.ts          0G Compute Router client + TEE attestation
      brainKey.ts     ECIES (secp256k1 + AES-GCM) for brain blobs
      intent.ts       EIP-712 child-intent signing
      transfer.ts     Brain re-key on sale (transferWithReKey)
      snapshot.ts     0G Storage publish + on-chain attestation
      storage.ts      0G Storage upload / download
      strategies/     momentum, meanRev, marketMaker, manager

  backend/            Fastify API + chain indexer (Supabase)

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
```

## 6. 0G primitives we use

Every component below is wired into the live system. Each entry says **what we use it for** and **where to read it in code**.

### 0G Chain (chainId 16602, Galileo testnet)

All six product contracts are deployed and verified on Galileo. Every EIP-712 intent is submitted to `AgentController`. Every snapshot is committed to `SnapshotAttestor`. Brain root commitments and re-key state live in `iNFT2` + `BrainKeyRegistry`. Code: `contracts/src/*`.

### 0G Compute (TEE inference via the Router)

Every strategy decision — momentum, mean-reversion, market-making, manager rebalance — is an LLM call through the 0G Compute Router with `verify_tee: true`. After the response we call `broker.inference.processResponse(provider, chatId)` to independently verify the TEE attestation. A failed attestation aborts the tick: we never act on an inference we cannot verify.

This is the **Sealed Inference / TEE-based execution** Track 2 specifically rewards. The strategy state never leaves the enclave, which mitigates front-running by design.

- Model: `zai-org/GLM-5-FP8`
- Router: `https://router-api-testnet.integratenetwork.work/v1` on testnet, `https://router-api.0g.ai/v1` on mainnet
- Code: `runtime/src/llm.ts`, `runtime/src/strategies/{momentum,meanRev,marketMaker,manager}.ts`

### 0G Storage (encrypted brain blobs + 6-hour snapshots)

Every iNFT's brain is encrypted with ECIES (secp256k1 ECDH + AES-256-GCM) to the current owner's pubkey, uploaded to 0G Storage, and its Merkle root is committed on-chain in `iNFT2`. Every 6 hours the runtime publishes a full snapshot (positions, PnL, equity curve, decision log) to 0G Storage and writes the storage root into `SnapshotAttestor`.

This single pipe gives two product primitives for free: **long-context memory** (brain blobs are how an agent remembers state across ticks) and **auditable lineage** (snapshots chain prev brain root to curr brain root, so tampering breaks the chain publicly).

- Code: `runtime/src/storage.ts`, `runtime/src/brainKey.ts`, `runtime/src/snapshot.ts`
- Transfer flow re-encrypts the brain to the buyer's pubkey atomically: `runtime/src/transfer.ts`

### 0G DA (DASigners precompile at `0x...1000`)

`SnapshotAttestor` reads the current DA epoch from the `IDASigners` precompile and embeds it in every snapshot row. Any indexer can verify the snapshot landed in DA without re-uploading the blob.

- Code: `contracts/src/SnapshotAttestor.sol`, `contracts/src/interfaces/IDASigners.sol`, `runtime/src/snapshot.ts`

### ERC-7857 iNFT

`iNFT2.sol` implements the draft ERC-7857 surface: every token tracks an encrypted brain root, an owner pubkey, and a `transferWithReKey` entry point that atomically re-encrypts the brain to the buyer's key and transfers the ERC-721 in one transaction.

- Code: `contracts/src/iNFT2.sol`, `contracts/src/BrainKeyRegistry.sol`, `contracts/src/interfaces/IERC7857.sol`

### ERC-6551 token-bound account (the recursion)

Every iNFT has a deterministic TBA from the canonical `(salt, chainId, tokenContract, tokenId)` formula. The manager iNFT's TBA is the on-chain owner of the three child iNFTs — that is the squared. `AgentController.executeChildIntent` recurses through the parent's TBA to broadcast a child trade in the same transaction.

- Code: `contracts/src/ERC6551Registry.sol`, `contracts/src/ERC6551Account.sol`, `contracts/src/AgentController.sol`
- Recursion test: `contracts/test/Recursion.t.sol`

### Track 2 mapping

| Track 2 ask | How we deliver it |
|---|---|
| AI-driven trading agent | Four strategies (momentum, mean-rev, MM, manager) running on 0G Compute |
| Sealed Inference / TEE | `verify_tee: true` + `processResponse` attestation; failed attestation aborts the tick |
| Front-running mitigation | Strategy state never leaves the TEE; brain blob is encrypted to the owner only |
| Verifiable execution | Snapshot lineage chains prev brain root to curr brain root, anchored to 0G DA every 6h |
| Risk management | `AgentController` enforces per-intent value cap, daily cap, nonce, expiry, target whitelist |
| Autonomous loop | Runtime ticks the observe -> decide -> sign -> execute -> snapshot cycle without human input |

## 7. Deployed addresses

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

## 8. Recursion model

```
iNFT(#2) -- owns --> TBA(#2)  -- holds --> iNFT(#3), iNFT(#4), iNFT(#5)
                                                |          |          |
                                              TBA(#3)    TBA(#4)    TBA(#5)
```

- Each iNFT has a unique ERC-6551 wallet computed deterministically from `(salt, chainId, tokenContract, tokenId)`.
- The manager iNFT's TBA is the owner of the three child iNFTs.
- Selling token #2 transfers the whole subtree in one ERC-721 transfer. The children move with the parent because their owner (the manager's TBA) now answers to a new operator key.
- Selling a child detaches only that branch. The brain is re-encrypted to the buyer's pubkey during transfer (`transferWithReKey` in `iNFT2.sol`), so the seller can no longer decrypt it.
- Depth is capped at 3 to keep recursion gas bounded.

## 9. Trust model

What the operator can and cannot do:

| Action | Requires | Mitigation |
|---|---|---|
| Submit a child intent on behalf of an iNFT | EIP-712 signature from the iNFT's owner key | Signatures recoverable on-chain. Bad routes rejected by `AgentController.executeChildIntent`. |
| Read a brain blob in plaintext | The current owner's secp256k1 private key | Operator only ever holds ciphertext + ephemeral pubkey. Owner key generated client-side by Privy, never leaves the wallet. |
| Censor an inference call | Yes, by refusing to dispatch | Each response carries a TEE attestation checked by `processResponse`. A censored call is no worse than a missed tick. |
| Forge a snapshot | No | Snapshots committed by `SnapshotAttestor`; lineage chains prev brain root to curr brain root. Tampering breaks the chain publicly. |
| Steal funds | No | The operator wallet is not a token owner. It only co-signs intents the iNFT owner authorized; the controller routes funds back into the iNFT's TBA. |

Trust assumption: **the iNFT owner's private key, the 0G TEE attestation, and the storage Merkle-root binding are all sound.** Everything else is replayable from public state.

## 10. Demo video

Under 3 minutes. Hits the four mandatory beats: core functionality, user flow, how 0G is actually used, on-chain proof.

| Time | Beat | What's on screen |
|---|---|---|
| 0:00 | Hook + title | "An AI agent you can own, trade, and stack." |
| 0:15 | Recursion in 10s | Landing; recursion diagram. The squared in one breath. |
| 0:30 | Mint | `/create`. Brain encrypted to owner pubkey (ECIES), blob uploaded to 0G Storage, root committed in `iNFT2` on Galileo. Tx link. |
| 1:00 | Live tick | `/agent/2` dashboard. Runtime calls 0G Compute Router (TEE). Attestation badge flips green after `processResponse`. EIP-712 intent signed by owner. Broadcast through TBA. Equity curve updates. |
| 1:45 | Snapshot lineage | `/agent/2/snapshot/[sid]`. Prev brain root, curr brain root, DA epoch, storage root, on-chain attestation tx. |
| 2:15 | transferWithReKey | `/agent/2/buy`. Buyer signs. Brain re-encrypts inside TEE to buyer's pubkey. ERC-721 transfers. New owner's dashboard shows a decryptable brain. |
| 2:45 | Recursion close | Manager executing a child intent through its TBA. Cut to logo. |

## 11. Prerequisites

- **Foundry** (any recent) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **Node 20+** and **pnpm 9+**
- **A funded operator EOA** on Galileo (~0.1 0G). Faucet: https://faucet.0g.ai
- **A Supabase project** (free tier). `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **A Privy app** (any plan). `App ID`.
- **A 0G Compute API key**. Create at https://pc.testnet.0g.ai with scope `inference`.

## 12. Setup and install

```bash
git clone https://github.com/sairammr/0g-APAC-Hackathon
cd 0g-APAC-Hackathon
git submodule update --init --recursive

(cd contracts && forge install)
(cd runtime  && pnpm install)
(cd backend  && pnpm install)
(cd frontend && pnpm install)
```

## 13. Deploy to testnet

Skip if you want to use the existing deployment in §7.

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY and ZG_RPC=https://evmrpc-testnet.0g.ai

forge script script/Deploy.s.sol \
  --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy

forge script script/SeedDemo.s.sol \
  --rpc-url $ZG_RPC --private-key $PRIVATE_KEY --broadcast --legacy
```

Both scripts emit `contracts/deployments/testnet.json` — the runtime, backend, and frontend all read addresses from there.

Apply the Supabase schema:

```bash
cd backend
supabase db push   # or paste supabase/migrations/*.sql in the Supabase SQL editor
```

## 14. Run locally

Three processes, three terminals. Each package has an `.env.example`.

**Runtime loop**

```bash
cd runtime
cp .env.example .env
pnpm run loop
```

**Backend API**

```bash
cd backend
cp .env.example .env
pnpm run dev
```

**Frontend**

```bash
cd frontend
cp .env.local.example .env.local
pnpm run dev
```

Open `http://localhost:3000`.

## 15. Testing

```bash
cd contracts && forge test -vv       # 21 forge tests
cd ../runtime  && pnpm test          # 14 vitest specs
cd ../backend  && pnpm test
cd ../frontend && pnpm run build     # type-check via the build
```

Highlights:
- `runtime/test/brainKey.test.ts` — ECIES roundtrip, AES-GCM tag enforcement.
- `contracts/test/Recursion.t.sol` — manager iNFT executing a child intent via its TBA.
- `contracts/test/iNFT2.t.sol` — `transferWithReKey` atomicity.

## 16. License

MIT.
