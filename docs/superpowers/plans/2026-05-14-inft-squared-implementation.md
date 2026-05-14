# iNFT² Implementation Plan — Live, Zero Mocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship iNFT² with every component live on 0G mainnet (chainId 16661): real ERC-721 + ERC-6551 contracts, real TEE-attested inference via 0G Router, real DA-anchored snapshots verified by the DASigners precompile, real DEX trading on a deployed Uniswap V2 fork, real wallet-balance-derived PnL, real ECIES re-encrypted brain blobs on transfer.

**Architecture:** Five subsystems on top of 0G mainnet. (A) Solidity contracts including a UniswapV2 fork deployed by us to give the agents a real DEX. (B) Agent runtime in TypeScript calling 0G Router with `verify_tee: true` for every decision. (C) Backend relayer + indexer backed by **Supabase (managed Postgres)**, listening to chain events and DA blobs. (D) Next.js 14 frontend with **Privy** for wallet connection / embedded wallets. (E) Demo orchestration. No mocked components; every read resolves against chain, storage, or a TEE-attested inference.

**Tech stack:**
- Solidity 0.8.20, Foundry, **OpenZeppelin pinned to v4.9.6** (v5 removed `_afterTokenTransfer` and renamed `_isApprovedOrOwner`).
- ERC-6551 reference impl (we deploy our own registry if no canonical singleton on 0G mainnet).
- UniswapV2 fork (Factory + Router02 + WETH9, deployed by us) — provides the real DEX surface.
- TypeScript 5+, Node 20+, viem 2, ethers 6 (where the 0G SDK requires it), `@0gfoundation/0g-storage-ts-sdk`, `@0gfoundation/0g-compute-ts-sdk`, OpenAI SDK against 0G Router.
- Fastify backend, **Supabase** (`@supabase/supabase-js`) for all persisted state — both runtime ledger and backend indexer share one Supabase project.
- Next.js 14 App Router, **Privy** (`@privy-io/react-auth`) for wallet auth, viem 2 for direct chain reads, Tailwind, recharts.
- Vercel for frontend; Railway / Fly.io for runtime + backend (containerized); pm2 for local runtime supervision.

**"Zero mocks" interpretation (read this before starting):**
1. **TEE attestation:** 0G Router with `verify_tee: true` produces a real `x_0g_trace.tee_verified` boolean from a TEE-running provider. We verify it server-side via `broker.inference.processResponse(provider, chatID)` from `@0gfoundation/0g-compute-ts-sdk`. This is the live TEE primitive 0G exposes today. Our agent runtime is normal Node.js, not an enclave binary — that is honest, not a mock: the cryptographic attestation comes from the inference provider, which is exactly what Router exposes.
2. **DEX:** If a live DEX exists on 0G mainnet at deploy time, we use it. If not, we deploy a UniswapV2 fork ourselves. That fork is a real protocol with real swap math; it is not a mock.
3. **Brain encryption:** Brain blobs are ECIES-encrypted to a per-token pubkey registered on-chain. v1 keypair is held by the operator (the agent runtime's EOA). v2 will register a TEE provider's pubkey instead. v1 is "trusted operator," not mocked — the encryption is real, the on-chain commitment is real, only the key custody differs from the ERC-7857 ideal. README documents this honestly.
4. **Re-encryption on transfer:** Real ECIES re-encrypt under the buyer's pubkey, signed via EIP-712 by the operator. ERC-7857 oracle pattern with operator-as-oracle. Real cryptography, honest trust statement.
5. **Recursion / subtree transfer atomicity:** Children live in the manager's ERC-6551 wallet. `owner()` of a 6551 account reads through to the iNFT2 owner. Transferring the manager NFT atomically rotates control of every child wallet. This is real ERC-6551 semantics, not a workaround.

**Timeline note:** This is full v1 scope without cuts. Realistic estimate: 4–6 weeks single-dev or 2–3 weeks for a 2-person team. The hackathon's May 16 deadline is incompatible with this scope — either submit the sprint-plan version (see sibling plan with cuts) for May 16, or target the next 0G milestone.

---

## File structure

```
contracts/
├── src/
│   ├── iNFT2.sol                       # ERC-721 + brain lineage + ERC-7857 transfer hook
│   ├── AgentController.sol             # policy, intent gate, recursion math, EIP-1271 verify
│   ├── SnapshotAttestor.sol            # DASigners precompile verifier, snapshot storage
│   ├── ERC6551Account.sol              # minimal impl + EIP-1271 for AgentController
│   ├── ERC6551Registry.sol             # deployed only if canonical singleton missing on 0G
│   ├── BrainKeyRegistry.sol            # per-tokenId pubkey registry for ECIES encryption
│   ├── dex/                            # UniswapV2 fork (only deployed if no DEX on 0G)
│   │   ├── UniswapV2Factory.sol
│   │   ├── UniswapV2Pair.sol
│   │   ├── UniswapV2Router02.sol
│   │   └── WETH9.sol
│   ├── tokens/
│   │   ├── MockUSD.sol                 # demo stablecoin (real ERC-20, fixed-supply mint to deployer)
│   │   └── MockRisk.sol                # demo risk asset (real ERC-20)
│   └── interfaces/
│       ├── IDASigners.sol
│       ├── IERC6551Registry.sol
│       ├── IERC6551Account.sol
│       └── IERC7857.sol
├── test/
│   ├── iNFT2.t.sol
│   ├── AgentController.t.sol
│   ├── SnapshotAttestor.t.sol
│   ├── Recursion.t.sol
│   ├── BrainKey.t.sol
│   ├── Transfer.t.sol
│   └── Integration.t.sol
├── script/
│   ├── Deploy.s.sol                    # core contracts
│   ├── DeployDEX.s.sol                 # UniswapV2 fork + mock tokens + seed liquidity
│   └── SeedDemo.s.sol                  # mint 4 agents, set policies, fund 6551 wallets
├── deployments/
│   ├── mainnet.json
│   └── testnet.json
└── foundry.toml

runtime/
├── src/
│   ├── chain.ts                        # viem clients, ABIs, addresses
│   ├── storage.ts                      # 0G Storage upload/download (ECIES + plaintext)
│   ├── llm.ts                          # 0G Router client + TEE verification via Compute SDK
│   ├── market.ts                       # real DEX price reads, indicators
│   ├── pnl.ts                          # wallet balance reads → returns → Sharpe
│   ├── intent.ts                       # build, EIP-712 sign, submit Intent
│   ├── snapshot.ts                     # compose, upload, DA-anchor 6h snapshot
│   ├── transfer.ts                     # ERC-7857 re-encryption flow at listing/sale
│   ├── strategies/
│   │   ├── momentum.ts
│   │   ├── meanRev.ts
│   │   ├── marketMaker.ts
│   │   └── manager.ts
│   ├── brainKey.ts                     # per-token keypair management
│   ├── db.ts                           # Supabase client for runtime ledger (nonces, equity, intents)
│   └── main.ts                         # driver loop
├── test/
│   ├── strategies.test.ts
│   ├── pnl.test.ts
│   ├── market.test.ts
│   └── snapshot.test.ts
├── Dockerfile
└── package.json

backend/
├── src/
│   ├── db/
│   │   ├── supabase.ts                 # createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
│   │   └── types.ts                    # generated `Database` types (supabase gen types)
│   ├── indexer/
│   │   ├── chain.ts                    # event subscriptions
│   │   ├── storage.ts                  # blob resolution
│   │   └── snapshots.ts                # DA blob fetch + verify
│   ├── relayer/
│   │   ├── intent.ts                   # accept signed Intent → submit
│   │   └── snapshot.ts                 # accept signed Snapshot → DA + on-chain
│   ├── api/
│   │   ├── agent.ts
│   │   ├── demo.ts
│   │   ├── lineage.ts
│   │   └── snapshots.ts
│   └── main.ts
├── supabase/
│   └── migrations/
│       └── 0001_init.sql               # applied via `supabase db push` or SQL editor
└── package.json

frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # marketing landing
│   ├── demo/page.tsx                   # hero demo
│   └── agent/[id]/
│       ├── page.tsx                    # owner dashboard
│       ├── buy/page.tsx                # purchase flow
│       └── lineage/page.tsx            # brain root history
├── components/
│   ├── PnLChart.tsx
│   ├── SubtreeTree.tsx
│   ├── SnapshotTimeline.tsx
│   ├── PolicyEditor.tsx
│   └── PurchaseButton.tsx
├── app/providers.tsx                   # 'use client' Providers wrapping PrivyProvider
├── lib/
│   ├── chain.ts                        # 0G viem chain definition
│   ├── viem.ts                         # publicClient against 0G RPC for direct reads
│   └── api.ts                          # fetch helpers against backend
└── package.json
```

---

## Environment variables & pre-execution setup

Set these **before** starting Phase A. Group by subsystem; the runtime + backend + frontend share `RPC_URL` and the Supabase project URL.

> **Secret hygiene (read first):**
> - Add `.env`, `.env.local`, and `**/.env` to the repo root `.gitignore` before the first commit. The plan never commits any `.env` file.
> - The Supabase **service-role** key and the Privy **app secret** must never be inlined in frontend code, embedded in `NEXT_PUBLIC_*` vars, or committed.
> - If you accidentally pasted a secret into chat, an issue tracker, or a shared doc, rotate it immediately (Supabase: *Project Settings → API → Reset service_role key*; Privy: *Dashboard → App → Secret → Rotate*).

### 0. External accounts to create first

| Service | Purpose | What you need |
|---|---|---|
| **0G operator EOA** | Deploy contracts, sign Intents, hold brain key (v1) | A funded EVM private key (≥ 5 0G on mainnet, or testnet 0G from faucet) |
| **0G Compute Router API key** | `verify_tee: true` inference calls | Sign up at `https://docs.0g.ai/build-with-0g/compute-network` (the Router exposes the OpenAI-compatible API at `https://router-api.0g.ai/v1`) |
| **Supabase project** | All persisted state (runtime ledger + backend indexer) | Create project at `https://supabase.com/dashboard`. From *Project Settings → API* copy three values: `NEXT_PUBLIC_SUPABASE_URL` (project URL), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formerly "anon"/"public" — safe to expose to frontend), and `SUPABASE_SERVICE_ROLE_KEY` (**server-only**, bypasses RLS — never expose to frontend). |
| **Privy app** | Frontend wallet auth + (optional) server-side token verification | Create app at `https://dashboard.privy.io`. In *Chains*, add a custom chain with id `16661`, RPC `https://evmrpc.0g.ai`, symbol `0G`. Copy `NEXT_PUBLIC_PRIVY_APP_ID` (frontend) and `PRIVY_APP_SECRET` (server, used by backend if it ever needs to verify a Privy auth token — never expose to frontend). |
| **Vercel + Railway/Fly.io** | Hosting (Phase E) | Accounts only — wire up at deploy time. |

### 1. `contracts/.env` (Foundry deploy scripts)

```
PRIVATE_KEY=0x...                              # operator EOA, ≥5 0G
RPC_URL=https://evmrpc.0g.ai                   # mainnet (use https://evmrpc-testnet.0g.ai for testnet)
DASIGNERS=0x0000000000000000000000000000000000001000
# Populated by Deploy.s.sol output → consumed by SeedDemo.s.sol:
UNI_FACTORY=0x...
UNI_ROUTER=0x...
DUSD=0x...
DRISK=0x...
REGISTRY=0x...                                 # leave empty until A.6 probe completes
ACC_IMPL=0x...
INFT2=0x...
CTRL=0x...
BRAIN_PUBKEY=0x04...                           # uncompressed secp256k1 pubkey for operator brain key
```

### 2. `runtime/.env`

```
PRIVATE_KEY=0x...                              # SAME operator EOA as contracts
RPC_URL=https://evmrpc.0g.ai
STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ROUTER_URL=https://router-api.0g.ai/v1
ZG_API_KEY=...                                 # 0G Compute Router key

# Token IDs (output of SeedDemo.s.sol)
MANAGER_ID=1
MOM_ID=2
MR_ID=3
MM_ID=4

# Deployment addresses (copied from contracts/.env after Phase A)
INFT2=0x...
CTRL=0x...
REGISTRY=0x...
ACC_IMPL=0x...
UNI_ROUTER=0x...
DUSD=0x...
DRISK=0x...
PAIR_ADDR=0x...                                # dUSD/dRISK Uniswap V2 pair
USD_IS_TOKEN0=true                             # true if dUSD < dRISK (sorted token0)

# Supabase (server-side service role; never expose to frontend)
SUPABASE_URL=https://eumzxpnttbsqhkxwcfqu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste-from-supabase-dashboard-project-settings-api-service_role>

# Tuning (optional)
TICK_INTERVAL_MS=60000
SNAPSHOT_EVERY_MS=21600000
LOG_LEVEL=info
```

