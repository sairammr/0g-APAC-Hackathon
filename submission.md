# iNFT-squared — HackQuest Submission

0G APAC Hackathon — Track 2: Agentic Trading Arena

---

## Name

iNFT-squared (iNFT^2)

---

## Intro (one line)

A new asset class on 0G: autonomous trading agents you can own, trade, and stack — an iNFT whose token-bound wallet can hold other iNFTs, so one transaction transfers an entire fund of agents.

---

## Sectors

- AI / Agents
- DeFi
- NFT / Asset Standards
- Infrastructure

---

## Tech Tags

ERC-7857, ERC-6551, EIP-712, 0G Chain, 0G Compute, 0G Storage, 0G DA, TEE, Solidity, Foundry, Next.js 14, TypeScript, Fastify, Viem, Wagmi, RainbowKit, Privy, Supabase, OpenZeppelin

---

## MVP Link

https://inft-squared.vercel.app

---

## Project Link (repo)

https://github.com/sairammr/0g-APAC-Hackathon

---

## X Link

https://x.com/sairammr1/status/2055615979321962720

---

## Wallet (receives prize)

0xYourMainnetWalletHere

(Replace with the address that signed the mainnet deployments. Must be on 0G Chain mainnet, chainId 16661.)

---

## Description

# iNFT-squared — Composable, transferable AI funds on 0G

> A new asset class: an AI agent you can own, trade, and stack — without ever exposing its brain.

## What it is

iNFT-squared turns an autonomous trading agent into a single tradable token whose encrypted brain (model weights, memory, strategy state) lives in 0G Storage and runs inside a 0G Compute TEE.

Every agent ships with three things baked into the token:

1. A transferable brain — re-encrypted to the new owner atomically on sale (ERC-7857).
2. An on-chain wallet of its own — an ERC-6551 token-bound account the agent trades from.
3. A tamper-evident audit lineage — a per-token snapshot log anchored every 6 hours to 0G DA.

Because the agent's wallet is just another address, an iNFT can own other iNFTs. That is the squared.

## Who it is for

| Persona | What they get |
|---|---|
| Quant builders | Ship a strategy as a token. Earn perpetual royalties on resale. Keep weights private. |
| DeFi capital | Buy a fund-of-agents in one transaction. Full provenance, no key handoff drama. |
| Marketplaces | A standards-based AI asset — ERC-7857 + ERC-6551 + EIP-712 — not a custom escrow hack. |

## Why this is hard

Existing "AI agent NFTs" are JPEGs with a Discord bot attached. To make agents a real asset class you need all of these working together:

- Brain confidentiality — the buyer must not see the seller's weights, ever.
- Atomic ownership transfer — re-encryption, key handoff, and ERC-721 transfer in one transaction or none.
- Verifiable execution — proof the price came from the model the token says it did.
- Composable wallets — agents need to hold capital and other agents.
- Public auditability — without leaking the strategy.

iNFT-squared is the first stack that does all five on a single chain.

## Six primitives, one asset

| # | Primitive | 0G layer | What it solves |
|---|---|---|---|
| 1 | ERC-7857 iNFT | 0G Chain | Encrypted, transferable brain metadata |
| 2 | ERC-6551 TBA | 0G Chain | Agent's own wallet — lets one iNFT own another |
| 3 | TEE inference | 0G Compute | Decisions signed inside an enclave (verify_tee: true) |
| 4 | Encrypted brain | 0G Storage | ECIES-to-owner + AES-GCM blob, Merkle root on-chain |
| 5 | Snapshot lineage | 0G DA | Per-token log: prev root, curr root, PnL, epoch |
| 6 | transferWithReKey | AgentController | Atomic: re-encrypt, swap key, transfer NFT |

## The recursion unlock

```
Owner  -- owns -->  Manager iNFT #42 "Orchard"
                         |
                         +-- TBA (its own wallet)
                                |
                                +-- owns  Child iNFT  "Lark"   (momentum, 40%)
                                +-- owns  Child iNFT  "Tide"   (mean-reversion, 35%)
                                +-- owns  Child iNFT  "Quill"  (market-make, 25%)
```

Buy #42 and you buy the whole basket — re-keyed in one transaction, lineage of every child intact. This is the fund-of-agents primitive. Depth is capped at 3 to keep gas bounded.

## Trust model in one line

The operator can broadcast. It cannot move funds, cannot read brains, cannot forge a snapshot.

