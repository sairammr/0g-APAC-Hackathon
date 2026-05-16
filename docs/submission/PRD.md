# iNFT² — Product Requirements Document

**Track:** 0G APAC Hackathon — Track 2 (Agentic Trading Arena)
**Status:** Testnet live on 0G Galileo (chainId 16602)
**Last updated:** 2026-05-15

---

## 1. Problem

Owning an AI agent that trades for you today means trusting an opaque pile of code on someone else's server. There is no good way to:

- **Verify** that the agent's inference happened in a tamper-resistant environment.
- **Audit** the agent's decision history or its hidden state ("brain").
- **Transfer** the agent — model state and all — to a new owner without leaking the previous owner's data.
- **Compose** agents: a fund-of-agents that *owns* sub-agents, where buying the parent buys the whole tree.

The result: trading agents are SaaS subscriptions, not assets. They can't be priced, sold, or stacked.

## 2. Solution

**iNFT²** ("iNFT squared") makes every trading agent — and every fund of agents — an asset on 0G Chain.

Each agent is an **ERC-7857 iNFT**: an NFT whose hidden state ("brain blob") is encrypted with the owner's secp256k1 public key and stored on 0G Storage. The agent's wallet is an **ERC-6551 token-bound account**, computed deterministically from the iNFT's identity. Because TBAs can hold tokens — including other iNFTs — an iNFT can *own* iNFTs. That's the recursion.

A trade happens when the manager iNFT signs an **EIP-712 intent** authorizing a child's TBA to call a DEX router. Inference runs on **0G Compute** with TEE attestation. Periodic full snapshots are anchored on-chain (Merkle root in 0G Storage, tagged with the current 0G DA epoch).

Selling an iNFT triggers `transferWithReKey`: the brain blob is downloaded, decrypted, **re-encrypted to the buyer's pubkey**, re-uploaded, and the new root is committed in the same transaction that flips ownership. The seller's key is no longer useful.

## 3. Goals & non-goals

### Goals
1. **Verifiable inference.** Every strategy decision carries a TEE attestation that the operator can independently re-verify.
2. **On-chain lineage.** Every brain mutation produces a `prevRoot → currRoot` link; anyone can replay the history.
3. **Tradable agents.** A buyer purchasing token #N inherits the agent's model state, wallet, and (if it has children) the entire subtree. No SaaS migration.
4. **Composable agents.** A manager iNFT signs intents for its children; a buyer of the manager owns the fund.
5. **Operator-as-relay, not custodian.** The operator wallet never holds user funds — it only relays signed intents.

### Non-goals
1. **Cross-chain.** All contracts live on 0G. No bridges.
2. **Permissionless minting.** v1 ships with a curated seed (one manager + three workers). Open minting is a later phase.
3. **Realtime trading.** Ticks are 60 s in production; this is a discretionary-pace fund, not HFT.
4. **Native fiat onramps.** Users bring 0G to the wallet; we don't sell tokens.
5. **Custom L1.** We use 0G as-is; no chain forks.

## 4. Users

| Persona | Need | Lands on |
|---|---|---|
| **Hackathon judge / first-time visitor** | Confirm 0G integration is real; see the recursion idea demonstrated end-to-end. | `/demo` — auto-refreshing live PnL for the four-agent subtree. |
| **iNFT owner / buyer** | Inspect an agent's recent decisions, Sharpe, snapshot lineage; click Buy. | `/agent/[id]`, `/agent/[id]/buy`. |
| **Operator (us)** | Run the loop, verify TEE responses, anchor snapshots, relay transfer requests. | Runtime container (no UI). |
| **Future contributor** | Understand the architecture; extend with new strategies. | This PRD + README + `docs/submission/AUDIT.md`. |

## 5. User stories

### 5.1 — Demo viewer
> *As a judge, I open `/demo` and within 30 seconds I see live PnL for four agents, the recursion diagram, and the current 0G chainscan link.*