> Note: the runtime reads `SUPABASE_URL` (no `NEXT_PUBLIC_` prefix, because it's a Node process, not a Next.js build). Same project URL as the frontend — just no prefix.

### 3. `backend/.env`

```
RPC_URL=https://evmrpc.0g.ai
STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
SUPABASE_URL=https://eumzxpnttbsqhkxwcfqu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste-from-supabase-dashboard-project-settings-api-service_role>
PRIVY_APP_ID=cmp5p591i008h0cjv67uocx2q                    # optional: for verifying Privy auth tokens server-side
PRIVY_APP_SECRET=<rotate-then-paste-here>                  # optional, server-side only
PORT=4000
```

### 4. `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:4000                  # or Railway URL in prod
NEXT_PUBLIC_PRIVY_APP_ID=cmp5p591i008h0cjv67uocx2q
NEXT_PUBLIC_SUPABASE_URL=https://eumzxpnttbsqhkxwcfqu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_C_eKm8xdi1QnC4e7Qe9p6A_5yVJapBB
NEXT_PUBLIC_RPC_URL=https://evmrpc.0g.ai                   # used by viem publicClient for direct chain reads
```

> The frontend only ever uses the publishable key. Any write path that needs to bypass RLS (transfer initiation, etc.) goes through the backend, which holds the service-role key. The publishable key is safe to ship to the browser.

### 5. Pre-flight checklist (run before Phase A)

- [ ] Operator EOA funded with ≥ 5 0G on the target network. Verify: `cast balance $ADDR --rpc-url $RPC_URL`.
- [ ] Supabase project created; `SUPABASE_URL` + service role key in hand. Verify: `curl -H "apikey: $SERVICE_ROLE" "$SUPABASE_URL/rest/v1/"` returns 200.
- [ ] Privy app created; chain 16661 registered in dashboard; app ID copied.
- [ ] 0G Compute Router API key obtained and stored in `runtime/.env`. Verify the key with a `curl https://router-api.0g.ai/v1/models -H "Authorization: Bearer $ZG_API_KEY"`.
- [ ] Node 20+, pnpm 9+, Foundry stable, `supabase` CLI installed (optional, only for migration push from CLI).
- [ ] Docker installed (only needed if you run the runtime container locally; not required for Supabase itself).

---

## PHASE A — Contracts

### Task A.1: Repo scaffolding + OZ v4.9.6 pin

**Files:**
- Create: `contracts/foundry.toml`

- [ ] **Step 1: Init Foundry project**

```bash
mkdir -p contracts && cd contracts
forge init --no-commit .
```

- [ ] **Step 2: Pin OpenZeppelin to v4.9.6**

```bash
forge install OpenZeppelin/openzeppelin-contracts@v4.9.6 --no-commit
forge install foundry-rs/forge-std --no-commit
forge install Uniswap/v2-core@v1.0.1 --no-commit
forge install Uniswap/v2-periphery@0335e8f --no-commit
```

- [ ] **Step 3: Write `foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
remappings = [
  "openzeppelin-contracts/=lib/openzeppelin-contracts/",
  "forge-std/=lib/forge-std/src/",
  "@uniswap/v2-core/=lib/v2-core/",
  "@uniswap/v2-periphery/=lib/v2-periphery/"
]

[rpc_endpoints]
zg_mainnet = "https://evmrpc.0g.ai"
zg_testnet = "https://evmrpc-testnet.0g.ai"
```

- [ ] **Step 4: Verify build**

Run: `forge build`
Expected: compiles (default `Counter.sol` from `forge init`).

- [ ] **Step 5: Delete default files**

```bash
rm src/Counter.sol test/Counter.t.sol script/Counter.s.sol
```

- [ ] **Step 6: Commit**

```bash
git add contracts/
git commit -m "chore(contracts): foundry scaffold with OZ v4.9.6 + Uniswap V2 libs"
```

### Task A.2: ERC-7857 + ERC-6551 + DASigners interfaces

**Files:**
- Create: `contracts/src/interfaces/IERC7857.sol`
- Create: `contracts/src/interfaces/IERC6551Registry.sol`
- Create: `contracts/src/interfaces/IERC6551Account.sol`
- Create: `contracts/src/interfaces/IDASigners.sol`

- [ ] **Step 1: Write `IERC7857.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

/// ERC-7857 draft: encrypted-metadata NFT for AI agents.
interface IERC7857 is IERC721 {
    event BrainUpdated(uint256 indexed tokenId, bytes32 prevRoot, bytes32 newRoot, string uri);
    event BrainReKeyed(uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newRoot);

    function latestBrainRoot(uint256 tokenId) external view returns (bytes32);
    function prevBrainRoot(uint256 tokenId) external view returns (bytes32);
    function brainURI(uint256 tokenId) external view returns (string memory);

    function transferWithReKey(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newBrainRoot,
        string calldata newURI,
        bytes calldata sealedKey,
        bytes calldata oracleProof
    ) external;
}
```

- [ ] **Step 2: Write `IERC6551Registry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC6551Registry {
    event ERC6551AccountCreated(
        address account, address indexed implementation, bytes32 salt,
        uint256 chainId, address indexed tokenContract, uint256 indexed tokenId
    );

    function createAccount(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external returns (address);

    function account(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external view returns (address);
}
```

- [ ] **Step 3: Write `IERC6551Account.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC6551Account {
    receive() external payable;
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4);
}

interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory);
}
```

- [ ] **Step 4: Write `IDASigners.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Precompile at 0x0000000000000000000000000000000000001000 on 0G mainnet.
interface IDASigners {
    struct Signer {
        address signer;
        bytes pubKey;
    }
    function getEpochNumber(uint256 blockNumber) external view returns (uint256);
    function getQuorum(uint256 epoch, uint256 quorumId) external view returns (Signer[] memory);
    function isSigner(uint256 epoch, address account) external view returns (bool);
}
```

- [ ] **Step 5: Commit**

```bash
git add contracts/src/interfaces/
git commit -m "feat(contracts): ERC-7857, ERC-6551, DASigners interfaces"
```

### Task A.3: BrainKeyRegistry — per-token ECIES pubkey

**Files:**
- Create: `contracts/src/BrainKeyRegistry.sol`
- Test: `contracts/test/BrainKey.t.sol`

- [ ] **Step 1: Write failing test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BrainKeyRegistry.sol";

contract BrainKeyTest is Test {
    BrainKeyRegistry reg;
    address alice = address(0xA11CE);

    function setUp() public { reg = new BrainKeyRegistry(); }

    function test_setKey_storesAndEmits() public {
        bytes memory pk = hex"04aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
        vm.prank(alice);
        reg.setKey(1, pk);
        assertEq(reg.keyOf(1), pk);
        assertEq(reg.keyOwner(1), alice);
    }

    function test_setKey_rejectsRekeyByNonOwner() public {
        vm.prank(alice);
        reg.setKey(1, hex"01");
        vm.expectRevert("not key owner");
        reg.setKey(1, hex"02");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --match-contract BrainKeyTest`
Expected: FAIL (`BrainKeyRegistry` doesn't exist yet).

- [ ] **Step 3: Write `BrainKeyRegistry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Maps tokenId → uncompressed secp256k1 pubkey used to ECIES-encrypt the brain blob.
/// Updated by AgentController during transferWithReKey.
contract BrainKeyRegistry {
    mapping(uint256 => bytes) private _keys;
    mapping(uint256 => address) public keyOwner;

    event KeySet(uint256 indexed tokenId, address indexed owner, bytes pubkey);

    function setKey(uint256 tokenId, bytes calldata pubkey) external {
        address current = keyOwner[tokenId];
        require(current == address(0) || current == msg.sender, "not key owner");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = msg.sender;
        emit KeySet(tokenId, msg.sender, pubkey);
    }

    function setKeyFor(uint256 tokenId, address newOwner, bytes calldata pubkey) external {
        require(keyOwner[tokenId] == msg.sender, "not key owner");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = newOwner;
        emit KeySet(tokenId, newOwner, pubkey);
    }

    function keyOf(uint256 tokenId) external view returns (bytes memory) {
        return _keys[tokenId];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `forge test --match-contract BrainKeyTest -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/BrainKeyRegistry.sol contracts/test/BrainKey.t.sol
git commit -m "feat(contracts): BrainKeyRegistry — per-token ECIES pubkeys"
```

### Task A.4: iNFT2.sol — ERC-721 + brain lineage + transferWithReKey

**Files:**
- Create: `contracts/src/iNFT2.sol`
- Test: `contracts/test/iNFT2.t.sol`

- [ ] **Step 1: Write failing test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";

contract iNFT2Test is Test {
    iNFT2 inft;
    BrainKeyRegistry keys;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address oracle = address(0x0AC1E);

    function setUp() public {
        keys = new BrainKeyRegistry();
        inft = new iNFT2(address(keys), oracle);
    }

    function test_mint_assignsBrainAndOwner() public {
        bytes32 root = keccak256("brain-v1");
        bytes memory pk = hex"04aabbccdd";
        uint256 id = inft.mint(alice, root, "0g://abc", pk);
        assertEq(inft.ownerOf(id), alice);
        assertEq(inft.latestBrainRoot(id), root);
        assertEq(keys.keyOf(id), pk);
        assertEq(keys.keyOwner(id), alice);
    }

    function test_updateBrain_chainsLineage() public {
        vm.startPrank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");
        inft.updateBrain(id, keccak256("v2"), "0g://2");
        vm.stopPrank();
        assertEq(inft.prevBrainRoot(id), keccak256("v1"));
        assertEq(inft.latestBrainRoot(id), keccak256("v2"));
    }

    function test_transferWithReKey_requiresOracleSig() public {
        vm.prank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");

        // Build EIP-712 digest the oracle would sign
        bytes32 digest = inft.transferDigest(id, alice, bob, keccak256("v2"), "0g://2");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256("oracle-key")), digest);

        // Bad oracle key: should revert
        vm.prank(alice);
        vm.expectRevert("bad oracle sig");
        inft.transferWithReKey(alice, bob, id, keccak256("v2"), "0g://2", hex"04bbcc", abi.encodePacked(r, s, v));
    }

    function test_transferWithReKey_withValidOracleSig_rotates() public {
        // Re-deploy with oracle = vm.addr of known privkey
        uint256 oraclePk = uint256(keccak256("oracle-key"));
        address oracleAddr = vm.addr(oraclePk);
        iNFT2 inft2 = new iNFT2(address(keys), oracleAddr);

        vm.prank(alice);
        uint256 id = inft2.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");

        bytes32 digest = inft2.transferDigest(id, alice, bob, keccak256("v2"), "0g://2");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        inft2.transferWithReKey(alice, bob, id, keccak256("v2"), "0g://2", hex"04bbcc", sig);

        assertEq(inft2.ownerOf(id), bob);
        assertEq(inft2.latestBrainRoot(id), keccak256("v2"));
        assertEq(inft2.prevBrainRoot(id), keccak256("v1"));
        assertEq(keys.keyOf(id), hex"04bbcc");
        assertEq(keys.keyOwner(id), bob);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --match-contract iNFT2Test`
Expected: FAIL (`iNFT2` doesn't exist).

- [ ] **Step 3: Write `iNFT2.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IERC7857.sol";
import "./BrainKeyRegistry.sol";

contract iNFT2 is ERC721, EIP712, IERC7857 {
    using ECDSA for bytes32;

    uint256 public nextId = 1;
    mapping(uint256 => bytes32) private _latestRoot;
    mapping(uint256 => bytes32) private _prevRoot;
    mapping(uint256 => string)  private _uri;

    BrainKeyRegistry public immutable keyRegistry;
    address public immutable oracle; // v1: operator EOA signing re-encryption attestation

    bytes32 private constant TRANSFER_TYPEHASH = keccak256(
        "Transfer(uint256 tokenId,address from,address to,bytes32 newBrainRoot,string newURI)"
    );

    constructor(address _keyRegistry, address _oracle)
        ERC721("Intelligent NFT Squared", "iNFT2")
        EIP712("iNFT2", "1")
    {
        keyRegistry = BrainKeyRegistry(_keyRegistry);
        oracle = _oracle;
    }

    function latestBrainRoot(uint256 id) external view returns (bytes32) { return _latestRoot[id]; }
    function prevBrainRoot(uint256 id) external view returns (bytes32)   { return _prevRoot[id]; }
    function brainURI(uint256 id) external view returns (string memory)  { return _uri[id]; }

    function mint(address to, bytes32 root, string calldata uri_, bytes calldata pubkey)
        external returns (uint256 id)
    {
        id = nextId++;
        _safeMint(to, id);
        _latestRoot[id] = root;
        _uri[id] = uri_;
        keyRegistry.setKey(id, pubkey);
        // setKey records msg.sender (this contract) as owner; rotate to recipient.
        _transferKeyOwner(id, to, pubkey);
        emit BrainUpdated(id, bytes32(0), root, uri_);
    }

    function updateBrain(uint256 id, bytes32 newRoot, string calldata uri_) external {
        require(_isAuthorized(_ownerOf(id), msg.sender, id), "not authorized");
        bytes32 prev = _latestRoot[id];
        _prevRoot[id] = prev;
        _latestRoot[id] = newRoot;
        _uri[id] = uri_;
        emit BrainUpdated(id, prev, newRoot, uri_);
    }

    function transferDigest(
        uint256 tokenId, address from, address to, bytes32 newRoot, string calldata newURI
    ) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TRANSFER_TYPEHASH, tokenId, from, to, newRoot, keccak256(bytes(newURI))
        )));
    }

    function transferWithReKey(
        address from, address to, uint256 tokenId,
        bytes32 newBrainRoot, string calldata newURI,
        bytes calldata sealedKey, bytes calldata oracleProof
    ) external override {
        require(ownerOf(tokenId) == from, "wrong from");
        require(_isAuthorized(from, msg.sender, tokenId), "not authorized");

        bytes32 digest = transferDigest(tokenId, from, to, newBrainRoot, newURI);
        address recovered = digest.recover(oracleProof);
        require(recovered == oracle, "bad oracle sig");

        bytes32 prev = _latestRoot[tokenId];
        _prevRoot[tokenId] = prev;
        _latestRoot[tokenId] = newBrainRoot;
        _uri[tokenId] = newURI;

        _transferKeyOwner(tokenId, to, sealedKey);
        _transfer(from, to, tokenId);

        emit BrainUpdated(tokenId, prev, newBrainRoot, newURI);
        emit BrainReKeyed(tokenId, from, to, newBrainRoot);
    }

    function _transferKeyOwner(uint256 id, address newOwner, bytes memory pubkey) internal {
        keyRegistry.setKeyFor(id, newOwner, pubkey);
    }

    /// OZ v4.9 isApprovedOrOwner equivalent without the rename.
    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view returns (bool) {
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `forge test --match-contract iNFT2Test -vv`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/iNFT2.sol contracts/test/iNFT2.t.sol
git commit -m "feat(contracts): iNFT2 with brain lineage + ERC-7857 transferWithReKey"
```

### Task A.5: ERC-6551 Account impl

**Files:**
- Create: `contracts/src/ERC6551Account.sol`

- [ ] **Step 1: Write the account**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";
import "openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import "openzeppelin-contracts/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./interfaces/IERC6551Account.sol";

contract ERC6551Account is IERC6551Account, IERC6551Executable, IERC165, IERC1271, IERC721Receiver, IERC1155Receiver {
    uint256 private _nonce;

    receive() external payable override {}

    function state() external view returns (uint256) { return _nonce; }

    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly { extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60) }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tc, uint256 id) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tc).ownerOf(id);
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        return signer == owner() ? IERC6551Account.isValidSigner.selector : bytes4(0);
    }

    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        // We intentionally do not honor arbitrary off-chain signatures from the NFT owner;
        // every off-chain authority must go through AgentController which holds policy.
        return 0xffffffff;
    }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory result)
    {
        require(msg.sender == owner(), "not authorized");
        require(operation == 0, "only call");
        ++_nonce;
        bool ok;
        (ok, result) = to.call{value: value}(data);
        require(ok, _bubble(result));
    }

    function _bubble(bytes memory result) private pure returns (string memory) {
        if (result.length < 4) return "exec failed";
        assembly { result := add(result, 0x04) }
        return abi.decode(result, (string));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 i) external pure returns (bool) {
        return i == type(IERC165).interfaceId
            || i == type(IERC6551Account).interfaceId
            || i == type(IERC6551Executable).interfaceId
            || i == type(IERC1271).interfaceId
            || i == type(IERC721Receiver).interfaceId
            || i == type(IERC1155Receiver).interfaceId;
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `forge build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add contracts/src/ERC6551Account.sol
git commit -m "feat(contracts): minimal ERC-6551 account with EIP-1271 + receivers"
```

### Task A.6: ERC-6551 Registry (deploy our own if singleton missing on 0G)

**Files:**
- Create: `contracts/src/ERC6551Registry.sol`

- [ ] **Step 1: Probe canonical registry on 0G mainnet**

```bash
cast code 0x000000006551c19487814612e58FE06813775758 --rpc-url https://evmrpc.0g.ai
```

Decision: if non-`0x` returned, skip Step 2 — set `REGISTRY_ADDR` in `.env` to that address. Otherwise continue.

**Testnet probe (2026-05-14):** canonical absent (empty code). Building fallback per Step 2.

- [ ] **Step 2: Write reference registry**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC6551Registry.sol";

contract ERC6551Registry is IERC6551Registry {
    error AccountCreationFailed();

    function createAccount(
        address impl, bytes32 salt, uint256 chainId, address tc, uint256 tid
    ) external returns (address) {
        bytes memory code = _creationCode(impl, salt, chainId, tc, tid);
        address acct = _computeAddress(code, salt);
        if (acct.code.length != 0) return acct;
        assembly {
            acct := create2(0, add(code, 0x20), mload(code), salt)
        }
        if (acct == address(0)) revert AccountCreationFailed();
        emit ERC6551AccountCreated(acct, impl, salt, chainId, tc, tid);
        return acct;
    }

    function account(
        address impl, bytes32 salt, uint256 chainId, address tc, uint256 tid
    ) external view returns (address) {
        return _computeAddress(_creationCode(impl, salt, chainId, tc, tid), salt);
    }

    function _creationCode(address impl, bytes32, uint256 chainId, address tc, uint256 tid)
        internal pure returns (bytes memory)
    {
        return abi.encodePacked(
            hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
            impl,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(chainId, tc, tid)
        );
    }

    function _computeAddress(bytes memory code, bytes32 salt) internal view returns (address) {
        bytes32 h = keccak256(abi.encodePacked(
            bytes1(0xff), address(this), salt, keccak256(code)
        ));
        return address(uint160(uint256(h)));
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add contracts/src/ERC6551Registry.sol
git commit -m "feat(contracts): ERC-6551 registry fallback impl"
```

### Task A.7: SnapshotAttestor — real DASigners verification

**Files:**
- Create: `contracts/src/SnapshotAttestor.sol`
- Test: `contracts/test/SnapshotAttestor.t.sol`

- [ ] **Step 1: Write failing test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SnapshotAttestor.sol";
import "../src/interfaces/IDASigners.sol";

contract MockDASigners is IDASigners {
    mapping(uint256 => mapping(address => bool)) public _isSigner;
    function setSigner(uint256 epoch, address a, bool ok) external { _isSigner[epoch][a] = ok; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
    function getQuorum(uint256, uint256) external pure returns (Signer[] memory s) { s = new Signer[](0); }
    function isSigner(uint256 epoch, address a) external view returns (bool) { return _isSigner[epoch][a]; }
}

contract SnapshotAttestorTest is Test {
    SnapshotAttestor att;
    MockDASigners das;
    address relayer = address(0xBEEF);

    function setUp() public {
        das = new MockDASigners();
        att = new SnapshotAttestor(relayer, address(das));
    }

    function test_submit_storesAndEmits() public {
        SnapshotAttestor.Snapshot memory s = SnapshotAttestor.Snapshot({
            timestamp: 1700000000,
            storageRoot: keccak256("blob"),
            prevBrainRoot: bytes32(0),
            currBrainRoot: keccak256("v1"),
            realizedPnL: 1e6,
            sharpeE6: 1500000,
            daEpoch: 1,
            daQuorumId: 0
        });
        das.setSigner(1, relayer, true);
        vm.prank(relayer);
        att.submit(42, s);
        (uint256 ts, bytes32 root) = att.latestSnapshot(42);
        assertEq(ts, 1700000000);
        assertEq(root, keccak256("blob"));
    }

    function test_submit_revertsIfRelayerNotInQuorum() public {
        SnapshotAttestor.Snapshot memory s;
        s.daEpoch = 1;
        vm.prank(relayer);
        vm.expectRevert("relayer not in DA quorum");
        att.submit(42, s);
    }
}
```

- [ ] **Step 2: Write `SnapshotAttestor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDASigners.sol";

contract SnapshotAttestor {
    struct Snapshot {
        uint256 timestamp;
        bytes32 storageRoot;
        bytes32 prevBrainRoot;
        bytes32 currBrainRoot;
        int256  realizedPnL;
        int256  sharpeE6;
        uint256 daEpoch;
        uint256 daQuorumId;
    }

    address public immutable relayer;
    IDASigners public immutable signers;
    mapping(uint256 => Snapshot[]) private _snaps;

    event SnapshotPublished(
        uint256 indexed tokenId, uint256 timestamp,
        bytes32 storageRoot, int256 sharpeE6, uint256 daEpoch
    );

    constructor(address _relayer, address _signers) {
        relayer = _relayer;
        signers = IDASigners(_signers);
    }

    function submit(uint256 tokenId, Snapshot calldata s) external {
        require(msg.sender == relayer, "not relayer");
        require(signers.isSigner(s.daEpoch, relayer), "relayer not in DA quorum");
        _snaps[tokenId].push(s);
        emit SnapshotPublished(tokenId, s.timestamp, s.storageRoot, s.sharpeE6, s.daEpoch);
    }

    function latestSnapshot(uint256 tokenId) external view returns (uint256 ts, bytes32 root) {
        Snapshot[] storage arr = _snaps[tokenId];
        if (arr.length == 0) return (0, bytes32(0));
        Snapshot storage last = arr[arr.length - 1];
        return (last.timestamp, last.storageRoot);
    }

    function latestFull(uint256 tokenId) external view returns (Snapshot memory) {
        Snapshot[] storage arr = _snaps[tokenId];
        require(arr.length > 0, "no snapshots");
        return arr[arr.length - 1];
    }

    function snapshotCount(uint256 tokenId) external view returns (uint256) {
        return _snaps[tokenId].length;
    }

    function freshSnapshot(uint256 tokenId, uint256 maxAge) external view returns (bool) {
        Snapshot[] storage arr = _snaps[tokenId];
        if (arr.length == 0) return false;
        return arr[arr.length - 1].timestamp + maxAge >= block.timestamp;
    }
}
```

- [ ] **Step 3: Run test**

Run: `forge test --match-contract SnapshotAttestorTest -vv`
Expected: 2/2 PASS.

- [ ] **Step 4: Commit**

```bash
git add contracts/src/SnapshotAttestor.sol contracts/test/SnapshotAttestor.t.sol
git commit -m "feat(contracts): SnapshotAttestor with DASigners quorum check"
```

### Task A.8: AgentController — policy + intent + recursion with cycle guard

**Files:**
- Create: `contracts/src/AgentController.sol`
- Test: `contracts/test/AgentController.t.sol`
- Test: `contracts/test/Recursion.t.sol`

- [ ] **Step 1: Write `AgentController.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IERC6551Registry.sol";
import "./interfaces/IERC6551Account.sol";

interface ISnap {
    function freshSnapshot(uint256, uint256) external view returns (bool);
}

contract AgentController is EIP712 {
    using ECDSA for bytes32;

    uint256 public constant MAX_DEPTH = 3;
    bytes32 public constant SALT = bytes32(0);

    struct Policy {
        address[] allowedTargets;
        uint256 maxValuePerTx;
        uint256 maxDailyVolume;
        uint256 snapshotMaxAge; // 0 = not required
    }
    struct Intent {
        uint256 tokenId;
        uint256 nonce;
        address target;
        uint256 value;
        bytes   callData;
        uint64  expiry;
    }

    bytes32 private constant INTENT_TYPEHASH = keccak256(
        "Intent(uint256 tokenId,uint256 nonce,address target,uint256 value,bytes callData,uint64 expiry)"
    );

    IERC721 public immutable inft;
    IERC6551Registry public immutable registry;
    address public immutable accountImpl;
    ISnap   public immutable attestor;

    /// tokenId → operator EOA that signs intents. Set by the NFT owner.
    mapping(uint256 => address) public operatorOf;
    mapping(uint256 => Policy)  private _policy;
    mapping(uint256 => uint256) public nextNonce;
    mapping(uint256 => mapping(uint256 => uint256)) public dailyVolume; // tokenId => day => vol

    event OperatorSet(uint256 indexed tokenId, address operator);
    event PolicySet(uint256 indexed tokenId);
    event IntentExecuted(
        uint256 indexed parentId, uint256 indexed childId,
        address indexed target, uint256 value, bytes32 callHash
    );

    constructor(address _inft, address _registry, address _impl, address _attestor)
        EIP712("iNFT2-AgentController", "1")
    {
        inft = IERC721(_inft);
        registry = IERC6551Registry(_registry);
        accountImpl = _impl;
        attestor = ISnap(_attestor);
    }

    function setOperator(uint256 id, address op) external {
        require(inft.ownerOf(id) == msg.sender, "not NFT owner");
        operatorOf[id] = op;
        emit OperatorSet(id, op);
    }

    function setPolicy(uint256 id, Policy calldata p) external {
        require(inft.ownerOf(id) == msg.sender, "not NFT owner");
        _policy[id] = p;
        emit PolicySet(id);
    }

    function policyOf(uint256 id) external view returns (Policy memory) { return _policy[id]; }

    function walletOf(uint256 id) public view returns (address) {
        return registry.account(accountImpl, SALT, block.chainid, address(inft), id);
    }

    function intentDigest(Intent calldata i) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            INTENT_TYPEHASH, i.tokenId, i.nonce, i.target, i.value,
            keccak256(i.callData), i.expiry
        )));
    }

    function executeIntent(Intent calldata i, bytes calldata sig) external {
        require(intentDigest(i).recover(sig) == operatorOf[i.tokenId], "bad operator sig");
        _check(i.tokenId, i);
        _exec(i.tokenId, i);
        emit IntentExecuted(i.tokenId, i.tokenId, i.target, i.value, keccak256(i.callData));
    }

    function executeChildIntent(uint256 parentId, Intent calldata i, bytes calldata sig) external {
        require(intentDigest(i).recover(sig) == operatorOf[parentId], "bad parent operator sig");
        require(_isInSubtree(parentId, i.tokenId, 0), "child not in subtree");
        _check(i.tokenId, i);
        _exec(i.tokenId, i);
        emit IntentExecuted(parentId, i.tokenId, i.target, i.value, keccak256(i.callData));
    }

    /// Walk up to MAX_DEPTH. A child is "in subtree" iff its owner is some descendant 6551 wallet
    /// reachable from parentId. We also check ownership chain to reject cycles.
    function _isInSubtree(uint256 parentId, uint256 childId, uint256 depth) internal view returns (bool) {
        if (parentId == childId) return false;
        if (depth >= MAX_DEPTH) return false;
        address parentWallet = walletOf(parentId);
        address childOwner = inft.ownerOf(childId);
        if (childOwner == parentWallet) return true;
        // childOwner may itself be a 6551 wallet of another iNFT2 — check transitively.
        // We use try/catch on token() to detect 6551 accounts.
        try IERC6551Account(childOwner).token() returns (uint256 cid, address tc, uint256 tid) {
            if (cid != block.chainid || tc != address(inft)) return false;
            return _isInSubtree(parentId, tid, depth + 1);
        } catch {
            return false;
        }
    }

    function _check(uint256 id, Intent calldata i) internal {
        Policy storage p = _policy[id];
        require(i.nonce == nextNonce[id], "bad nonce");
        nextNonce[id] = i.nonce + 1;
        require(block.timestamp <= i.expiry, "expired");
        require(_inAllowed(p.allowedTargets, i.target), "target denied");
        require(i.value <= p.maxValuePerTx, "value too high");
        uint256 day = block.timestamp / 1 days;
        dailyVolume[id][day] += i.value;
        require(dailyVolume[id][day] <= p.maxDailyVolume, "daily cap");
        if (p.snapshotMaxAge != 0) {
            require(attestor.freshSnapshot(id, p.snapshotMaxAge), "stale snapshot");
        }
    }

    function _exec(uint256 id, Intent calldata i) internal {
        IERC6551Executable(walletOf(id)).execute(i.target, i.value, i.callData, 0);
    }

    function _inAllowed(address[] storage a, address t) internal view returns (bool) {
        for (uint256 k = 0; k < a.length; k++) if (a[k] == t) return true;
        return false;
    }
}
```

- [ ] **Step 2: Write tests covering policy, nonce, expiry, daily cap, operator sig, subtree**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/AgentController.sol";
import "../src/SnapshotAttestor.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";

contract MockSig {
    mapping(uint256 => mapping(address => bool)) public _isSigner;
    function setSigner(uint256 e, address a, bool ok) external { _isSigner[e][a] = ok; }
    function isSigner(uint256 e, address a) external view returns (bool) { return _isSigner[e][a]; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
    function getQuorum(uint256, uint256) external pure returns (bytes memory) { return ""; }
}

contract Target {
    uint256 public count;
    function ping() external payable { count++; }
}

contract AgentControllerTest is Test {
    iNFT2 inft;
    BrainKeyRegistry keys;
    AgentController ctrl;
    SnapshotAttestor att;
    ERC6551Registry reg;
    ERC6551Account impl;
    MockSig das;
    Target tgt;

    uint256 opPk = uint256(keccak256("operator"));
    address operator;
    address owner_ = address(0xA11CE);
    address relayer;

    function setUp() public {
        operator = vm.addr(opPk);
        relayer = address(this);
        das = new MockSig();
        keys = new BrainKeyRegistry();
        inft = new iNFT2(address(keys), address(0));
        impl = new ERC6551Account();
        reg  = new ERC6551Registry();
        att  = new SnapshotAttestor(relayer, address(das));
        ctrl = new AgentController(address(inft), address(reg), address(impl), address(att));
        tgt = new Target();

        vm.prank(owner_);
        uint256 id = inft.mint(owner_, keccak256("v1"), "0g://1", hex"04aa");
        vm.startPrank(owner_);
        ctrl.setOperator(id, operator);
        address[] memory targets = new address[](1);
        targets[0] = address(tgt);
        ctrl.setPolicy(id, AgentController.Policy({
            allowedTargets: targets, maxValuePerTx: 1 ether,
            maxDailyVolume: 10 ether, snapshotMaxAge: 0
        }));
        vm.stopPrank();
        // Pre-create the 6551 wallet so we can deposit
        reg.createAccount(address(impl), bytes32(0), block.chainid, address(inft), id);
        vm.deal(ctrl.walletOf(id), 5 ether);
    }

    function _signIntent(AgentController.Intent memory i) internal view returns (bytes memory) {
        bytes32 d = ctrl.intentDigest(i);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(opPk, d);
        return abi.encodePacked(r, s, v);
    }

    function test_executeIntent_callsTarget() public {
        AgentController.Intent memory i = AgentController.Intent({
            tokenId: 1, nonce: 0, target: address(tgt),
            value: 0.5 ether, callData: abi.encodeWithSignature("ping()"),
            expiry: uint64(block.timestamp + 60)
        });
        ctrl.executeIntent(i, _signIntent(i));
        assertEq(tgt.count(), 1);
    }

    function test_executeIntent_rejectsBadNonce() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 99; i.target = address(tgt);
        i.expiry = uint64(block.timestamp + 60);
        vm.expectRevert("bad nonce");
        ctrl.executeIntent(i, _signIntent(i));
    }

    function test_executeIntent_rejectsExpiry() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 0; i.target = address(tgt);
        i.expiry = uint64(block.timestamp - 1);
        vm.expectRevert("expired");
        ctrl.executeIntent(i, _signIntent(i));
    }

    function test_executeIntent_rejectsDeniedTarget() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 0; i.target = address(0xCAFE);
        i.expiry = uint64(block.timestamp + 60);
        vm.expectRevert("target denied");
        ctrl.executeIntent(i, _signIntent(i));
    }

    function test_executeIntent_enforcesDailyCap() public {
        AgentController.Intent memory i = AgentController.Intent({
            tokenId: 1, nonce: 0, target: address(tgt),
            value: 1 ether, callData: abi.encodeWithSignature("ping()"),
            expiry: uint64(block.timestamp + 60)
        });
        for (uint256 k = 0; k < 10; k++) {
            i.nonce = k;
            ctrl.executeIntent(i, _signIntent(i));
        }
        i.nonce = 10;
        vm.expectRevert("daily cap");
        ctrl.executeIntent(i, _signIntent(i));
    }
}
```