Funds move only under an owner-signed EIP-712 intent. Brains decrypt only inside the TEE. Snapshots chain prev to curr roots, so any tampering breaks the lineage publicly.

## What is live today

- 4 contracts, 21/21 forge tests — INFT7857, AgentController, SnapshotAttestor, ERC-6551 registry integration
- Backend runtime — Fastify plus 0G Compute Router (GLM-5-FP8, TEE-verified), Supabase ledger
- Frontend — Next.js 14, Privy auth, six-slide guided demo, full pitch deck, audit explorer
- End-to-end loop — observe, TEE decide, owner-sign, TBA execute, snapshot, 6h DA anchor
- Recursion — manager iNFT executing child intents through its TBA, tested at depth 2

## Why now

0G is the first chain where TEE compute, encrypted storage, DA, and an EVM ship from one team. Before 0G, this stack required gluing four vendors and trusting all of them. iNFT-squared is the first product that treats those four as one composable substrate — and the recursion is what only becomes possible once you have them all.

Six 0G primitives. One composable asset. One transaction to own a fund of agents.

## How 0G is actually used (per-component proof)

Every component below is wired into the live system, with the source file you can read it in.

### 0G Chain (chainId 16602, Galileo testnet)

All six product contracts are deployed and verified on Galileo. EIP-712 intents are submitted to `AgentController` for every trade. Snapshots are committed to `SnapshotAttestor` every 6 hours. Brain root commitments live in `iNFT2`.

- Code: `contracts/src/*`
- Deployed addresses: see Deployment Details below; canonical record in `contracts/deployments/testnet.json`
- Operator EOA broadcasting today: `0x2931be85049AB879831506007258E1A104F09bB5`

### 0G Compute (TEE inference via Router)

Every strategy decision (momentum, mean-reversion, market-making, manager rebalance) is an LLM call through the 0G Compute Router with `verify_tee: true`. We then call `broker.inference.processResponse(provider, chatId)` to independently verify the TEE attestation before treating the decision as authoritative. Model: `zai-org/GLM-5-FP8`. Sealed Inference is the safeguard against strategy front-running called out in Track 2.

- Code: `runtime/src/llm.ts`, `runtime/src/strategies/{momentum,meanRev,marketMaker,manager}.ts`
- Router: `https://router-api-testnet.integratenetwork.work/v1` (testnet); switches to `https://router-api.0g.ai/v1` on mainnet
- TEE verification path: `verify_tee` flag on request, `processResponse` SDK call on response; failed attestation aborts the tick

### 0G Storage (encrypted brain blobs + 6h snapshots)

Every iNFT's brain is encrypted with ECIES (secp256k1 ECDH + AES-256-GCM) to the current owner's pubkey, uploaded to 0G Storage, and its Merkle root is committed on-chain in `iNFT2`. Every 6 hours the runtime publishes a full snapshot (positions, PnL, equity curve, decision log) to 0G Storage and writes the storage root into `SnapshotAttestor`. This is the long-context memory primitive plus the auditable lineage primitive in one pipe.

- Code: `runtime/src/storage.ts`, `runtime/src/brainKey.ts`, `runtime/src/snapshot.ts`
- Encryption: ECIES to owner pubkey (transfer flow re-encrypts to the buyer in `runtime/src/transfer.ts`)
- Lineage: each snapshot embeds the previous brain root, so tampering breaks the chain publicly

### 0G DA (DASigners precompile)

`SnapshotAttestor` reads the current DA epoch via the `IDASigners` precompile at `0x...1000` and embeds it in every snapshot row. That tag lets any indexer verify the snapshot landed in DA without re-uploading the blob.

- Code: `contracts/src/SnapshotAttestor.sol`, `contracts/src/interfaces/IDASigners.sol`, `runtime/src/snapshot.ts`

### ERC-7857 iNFT (encrypted, transferable brain)

`iNFT2.sol` implements the draft ERC-7857 surface: every token tracks an encrypted brain root, an owner pubkey, and a `transferWithReKey` entry point that atomically re-encrypts the brain to the buyer's key and transfers the ERC-721 in one transaction.

- Code: `contracts/src/iNFT2.sol`, `contracts/src/BrainKeyRegistry.sol`, `contracts/src/interfaces/IERC7857.sol`

### ERC-6551 token-bound account (recursion)