### 5.2 — Agent inspector
> *As an iNFT owner, I open `/agent/3`, see the Momentum agent's last 50 ticks with TEE-verified flag, its Sharpe, and its 30-day equity curve.*

### 5.3 — Buyer
> *As a buyer with a Privy embedded wallet, I open `/agent/3/buy`, click Buy, and within ~30 s I own iNFT #3 — its brain blob is re-keyed to my pubkey, and the previous owner can no longer decrypt it.*
>
> (See AUDIT §3.3 — this flow is currently a queued-row placeholder; the runtime polling loop that would dequeue it is a planned follow-up.)

### 5.4 — Operator
> *As the operator, I run `pnpm run loop`. Every minute I see one tick per child with `teeVerified=true`, and every 6 hours I see a snapshot published with a fresh Merkle root and DA epoch tag.*

### 5.5 — Auditor
> *As an auditor, I read `SnapshotAttestor` events for a given tokenId, fetch each snapshot blob from 0G Storage, verify `keccak256(blob) == storageRoot`, and replay the lineage from genesis to current.*

## 6. Functional requirements

### 6.1 Contracts (on-chain, source of truth)

| ID | Requirement | Implementation |
|---|---|---|
| FR-1 | An iNFT has an encrypted brain blob root recoverable from on-chain state. | `iNFT2.brainBlobOf(tokenId)` |
| FR-2 | Brain blob rotates on every `updateBrain`; previous root is chained. | `iNFT2.t.sol:test_updateBrain_chainsLineage` |
| FR-3 | Vanilla `safeTransferFrom` MUST revert; transfers go through `transferWithReKey`. | `iNFT2.t.sol:test_safeTransferFrom_reverts` |
| FR-4 | `transferWithReKey` requires a valid oracle signature. | `iNFT2.t.sol:test_transferWithReKey_*` |
| FR-5 | Every iNFT has a deterministic ERC-6551 wallet (canonical 4-word footer: salt, chainId, tc, tid). | `ERC6551Registry.account(...)` |
| FR-6 | `AgentController.executeChildIntent` accepts only EIP-712 intents signed by the iNFT's owner key, enforces nonce + expiry + daily cap + target allowlist. | `AgentController.t.sol` (5 tests) |
| FR-7 | Snapshots include the storage root, prev/curr brain roots, PnL, Sharpe×1e6, and the DA epoch. | `SnapshotAttestor.submit(...)` |
| FR-8 | Recursion check: a `walletOf(parent)` chain must resolve a descendant token in ≤3 hops. | `Recursion.t.sol` (5 tests) |

### 6.2 Runtime

| ID | Requirement | Implementation |
|---|---|---|
| FR-9 | Every tick produces one `decide()` call per child + one intent submission per non-hold decision. | `runtime/src/main.ts:loopOnce` |
| FR-10 | Inference call carries TEE verification via `processResponse`. | `runtime/src/llm.ts:65` |
| FR-11 | Manager rebalance reads each child's recent Sharpe from the snapshot ledger and emits a weight vector summing to 10000 bps. | `runtime/src/strategies/manager.ts` |
| FR-12 | Periodic full snapshot composes JSON blob → uploads to 0G Storage → reads DA epoch → calls `SnapshotAttestor.submit`. | `runtime/src/snapshot.ts:publishSnapshot` |
| FR-13 | Sale flow re-keys the brain: download → decrypt → re-encrypt to buyer pubkey → upload → sign Transfer digest → submit `transferWithReKey`. | `runtime/src/transfer.ts:reKeyAndTransfer` |
| FR-14 | Loop tolerates: no DEX, no Supabase, no prior snapshots — degrades gracefully without crashing. | Three guards in `main.ts`: `DEX_AVAILABLE`, `DB_ENABLED`, manager `try/catch`. |

### 6.3 Backend