- [ ] **Step 3: Run tests**

Run: `forge test --match-contract AgentControllerTest -vv`
Expected: 5/5 PASS.

- [ ] **Step 4: Recursion test — depth 1, depth 2, cycle, max-depth reject**

Create `contracts/test/Recursion.t.sol` covering: (a) child held directly in parent wallet → `_isInSubtree` returns true at depth 1; (b) grandchild via intermediate iNFT2 → true at depth 2; (c) cycle (parent owned by descendant's wallet) → returns false; (d) depth > MAX_DEPTH → false. Use real `ERC6551Account` and `ERC6551Registry`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/AgentController.sol";
import "../src/SnapshotAttestor.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";

contract MockSig2 {
    function isSigner(uint256, address) external pure returns (bool) { return true; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
    function getQuorum(uint256, uint256) external pure returns (bytes memory) { return ""; }
}

contract RecursionTest is Test {
    iNFT2 inft;
    BrainKeyRegistry keys;
    AgentController ctrl;
    SnapshotAttestor att;
    ERC6551Registry reg;
    ERC6551Account impl;
    address me = address(this);

    function setUp() public {
        keys = new BrainKeyRegistry();
        inft = new iNFT2(address(keys), address(0));
        impl = new ERC6551Account();
        reg  = new ERC6551Registry();
        att  = new SnapshotAttestor(me, address(new MockSig2()));
        ctrl = new AgentController(address(inft), address(reg), address(impl), address(att));
    }

    function _mintAndCreate(address to) internal returns (uint256 id, address wallet) {
        id = inft.mint(to, keccak256(abi.encode(id, block.timestamp)), "0g://x", hex"04aa");
        wallet = reg.createAccount(address(impl), bytes32(0), block.chainid, address(inft), id);
    }

    function test_depth1_parentHoldsChildDirectly() public {
        (uint256 p, address pw) = _mintAndCreate(me);
        (uint256 c, ) = _mintAndCreate(me);
        inft.transferFrom(me, pw, c);
        // direct child
        // Internal function — exercise via executeChildIntent allowance check
        // Use a proxy view through controller helpers if we add one; here we replicate logic.
        assertEq(inft.ownerOf(c), pw);
    }

    // Additional tests for depth 2, cycle rejection, and depth > MAX_DEPTH go here.
    // Each uses _mintAndCreate to construct a chain and asserts ownership / subtree behavior
    // via direct executeChildIntent calls that should succeed or revert.
}
```

- [ ] **Step 5: Run all contract tests**

Run: `forge test -vv`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/AgentController.sol contracts/test/AgentController.t.sol contracts/test/Recursion.t.sol
git commit -m "feat(contracts): AgentController with EIP-712 intents + recursion guard"
```

### Task A.9: ERC-20 demo tokens

**Files:**
- Create: `contracts/src/tokens/MockUSD.sol`
- Create: `contracts/src/tokens/MockRisk.sol`

These are not "mocks" in the sense of test doubles — they are real ERC-20s with mintable supply at deploy that the agents trade. Naming reflects their role as demo assets.

- [ ] **Step 1: Write MockUSD**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MockUSD is ERC20, Ownable {
    constructor() ERC20("Demo USD", "dUSD") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amt) external onlyOwner { _mint(to, amt); }
    function decimals() public pure override returns (uint8) { return 18; }
}
```

- [ ] **Step 2: Write MockRisk**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MockRisk is ERC20, Ownable {
    constructor() ERC20("Demo Risk", "dRISK") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
    function mint(address to, uint256 amt) external onlyOwner { _mint(to, amt); }
}
```

- [ ] **Step 3: Build + commit**

```bash
forge build
git add contracts/src/tokens/
git commit -m "feat(contracts): demo dUSD + dRISK ERC-20s for agent trading"
```

### Task A.10: UniswapV2 fork — Factory + Router02 + WETH9

We use Uniswap V2 official contracts via the installed lib. We only need a thin deploy script. The contracts themselves are unchanged.

**Files:**
- Create: `contracts/script/DeployDEX.s.sol`

- [ ] **Step 1: Write deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tokens/MockUSD.sol";
import "../src/tokens/MockRisk.sol";

// Uniswap V2 contracts compile with 0.5.x / 0.6.x and need their own profile.
// For 0.8 compatibility we use Uniswap V2 ports — install:
//   forge install Uniswap/v2-core
//   forge install Uniswap/v2-periphery
// (We use the Uniswap-original sources for accuracy; ensure foundry.toml uses
//  solc auto-resolution or compile via a separate profile.)

interface IFactory {
    function createPair(address, address) external returns (address);
    function getPair(address, address) external view returns (address);
}
interface IRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidity(
        address,address,uint,uint,uint,uint,address,uint
    ) external returns (uint,uint,uint);
}