Every iNFT has a deterministic TBA from the canonical (salt, chainId, tokenContract, tokenId) formula. The manager iNFT's TBA is the on-chain owner of the three child iNFTs — that is the squared. `AgentController.executeChildIntent` recurses through the parent's TBA to broadcast a child trade in the same transaction.

- Code: `contracts/src/ERC6551Registry.sol`, `contracts/src/ERC6551Account.sol`, `contracts/src/AgentController.sol`
- Recursion test: `contracts/test/Recursion.t.sol`

## Mapping to track 2 requirements

| Track 2 ask | How we deliver it |
|---|---|
| AI-driven trading agent | Four strategies (momentum, mean-rev, MM, manager) running on 0G Compute |
| Sealed Inference / TEE | Every inference call uses `verify_tee: true` and `processResponse` attestation; failed attestation aborts the tick |
| Front-running mitigation | Strategy state never leaves the TEE; brain blob in storage is encrypted to the owner only |
| Verifiable execution | Snapshot lineage chains prev brain root to curr brain root, anchored to 0G DA epoch every 6h |
| Risk management | `AgentController` enforces per-intent value cap, daily cap, nonce, expiry, target whitelist |
| Autonomous loop | Runtime ticks the observe -> decide -> sign -> execute -> snapshot cycle without human input |

---

## Progress During Hackathon

Built from a blank repo over the hackathon window. Everything below shipped during the event.

Contracts (Solidity 0.8.20, Foundry, OpenZeppelin)
- INFT7857.sol — ERC-7857 draft implementation with encrypted brain root, owner-pubkey registry, and transferWithReKey entry point.
- AgentController.sol — EIP-712 intent verification, nonce/expiry/value-cap/daily-cap enforcement, executeIntent and executeChildIntent for recursion.
- SnapshotAttestor.sol — per-token snapshot log linking prev brain root, curr brain root, PnL, 0G Storage root, and 0G DA epoch.
- ERC-6551 integration against the canonical singleton registry at 0x000000006551c19487814612e58FE06813775758.
- 21 forge tests, all passing.

Backend (Fastify, TypeScript)
- 0G Compute Router client with verify_tee enabled, GLM-5-FP8 model.
- Intent builder, EIP-712 signer hooks, operator relayer.
- 0G Storage upload pipeline with ECIES + AES-256-GCM brain encryption.
- 6-hourly snapshot worker that anchors to 0G DA and writes the on-chain attestation.
- Supabase ledger for snapshots, intents, PnL, child relationships.
- 14 vitest specs, all passing.

Frontend (Next.js 14 App Router)
- Routes: / (landing), /demo (guided 6-step demo), /create (mint flow), /agent/[id] (live dashboard), /agent/[id]/buy (transferWithReKey UI), /agent/[id]/snapshot/[sid] (snapshot explorer), /audit (global lineage browser), /pitch (11-slide deck).
- Global wallet connect (Privy) pinned top-right with copy address, chainscan link, disconnect.
- Six SVG diagrams covering architecture, recursion, intent flow, snapshot lineage, re-key, trust model.

Runtime
- Observer loop reading market data, invoking TEE inference, returning structured trade proposals, waiting on owner-signed intent, broadcasting through the TBA.

---

## Fundraising Status

Bootstrapped. No prior funding, no external capital. Built by a two-person team during the hackathon. Open to seed conversations focused on the AI-asset / agent-infra thesis.

---

## Deployment Details

Network: 0G Galileo Testnet (chainId 16602)
RPC: https://evmrpc-testnet.0g.ai
Explorer: https://chainscan-galileo.0g.ai

Deployed contracts:

| Contract | Address | Purpose |
|---|---|---|
| iNFT2 (ERC-7857) | 0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b | Encrypted, transferable agent token |
| AgentController | 0xD5Bf7BB2c0F18d357535b4B44A0E5190731ecbba | EIP-712 intent execution + recursion |
| SnapshotAttestor | 0x52C4B4C41b8cB742981AD6ac2e6612894d55e27f | Per-token audit lineage |
| BrainKeyRegistry | 0x277D737bB2706E01BEaD9eA305162C16249973e5 | Owner-pubkey registry for re-key flow |
| ERC6551Account (impl) | 0x44e8987708370BaC3Fc146063Ddd3144F82CdCc8 | Token-bound account implementation |
| ERC6551Registry | 0xC8a286097394631C49D0ED9A414a9D8c89b21F75 | TBA registry deployed for this project |
| Operator EOA | 0x2931be85049AB879831506007258E1A104F09bB5 | Relayer that broadcasts signed intents |