| ID | Requirement | Implementation |
|---|---|---|
| FR-15 | Chain indexer watches `iNFT2 Transfer`, `iNFT2 BrainUpdated`, `SnapshotAttestor SnapshotSubmitted`, `AgentController IntentExecuted` from a persisted cursor. | `backend/src/indexer/chain.ts` |
| FR-16 | Snapshot fetcher downloads blob JSON from 0G Storage and writes `blob_json + da_verified` back to the row. | `backend/src/indexer/snapshots.ts` |
| FR-17 | REST API exposes: agent state, demo state, lineage, snapshots list. | `backend/src/main.ts` |
| FR-18 | Transfer queue accepts buy requests and (planned) the runtime drains the queue. | Endpoint exists; queue-drainer is a follow-up. |

### 6.4 Frontend

| ID | Requirement | Implementation |
|---|---|---|
| FR-19 | Privy embedded wallet, configured for Galileo as default + only chain. | `frontend/app/providers.tsx` |
| FR-20 | `/demo` shows four agents with auto-refreshing PnL. | `frontend/app/demo/page.tsx` |
| FR-21 | `/agent/[id]` shows decisions, snapshot timeline, subtree tree. | `frontend/app/agent/[id]/page.tsx` |
| FR-22 | `/agent/[id]/buy` collects buyer pubkey and posts to `/api/transfer/initiate`. | `frontend/app/agent/[id]/buy/page.tsx` (pubkey-derivation from Privy wallet is a follow-up — currently manual paste). |

## 7. Non-functional requirements

| Concern | Target | How |
|---|---|---|
| **Latency: tick → on-chain intent** | < 5 s on Galileo at 5 gwei legacy gas | Single `writeContract` per swap; nonce managed in `AgentController`. |
| **Snapshot frequency** | Every 6 h per agent | `SNAPSHOT_EVERY_MS=21600000` (default). |
| **Crypto** | secp256k1 ECDH + AES-256-GCM for brain blobs; EIP-712 for intents/transfers. | `runtime/src/brainKey.ts`, `runtime/src/intent.ts`, `runtime/src/transfer.ts`. |
| **Operator-key blast radius** | Operator can relay intents but cannot move funds out of TBAs or read brain blobs. | Controller code routes funds back to TBA; operator never holds the owner secp256k1 key. |
| **DA verification** | Every snapshot carries the current 0G DA epoch. | `runtime/src/snapshot.ts` reads `DASigners.getEpochNumber` precompile; falls back to 0 on revert. |
| **Test coverage** | All contract paths + all crypto primitives. | 21 forge tests + 14 vitest tests, including AES-GCM tag enforcement. |

## 8. Architecture (one screen)

```
┌──────────── Frontend (Next.js 14 + Privy + viem) ────────────┐
│ /demo  /agent/[id]  /agent/[id]/buy                          │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST
┌──────────────────────▼───────────────────────────────────────┐
│   Backend (Fastify) — backend/src/main.ts                    │
│  • /api/demo-state    /api/agent/:id   ...                   │
│  • indexer  +  snapshot fetcher  (background)                │
└────────┬────────────────────────────┬────────────────────────┘
         │ writes/reads               │ event watch + storage GET
┌────────▼─────────┐         ┌────────▼──────────────┐
│ Supabase         │         │ 0G Chain + 0G Storage │
│  agents, ticks   │         │ (chainId 16602)       │
│  snapshots, etc. │         └────────┬──────────────┘
└──────────────────┘                  │
                                      │
┌─────────────────────────────────────┼────────────────────────┐
│         Runtime loop  (runtime/src/main.ts)                  │
│  tick → market.ts → child.decide() {momentum, meanRev, mm}   │
│        ↓ via 0G Compute Router (TEE-attested)                │
│  signIntent (EIP-712) → AgentController on 0G Chain          │
│  every 6h: manager rebalance + publishSnapshot →             │
│            0G Storage + SnapshotAttestor + 0G DA epoch       │
└──────────────────────────────────────────────────────────────┘
```

## 9. Out of scope (v1)