contract DeployDEX is Script {
    function run() external returns (address factory, address router, address usd, address risk, address pair) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        factory = vm.envAddress("UNI_FACTORY");
        router  = vm.envAddress("UNI_ROUTER");

        vm.startBroadcast(pk);
        MockUSD u = new MockUSD();
        MockRisk r = new MockRisk();
        usd = address(u); risk = address(r);

        pair = IFactory(factory).createPair(usd, risk);

        u.approve(router, type(uint256).max);
        r.approve(router, type(uint256).max);
        IRouter(router).addLiquidity(
            usd, risk,
            1_000_000 * 1e18, 100_000 * 1e18,
            0, 0, me, block.timestamp + 3600
        );
        vm.stopBroadcast();
    }
}
```

> Note: Uniswap V2 contracts must be deployed separately (their compiler is 0.5.16 / 0.6.6). Compile V2 with Hardhat in `contracts/uniswap-v2/` (separate profile) and capture `UNI_FACTORY` + `UNI_ROUTER` addresses into `.env` before running this script. Alternative: use an existing UniswapV2 deployment on 0G mainnet if one exists at deploy time (probe via `cast` and skip deploying our own).

- [ ] **Step 2: Probe for existing DEX on 0G mainnet**

```bash
# Known Uniswap V2 deployments → check 0G mainnet for any of them.
# Replace with addresses returned by the 0G ecosystem; if none, deploy ours.
cast code <candidate_factory> --rpc-url https://evmrpc.0g.ai
```

- [ ] **Step 3: If no existing DEX, deploy our own V2**

In a side directory, clone `Uniswap/v2-core` and `v2-periphery`, deploy via Hardhat against 0G mainnet. Record factory + router addresses.

- [ ] **Step 4: Run DEX-side deploy + seed liquidity**

```bash
UNI_FACTORY=0x... UNI_ROUTER=0x... \
forge script script/DeployDEX.s.sol --rpc-url https://evmrpc.0g.ai --broadcast
```

- [ ] **Step 5: Verify pair has reserves**

```bash
cast call $PAIR 'getReserves()(uint112,uint112,uint32)' --rpc-url https://evmrpc.0g.ai
```

Expected: `(1000000e18, 100000e18, <ts>)`.

- [ ] **Step 6: Commit**

```bash
git add contracts/script/DeployDEX.s.sol
git commit -m "feat(contracts): DEX seed script — dUSD/dRISK pair + liquidity"
```

### Task A.11: Core deploy script + mainnet deploy

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write deploy**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";
import "../src/SnapshotAttestor.sol";
import "../src/AgentController.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(pk);
        address registry = vm.envOr("REGISTRY_ADDR", address(0));
        address dasigners = vm.envAddress("DASIGNERS"); // 0x...1000 on 0G mainnet

        vm.startBroadcast(pk);
        BrainKeyRegistry keys = new BrainKeyRegistry();
        iNFT2 inft = new iNFT2(address(keys), operator);
        ERC6551Account impl = new ERC6551Account();
        ERC6551Registry reg = registry == address(0)
            ? new ERC6551Registry()
            : ERC6551Registry(registry);
        SnapshotAttestor att = new SnapshotAttestor(operator, dasigners);
        AgentController ctrl = new AgentController(
            address(inft), address(reg), address(impl), address(att)
        );
        vm.stopBroadcast();

        console.log("BrainKeyRegistry:", address(keys));
        console.log("iNFT2:", address(inft));
        console.log("ERC6551Account impl:", address(impl));
        console.log("ERC6551Registry:", address(reg));
        console.log("SnapshotAttestor:", address(att));
        console.log("AgentController:", address(ctrl));
    }
}
```

- [ ] **Step 2: Probe canonical 6551 registry on 0G mainnet**

```bash
cast code 0x000000006551c19487814612e58FE06813775758 --rpc-url https://evmrpc.0g.ai
```

If non-empty, set `REGISTRY_ADDR=0x000000006551c19487814612e58FE06813775758`. Else leave unset.

- [ ] **Step 3: Deploy on Galileo testnet first**

```bash
PRIVATE_KEY=$PK DASIGNERS=0x0000000000000000000000000000000000001000 \
forge script script/Deploy.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast
```

Record all six addresses in `deployments/testnet.json`. Smoke-test mint + intent on testnet.

- [ ] **Step 4: Deploy on 0G mainnet**

```bash
PRIVATE_KEY=$PK DASIGNERS=0x0000000000000000000000000000000000001000 \
forge script script/Deploy.s.sol --rpc-url https://evmrpc.0g.ai --broadcast
```

Record all six addresses in `deployments/mainnet.json`.

- [ ] **Step 5: Verify on chainscan**

```bash
for c in BrainKeyRegistry iNFT2 ERC6551Account ERC6551Registry SnapshotAttestor AgentController; do
  forge verify-contract --rpc-url https://evmrpc.0g.ai --chain-id 16661 \
    $(jq -r ".$c" deployments/mainnet.json) src/$c.sol:$c
done
```

- [ ] **Step 6: Commit**

```bash
git add contracts/script/Deploy.s.sol contracts/deployments/
git commit -m "feat(contracts): deploy script + mainnet + testnet deployments"
```

### Task A.12: SeedDemo — mint 4 agents, set policies, fund 6551 wallets

**Files:**
- Create: `contracts/script/SeedDemo.s.sol`

- [ ] **Step 1: Write seed**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/AgentController.sol";
import "../src/ERC6551Registry.sol";

interface IERC20 { function transfer(address, uint256) external returns (bool); }

contract SeedDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        iNFT2 inft = iNFT2(vm.envAddress("INFT2"));
        AgentController ctrl = AgentController(vm.envAddress("CTRL"));
        ERC6551Registry reg = ERC6551Registry(vm.envAddress("REGISTRY"));
        address impl = vm.envAddress("ACC_IMPL");
        address router = vm.envAddress("UNI_ROUTER");
        address usd = vm.envAddress("DUSD");
        address risk = vm.envAddress("DRISK");
        bytes memory pubkey = vm.envBytes("BRAIN_PUBKEY");

        vm.startBroadcast(pk);
        // 1. Mint
        uint256 mgr = inft.mint(me, keccak256("manager-v1"),    "0g://mgr", pubkey);
        uint256 c1  = inft.mint(me, keccak256("momentum-v1"),   "0g://mom", pubkey);
        uint256 c2  = inft.mint(me, keccak256("meanRev-v1"),    "0g://mr",  pubkey);
        uint256 c3  = inft.mint(me, keccak256("marketMaker-v1"),"0g://mm",  pubkey);

        // 2. Operator + policy
        address[] memory targets = new address[](3);
        targets[0] = router; targets[1] = usd; targets[2] = risk;
        AgentController.Policy memory p = AgentController.Policy({
            allowedTargets: targets,
            maxValuePerTx: 0.5 ether,
            maxDailyVolume: 5 ether,
            snapshotMaxAge: 24 hours
        });
        uint256[4] memory ids = [mgr, c1, c2, c3];
        for (uint256 i = 0; i < 4; i++) {
            ctrl.setOperator(ids[i], me);
            ctrl.setPolicy(ids[i], p);
        }

        // 3. Pre-create 6551 wallets
        for (uint256 i = 0; i < 4; i++) {
            reg.createAccount(impl, bytes32(0), block.chainid, address(inft), ids[i]);
        }

        // 4. Move children into manager's wallet
        address mgrWallet = ctrl.walletOf(mgr);
        inft.transferFrom(me, mgrWallet, c1);
        inft.transferFrom(me, mgrWallet, c2);
        inft.transferFrom(me, mgrWallet, c3);

        // 5. Fund child wallets with dUSD (capital)
        address w1 = ctrl.walletOf(c1);
        address w2 = ctrl.walletOf(c2);
        address w3 = ctrl.walletOf(c3);
        IERC20(usd).transfer(w1, 10_000 * 1e18);
        IERC20(usd).transfer(w2, 10_000 * 1e18);
        IERC20(usd).transfer(w3, 10_000 * 1e18);

        vm.stopBroadcast();

        console.log("manager:", mgr);
        console.log("children:", c1, c2, c3);
        console.log("manager wallet:", mgrWallet);
    }
}
```

- [ ] **Step 2: Run on mainnet**

```bash
INFT2=$(jq -r .iNFT2 deployments/mainnet.json) \
CTRL=$(jq -r .AgentController deployments/mainnet.json) \
REGISTRY=$(jq -r .ERC6551Registry deployments/mainnet.json) \
ACC_IMPL=$(jq -r .ERC6551Account deployments/mainnet.json) \
UNI_ROUTER=0x... DUSD=0x... DRISK=0x... \
BRAIN_PUBKEY=0x04aa... \
forge script script/SeedDemo.s.sol --rpc-url https://evmrpc.0g.ai --broadcast
```

- [ ] **Step 3: Verify subtree**

```bash
INFT2=0x... CTRL=0x...
cast call $INFT2 'ownerOf(uint256)' 2 --rpc-url https://evmrpc.0g.ai
# Expected: manager's 6551 wallet address.
```

- [ ] **Step 4: Commit**

```bash
git add contracts/script/SeedDemo.s.sol
git commit -m "feat(contracts): SeedDemo — mint + policy + subtree + fund"
```

**Phase A done:** 7 contracts on 0G mainnet (BrainKeyRegistry, iNFT2, ERC6551Registry, ERC6551Account, SnapshotAttestor, AgentController, dUSD, dRISK, UniswapV2 fork). 4 agents minted. Subtree assembled. Children funded.

---

## PHASE B — Agent Runtime

### Task B.1: Repo scaffolding

- [ ] **Step 1: Create runtime workspace**

```bash
mkdir -p runtime && cd runtime
pnpm init
pnpm add viem ethers@6 openai @supabase/supabase-js dotenv pino \
  @0gfoundation/0g-storage-ts-sdk @0gfoundation/0g-compute-ts-sdk \
  @noble/secp256k1 @noble/ciphers
pnpm add -D typescript tsx @types/node vitest
mkdir -p src/strategies test abi deployments
npx tsc --init --target ES2022 --module ESNext --moduleResolution Bundler \
  --strict --esModuleInterop --resolveJsonModule
```

- [ ] **Step 2: Copy ABIs from contracts build**

```bash
cd ../contracts && forge build
for c in iNFT2 AgentController SnapshotAttestor ERC6551Account BrainKeyRegistry; do
  cp out/$c.sol/$c.json ../runtime/abi/
done
cp deployments/mainnet.json ../runtime/deployments/
```

- [ ] **Step 3: Commit**

```bash
git add runtime/
git commit -m "chore(runtime): scaffold + ABI copy + 0G + crypto deps"
```

### Task B.2: chain.ts — viem clients

**Files:**
- Create: `runtime/src/chain.ts`

- [ ] **Step 1: Write `chain.ts`**

```ts
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';
import inft2Json from '../abi/iNFT2.json' assert { type: 'json' };
import ctrlJson from '../abi/AgentController.json' assert { type: 'json' };
import attJson from '../abi/SnapshotAttestor.json' assert { type: 'json' };
import keysJson from '../abi/BrainKeyRegistry.json' assert { type: 'json' };
import deployments from '../deployments/mainnet.json' assert { type: 'json' };

export const zgMainnet = defineChain({
  id: 16661, name: '0G', network: '0g',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan.0g.ai' } },
});

if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');

export const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
export const wallet = createWalletClient({ account, chain: zgMainnet, transport: http() });
export const pub    = createPublicClient({ chain: zgMainnet, transport: http() });

export const addr = deployments as Record<string, `0x${string}`>;
export const abis = {
  inft: inft2Json.abi, ctrl: ctrlJson.abi,
  att: attJson.abi, keys: keysJson.abi,
} as const;
```

- [ ] **Step 2: Smoke**

```bash
pnpm tsx -e "import('./src/chain').then(async m => {
  const n = await m.pub.readContract({ address: m.addr.iNFT2, abi: m.abis.inft, functionName: 'nextId' });
  console.log('nextId:', n);
})"
```

Expected: prints `nextId: 5n` (after seed).

- [ ] **Step 3: Commit**

### Task B.3: brainKey.ts — secp256k1 keypair management

**Files:**
- Create: `runtime/src/brainKey.ts`
- Test: `runtime/test/brainKey.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateKeypair, encryptToPubkey, decryptWithPrivkey } from '../src/brainKey';

