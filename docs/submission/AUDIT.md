# iNFT² End-to-End Audit

Date: 2026-05-15.
Repo state: branch `feat/inft2-impl` @ `f1c1ea0`.

This document answers four questions:

1. Is everything done?
2. What works end-to-end right now?
3. What's mocked, stubbed, or hardcoded?
4. What do you need to do before submission?

---

## 1. What's done vs. what's left

| Phase | Status | Notes |
|---|---|---|
| A — Solidity contracts | ✅ Done, **deployed on Galileo** | 6 contracts, 21/21 forge tests passing. Mainnet not deployed. |
| B — Runtime loop | ✅ Code complete | 14/14 vitest passing. Loop boots, ticks, falls back gracefully when DEX/DB missing. |
| C — Backend API + indexer | ✅ Code complete | Fastify boots, indexer + snapshot fetcher background tasks wired. No test files. |
| D — Frontend | ✅ Code complete | Next.js build green, 6 routes compile. Privy + viem + Recharts integrated. |
| E.1 — Mainnet deploy | ❌ Not done | Needs funded mainnet wallet (chainId 16661). |
| E.2 — Backend/runtime hosted | ❌ Not done | Needs Railway/Fly. |
| E.3 — Frontend on Vercel | ❌ Not done | Needs Vercel auth + a production Privy app ID. |
| E.4 — 48 h soak | ❌ Not done | Depends on E.1–E.3. |
| E.5 — README | ✅ Done | At repo root. |
| E.6 — Demo video script | ✅ Done | `docs/submission/demo-video-script.md`. Filming pending. |

## 2. Test results

| Suite | Result | Command |
|---|---|---|
| Foundry contract tests | **21/21 pass** | `cd contracts && forge test --no-match-path 'lib/**'` |
| Runtime unit tests (vitest) | **14/14 pass** | `cd runtime && pnpm test` |
| Backend tests | n/a — **no test files** | `cd backend && pnpm test` (exits with "No test files found") |
| Frontend build | ✅ compiles clean | `cd frontend && pnpm run build` |
| Runtime smoke (60 s loop) | ⚠️ ticks but every child errors | Caused by env misconfig — see §4.1. |

## 3. What's mocked or stubbed (the honest list)

These are the only places where the system substitutes a real integration with a fake or simplified path. Everything else is live.

### 3.1 — Runtime storage (live on Galileo)
- **File:** `runtime/src/storage.ts`
- **Behavior:** Uploads land on 0G Storage end-to-end. SDK 0.3.3's typechain bindings predate the deployed `FixedPriceFlow` — `submit` now takes `Submission { SubmissionData; address submitter }` but the SDK still ships the old flat-tuple selector `0xef3e12dc`, producing an empty revert that ethers v6 mis-labels as `require(false)`. We subclass the SDK's `Uploader` and override only the two methods that touch the changed ABI (`submitTransaction` re-encodes against the new shape; `processLogs` decodes the new `Submit` event where `submissionIndex` is no longer indexed). Everything else — merkle tree, segment splitting, HTTP upload to storage nodes, finalization wait — reuses the SDK as-is.
- **Verification:** smoke-storage round-trip lands a real tx (e.g. `0xd2d2e6…519563`, sequence `113733`), blob finalized on storage node per `zgs_getFileInfo`.
- **Escape hatch:** `STORAGE_STUB=true` forces an in-memory keccak256 store, kept for emergencies if the storage network ever goes offline. Off by default.
- **Test coverage:** `runtime/test/storage.test.ts` exercises the stub roundtrip; live path is verified via `runtime/scripts/smoke-storage.ts`.

### 3.2 — Runtime market data (deliberate, not a fallback)
- **File:** `runtime/src/market.ts`
- **Behavior:** Synthetic deterministic price walk (xorshift32 seeded by `MARKET_SEED`). There is no live DEX on Galileo to read from.
- **Impact:** PnL is theatre — every "trade" the runtime emits is against this walk. With `DUSD`/`DRISK`/`UNI_ROUTER` env vars set, swap intents are *submitted on-chain* but their economics only matter relative to mock tokens.

### 3.3 — Buy flow / transfer endpoint (placeholder — not wired end to end)
- **Files:** `backend/src/main.ts:66-85`, `frontend/app/agent/[id]/buy/page.tsx`
- **Behavior:**
  - Frontend asks the user to **paste their secp256k1 public key as hex**. There is no derivation from the Privy embedded wallet. **Most users will not have this on hand.**
  - Backend `/api/transfer/initiate` writes a row into the `transfers` table with `from_addr = 0x0…0`, `new_brain_root = ''`, `tx_hash = 'pending'`. Nothing reads that table.
  - The actual `reKeyAndTransfer` code in `runtime/src/transfer.ts` is correct and tested, but **no process polls the queue**. The runtime loop only handles trading ticks and snapshots.
- **Impact:** Clicking "Buy" in the frontend will return `{status: 'queued'}` and then nothing happens on-chain.

### 3.4 — Manager snapshot lineage (hardcoded zero roots)
- **File:** `runtime/src/main.ts:148-156`
- **Behavior:** Every call to `publishSnapshot` passes `prevBrainRoot` and `currBrainRoot` as `0x0…0` instead of reading the current brain blob root from `iNFT2.brainBlobOf(tokenId)`.
- **Impact:** Snapshots will land on-chain but the lineage view in the frontend (`/agent/[id]/lineage`) will be a flat list of zero roots, not a chain. The contract test `iNFT2.t.sol:test_updateBrain_chainsLineage` proves lineage works at the contract level — the runtime just isn't feeding it real values.