- Public minting of new iNFTs.
- Cross-chain ownership.
- Strategy plug-in marketplace.
- Operator decentralization (one trusted relayer in v1).
- Real DEX integration on Galileo (no mature V2 deployment); we ship with mock USD/RISK + synthetic price walk.
- Mobile app.

## 10. Success metrics

| Metric | v1 target | Source |
|---|---|---|
| End-to-end tick success rate | > 95 % over a 48 h soak | Runtime logs + Supabase `ticks` table |
| TEE-verified inference share | > 99 % of completed inference calls | `ticks.tee_verified` aggregate |
| Snapshot landed on-chain rate | 100 % per 6 h window | `SnapshotAttestor` event count |
| Lineage continuity | Every snapshot's `prevBrainRoot` matches the previous snapshot's `currBrainRoot` for the same tokenId | Indexer assertion |
| Buy flow latency | < 60 s from click to `transferWithReKey` confirmed | Frontend tracing (follow-up — depends on dequeue wiring) |

## 11. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| 0G Storage SDK selector mismatch on Galileo | Resolved | Subclassed the SDK's `Uploader` to encode the new `Submission` ABI (wraps `SubmissionData` + `submitter`) and decode the new `Submit` event; live uploads land on Galileo. `STORAGE_STUB=true` retained as an offline escape hatch. See AUDIT §3.1. |
| 0G Compute Router rate limits | Low — would just throttle ticks | Strategy `decide()` calls are cheap; pause-then-retry on 429. |
| TEE attestation gaps if a provider goes down | Low | `processResponse` returns `null` (not `false`); we log it and continue. Provider rotation handled by router. |
| Operator key compromise | High in theory; limited blast radius in practice | Operator signs only EIP-712 intents authorized by owner keys; controller caps daily volume per agent. |
| Mainnet not yet deployed | Submission risk for the "0G mainnet address" requirement | Phase E.1 — pending operator funding on chainId 16661. |
| Buy flow placeholder | Demo risk if a judge clicks "Buy" | Demo video focuses on the trading loop; buy flow is shown as design, dequeue wiring is the obvious next milestone. |

## 12. Open questions

1. Should the operator be a multisig before mainnet? (Today: single EOA.)
2. Should strategy prompts be on-chain (in the brain blob) or off-chain (in the runtime code)? Today they're hybrid — base prompt in code, personalization in the brain.
3. Should the manager's weight decision itself be attested? (Today: yes, via the same TEE inference call.)
4. Buy flow: drain queue from the runtime, or stand up a dedicated relayer service?
5. Royalties on sale: hardcoded percent to original minter, or governance-settable?

## 13. Milestones

| Milestone | State | Done when |
|---|---|---|
| **A — Contracts** | Done | 6 contracts deployed on Galileo; 21/21 forge tests green. |
| **B — Runtime** | Done | Loop ticks, infers, signs, submits; 14/14 vitest green. |
| **C — Backend** | Done | API serves demo state; indexer + snapshot fetcher boot. |
| **D — Frontend** | Done | `/demo`, `/agent/[id]`, `/agent/[id]/buy` build clean. |
| **E.1 — Mainnet deploy** | Pending | Six contracts redeployed on 16661 + verified. |
| **E.2 — Hosting** | Pending | Backend + runtime container on Railway/Fly; uptime monitored. |
| **E.3 — Vercel** | Pending | Frontend deployed; Privy production app ID configured. |
| **E.4 — Soak** | Pending | 48 h continuous tick at default cadence, no crash. |
| **E.5 — README** | Done | Repo root README in 10 sections. |
| **E.6 — Demo video** | Script done; filming pending | 3-minute video covering tick anatomy + recursion + sale. |
| **F — Follow-ups** | Not started | Brain-root snapshot fix, buy-flow dequeue, Privy pubkey derivation, backend test suite. |

---

**Related docs:**
- `README.md` — submission-facing project overview
- `docs/submission/AUDIT.md` — what's live, what's mocked, env checklist
- `docs/submission/demo-video-script.md` — shot-by-shot for the 3-min demo
- `Hackathon.md` — competition rules + submission requirements