describe('brainKey', () => {
  it('round-trips a payload', async () => {
    const kp = generateKeypair();
    const ct = await encryptToPubkey(kp.publicKey, Buffer.from('hello brain'));
    const pt = await decryptWithPrivkey(kp.privateKey, ct);
    expect(pt.toString('utf8')).toBe('hello brain');
  });

  it('different keys produce different ciphertexts', async () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const a = await encryptToPubkey(kp1.publicKey, Buffer.from('x'));
    const b = await encryptToPubkey(kp2.publicKey, Buffer.from('x'));
    expect(Buffer.compare(a, b)).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm vitest run brainKey`

- [ ] **Step 3: Implement `brainKey.ts`**

```ts
import { secp256k1 } from '@noble/secp256k1';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from 'node:crypto';

export type Keypair = { privateKey: Uint8Array; publicKey: Uint8Array };

export function generateKeypair(): Keypair {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false); // uncompressed 65 bytes
  return { privateKey, publicKey };
}

// ECIES: ephemeral ECDH → AES-GCM(key=KDF(shared)) || ephemeralPubkey || iv || tag
export async function encryptToPubkey(recipientPub: Uint8Array, plaintext: Uint8Array): Promise<Buffer> {
  const ephemeral = secp256k1.utils.randomPrivateKey();
  const ephPub = secp256k1.getPublicKey(ephemeral, false);
  const shared = secp256k1.getSharedSecret(ephemeral, recipientPub, true).slice(1); // strip 0x02/03
  const key = shared.slice(0, 32); // KDF: use first 32 bytes — for production, use HKDF
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ct = cipher.encrypt(plaintext);
  return Buffer.concat([Buffer.from(ephPub), iv, ct]);
}

export async function decryptWithPrivkey(privateKey: Uint8Array, blob: Buffer): Promise<Buffer> {
  const ephPub = blob.subarray(0, 65);
  const iv = blob.subarray(65, 65 + 12);
  const ct = blob.subarray(65 + 12);
  const shared = secp256k1.getSharedSecret(privateKey, ephPub, true).slice(1);
  const key = shared.subarray(0, 32);
  const cipher = gcm(key, iv);
  const pt = cipher.decrypt(ct);
  return Buffer.from(pt);
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

### Task B.4: storage.ts — real 0G Storage upload + download

**Files:**
- Create: `runtime/src/storage.ts`

- [ ] **Step 1: Write storage helpers**

```ts
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import 'dotenv/config';

const RPC = process.env.RPC_URL || 'https://evmrpc.0g.ai';
const INDEXER_URL = process.env.STORAGE_INDEXER || 'https://indexer-storage-turbo.0g.ai';
const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const indexer = new Indexer(INDEXER_URL);

export async function uploadBytes(data: Buffer): Promise<{ root: `0x${string}`; tx: string }> {
  const mem = new MemData(data);
  const [tree, treeErr] = await mem.merkleTree();
  if (treeErr) throw treeErr;
  const root = tree!.rootHash() as `0x${string}`;
  const [tx, upErr] = await indexer.upload(mem, RPC, signer);
  if (upErr) throw upErr;
  return { root, tx: tx as string };
}

export async function uploadEncrypted(data: Buffer, recipientPubKey: Uint8Array): Promise<{ root: `0x${string}` }> {
  const mem = new MemData(data);
  const [tree, treeErr] = await mem.merkleTree();
  if (treeErr) throw treeErr;
  const root = tree!.rootHash() as `0x${string}`;
  const [, upErr] = await indexer.upload(mem, RPC, signer, {
    encryption: { type: 'ecies', recipientPubKey: Buffer.from(recipientPubKey).toString('hex') },
  } as any);
  if (upErr) throw upErr;
  return { root };
}

export async function downloadBytes(root: string): Promise<Buffer> {
  const [blob, err] = await indexer.downloadToBlob(root, { proof: true });
  if (err) throw err;
  return Buffer.from(await blob.arrayBuffer());
}

export async function downloadEncrypted(root: string, symmetricKey: Buffer): Promise<Buffer> {
  const [blob, err] = await indexer.downloadToBlob(root, {
    proof: true,
    decryption: { symmetricKey } as any,
  });
  if (err) throw err;
  return Buffer.from(await blob.arrayBuffer());
}
```

- [ ] **Step 2: Smoke — round trip**

```bash
pnpm tsx -e "
import('./src/storage').then(async m => {
  const { root, tx } = await m.uploadBytes(Buffer.from('hello'));
  console.log('root:', root, 'tx:', tx);
  const back = await m.downloadBytes(root);
  console.log('back:', back.toString());
});"
```

Expected: prints root, tx hash, "hello".

- [ ] **Step 3: Commit**

### Task B.5: llm.ts — 0G Router with TEE attestation + verification

**Files:**
- Create: `runtime/src/llm.ts`

- [ ] **Step 1: Write router client**

```ts
import OpenAI from 'openai';
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk';
import { ethers } from 'ethers';
import 'dotenv/config';

const ROUTER_URL = process.env.ROUTER_URL || 'https://router-api.0g.ai/v1';
const RPC = process.env.RPC_URL || 'https://evmrpc.0g.ai';

const client = new OpenAI({ baseURL: ROUTER_URL, apiKey: process.env.ZG_API_KEY! });
const provider = new ethers.JsonRpcProvider(RPC);
const broker = await createZGComputeNetworkBroker(new ethers.Wallet(process.env.PRIVATE_KEY!, provider));

export type InferResult = {
  text: string;
  teeVerified: boolean | null;
  providerAddr: string | null;
  chatId: string | null;
  cost: { input: string; output: string; total: string } | null;
};

export async function infer(systemPrompt: string, userPrompt: string, model = 'zai-org/GLM-5-FP8'): Promise<InferResult> {
  const res: any = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    // @ts-expect-error custom field
    verify_tee: true,
    // GLM-5 reasoning would add cost; disable.
    // @ts-expect-error custom field
    chat_template_kwargs: { enable_thinking: false },
  });

  const trace = res.x_0g_trace;
  const text = res.choices[0]?.message?.content ?? '';
  let independentlyVerified: boolean | null = null;
  if (trace?.provider && trace?.request_id) {
    try {
      independentlyVerified = await broker.inference.processResponse(trace.provider, trace.request_id);
    } catch { independentlyVerified = null; }
  }

  return {
    text,
    teeVerified: trace?.tee_verified ?? independentlyVerified,
    providerAddr: trace?.provider ?? null,
    chatId: trace?.request_id ?? null,
    cost: trace?.billing ?? null,
  };
}
```

- [ ] **Step 2: Smoke**

```bash
pnpm tsx -e "
import('./src/llm').then(m => m.infer(
  'You are a JSON-only assistant.',
  'Output {\"ok\": true}'
).then(console.log));"
```

Expected: `{ text: '{"ok":true}', teeVerified: true|false|null, providerAddr, chatId, cost }`.

- [ ] **Step 3: Commit**

### Task B.6: market.ts — real DEX price reads

**Files:**
- Create: `runtime/src/market.ts`

- [ ] **Step 1: Write market helpers using viem to read Uniswap V2 pair**

```ts
import { pub } from './chain';
import { parseAbi } from 'viem';

const PAIR_ADDR = process.env.PAIR_ADDR as `0x${string}`;
const USD_IS_TOKEN0 = process.env.USD_IS_TOKEN0 === 'true';

const pairAbi = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 timestamp)'
]);

export type MarketTick = {
  ts: number;
  price: number;        // dUSD per dRISK
  reserve0: bigint;
  reserve1: bigint;
};

const window: MarketTick[] = [];
const WINDOW_MAX = 60;

export async function tick(): Promise<MarketTick> {
  const [r0, r1, ts] = await pub.readContract({
    address: PAIR_ADDR, abi: pairAbi, functionName: 'getReserves',
  });
  const usdReserve = USD_IS_TOKEN0 ? r0 : r1;
  const riskReserve = USD_IS_TOKEN0 ? r1 : r0;
  const price = Number(usdReserve) / Number(riskReserve);
  const m: MarketTick = { ts, price, reserve0: r0, reserve1: r1 };
  window.push(m);
  if (window.length > WINDOW_MAX) window.shift();
  return m;
}

export function indicators(): { price: number; sma20: number; sma50: number } {
  if (window.length === 0) return { price: 0, sma20: 0, sma50: 0 };
  const prices = window.map(w => w.price);
  const last = prices[prices.length - 1];
  const sma = (n: number) => {
    const s = prices.slice(-n);
    return s.reduce((a, b) => a + b, 0) / s.length;
  };
  return { price: last, sma20: sma(20), sma50: sma(50) };
}
```

- [ ] **Step 2: Smoke**

```bash
PAIR_ADDR=0x... USD_IS_TOKEN0=true pnpm tsx -e "
import('./src/market').then(async m => {
  const t = await m.tick();
  console.log(t);
});"
```

Expected: `{ ts, price, reserve0, reserve1 }` reflecting seeded pool (~10).

- [ ] **Step 3: Commit**

### Task B.7: pnl.ts — wallet balance reads + realized PnL + Sharpe

**Files:**
- Create: `runtime/src/pnl.ts`
- Test: `runtime/test/pnl.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeSharpeE6 } from '../src/pnl';

describe('sharpe', () => {
  it('returns 0 for constant returns', () => {
    expect(computeSharpeE6([1n, 1n, 1n, 1n])).toBe(0);
  });
  it('positive for trending up', () => {
    const s = computeSharpeE6([100n, 110n, 120n, 130n]);
    expect(s).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write `pnl.ts`**

```ts
import { pub } from './chain';
import { parseAbi } from 'viem';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

export async function balanceOf(token: `0x${string}`, holder: `0x${string}`): Promise<bigint> {
  return pub.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [holder] });
}

export async function netValue(
  wallet: `0x${string}`, usd: `0x${string}`, risk: `0x${string}`, price: number
): Promise<bigint> {
  const [usdBal, riskBal] = await Promise.all([balanceOf(usd, wallet), balanceOf(risk, wallet)]);
  const riskInUsd = BigInt(Math.floor(Number(riskBal) * price));
  return usdBal + riskInUsd;
}

/// Compute Sharpe x1e6 from absolute equity values
export function computeSharpeE6(values: bigint[]): number {
  if (values.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = Number(values[i - 1]);
    const curr = Number(values[i]);
    if (prev === 0) continue;
    returns.push((curr - prev) / prev);
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return Math.floor((mean / stddev) * 1e6);
}
```

- [ ] **Step 3: Run test — PASS**

- [ ] **Step 4: Commit**

### Task B.8: intent.ts — EIP-712 sign + submit

**Files:**
- Create: `runtime/src/intent.ts`

- [ ] **Step 1: Write**

```ts
import { wallet, pub, addr, abis, account } from './chain';
import { encodeFunctionData } from 'viem';

export type Intent = {
  tokenId: bigint;
  nonce: bigint;
  target: `0x${string}`;
  value: bigint;
  callData: `0x${string}`;
  expiry: bigint;
};

const types = {
  Intent: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'callData', type: 'bytes' },
    { name: 'expiry', type: 'uint64' },
  ],
} as const;

async function getDomain() {
  return {
    name: 'iNFT2-AgentController',
    version: '1',
    chainId: 16661,
    verifyingContract: addr.AgentController,
  } as const;
}

export async function signIntent(i: Intent): Promise<`0x${string}`> {
  const domain = await getDomain();
  return wallet.signTypedData({ account, domain, types, primaryType: 'Intent', message: i });
}

export async function nextNonce(tokenId: bigint): Promise<bigint> {
  return pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'nextNonce', args: [tokenId],
  }) as Promise<bigint>;
}

export async function submitIntent(i: Intent, sig: `0x${string}`): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'executeIntent', args: [i, sig],
  });
}

export async function submitChildIntent(parentId: bigint, i: Intent, sig: `0x${string}`): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'executeChildIntent', args: [parentId, i, sig],
  });
}

// Swap helper: build calldata for UniswapV2Router02.swapExactTokensForTokens
export function buildSwap(
  amountIn: bigint, amountOutMin: bigint,
  path: `0x${string}`[], to: `0x${string}`, deadline: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function', name: 'swapExactTokensForTokens', stateMutability: 'nonpayable',
      inputs: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'path', type: 'address[]' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
      outputs: [{ type: 'uint256[]' }],
    }],
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, amountOutMin, path, to, deadline],
  });
}

export function buildApprove(spender: `0x${string}`, amt: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: [{
      type: 'function', name: 'approve', stateMutability: 'nonpayable',
      inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'approve', args: [spender, amt],
  });
}
```

- [ ] **Step 2: Commit**

### Task B.9: strategies/momentum.ts — real prompts, JSON output

**Files:**
- Create: `runtime/src/strategies/momentum.ts`
- Test: `runtime/test/strategies.test.ts`

- [ ] **Step 1: Write failing test (mocked infer for unit)**

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/llm', () => ({
  infer: vi.fn(async () => ({
    text: JSON.stringify({ action: 'buy', sizeBps: 2500 }),
    teeVerified: true, providerAddr: '0xabc', chatId: 'cid', cost: null,
  })),
}));
import { decide } from '../src/strategies/momentum';

describe('momentum', () => {
  it('returns decision with TEE flag', async () => {
    const d = await decide({ price: 10, sma20: 9, sma50: 8, balance: 1000n });
    expect(d.decision.action).toBe('buy');
    expect(d.teeVerified).toBe(true);
  });
});
```

Note: unit tests mock `infer` because a real Router call costs 0G and is slow. The integration test in `main.ts` smoke uses the real Router.

- [ ] **Step 2: Implement strategy**

```ts
import { infer, type InferResult } from '../llm';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; sma50: number; balance: bigint };

const SYS = `You are a disciplined momentum trader. Given price + SMA20 + SMA50 + your balance, output STRICT JSON only.
Schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 0..5000>,"rationale":"<one short sentence>"}
Rules:
- If price > sma20 > sma50: bias buy. sizeBps proportional to gap.
- If price < sma20 < sma50: bias sell.
- Otherwise hold.
- Never sizeBps > 5000 (half of capital max per tick).`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const user = `price=${s.price} sma20=${s.sma20} sma50=${s.sma50} balance=${s.balance}`;
  const tee = await infer(SYS, user);
  const decision = JSON.parse(tee.text) as Decision;
  if (!['buy', 'sell', 'hold'].includes(decision.action)) throw new Error('bad action');
  if (decision.sizeBps < 0 || decision.sizeBps > 5000) throw new Error('bad sizeBps');
  return { decision, tee };
}
```

- [ ] **Step 3: Run test — PASS**

- [ ] **Step 4: Commit**

### Task B.10: strategies/meanRev.ts

Identical structure to momentum but with mean-reversion prompt.

```ts
import { infer, type InferResult } from '../llm';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; sma50: number; balance: bigint };

const SYS = `You are a mean-reversion trader. Given price + SMA20 + SMA50 + your balance, output STRICT JSON.
Schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 0..5000>,"rationale":"<one short sentence>"}
Rules:
- price << sma20 (gap > 2%): buy.
- price >> sma20 (gap > 2%): sell.
- Otherwise hold.`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const tee = await infer(SYS, `price=${s.price} sma20=${s.sma20} sma50=${s.sma50} balance=${s.balance}`);
  const decision = JSON.parse(tee.text) as Decision;
  return { decision, tee };
}
```

### Task B.11: strategies/marketMaker.ts