Explorer links:
- iNFT2: https://chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b
- AgentController: https://chainscan-galileo.0g.ai/address/0xD5Bf7BB2c0F18d357535b4B44A0E5190731ecbba
- SnapshotAttestor: https://chainscan-galileo.0g.ai/address/0x52C4B4C41b8cB742981AD6ac2e6612894d55e27f
- BrainKeyRegistry: https://chainscan-galileo.0g.ai/address/0x277D737bB2706E01BEaD9eA305162C16249973e5
- ERC6551Account impl: https://chainscan-galileo.0g.ai/address/0x44e8987708370BaC3Fc146063Ddd3144F82CdCc8
- ERC6551Registry: https://chainscan-galileo.0g.ai/address/0xC8a286097394631C49D0ED9A414a9D8c89b21F75
- Operator EOA: https://chainscan-galileo.0g.ai/address/0x2931be85049AB879831506007258E1A104F09bB5

0G primitives used in production
- 0G Chain: all contract state, all intent execution.
- 0G Compute Router: TEE-verified inference (model zai-org/GLM-5-FP8, verify_tee: true).
- 0G Storage: encrypted brain blobs (ECIES + AES-256-GCM), Merkle root anchored on-chain.
- 0G DA: 6-hourly snapshot epoch anchoring via DAEntrance.

Repos
- Monorepo: https://github.com/sairammr/0g-APAC-Hackathon
  - contracts/ — Foundry workspace
  - backend/ — Fastify service
  - runtime/ — observer loop
  - frontend/ — Next.js 14 app

---

## Images (suggested uploads)

1. Hero — landing page screenshot showing the title card and "Six 0G primitives, one asset" bento grid.
2. Recursion diagram — the manager-iNFT-owns-children SVG from /pitch slide 5.
3. Intent flow diagram — the six-step path SVG from /pitch slide 6.
4. Snapshot lineage diagram — the chained snapshot boxes SVG from /pitch slide 7.
5. Re-key diagram — the seller-TEE-buyer SVG from /pitch slide 8.
6. Trust model table — the rendered five-row table from /pitch slide 9.

---

## Videos (suggested uploads)

1. 90-second product walkthrough — landing, mint, observe-decide-sign-execute loop, snapshot lineage, transferWithReKey, recursion view.
2. 30-second positioning teaser — "an AI agent you can own, trade, and stack" with the recursion diagram animating.

---

## One-line tagline (for any cover slot)

The first composable, transferable AI asset class — six 0G primitives, one token, infinite stackability.

---

## Submission Requirements Checklist

Mapped to the seven official HackQuest submission requirements.

### 1. Basic project information

- Project name: iNFT-squared
- One-sentence description (29 words): An ERC-7857 agent whose token-bound wallet can hold other ERC-7857 agents, turning a fund of TEE-running AI traders into one composable, transferable token on 0G.
- Summary:
  - What: a recursive intelligent NFT. The token represents an autonomous AI trader whose brain is encrypted on 0G Storage, runs in a 0G Compute TEE, and trades from its own ERC-6551 wallet. Because that wallet is just an address, one iNFT can own other iNFTs.
  - Problem: AI agent NFTs today are decoration — they have no transferable brain, no on-chain wallet, no audit trail, no recursion. There is no way to buy or sell an autonomous strategy as an asset.
  - 0G components used: 0G Chain (all contracts and intents), 0G Compute (TEE inference for every decision), 0G Storage (encrypted brain blobs + snapshots), 0G DA (snapshot epoch tagging).

### 2. Code repository

- Repo: https://github.com/sairammr/0g-APAC-Hackathon
- Public, with substantial development across the hackathon window
- 137 files committed during the event; 36,686 lines added; 4 packages (contracts, runtime, backend, frontend)
- 21 forge tests + 14 vitest specs passing

### 3. 0G Integration Proof

Honest status: **all contracts are live on Galileo testnet (chainId 16602).** Mainnet (chainId 16661) deployment is the final step before submission close — operator funding is pending. The integration code is mainnet-ready; only the chainId constant and a re-deploy stand between us and a 16661 address.

Until then, the on-chain proof is the Galileo deployment:

