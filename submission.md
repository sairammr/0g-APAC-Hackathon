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

https://x.com/inft_squared

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