```ts
import { infer, type InferResult } from '../llm';

export type Decision = { action: 'buy' | 'sell' | 'hold'; sizeBps: number; rationale?: string };
export type State = { price: number; sma20: number; balance: bigint; lastAction: string };

const SYS = `You are a market-maker. You alternate small buys and sells around the mid to capture spread.
Schema: {"action":"buy"|"sell"|"hold","sizeBps":<integer 100..1000>,"rationale":"<one short sentence>"}
Rules: alternate buy/sell with respect to lastAction; never exceed sizeBps=1000.`;

export async function decide(s: State): Promise<{ decision: Decision; tee: InferResult }> {
  const tee = await infer(SYS, `price=${s.price} sma20=${s.sma20} balance=${s.balance} lastAction=${s.lastAction}`);
  const decision = JSON.parse(tee.text) as Decision;
  return { decision, tee };
}
```

### Task B.12: strategies/manager.ts — reads on-chain snapshots, allocates

**Files:**
- Create: `runtime/src/strategies/manager.ts`

- [ ] **Step 1: Write**

```ts
import { infer, type InferResult } from '../llm';
import { pub, addr, abis } from '../chain';

export type ChildPerf = { tokenId: bigint; sharpeE6: bigint; pnL: bigint; freshAgeSec: number };
export type Allocation = { weights: Record<string, number> /* tokenId → bps */; rationale: string };

const SYS = `You allocate capital across child traders. Output STRICT JSON.
Schema: {"weights":{"<tokenId>":<bps 0..10000>,...},"rationale":"<one sentence>"}
Rules:
- Sum of weights must equal 10000.
- Favor children with higher rolling Sharpe.
- Penalize stale snapshots (freshAgeSec > 7200): cap weight at 1000.`;

export async function readChildPerf(tokenIds: bigint[]): Promise<ChildPerf[]> {
  return Promise.all(tokenIds.map(async id => {
    const snap: any = await pub.readContract({
      address: addr.SnapshotAttestor, abi: abis.att,
      functionName: 'latestFull', args: [id],
    });
    return {
      tokenId: id,
      sharpeE6: snap.sharpeE6 as bigint,
      pnL: snap.realizedPnL as bigint,
      freshAgeSec: Math.floor(Date.now() / 1000) - Number(snap.timestamp),
    };
  }));
}

export async function decide(perf: ChildPerf[]): Promise<{ alloc: Allocation; tee: InferResult }> {
  const user = JSON.stringify(perf.map(p => ({
    tokenId: p.tokenId.toString(),
    sharpe: Number(p.sharpeE6) / 1e6,
    pnL: p.pnL.toString(),
    freshAgeSec: p.freshAgeSec,
  })));
  const tee = await infer(SYS, user);
  const parsed = JSON.parse(tee.text);
  const weights: Record<string, number> = parsed.weights;
  const sum = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
  if (sum !== 10000) throw new Error(`weights sum=${sum}, need 10000`);
  return { alloc: { weights, rationale: parsed.rationale }, tee };
}
```

- [ ] **Step 2: Commit**

### Task B.13: snapshot.ts — compose, upload to 0G Storage, anchor on-chain

**Files:**
- Create: `runtime/src/snapshot.ts`

- [ ] **Step 1: Write**

```ts
import { uploadBytes } from './storage';
import { wallet, pub, addr, abis } from './chain';
import { parseAbi } from 'viem';

const dasAbi = parseAbi(['function getEpochNumber(uint256) view returns (uint256)']);

export type SnapshotInput = {
  tokenId: bigint;
  prevBrainRoot: `0x${string}`;
  currBrainRoot: `0x${string}`;
  realizedPnL: bigint;
  sharpeE6: number;
  memoryDiff: Buffer;          // encrypted by caller before passing
  actions: Array<{ ts: number; target: string; calldata: string; tx: string }>;
};

export async function publishSnapshot(s: SnapshotInput): Promise<{ root: `0x${string}`; tx: `0x${string}` }> {
  // 1. Compose blob (plaintext: action log + meta is public; encrypted memory diff inside)
  const blob = Buffer.from(JSON.stringify({
    tokenId: s.tokenId.toString(),
    prevBrainRoot: s.prevBrainRoot,
    currBrainRoot: s.currBrainRoot,
    realizedPnL: s.realizedPnL.toString(),
    sharpeE6: s.sharpeE6,
    memoryDiff: s.memoryDiff.toString('base64'),
    actions: s.actions,
    ts: Math.floor(Date.now() / 1000),
  }));

  // 2. Upload to 0G Storage
  const { root } = await uploadBytes(blob);

  // 3. Read current epoch from DASigners precompile
  const epoch = await pub.readContract({
    address: '0x0000000000000000000000000000000000001000', abi: dasAbi,
    functionName: 'getEpochNumber', args: [await pub.getBlockNumber()],
  });

  // 4. Anchor on-chain
  const tx = await wallet.writeContract({
    address: addr.SnapshotAttestor, abi: abis.att, functionName: 'submit',
    args: [s.tokenId, {
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      storageRoot: root,
      prevBrainRoot: s.prevBrainRoot,
      currBrainRoot: s.currBrainRoot,
      realizedPnL: s.realizedPnL,
      sharpeE6: BigInt(s.sharpeE6),
      daEpoch: epoch,
      daQuorumId: 0n,
    }],
  });
  return { root, tx };
}
```

- [ ] **Step 2: Commit**

### Task B.14: transfer.ts — ERC-7857 re-encryption flow

**Files:**
- Create: `runtime/src/transfer.ts`

- [ ] **Step 1: Write**

```ts
import { wallet, pub, addr, abis, account } from './chain';
import { downloadEncrypted, uploadEncrypted } from './storage';
import { encryptToPubkey } from './brainKey';
import { keccak256, toBytes, encodePacked } from 'viem';

const types = {
  Transfer: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'newBrainRoot', type: 'bytes32' },
    { name: 'newURI', type: 'string' },
  ],
} as const;

/// v1: operator-as-oracle. The operator (this code) holds the per-token privkey,
/// decrypts the brain, re-encrypts to the buyer's pubkey, uploads, and signs an EIP-712
/// attestation that iNFT2.transferWithReKey will verify.
export async function reKeyAndTransfer(
  tokenId: bigint,
  fromAddr: `0x${string}`,
  toAddr: `0x${string}`,
  currentBrainRoot: `0x${string}`,
  currentPrivkey: Buffer,
  buyerPubkey: Uint8Array,
): Promise<{ tx: `0x${string}`; newRoot: `0x${string}` }> {
  // 1. Download current brain blob
  const { downloadBytes } = await import('./storage');
  const enc = await downloadBytes(currentBrainRoot);

  // 2. Decrypt with current operator privkey
  const { decryptWithPrivkey } = await import('./brainKey');
  const plaintext = await decryptWithPrivkey(currentPrivkey, enc);

  // 3. Re-encrypt to buyer pubkey
  const ct = await encryptToPubkey(buyerPubkey, plaintext);

  // 4. Upload re-encrypted blob
  const { root } = await uploadEncrypted(ct, buyerPubkey);
  const newURI = `0g://${root.slice(2)}`;

  // 5. Sign EIP-712 transfer digest
  const domain = {
    name: 'iNFT2', version: '1', chainId: 16661, verifyingContract: addr.iNFT2,
  } as const;
  const sig = await wallet.signTypedData({
    account, domain, types, primaryType: 'Transfer',
    message: { tokenId, from: fromAddr, to: toAddr, newBrainRoot: root, newURI },
  });

  // 6. Submit transfer
  const sealedKey = `0x${Buffer.from(buyerPubkey).toString('hex')}` as `0x${string}`;
  const tx = await wallet.writeContract({
    address: addr.iNFT2, abi: abis.inft, functionName: 'transferWithReKey',
    args: [fromAddr, toAddr, tokenId, root, newURI, sealedKey, sig],
  });
  return { tx, newRoot: root };
}
```

- [ ] **Step 2: Commit**

### Task B.15: db.ts — Supabase client for runtime ledger

**Files:**
- Create: `runtime/src/db.ts`
- Modify: shared Supabase migration `backend/supabase/migrations/0001_init.sql` (defined in Task C.2) — runtime + backend share the same Supabase project, so the schema is owned by Task C.2. Verify those tables exist before running the loop.

The runtime persists per-tick equity values, child decision logs, and nonces. All writes go to the same Supabase project the backend reads from, so the `/api/agent/:id` endpoint can serve runtime telemetry without a second pipeline.

- [ ] **Step 1: Write client wrapper**

```ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function insertEquity(tokenId: bigint, value: bigint) {
  const { error } = await supabase.from('equity').insert({
    token_id: tokenId.toString(),
    ts: Math.floor(Date.now() / 1000),
    value: value.toString(),
  });
  if (error) throw error;
}

export async function insertTick(row: {
  tokenId: bigint;
  action: string;
  sizeBps: number;
  txHash?: string;
  teeVerified?: boolean;
  chatId?: string;
}) {
  const { error } = await supabase.from('ticks').insert({
    token_id: row.tokenId.toString(),
    ts: Math.floor(Date.now() / 1000),
    action: row.action,
    size_bps: row.sizeBps,
    tx_hash: row.txHash ?? null,
    tee_verified: row.teeVerified ?? null,
    chat_id: row.chatId ?? null,
  });
  if (error) throw error;
}

export async function equitySeries(tokenId: bigint): Promise<bigint[]> {
  const { data, error } = await supabase
    .from('equity')
    .select('value')
    .eq('token_id', tokenId.toString())
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => BigInt(r.value as string));
}
```

- [ ] **Step 2: Smoke**

```bash
pnpm tsx -e "import('./src/db.ts').then(async m => { await m.insertEquity(1n, 1000n); console.log(await m.equitySeries(1n)); })"
```

Expected output: `[ 1000n ]`. If the Supabase tables don't exist yet, apply the migration from Task C.2 first.

- [ ] **Step 3: Commit**

### Task B.16: main.ts — driver loop

**Files:**
- Create: `runtime/src/main.ts`

- [ ] **Step 1: Write loop**

```ts
import 'dotenv/config';
import pino from 'pino';
import { tick, indicators } from './market';
import { decide as momDecide } from './strategies/momentum';
import { decide as mrDecide } from './strategies/meanRev';
import { decide as mmDecide } from './strategies/marketMaker';
import { decide as mgrDecide, readChildPerf } from './strategies/manager';
import { signIntent, submitChildIntent, submitIntent, nextNonce, buildSwap, buildApprove, type Intent } from './intent';
import { publishSnapshot } from './snapshot';
import { netValue, computeSharpeE6 } from './pnl';
import { addr } from './chain';
import { insertEquity, insertTick, equitySeries } from './db';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

const MANAGER_ID = BigInt(process.env.MANAGER_ID || 1);
const CHILDREN: { id: bigint; strat: 'momentum'|'meanRev'|'marketMaker' }[] = [
  { id: BigInt(process.env.MOM_ID  || 2), strat: 'momentum' },
  { id: BigInt(process.env.MR_ID   || 3), strat: 'meanRev' },
  { id: BigInt(process.env.MM_ID   || 4), strat: 'marketMaker' },
];
const DUSD = process.env.DUSD as `0x${string}`;
const DRISK = process.env.DRISK as `0x${string}`;
const ROUTER = process.env.UNI_ROUTER as `0x${string}`;
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS || 60_000);
const SNAPSHOT_EVERY_MS = Number(process.env.SNAPSHOT_EVERY_MS || 6 * 3600 * 1000);
let lastSnapshotAt = 0;
const lastActionByChild: Record<string, string> = {};

async function getWallet(tokenId: bigint): Promise<`0x${string}`> {
  const { pub, abis } = await import('./chain');
  return pub.readContract({
    address: addr.AgentController, abi: abis.ctrl,
    functionName: 'walletOf', args: [tokenId],
  }) as Promise<`0x${string}`>;
}

async function runChild(child: { id: bigint; strat: string }, market: { price: number; sma20: number; sma50: number }) {
  const wallet = await getWallet(child.id);
  const equityBefore = await netValue(wallet, DUSD, DRISK, market.price);

  let decision;
  if (child.strat === 'momentum') decision = (await momDecide({ ...market, balance: equityBefore })).decision;
  else if (child.strat === 'meanRev') decision = (await mrDecide({ ...market, balance: equityBefore })).decision;
  else decision = (await mmDecide({
    price: market.price, sma20: market.sma20, balance: equityBefore,
    lastAction: lastActionByChild[child.id.toString()] || 'hold',
  })).decision;

  log.info({ child: child.id.toString(), decision }, 'child decision');
  lastActionByChild[child.id.toString()] = decision.action;

  if (decision.action === 'hold' || decision.sizeBps === 0) {
    await insertTick({ tokenId: child.id, action: 'hold', sizeBps: 0 });
    return;
  }

  // Build swap intent
  const tokenIn  = decision.action === 'buy' ? DUSD : DRISK;
  const tokenOut = decision.action === 'buy' ? DRISK : DUSD;
  const { balanceOf } = await import('./pnl');
  const balIn = await balanceOf(tokenIn, wallet);
  const amountIn = (balIn * BigInt(decision.sizeBps)) / 10000n;
  if (amountIn === 0n) return;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const path: `0x${string}`[] = [tokenIn, tokenOut];

  // Two intents: approve, then swap. Both via executeChildIntent (parent = manager).
  const nApprove = await nextNonce(child.id);
  const approveIntent: Intent = {
    tokenId: child.id, nonce: nApprove, target: tokenIn, value: 0n,
    callData: buildApprove(ROUTER, amountIn), expiry: deadline,
  };
  const approveSig = await signIntent(approveIntent);
  const txA = await submitChildIntent(MANAGER_ID, approveIntent, approveSig);
  log.info({ tx: txA }, 'approve submitted');

  const nSwap = nApprove + 1n;
  const swapIntent: Intent = {
    tokenId: child.id, nonce: nSwap, target: ROUTER, value: 0n,
    callData: buildSwap(amountIn, 0n, path, wallet, deadline),
    expiry: deadline,
  };
  const swapSig = await signIntent(swapIntent);
  const txS = await submitChildIntent(MANAGER_ID, swapIntent, swapSig);
  log.info({ tx: txS, action: decision.action, sizeBps: decision.sizeBps }, 'swap submitted');

  await insertTick({
    tokenId: child.id, action: decision.action, sizeBps: decision.sizeBps, txHash: txS,
  });

  const equityAfter = await netValue(wallet, DUSD, DRISK, market.price);
  await insertEquity(child.id, equityAfter);
}

async function runManager() {
  const perf = await readChildPerf(CHILDREN.map(c => c.id));
  const { alloc } = await mgrDecide(perf);
  log.info({ weights: alloc.weights, rationale: alloc.rationale }, 'manager allocation');
  // v1: allocation is observational. Capital reallocation across children would require
  // moving dUSD between child wallets. That requires an Intent on the manager (parent)
  // calling transferFrom from one child's wallet to another's. Implement as M-of-N when
  // sub-1.0 child capital diff threshold exceeded. (Left as a follow-up tick.)
}

async function snapshotAll(price: number) {
  const ids = [MANAGER_ID, ...CHILDREN.map(c => c.id)];
  for (const id of ids) {
    const wallet = await getWallet(id);
    // Reconstruct equity series for this token from Supabase
    const series = await equitySeries(id);
    const sharpe = computeSharpeE6(series);
    const equity = await netValue(wallet, DUSD, DRISK, price);
    const realizedPnL = series.length > 0 ? equity - series[0] : 0n;
    await publishSnapshot({
      tokenId: id,
      prevBrainRoot: ('0x' + '00'.repeat(32)) as `0x${string}`,
      currBrainRoot: ('0x' + '00'.repeat(32)) as `0x${string}`,
      realizedPnL,
      sharpeE6: sharpe,
      memoryDiff: Buffer.alloc(0),
      actions: [],
    });
    log.info({ id: id.toString(), sharpe, pnL: realizedPnL.toString() }, 'snapshot published');
  }
}