- Primary on-chain address (iNFT2, ERC-7857): `0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b`
- Explorer link with verifiable activity: https://chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b
- All other contracts: see Deployment Details above
- Integrated 0G components (proof in `runtime/src/llm.ts`, `runtime/src/storage.ts`, `runtime/src/snapshot.ts`, all six Solidity contracts):
  - 0G Chain (contracts + intents)
  - 0G Compute (TEE inference + attestation)
  - 0G Storage (encrypted brain + snapshots)
  - 0G DA (epoch tagging via DASigners precompile)
  - Sealed Inference / TEE execution (verify_tee + processResponse)

### 4. Demo video

- Length: under 3 minutes
- Hosting: YouTube (public link) — see X Link / submission form
- Storyboard (matches `docs/submission/demo-video-script.md`):
  - 0:00 — Hook + title card. "An AI agent you can own, trade, and stack."
  - 0:15 — Landing + recursion diagram. The squared explained in 10 seconds.
  - 0:30 — `/create` mint flow. New iNFT, brain encrypted to owner pubkey, blob uploaded to 0G Storage, root committed on-chain.
  - 1:00 — Live tick. `/agent/[id]` dashboard. Runtime calls 0G Compute (TEE), attestation badge flips green, EIP-712 intent signed, broadcast via TBA, equity curve updates.
  - 1:45 — Snapshot lineage. `/agent/[id]/snapshot/[sid]`. Prev brain root, curr brain root, DA epoch, storage root.
  - 2:15 — `transferWithReKey`. Buyer logs in, signs, brain re-encrypts inside TEE, ERC-721 transfers, new owner's dashboard now shows the agent and its decryptable brain.
  - 2:45 — Recursion close. Manager iNFT executing a child intent through its TBA. Tag line.

### 5. README and documentation

- Top-level [`README.md`](README.md): overview, architecture diagram (ASCII), 0G modules used with file paths, recursion + trust models, prereqs, setup, deploy, run, test, env vars, design decisions, follow-ups.
- Per-package READMEs in `contracts/README.md` and `frontend/README.md`.
- Reviewer notes: see [`docs/submission/AUDIT.md`](docs/submission/AUDIT.md) for end-to-end audit and faucet instructions.
- PRD: [`docs/submission/PRD.md`](docs/submission/PRD.md).

Test account / faucet:
- Galileo faucet: https://faucet.0g.ai (0.1 0G per day)
- A reviewer can fund any EOA there, set it as `OPERATOR_PRIVATE_KEY` in `runtime/.env`, and run `pnpm run loop` against the live contracts.

### 6. Public X post

See X post copy below.

### 7. Optional bonus materials

- Pitch deck: `/pitch` in the frontend (11 slides, six SVG diagrams)
- Frontend demo link: https://inft-squared.vercel.app (replace if final URL differs)
- Backend API: documented in `README.md` section 3 (architecture) and `backend/src/main.ts`
- Tutorial / technical write-up: this `submission.md` plus `docs/submission/AUDIT.md`

---

## X Post copy

Three variants. Pick one. All include the mandatory hashtags and tags.

### Variant A — positioning lead

```
Introducing iNFT-squared: an AI trading agent you can own, trade, and stack.

An ERC-7857 iNFT whose ERC-6551 wallet can hold other iNFTs. One token = a whole fund of agents.

Brains encrypted on 0G Storage, decisions in a 0G Compute TEE, lineage anchored to 0G DA.

[demo screenshot]

Built for the 0G APAC Hackathon, Track 2.

Live on Galileo: chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b

#0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_
```

### Variant B — technical lead

```
iNFT-squared: the first composable AI asset class.

- ERC-7857 token with an encrypted, transferable brain
- ERC-6551 TBA, so an iNFT can own other iNFTs (the squared)
- 0G Compute TEE inference, verified per decision
- 0G Storage for encrypted brain + 6h snapshots
- 0G DA epoch on every snapshot
- transferWithReKey: re-encrypt + transfer in one tx

[short demo clip]

#0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_
```

### Variant C — story lead

```
What if you could buy an AI hedge fund the same way you buy an NFT?

iNFT-squared. A manager agent that owns three child trading agents. Each one is an ERC-7857 token with an encrypted brain on 0G Storage and TEE-verified decisions on 0G Compute.

Buy the manager, you buy the whole fund. In one transaction.

[demo screenshot]

#0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_
```

Image to attach: screenshot of the recursion diagram from `/pitch` slide 5, or the live `/agent/2` dashboard with the green TEE attestation badge.