### 3.5 — Backend has no test suite
- `backend/package.json` declares `vitest run` but no `*.test.ts` files exist. Coverage on the indexer + snapshot fetcher is zero.

### 3.6 — Contract-side mocks (test-only, expected)
- `contracts/src/tokens/MockUSD.sol`, `MockRisk.sol`: mock ERC-20s minted by `DeployDEX.s.sol`. These ARE the dUSD/dRISK tokens used in production demo flow — they're "real" deployed contracts, not stubs in the misleading sense.
- `contracts/test/*.t.sol` uses `MockDASigners`, `MockSig`: Solidity test scaffolding. Not deployed.

## 4. Env-var checklist

Run from each package directory:

```bash
cp .env.example .env       # then fill in the values below
```

Templates now exist at:
- `contracts/.env.example`
- `runtime/.env.example`
- `backend/.env.example`
- `frontend/.env.local.example`

### 4.1 — Where the runtime smoke test broke

The 60-second smoke run produced this every tick:

```
"child step failed: Invalid parameters were provided to the RPC method"
```

Root cause: in `runtime/.env`, `MANAGER_ID=1` and children `2,3,4`. But the deployed seed (`contracts/deployments/testnet.json`) says manager `=2`, children `=3,4,5`. The runtime is asking AgentController for `walletOf(1)`, which fails.

**Fix:** edit `runtime/.env` and align with deployment record:

```
MANAGER_ID=2
MOM_ID=3
MR_ID=4
MM_ID=5
```

Then the snapshot failures `"Invalid API key"` will also need investigation — your `RPC_URL` env may include a path-embedded API key that no longer authenticates. Either set it to the public endpoint `https://evmrpc-testnet.0g.ai` or refresh the key.

### 4.2 — What you, the user, still need to provide

| Where | Variable | Why | Source |
|---|---|---|---|
| `runtime/.env` | `PRIVATE_KEY` | Operator wallet — must own the iNFTs and have Galileo gas. | Your wallet. Fund via [faucet.0g.ai](https://faucet.0g.ai). |
| `runtime/.env` | `ZG_API_KEY` | 0G Compute Router. The current value in your `.env` returns "Invalid API key" — needs to be refreshed. | Sign in at `router-api.0g.ai`. |
| `runtime/.env` | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Persist ticks, equity, snapshots. Without these the loop runs blind. | Supabase dashboard → Project settings → API. |
| `backend/.env` | same Supabase pair + `RPC_URL` | API + chain indexer read/write. | Same Supabase project. |
| `frontend/.env.local` | `NEXT_PUBLIC_PRIVY_APP_ID` | Privy login. | [dashboard.privy.io](https://dashboard.privy.io). |
| Supabase project | migration applied | Runtime writes will fail until you run `backend/supabase/migrations/0001_init.sql`. | Supabase SQL editor or `supabase db push`. |

## 5. Honest end-to-end run sequence (testnet)

If you fix the env, this is the order of operations that will produce a working demo:

1. **Wallet funded:** `PRIVATE_KEY` holds ~0.1 0G on chainId 16602.
2. **Supabase initialized:** run the migration once.
3. **Runtime env aligned:** `MANAGER_ID=2 MOM_ID=3 MR_ID=4 MM_ID=5`, valid `ZG_API_KEY`, valid `RPC_URL`.
4. **Start runtime:** `cd runtime && pnpm run loop`. Watch logs for `child decision` (with `teeVerified=true`) and `snapshot published`. The very first snapshot is the trigger that the manager needs to start producing allocations — it will fail with `no snapshots` until that lands.
5. **Start backend:** `cd backend && pnpm run dev` (or whatever start script you add — currently only `pnpm run loop` for runtime; backend needs `dev` / `start` scripts adding). Indexer will catch up on contract events.
6. **Start frontend:** `cd frontend && pnpm run dev`. Visit `/demo` — should show four agents with live PnL once equity data populates.
7. **Buy flow:** Currently mocked (see §3.3). For the demo video, the script handwaves this part; for a true end-to-end exercise, you'd need to either (a) extend the runtime with a `pollTransfers()` polling loop, or (b) drive `reKeyAndTransfer` directly from the runtime CLI.

## 6. Pre-submission shopping list

In priority order:

1. **Fix `runtime/.env`** — token IDs + RPC URL + ZG_API_KEY. (5 min, your action.)
2. **Apply the Supabase migration.** (1 min, your action.)
3. **Replace the hardcoded zero brain roots** in `runtime/src/main.ts:148-156` by reading `iNFT2.brainBlobOf(tokenId)` before the snapshot. (10 min code change; we can do this.)
4. **Add a real buy-flow wiring** — minimum viable: the runtime polls `transfers WHERE tx_hash='pending'` every N seconds, calls `reKeyAndTransfer`, updates the row. (30 min code change; we can do this.)
5. **Derive the buyer pubkey automatically** from the Privy embedded wallet instead of asking the user to paste it. Privy exposes the private key signer; `secp256k1.getPublicKey(privKey, false)` produces the uncompressed bytes. (15 min code change; we can do this.)
6. **Add backend dev script** in `backend/package.json` (current scripts: nothing for dev/start). (1 min.)
7. **Mainnet deploy** when ready — see Phase E.1.
8. **Vercel + Railway/Fly** when ready — see Phase E.2/E.3.
9. **Record the demo video** following `docs/submission/demo-video-script.md`.

Items 3–6 are local code changes I can do now if you want. Items 1, 2, 7, 8, 9 need your action (credentials, hosting, on-camera).