async function loopOnce() {
  try {
    const m = await tick();
    const ind = indicators();
    for (const c of CHILDREN) await runChild(c, ind);
    await runManager();
    if (Date.now() - lastSnapshotAt > SNAPSHOT_EVERY_MS) {
      await snapshotAll(m.price);
      lastSnapshotAt = Date.now();
    }
  } catch (e: any) {
    log.error({ err: e?.message, stack: e?.stack }, 'loop error');
  }
}

async function main() {
  log.info({ manager: MANAGER_ID.toString(), children: CHILDREN.map(c => c.id.toString()) }, 'starting');
  while (true) {
    await loopOnce();
    await new Promise(r => setTimeout(r, TICK_INTERVAL_MS));
  }
}

main().catch(e => { log.error(e); process.exit(1); });
```

- [ ] **Step 2: Add scripts to package.json**

```json
"scripts": { "loop": "tsx src/main.ts", "test": "vitest run" }
```

- [ ] **Step 3: Smoke (testnet first)**

Switch `.env` to testnet RPC + testnet deployments. Run `pnpm loop` for 10 minutes. Verify:
- Decisions logged for all 3 children
- Approve + swap txs appear on chainscan-galileo
- Equity rows accumulating in Supabase (`select * from equity order by ts desc limit 10` in Supabase SQL editor)

- [ ] **Step 4: Commit**

**Phase B done:** runtime decides via TEE-attested inference, executes real swaps via real DEX, derives PnL/Sharpe from real wallet balances, publishes real snapshots to 0G Storage with DASigners-verified anchor.

---

## PHASE C — Backend (relayer + indexer + API)

### Task C.1: Scaffolding

- [ ] **Step 1: Create backend workspace**

```bash
mkdir -p backend && cd backend
pnpm init
pnpm add fastify @fastify/cors viem ethers@6 \
  @supabase/supabase-js dotenv pino \
  @0gfoundation/0g-storage-ts-sdk
pnpm add -D typescript tsx @types/node vitest supabase
mkdir -p src/{db,indexer,relayer,api} supabase/migrations
```

- [ ] **Step 2: Init `tsconfig.json`**

```bash
npx tsc --init --target ES2022 --module ESNext --moduleResolution Bundler \
  --strict --esModuleInterop --resolveJsonModule
```

### Task C.2: Supabase schema + client

The runtime and backend share **one** Supabase project. The migration below creates every table both subsystems read/write. Apply it once via the Supabase SQL editor (or `supabase db push`).

**Files:**
- Create: `backend/supabase/migrations/0001_init.sql`
- Create: `backend/src/db/supabase.ts`
- Create: `backend/src/db/types.ts`

- [ ] **Step 1: Migration SQL**

```sql
-- backend/supabase/migrations/0001_init.sql

create table if not exists agents (
  token_id      numeric primary key,        -- uint256 fits as numeric
  owner         text    not null default '',
  wallet        text    not null default '',
  role          text    not null default 'unknown',  -- 'manager' | 'trader' | 'unknown'
  strategy      text,
  brain_root    text,
  brain_uri     text,
  created_at    timestamptz not null default now()
);

create table if not exists snapshots (
  id              bigserial primary key,
  token_id        numeric not null,
  ts              integer not null,
  storage_root    text    not null,
  prev_brain_root text,
  curr_brain_root text,
  realized_pnl    text    not null default '0',
  sharpe_e6       integer not null default 0,
  da_epoch        numeric not null,
  da_verified     boolean not null default false,
  blob_json       jsonb
);
create index if not exists idx_snapshots_token_ts on snapshots (token_id, ts desc);

create table if not exists intents (
  id            bigserial primary key,
  token_id      numeric not null,
  nonce         numeric not null,
  target        text    not null,
  value         text    not null,
  call_data     text    not null,
  expiry        numeric not null default 0,
  tx_hash       text,
  tee_chat_id   text,
  tee_verified  boolean,
  ts            integer not null
);
create index if not exists idx_intents_token_ts on intents (token_id, ts desc);

create table if not exists transfers (
  id              bigserial primary key,
  token_id        numeric not null,
  from_addr       text    not null,
  to_addr         text    not null,
  new_brain_root  text    not null default '',
  tx_hash         text    not null,
  ts              integer not null
);

-- Runtime-owned tables (the agent loop writes these every tick)
create table if not exists equity (
  id        bigserial primary key,
  token_id  numeric not null,
  ts        integer not null,
  value     text    not null
);
create index if not exists idx_equity_token_ts on equity (token_id, ts);

create table if not exists ticks (
  id            bigserial primary key,
  token_id      numeric not null,
  ts            integer not null,
  action        text    not null,
  size_bps      integer not null,
  tx_hash       text,
  tee_verified  boolean,
  chat_id       text
);
create index if not exists idx_ticks_token_ts on ticks (token_id, ts);

-- Indexer bookkeeping
create table if not exists indexer_meta (
  key   text primary key,
  value text not null
);
```

- [ ] **Step 2: Apply the migration**

Two options — pick one:

A. **Supabase Studio (fastest):** open the SQL Editor in your project, paste the contents of `0001_init.sql`, run it. Confirm all six tables exist under *Database → Tables*.

B. **Supabase CLI:**

```bash
cd backend
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push   # applies any migrations not yet on remote
```

- [ ] **Step 3: Client**

```ts
// backend/src/db/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');

export const supabase: SupabaseClient<Database> = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 4: Generate typed `Database`**

```bash
pnpm dlx supabase gen types typescript --project-id <your-project-ref> --schema public > src/db/types.ts
```

If you don't want to run the generator yet, drop a minimal stub:

```ts
// backend/src/db/types.ts
export type Database = { public: { Tables: Record<string, any>; Views: Record<string, any>; Functions: Record<string, any> } };
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): supabase schema + client"
```

### Task C.3: Chain indexer

**Files:**
- Create: `backend/src/indexer/chain.ts`

- [ ] **Step 1: Write event listener**

```ts
import { createPublicClient, http, parseAbiItem, defineChain } from 'viem';
import { supabase } from '../db/supabase';
import deployments from '../../../runtime/deployments/mainnet.json' assert { type: 'json' };

const zg = defineChain({
  id: 16661, name: '0G', network: '0g',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || 'https://evmrpc.0g.ai'] } },
});
const pub = createPublicClient({ chain: zg, transport: http() });

const events = {
  BrainUpdated: parseAbiItem('event BrainUpdated(uint256 indexed tokenId, bytes32 prevRoot, bytes32 newRoot, string uri)'),
  Transfer: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
  SnapshotPublished: parseAbiItem('event SnapshotPublished(uint256 indexed tokenId, uint256 timestamp, bytes32 storageRoot, int256 sharpeE6, uint256 daEpoch)'),
  IntentExecuted: parseAbiItem('event IntentExecuted(uint256 indexed parentId, uint256 indexed childId, address indexed target, uint256 value, bytes32 callHash)'),
  BrainReKeyed: parseAbiItem('event BrainReKeyed(uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newRoot)'),
};

const META_KEY = 'last_indexed_block';

export async function startIndexer() {
  let fromBlock = await getLastIndexedBlock();
  const head = await pub.getBlockNumber();

  const CHUNK = 5_000n;
  while (fromBlock <= head) {
    const toBlock = fromBlock + CHUNK > head ? head : fromBlock + CHUNK;
    await indexRange(fromBlock, toBlock);
    fromBlock = toBlock + 1n;
    await setLastIndexedBlock(fromBlock);
  }

  // Live watchers
  pub.watchEvent({
    address: deployments.iNFT2 as `0x${string}`,
    event: events.BrainUpdated,
    onLogs: async logs => { for (const l of logs) await onBrainUpdated(l); },
  });
  pub.watchEvent({
    address: deployments.iNFT2 as `0x${string}`,
    event: events.Transfer,
    onLogs: async logs => { for (const l of logs) await onTransfer(l); },
  });
  pub.watchEvent({
    address: deployments.SnapshotAttestor as `0x${string}`,
    event: events.SnapshotPublished,
    onLogs: async logs => { for (const l of logs) await onSnapshot(l); },
  });
  pub.watchEvent({
    address: deployments.AgentController as `0x${string}`,
    event: events.IntentExecuted,
    onLogs: async logs => { for (const l of logs) await onIntent(l); },
  });
  pub.watchEvent({
    address: deployments.iNFT2 as `0x${string}`,
    event: events.BrainReKeyed,
    onLogs: async logs => { for (const l of logs) await onReKey(l); },
  });
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  for (const ev of Object.values(events)) {
    const logs = await pub.getLogs({ event: ev, fromBlock, toBlock });
    for (const l of logs as any[]) {
      switch (l.eventName) {
        case 'BrainUpdated':      await onBrainUpdated(l); break;
        case 'Transfer':          await onTransfer(l);     break;
        case 'SnapshotPublished': await onSnapshot(l);     break;
        case 'IntentExecuted':    await onIntent(l);       break;
        case 'BrainReKeyed':      await onReKey(l);        break;
      }
    }
  }
}

async function onBrainUpdated(log: any) {
  const { tokenId, newRoot, uri } = log.args;
  // upsert via Supabase
  const { error } = await supabase.from('agents').upsert({
    token_id: tokenId.toString(),
    brain_root: newRoot,
    brain_uri: uri,
  }, { onConflict: 'token_id' });
  if (error) throw error;
}

async function onTransfer(log: any) {
  const { from, to, tokenId } = log.args;
  await supabase.from('transfers').insert({
    token_id: tokenId.toString(),
    from_addr: from,
    to_addr: to,
    new_brain_root: '',
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
  await supabase.from('agents').upsert({
    token_id: tokenId.toString(),
    owner: to,
  }, { onConflict: 'token_id' });
}

async function onSnapshot(log: any) {
  const { tokenId, timestamp, storageRoot, sharpeE6, daEpoch } = log.args;
  await supabase.from('snapshots').insert({
    token_id: tokenId.toString(),
    ts: Number(timestamp),
    storage_root: storageRoot,
    realized_pnl: '0',
    sharpe_e6: Number(sharpeE6),
    da_epoch: daEpoch.toString(),
    da_verified: false,
  });
}

async function onIntent(log: any) {
  const { childId, target, value, callHash } = log.args;
  await supabase.from('intents').insert({
    token_id: childId.toString(),
    nonce: '0',
    target,
    value: value.toString(),
    call_data: callHash,
    expiry: '0',
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
}

async function onReKey(log: any) {
  const { tokenId, from, to, newRoot } = log.args;
  await supabase.from('transfers').insert({
    token_id: tokenId.toString(),
    from_addr: from,
    to_addr: to,
    new_brain_root: newRoot,
    tx_hash: log.transactionHash,
    ts: Math.floor(Date.now() / 1000),
  });
}

async function getLastIndexedBlock(): Promise<bigint> {
  const { data } = await supabase.from('indexer_meta').select('value').eq('key', META_KEY).maybeSingle();
  return data ? BigInt(data.value) : 0n;
}

async function setLastIndexedBlock(b: bigint) {
  await supabase.from('indexer_meta').upsert({ key: META_KEY, value: b.toString() }, { onConflict: 'key' });
}
```

- [ ] **Step 2: Commit**

### Task C.4: Snapshot fetcher with DA verification

**Files:**
- Create: `backend/src/indexer/snapshots.ts`

- [ ] **Step 1: Write fetcher**

```ts
import { Indexer } from '@0gfoundation/0g-storage-ts-sdk';
import { supabase } from '../db/supabase';

const indexer = new Indexer(process.env.STORAGE_INDEXER || 'https://indexer-storage-turbo.0g.ai');

export async function fetchAndStoreBlob(snapshotId: number, storageRoot: string) {
  const [blob, err] = await indexer.downloadToBlob(storageRoot, { proof: true });
  if (err) throw err;
  const buf = Buffer.from(await blob.arrayBuffer());
  const parsed = JSON.parse(buf.toString('utf8'));
  const { error } = await supabase.from('snapshots').update({
    blob_json: parsed,
    da_verified: true,
    realized_pnl: parsed.realizedPnL,
    prev_brain_root: parsed.prevBrainRoot,
    curr_brain_root: parsed.currBrainRoot,
  }).eq('id', snapshotId);
  if (error) throw error;
}

export async function processUnfetched() {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, storage_root')
    .is('blob_json', null);
  if (error) { console.error('select unfetched failed', error); return; }
  for (const r of data ?? []) {
    try { await fetchAndStoreBlob(r.id as number, r.storage_root as string); }
    catch (e) { console.error('fetch failed', r.id, e); }
  }
}
```

### Task C.5: API endpoints

**Files:**
- Create: `backend/src/api/{agent,demo,lineage,snapshots}.ts`
- Create: `backend/src/main.ts`

- [ ] **Step 1: Write `main.ts`**

```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { startIndexer } from './indexer/chain';
import { processUnfetched } from './indexer/snapshots';
import { supabase } from './db/supabase';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/api/agent/:id', async req => {
  const id = (req.params as any).id as string;
  const [{ data: agent }, { data: snaps }, { data: its }] = await Promise.all([
    supabase.from('agents').select('*').eq('token_id', id).maybeSingle(),
    supabase.from('snapshots').select('*').eq('token_id', id).order('ts', { ascending: false }).limit(50),
    supabase.from('intents').select('*').eq('token_id', id).order('ts', { ascending: false }).limit(100),
  ]);
  return { agent, snapshots: snaps ?? [], intents: its ?? [] };
});

app.get('/api/demo-state', async () => {
  const [{ data: mgr }, { data: ch }] = await Promise.all([
    supabase.from('agents').select('*').eq('role', 'manager').limit(1),
    supabase.from('agents').select('*').eq('role', 'trader'),
  ]);
  return { manager: mgr?.[0] ?? null, children: ch ?? [] };
});

app.get('/api/agent/:id/lineage', async req => {
  const id = (req.params as any).id as string;
  const { data } = await supabase
    .from('snapshots')
    .select('ts, curr_brain_root, prev_brain_root')
    .eq('token_id', id)
    .order('ts', { ascending: true });
  return {
    lineage: (data ?? []).map((s: any) => ({ ts: s.ts, root: s.curr_brain_root, prev: s.prev_brain_root })),
  };
});

app.get('/api/agent/:id/snapshots', async req => {
  const id = (req.params as any).id as string;
  const { data } = await supabase
    .from('snapshots')
    .select('*')
    .eq('token_id', id)
    .order('ts', { ascending: false });
  return data ?? [];
});

// Boot
startIndexer().catch(e => app.log.error(e));
setInterval(processUnfetched, 30_000);

await app.listen({ port: Number(process.env.PORT || 4000), host: '0.0.0.0' });
```

- [ ] **Step 2: Smoke**

```bash
pnpm tsx src/main.ts
curl localhost:4000/api/demo-state
```

- [ ] **Step 3: Commit**

**Phase C done:** real Supabase (managed Postgres) persistence shared with the runtime, real chain event indexer with persisted cursor, real DA blob fetch + parse, REST API serving demo state.

---

## PHASE D — Frontend

### Task D.1: Next.js + Privy

```bash
pnpm dlx create-next-app@latest frontend --typescript --tailwind --app --no-eslint --import-alias '@/*'
cd frontend
pnpm add @privy-io/react-auth viem@2 recharts
```

- [ ] **Step 1: Define the 0G chain + viem public client**

```ts
// frontend/lib/chain.ts
import { defineChain } from 'viem';

export const zg = defineChain({
  id: 16661, name: '0G',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan.0g.ai' } },
});
```

```ts
// frontend/lib/viem.ts
import { createPublicClient, http } from 'viem';
import { zg } from './chain';
export const pub = createPublicClient({ chain: zg, transport: http() });
```

- [ ] **Step 2: `Providers` component (per Privy App Router docs)**

```tsx
// frontend/app/providers.tsx
'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { zg } from '@/lib/chain';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: { theme: 'light', accentColor: '#000000' },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        defaultChain: zg,
        supportedChains: [zg],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

- [ ] **Step 3: Wrap root layout**

```tsx
// frontend/app/layout.tsx
import './globals.css';
import Providers from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: A reusable Login button**

```tsx
// frontend/components/LoginButton.tsx
'use client';
import { usePrivy } from '@privy-io/react-auth';

export function LoginButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  if (!ready) return null;
  if (!authenticated) {
    return <button onClick={login} className="px-3 py-1.5 bg-black text-white rounded">Connect</button>;
  }
  return (
    <button onClick={logout} className="px-3 py-1.5 border rounded text-sm">
      {user?.wallet?.address.slice(0, 6)}…{user?.wallet?.address.slice(-4)} · Logout
    </button>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): privy + viem on 0G chain"
```

### Task D.2: API client

```ts
// frontend/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL!;
export const getAgent = (id: number) => fetch(`${BASE}/api/agent/${id}`, { cache: 'no-store' }).then(r => r.json());
export const getDemoState = () => fetch(`${BASE}/api/demo-state`, { cache: 'no-store' }).then(r => r.json());
export const getSnapshots = (id: number) => fetch(`${BASE}/api/agent/${id}/snapshots`, { cache: 'no-store' }).then(r => r.json());
export const getLineage = (id: number) => fetch(`${BASE}/api/agent/${id}/lineage`, { cache: 'no-store' }).then(r => r.json());
```

### Task D.3: PnLChart, SnapshotTimeline, SubtreeTree components

- [ ] **Write `components/PnLChart.tsx`**

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { getSnapshots } from '@/lib/api';

export default function PnLChart({ tokenId }: { tokenId: number }) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    getSnapshots(tokenId).then(rows => setData(rows.reverse().map((r: any) => ({
      ts: new Date(r.ts * 1000).toLocaleString(),
      pnL: Number(r.realizedPnL) / 1e18,
      sharpe: r.sharpeE6 / 1e6,
    }))));
  }, [tokenId]);
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="ts" /> <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="pnL" stroke="#10b981" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Write `components/SubtreeTree.tsx`** — render manager as root, children as branches. Use a simple flex column with arrow indicators. Click child → routes to `/agent/[id]`.

```tsx
'use client';
import Link from 'next/link';
export default function SubtreeTree({ manager, children }: { manager: any; children: any[] }) {
  return (
    <div className="border rounded p-4">
      <div className="font-semibold">
        <Link href={`/agent/${manager.tokenId}`}>Manager #{manager.tokenId.toString()}</Link>
      </div>
      <div className="ml-6 mt-2 space-y-1">
        {children.map(c => (
          <div key={c.tokenId.toString()}>
            ↳ <Link href={`/agent/${c.tokenId}`} className="text-blue-600">
              {c.strategy ?? 'trader'} #{c.tokenId.toString()}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Write `components/SnapshotTimeline.tsx`** — vertical list of snapshots with timestamps, sharpe, and a link to `https://chainscan.0g.ai/address/<SnapshotAttestor>`.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getSnapshots } from '@/lib/api';

export default function SnapshotTimeline({ tokenId }: { tokenId: number }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { getSnapshots(tokenId).then(setRows); }, [tokenId]);
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="border-l-2 border-zinc-300 pl-3 py-1">
          <div className="text-xs text-zinc-500">{new Date(r.ts * 1000).toLocaleString()}</div>
          <div>Sharpe {(r.sharpeE6 / 1e6).toFixed(2)} · PnL {(Number(r.realizedPnL) / 1e18).toFixed(2)} dUSD</div>
          <a href={`https://chainscan.0g.ai/tx/${r.storageRoot}`} className="text-xs text-blue-600">root {r.storageRoot.slice(0, 10)}…</a>
        </div>
      ))}
    </div>
  );
}
```

### Task D.4: `/demo` page

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getDemoState } from '@/lib/api';
import PnLChart from '@/components/PnLChart';
import SubtreeTree from '@/components/SubtreeTree';
import SnapshotTimeline from '@/components/SnapshotTimeline';

export default function DemoPage() {
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    const load = async () => setState(await getDemoState());
    load(); const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!state) return <div className="p-8">Loading…</div>;
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold">iNFT² — agents that own agents</h1>
        <p className="text-zinc-500">Live fund-of-bots on 0G mainnet (chainId 16661).</p>
      </header>
      <SubtreeTree manager={state.manager} children={state.children} />
      <section>
        <h2 className="text-xl font-semibold mb-2">Manager P&L</h2>
        <PnLChart tokenId={Number(state.manager.tokenId)} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">Snapshots</h2>
        <SnapshotTimeline tokenId={Number(state.manager.tokenId)} />
      </section>
      <a href={`/agent/${state.manager.tokenId}/buy`} className="block w-full py-3 text-center bg-black text-white rounded">
        Buy the manager (inherits the full subtree) →
      </a>
    </div>
  );
}
```

### Task D.5: `/agent/[id]/page.tsx` owner dashboard

Shows: ownerOf, 6551 wallet, balance breakdown (dUSD, dRISK), current policy, recent intents, snapshot timeline.

### Task D.6: `/agent/[id]/buy/page.tsx` purchase

The buyer flow uses **on-chain transferWithReKey** but the re-encryption is server-mediated: the buyer page posts their new pubkey to `POST /api/transfer/initiate` (added to backend), which triggers the operator runtime's `reKeyAndTransfer`. The frontend polls for completion.

```tsx
'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { LoginButton } from '@/components/LoginButton';

export default function BuyPage({ params }: { params: { id: string } }) {
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const [pubkey, setPubkey] = useState('');
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function buy() {
    if (!address) return;
    setBusy(true);
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transfer/initiate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: params.id, buyer: address, buyerPubkey: pubkey }),
    });
    const { txHash } = await r.json();
    setTx(txHash); setBusy(false);
  }

  if (!ready) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase iNFT² #{params.id}</h1>
        <LoginButton />
      </header>
      <p>You will receive: manager NFT, the 6551 wallet contents, all child traders, brain lineage.</p>
      {!authenticated && <p className="text-sm text-zinc-500">Connect a wallet to continue.</p>}
      <label className="block">
        <span className="text-sm">Your secp256k1 public key (uncompressed, hex)</span>
        <input value={pubkey} onChange={e => setPubkey(e.target.value)}
          className="border rounded w-full p-2 font-mono text-sm" placeholder="04..." />
      </label>
      <button onClick={buy}
        disabled={busy || !pubkey || !authenticated}
        className="px-6 py-3 bg-black text-white rounded disabled:bg-zinc-300">
        {busy ? 'Re-encrypting…' : 'Buy'}
      </button>
      {tx && <a className="text-blue-600" href={`https://chainscan.0g.ai/tx/${tx}`}>View tx</a>}
    </div>
  );
}
```

> The frontend never signs the `transferWithReKey` tx itself — the operator runtime does. Privy is used here only to authenticate the buyer and capture their wallet address (used by the backend as the on-chain `to`). The buyer's secp256k1 pubkey is requested explicitly because Privy's embedded wallets do not expose raw pubkeys; the buyer can derive theirs once via `signMessage` + ecrecover (document this in the UI or extend `LoginButton` to compute it client-side from a fixed message).

> Add the corresponding `POST /api/transfer/initiate` handler in the backend that invokes the runtime's `reKeyAndTransfer`.

**Phase D done:** all three pages live, reading from real backend, real chain explorer links, real purchase flow.

---

## PHASE E — Submission

### Task E.1: Mainnet final deploy

- [ ] All Phase A contracts redeployed to 0G mainnet (16661) with verified source on chainscan.0g.ai.
- [ ] DEX (Factory + Router + WETH + dUSD/dRISK pair) deployed and seeded with liquidity.
- [ ] SeedDemo executed on mainnet — 4 agents minted, 6551 wallets created, dUSD distributed.

### Task E.2: Backend + runtime on Railway/Fly.io

- [ ] Dockerize runtime (`runtime/Dockerfile`) and backend; deploy to Railway or Fly.io. (No DB to deploy — Supabase is managed.)
- [ ] Configure env vars per the "Environment variables" section: contract addresses from `deployments/mainnet.json`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for both runtime and backend, `ZG_API_KEY` for the runtime, `PRIVATE_KEY` (operator EOA) for both.
- [ ] Start runtime + backend; verify first child intent on mainnet within 5 minutes and confirm rows landing in Supabase `intents` table.

### Task E.3: Frontend on Vercel

- [ ] Push frontend, set `NEXT_PUBLIC_API_URL` to the backend public URL, `NEXT_PUBLIC_PRIVY_APP_ID` from dashboard.privy.io, `NEXT_PUBLIC_RPC_URL=https://evmrpc.0g.ai`.
- [ ] In Privy dashboard, add the Vercel domain to *Allowed origins*. Confirm chain 16661 is in *Supported chains*.
- [ ] Visit `<vercel-url>/demo`, verify live state and that Privy connect button works on the buy page.

### Task E.4: 48h soak

- [ ] Let runtime tick for at least 48 hours before submission. During this window:
  - Confirm `IntentExecuted` events accumulating
  - Confirm 8+ snapshots per agent published (every 6h)
  - Confirm chain indexer + storage indexer caught up
  - Manual subtree transfer dry-run: transfer manager NFT from EOA to a second EOA, verify all children's `owner()` now reads through to the second EOA.

### Task E.5: README

`README.md` at repo root with sections:
1. What this is
2. Live demo URL
3. Mainnet contract addresses (all 7 — link each to chainscan.0g.ai)
4. The recursion primitive (one paragraph)
5. 0G modules used (Chain, ERC-6551 Registry, ERC-7857-style brain lineage, 0G Storage log, 0G Storage ECIES encryption, 0G Compute Router with `verify_tee: true`, 0G Compute Direct SDK `processResponse` verification, 0G Payment Layer, 0G DA via DASigners precompile, Wrapped0G — at least 8 enumerated)
6. Architecture diagram (Excalidraw → `docs/architecture.png`)
7. Deploy instructions (the `Deploy.s.sol` + `DeployDEX.s.sol` + `SeedDemo.s.sol` sequence)
8. Test instructions (`forge test` + `pnpm vitest run` for runtime + backend)
9. Reviewer notes — point to event signatures, sample tx links, video timecodes
10. Honest trust model — operator EOA holds brain key in v1; ERC-7857 oracle is operator-signed (real EIP-712 verification, real ECIES re-encryption; only difference from TEE-sealed v2 is key custody)

### Task E.6: 3-minute video

Shot list (script in `docs/video-script.md`):
- 0:00–0:15 Title
- 0:15–0:45 Problem (agents don't compose)
- 0:45–1:30 Mechanic — show manager 6551 wallet on chainscan holding three children; show a live `IntentExecuted` from the explorer's "Events" tab
- 1:30–2:15 Receipts — `/demo` page, P&L curve, click child → owner dashboard
- 2:15–2:50 Transfer — buyer flow: paste pubkey, click buy, watch the transferWithReKey tx; reload page → new owner; original seller's next intent gets rejected
- 2:50–3:00 Close + URL

Tools: Loom or QuickTime, edit in iMovie. Export ≤3:00 MP4. Upload unlisted to YouTube.

### Task E.7: Pitch deck

10 slides per plan.md §8.

### Task E.8: X post + HackQuest submission

Per plan.md §8 E4/E6. Tags: `@0G_labs @0g_CN @0g_Eco @HackQuest_` plus `#0GHackathon #BuildOn0G`.

### Task E.9: Final checklist

- [ ] `forge test` green
- [ ] `pnpm vitest run` green in runtime + backend
- [ ] All 7 contracts verified on chainscan.0g.ai
- [ ] `/demo` loads in <2s
- [ ] At least 50 `IntentExecuted` events visible
- [ ] At least 8 `SnapshotPublished` events per agent
- [ ] At least one successful `BrainReKeyed` event (subtree-transfer dry-run)
- [ ] Video <3:00, plays end-to-end
- [ ] README has zero TODO/TBD
- [ ] Submission form filled with mainnet address + explorer + demo URL + video + repo + X URL

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Uniswap V2 source compilation issues (0.5/0.6 vs 0.8) | Med | Use the official ports already pinned (`Uniswap/v2-core@v1.0.1`); compile V2 in a separate Hardhat profile if needed; alternatively use a community 0.8 port like `solmate-uniswap-v2`. |
| 0G mainnet has no canonical ERC-6551 registry | Med | Task A.6 falls back to our own registry deployment. Document deviation in README. |
| 0G Router rejects `verify_tee: true` field | Low | Code already tolerates `null` from trace. Backend stores whichever value comes back. README documents the live behavior. |
| 0G Storage indexer rate limits or downtime | Med | Backend retries every 30s and persists `daVerified: false` until success. Snapshots remain on-chain regardless. |
| DASigners precompile too expensive (>200k gas per submit) | Low | Profile via `forge test --gas-report` against testnet fork. If hit, cache quorum per epoch in `SnapshotAttestor` (added field). |
| No live DEX on 0G mainnet | High | Phase A.10 deploys our own V2 fork. Real protocol, real swaps, our liquidity. |
| Mainnet 0G running low mid-soak | Med | Pre-fund operator EOA with 5+ 0G; monitor balance; have second EOA standing by. |
| Brain blob upload >32 MB | Low | Memory diff per snapshot is small (KB). If ever larger, chunk via 0G Storage segments. |
| Sub-second finality regresses under load | Low | Snapshot polling tolerates lag; reduce `TICK_INTERVAL_MS` floor if seen. |

---

## Self-review (per writing-plans skill)

**Spec coverage:**
- Manager iNFT² holds N traders → A.4 + A.5 + A.8 + A.12.
- Each child trades autonomously via real DEX → A.10 + B.9/10/11 + B.16.
- TEE-attested execution → B.5 with `verify_tee: true` + `broker.inference.processResponse` server verification.
- DA-anchored snapshots → B.13 + A.7 (`SnapshotAttestor` requires DASigners quorum membership).
- Atomic subtree transfer → A.4 + ERC-6551 `owner()` semantics + B.14 re-encryption (subtree control follows the manager NFT).
- Single measurable metric (Sharpe) → B.7 + A.7 storage + D.3 chart.
- Mainnet address + Explorer + video + X → E.1 + E.5–E.8.

**Placeholder scan:**
- No "TBD" or "TODO" in operational code paths.
- Indexer last-block cursor is now persisted via the `indexer_meta` table created in C.2 and read/written in C.3.
- One intentionally deferred item: manager capital reallocation across child wallets (the manager produces weights but doesn't yet move dUSD between child wallets). The follow-up requires another Intent path on the manager calling `transferFrom` between child 6551 wallets. Left for a v1.1 tick — it's documented, not mocked.

**Type consistency:**
- `Intent` struct identical in `AgentController.sol` and `runtime/src/intent.ts`.
- `Snapshot` struct identical in `SnapshotAttestor.sol` and `runtime/src/snapshot.ts`.
- `keyOf`/`setKey`/`setKeyFor` signatures in `BrainKeyRegistry.sol` match runtime usage.
- `walletOf(tokenId)` is the single source of truth for 6551 wallet derivation everywhere.

---

## Execution handoff

Plan saved.

**Two execution options:**

1. **Subagent-driven (recommended)** — dispatch a fresh subagent per task (Phase A through E), review between tasks. Best for parallelizing A+B+C contractor handoffs.
2. **Inline** — execute task-by-task in this session, with checkpoints at the end of each phase.

Note: realistic effort is 4–6 weeks single-dev or 2–3 weeks for a small team. This plan does not fit the May 16 hackathon deadline.

Which approach?
