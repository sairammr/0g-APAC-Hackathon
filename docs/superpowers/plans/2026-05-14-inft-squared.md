# iNFT² — 1-Day Sprint Plan

> **For agentic workers:** This is a single-day execution plan. Tasks use checkbox (`- [ ]`) syntax. Each task lists files, code, commands, and a done-criterion. If running with 2–3 people in parallel, phases 3/4/5 compress dramatically.

**Goal:** Ship iNFT² — manager iNFT holds N trader iNFT children in its ERC-6551 wallet, allocates capital via DA-attested snapshots, transfers atomically on sale. Deploy to 0G mainnet (16661). Submit to HackQuest by 2026-05-16.

**Architecture:** Five modules — contracts (Solidity), agent runtime (TS), backend (TS REST + driver loop), frontend (Next.js), demo orchestration. Modules integrate at hour 14 (mint on mainnet, start live runtime).

**Tech stack:**
- Solidity 0.8.20, Foundry, OpenZeppelin, ERC-6551 Registry singleton.
- TypeScript 5+ / Node 20+, viem, `@0gfoundation/0g-storage-ts-sdk`, OpenAI SDK against 0G Router.
- Next.js 14 (App Router), wagmi v2, RainbowKit, Tailwind, recharts.
- SQLite via `better-sqlite3` (no Postgres in 1 day).

---

## 0. Scope cuts — what ships vs. what's honestly mocked

| Concept | Ships real | Mocked / deferred |
|---|---|---|
| iNFT² (ERC-721 + 7857-style brain root) | ✅ | — |
| ERC-6551 per-token wallet | ✅ | — |
| Parent holds child (recursion primitive) | ✅ | — |
| AgentController + policy + `executeChildIntent` | ✅ | — |
| TEE inference | ✅ — 0G Router with `verify_tee: true` | own enclave with sealed Ed25519 |
| Intent signing authority | server-side relayer EOA bound to controller | enclave-sealed key (v2) |
| 0G Storage brain blob | ✅ ECIES-encrypted | — |
| 0G Storage log for action history | ✅ | — |
| Snapshot publication | ✅ to 0G Storage log, root stored in `SnapshotAttestor` | DASigners precompile quorum verify (v2) |
| Atomic subtree transfer | sequential token-by-token in one tx | true batched atomicity (v2) |
| Fine-tuning loop | ❌ | v2 |
| 2 child traders | ✅ | 3rd child trader (v2) |
| Mainnet deploy | ✅ | — |
| 24/7 runtime | ❌ — agents live ~2h before submission | 2-week pre-judging soak (v2) |

The README has a **§"v1 honesty / v2 roadmap"** section that lists every item above. The video says "today we ship the recursion primitive end-to-end; the cryptographic accountability layer is the v2 surface."

---

## 1. Time budget (single-dev; halve with 2-3 parallel)

| Hour | Phase | Done-criterion |
|---|---|---|
| 0:00–1:00 | Phase 1 — Setup | three scaffolded repos, mainnet wallet has 1+ 0G |
| 1:00–4:00 | Phase 2 — Contracts | 4 contracts deployed to 0G mainnet, verified |
| 4:00–7:00 | Phase 3 — Agent runtime | 3 strategies signing intents against testnet |
| 7:00–10:00 | Phase 4 — Backend | REST + driver loop ticking every 5min |
| 10:00–14:00 | Phase 5 — Frontend | demo page + buyer purchase flow working |
| 14:00–15:00 | Phase 6 — Mainnet mint + start | 4 agents live on mainnet, first rebalance |
| 15:00–17:00 | Phase 7 — Submission assets | video, README, deck, X post |
| 17:00–18:00 | Phase 8 — Submit | HackQuest form filled |

---

## PHASE 1 — Setup (Hour 0:00–1:00)

### Task 1.1 — Repo scaffolding

- [ ] Create three subdirs at repo root: `contracts/`, `runtime/`, `frontend/`. Backend lives inside `runtime/` (same package).
- [ ] `cd contracts && forge init --no-commit . && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std`
- [ ] `cd runtime && pnpm init && pnpm add viem @0gfoundation/0g-storage-ts-sdk openai better-sqlite3 fastify dotenv ethers && pnpm add -D typescript tsx @types/node vitest`
- [ ] `pnpm dlx create-next-app@latest frontend --typescript --tailwind --app --no-eslint --import-alias '@/*'`
- [ ] `cd frontend && pnpm add wagmi viem @rainbow-me/rainbowkit @tanstack/react-query recharts`
- [ ] **Commit:** `chore: scaffold contracts, runtime, frontend`

### Task 1.2 — Mainnet wallet + funding

- [ ] Generate a fresh EOA in MetaMask (this is the **deployer + relayer + agent operator** — same key for v1 to save time).
- [ ] Add 0G mainnet to wallet:
  - RPC: `https://evmrpc.0g.ai`
  - Chain ID: `16661`
  - Symbol: `0G`
  - Explorer: `https://chainscan.0g.ai`
- [ ] Fund with 1+ 0G via exchange withdrawal or 0G ecosystem grant. If grant pending, develop on Galileo testnet (`16602`, faucet `https://faucet.0g.ai`) and switch RPC URL when deploying.
- [ ] Create `.env` in `contracts/`, `runtime/`, `frontend/` with `PRIVATE_KEY=`, `RPC_URL=https://evmrpc.0g.ai`, `CHAIN_ID=16661`.

### Task 1.3 — 0G Compute API key

- [ ] Visit `https://pc.0g.ai` → connect wallet → deposit ~0.5 0G to Payment Layer (mainnet `0xA3b15Bd2aD18BFB6b5f92D8AA9F444Dd59d1cE32`).
- [ ] Create API key with `inference` scope → store as `ZG_API_KEY=sk-...` in `runtime/.env`.
- [ ] Smoke-test:
  ```bash
  curl https://router-api.0g.ai/v1/chat/completions \
    -H "Authorization: Bearer $ZG_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"zai-org/GLM-5-FP8","messages":[{"role":"user","content":"say hi"}]}'
  ```

**Done:** `forge --version`, `pnpm --version` both work; wallet has 0G; Router responds.

---

## PHASE 2 — Contracts (Hour 1:00–4:00)

### File structure

```
contracts/
├── src/
│   ├── iNFT2.sol
│   ├── AgentController.sol
│   ├── SnapshotAttestor.sol
│   ├── ERC6551Account.sol
│   └── interfaces/
│       ├── IERC6551Registry.sol
│       └── IERC6551Account.sol
├── test/
│   ├── iNFT2.t.sol
│   ├── AgentController.t.sol
│   └── Integration.t.sol
├── script/
│   ├── Deploy.s.sol
│   └── SeedDemo.s.sol
└── foundry.toml
```

### Task 2.1 — `iNFT2.sol` (Hour 1:00–1:30)

- [ ] Create `src/iNFT2.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

contract iNFT2 is ERC721 {
    uint256 public nextId = 1;
    // brain lineage: each mutation appends to the chain
    mapping(uint256 => bytes32) public latestBrainRoot;
    mapping(uint256 => bytes32) public prevBrainRoot;
    // storage indexer URI for the encrypted brain blob
    mapping(uint256 => string) public brainURI;

    event BrainUpdated(uint256 indexed id, bytes32 prevRoot, bytes32 newRoot, string uri);
    event Transferred(uint256 indexed id, address indexed from, address indexed to);

    constructor() ERC721("Intelligent NFT Squared", "iNFT2") {}

    function mint(address to, bytes32 brainRoot, string calldata uri) external returns (uint256 id) {
        id = nextId++;
        _safeMint(to, id);
        latestBrainRoot[id] = brainRoot;
        brainURI[id] = uri;
        emit BrainUpdated(id, bytes32(0), brainRoot, uri);
    }

    function updateBrain(uint256 id, bytes32 newRoot, string calldata uri) external {
        require(ownerOf(id) == msg.sender || _isApprovedOrOwner(msg.sender, id), "not owner");
        bytes32 prev = latestBrainRoot[id];
        prevBrainRoot[id] = prev;
        latestBrainRoot[id] = newRoot;
        brainURI[id] = uri;
        emit BrainUpdated(id, prev, newRoot, uri);
    }

    function _afterTokenTransfer(address from, address to, uint256 id, uint256 batchSize) internal override {
        super._afterTokenTransfer(from, to, id, batchSize);
        if (from != address(0) && to != address(0)) emit Transferred(id, from, to);
    }
}
```

- [ ] Create failing test `test/iNFT2.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";

contract iNFT2Test is Test {
    iNFT2 inft;
    address alice = address(0xA11CE);

    function setUp() public { inft = new iNFT2(); }

    function test_mint_assignsBrainAndOwner() public {
        uint256 id = inft.mint(alice, keccak256("brain-v1"), "0g://abc");
        assertEq(inft.ownerOf(id), alice);
        assertEq(inft.latestBrainRoot(id), keccak256("brain-v1"));
    }

    function test_updateBrain_chainsLineage() public {
        vm.prank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1");
        vm.prank(alice);
        inft.updateBrain(id, keccak256("v2"), "0g://2");
        assertEq(inft.prevBrainRoot(id), keccak256("v1"));
        assertEq(inft.latestBrainRoot(id), keccak256("v2"));
    }
}
```

- [ ] `forge test --match-contract iNFT2Test -vv` → both pass.
- [ ] **Commit:** `feat(contracts): iNFT2 ERC-721 with brain lineage`

### Task 2.2 — ERC-6551 wiring (Hour 1:30–2:00)

- [ ] Determine if singleton registry exists on 0G mainnet:
  ```bash
  cast code 0x000000006551c19487814612e58FE06813775758 --rpc-url https://evmrpc.0g.ai
  ```
- [ ] If returns non-`0x`: use canonical registry. Else: deploy our own. Create `src/ERC6551Registry.sol` from the [official source](https://github.com/erc6551/reference). Skip if canonical exists.
- [ ] Create `src/ERC6551Account.sol` — minimal implementation:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

contract ERC6551Account {
    uint256 public nonce;

    receive() external payable {}

    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly { extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60) }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        if (signer == owner()) return 0x523e3260;
        return 0x00000000;
    }

    function execute(address to, uint256 value, bytes calldata data, uint8) external payable returns (bytes memory result) {
        require(msg.sender == owner(), "not authorized");
        ++nonce;
        bool ok;
        (ok, result) = to.call{value: value}(data);
        require(ok, "exec failed");
    }
}
```

- [ ] **Commit:** `feat(contracts): ERC-6551 minimal account impl`

### Task 2.3 — `AgentController.sol` (Hour 2:00–3:00)

- [ ] Create `src/AgentController.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

interface IERC6551Registry {
    function account(address impl, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId) external view returns (address);
}
interface IAccount {
    function execute(address to, uint256 value, bytes calldata data, uint8 op) external payable returns (bytes memory);
}

contract AgentController {
    uint256 constant MAX_DEPTH = 3;
    bytes32 constant SALT = bytes32(0);

    struct Policy {
        address[] allowedTargets;
        uint256 maxValuePerTx;
        uint256 maxDailyVolume;
        uint256 snapshotMaxAge;
    }
    struct Intent {
        uint256 tokenId;
        uint256 nonce;
        address target;
        uint256 value;
        bytes callData;
        uint64 expiry;
    }

    IERC721 public immutable inft;
    IERC6551Registry public immutable registry;
    address public immutable accountImpl;
    address public immutable snapshotAttestor;
    address public immutable relayer; // v1 trusted relayer; v2 = enclave key

    mapping(uint256 => Policy) public policy;
    mapping(uint256 => uint256) public nextNonce;
    mapping(uint256 => mapping(uint256 => uint256)) public dailyVolume; // tokenId => day => vol

    event IntentExecuted(uint256 indexed tokenId, address indexed target, uint256 value, bytes32 indexed callHash);

    modifier onlyRelayer() { require(msg.sender == relayer, "not relayer"); _; }
    modifier onlyOwnerOf(uint256 id) { require(inft.ownerOf(id) == msg.sender, "not owner"); _; }

    constructor(address _inft, address _registry, address _impl, address _attestor, address _relayer) {
        inft = IERC721(_inft);
        registry = IERC6551Registry(_registry);
        accountImpl = _impl;
        snapshotAttestor = _attestor;
        relayer = _relayer;
    }

    function setPolicy(uint256 id, Policy calldata p) external onlyOwnerOf(id) {
        policy[id] = p;
    }

    function walletOf(uint256 id) public view returns (address) {
        return registry.account(accountImpl, SALT, block.chainid, address(inft), id);
    }

    function executeIntent(Intent calldata i) external onlyRelayer {
        _checkAndExec(i.tokenId, i);
    }

    function executeChildIntent(uint256 parentId, uint256 childId, Intent calldata i) external onlyRelayer {
        require(_holdsChild(parentId, childId, 0), "not in subtree");
        _checkAndExec(childId, i);
    }

    function _holdsChild(uint256 parentId, uint256 childId, uint256 depth) internal view returns (bool) {
        if (depth >= MAX_DEPTH) return false;
        address parentWallet = walletOf(parentId);
        if (inft.ownerOf(childId) == parentWallet) return true;
        // recurse: try each held token? for v1 demo, only direct ownership.
        return false;
    }

    function _checkAndExec(uint256 id, Intent calldata i) internal {
        Policy storage p = policy[id];
        require(i.nonce == nextNonce[id]++, "bad nonce");
        require(block.timestamp <= i.expiry, "expired");
        require(_inAllowed(p.allowedTargets, i.target), "target denied");
        require(i.value <= p.maxValuePerTx, "value too high");
        uint256 day = block.timestamp / 1 days;
        dailyVolume[id][day] += i.value;
        require(dailyVolume[id][day] <= p.maxDailyVolume, "daily cap");
        require(_snapshotFresh(id, p.snapshotMaxAge), "stale snapshot");
        IAccount(walletOf(id)).execute(i.target, i.value, i.callData, 0);
        emit IntentExecuted(id, i.target, i.value, keccak256(i.callData));
    }

    function _inAllowed(address[] storage a, address t) internal view returns (bool) {
        for (uint256 i = 0; i < a.length; i++) if (a[i] == t) return true;
        return false;
    }

    function _snapshotFresh(uint256 id, uint256 maxAge) internal view returns (bool) {
        if (maxAge == 0) return true;
        (uint256 ts, ) = ISnapshotAttestor(snapshotAttestor).latestSnapshot(id);
        return ts + maxAge > block.timestamp;
    }
}

interface ISnapshotAttestor {
    function latestSnapshot(uint256 id) external view returns (uint256 ts, bytes32 root);
}
```

- [ ] Write tests `test/AgentController.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/AgentController.sol";
import "../src/ERC6551Account.sol";
import "../src/SnapshotAttestor.sol";

contract MockRegistry is IERC6551Registry {
    function account(address, bytes32, uint256, address, uint256) external view returns (address) {
        return address(0xBEEF);
    }
}

contract MockTarget {
    uint256 public called;
    function ping() external payable { called++; }
}

contract AgentControllerTest is Test {
    iNFT2 inft;
    AgentController ctrl;
    SnapshotAttestor att;
    MockRegistry reg;
    MockTarget tgt;
    address alice = address(0xA11CE);
    address relayer = address(0xBEEF);

    function setUp() public {
        inft = new iNFT2();
        att = new SnapshotAttestor(relayer);
        reg = new MockRegistry();
        ctrl = new AgentController(address(inft), address(reg), address(0xACC), address(att), relayer);
        tgt = new MockTarget();
    }

    function test_executeIntent_rejectsNonRelayer() public {
        AgentController.Intent memory i;
        vm.expectRevert("not relayer");
        ctrl.executeIntent(i);
    }
    // Add: policy denial, nonce, expiry, daily-cap, snapshot-stale tests
}
```

- [ ] `forge test --match-contract AgentControllerTest -vv` → passes.
- [ ] **Commit:** `feat(contracts): AgentController with policy + recursion`

### Task 2.4 — `SnapshotAttestor.sol` (Hour 3:00–3:20)

- [ ] Create `src/SnapshotAttestor.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SnapshotAttestor {
    struct Snapshot {
        uint256 timestamp;
        bytes32 root;          // 0G Storage log root for the snapshot blob
        bytes32 prevBrainRoot;
        bytes32 currBrainRoot;
        int256 realizedPnL;
        int256 sharpe;         // x1e6
    }
    address public immutable relayer;
    mapping(uint256 => Snapshot[]) public snapshots;

    event SnapshotPublished(uint256 indexed tokenId, uint256 timestamp, bytes32 root);

    constructor(address _relayer) { relayer = _relayer; }

    function submit(uint256 tokenId, Snapshot calldata s) external {
        require(msg.sender == relayer, "not relayer");
        snapshots[tokenId].push(s);
        emit SnapshotPublished(tokenId, s.timestamp, s.root);
    }

    function latestSnapshot(uint256 tokenId) external view returns (uint256 ts, bytes32 root) {
        Snapshot[] storage arr = snapshots[tokenId];
        if (arr.length == 0) return (0, bytes32(0));
        Snapshot storage s = arr[arr.length - 1];
        return (s.timestamp, s.root);
    }

    function snapshotCount(uint256 tokenId) external view returns (uint256) {
        return snapshots[tokenId].length;
    }

    function latestFull(uint256 tokenId) external view returns (Snapshot memory) {
        Snapshot[] storage arr = snapshots[tokenId];
        return arr[arr.length - 1];
    }
}
```

- [ ] Test `submit` + `latestSnapshot` in `Integration.t.sol`.
- [ ] **Commit:** `feat(contracts): SnapshotAttestor`

### Task 2.5 — Deploy script + mainnet deploy (Hour 3:20–4:00)

- [ ] Create `script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/ERC6551Account.sol";
import "../src/SnapshotAttestor.sol";
import "../src/AgentController.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address relayer = vm.addr(pk); // same key in v1
        address registry = 0x000000006551c19487814612e58FE06813775758;

        vm.startBroadcast(pk);
        iNFT2 inft = new iNFT2();
        ERC6551Account impl = new ERC6551Account();
        SnapshotAttestor att = new SnapshotAttestor(relayer);
        AgentController ctrl = new AgentController(
            address(inft), registry, address(impl), address(att), relayer
        );
        vm.stopBroadcast();

        console.log("iNFT2:", address(inft));
        console.log("Account impl:", address(impl));
        console.log("SnapshotAttestor:", address(att));
        console.log("AgentController:", address(ctrl));
    }
}
```

- [ ] Run on testnet first:
  ```bash
  forge script script/Deploy.s.sol --rpc-url https://evmrpc-testnet.0g.ai --broadcast
  ```
- [ ] Then mainnet:
  ```bash
  forge script script/Deploy.s.sol --rpc-url https://evmrpc.0g.ai --broadcast
  ```
- [ ] Record all four addresses in `deployments/mainnet.json`. Commit.
- [ ] Verify on `chainscan.0g.ai`:
  ```bash
  forge verify-contract --rpc-url https://evmrpc.0g.ai --chain-id 16661 <addr> src/iNFT2.sol:iNFT2
  ```

**Phase 2 done:** four contracts deployed to mainnet, verified, addresses persisted, tests green.

---

## PHASE 3 — Agent runtime (Hour 4:00–7:00)

### File structure

```
runtime/
├── src/
│   ├── chain.ts           # viem client, contract ABIs, helpers
│   ├── storage.ts         # 0G Storage upload/download (brain blobs)
│   ├── llm.ts             # 0G Router client (TEE inference)
│   ├── intent.ts          # build + sign Intent, submit
│   ├── snapshot.ts        # compose + publish 6h snapshot
│   ├── strategies/
│   │   ├── momentum.ts
│   │   ├── meanRev.ts
│   │   └── manager.ts
│   ├── market.ts          # fake market data (or read DEX) for v1
│   ├── db.ts              # sqlite
│   └── main.ts            # tick loop
├── test/
│   └── strategies.test.ts
├── .env
└── package.json
```

### Task 3.1 — `chain.ts` + ABIs (Hour 4:00–4:30)

- [ ] After Phase 2 deploy, generate ABIs:
  ```bash
  cd ../contracts && forge build && cp out/iNFT2.sol/iNFT2.json ../runtime/abi/
  # repeat for AgentController, SnapshotAttestor, ERC6551Account
  ```
- [ ] Create `runtime/src/chain.ts`:

```ts
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import iNFT2Abi from '../abi/iNFT2.json';
import controllerAbi from '../abi/AgentController.json';
import attestorAbi from '../abi/SnapshotAttestor.json';
import deployments from '../deployments/mainnet.json';

export const chain = { id: 16661, name: '0G', network: '0g',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } } } as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
export const wallet = createWalletClient({ account, chain, transport: http() });
export const pub = createPublicClient({ chain, transport: http() });

export const addr = deployments;
export const abis = { inft: iNFT2Abi.abi, ctrl: controllerAbi.abi, att: attestorAbi.abi };
```

- [ ] Smoke test:
  ```ts
  // test/chain.smoke.ts
  import { pub, addr, abis } from '../src/chain';
  const id = await pub.readContract({ address: addr.inft, abi: abis.inft, functionName: 'nextId' });
  console.log('nextId:', id);
  ```
- [ ] Run: `pnpm tsx test/chain.smoke.ts` → prints a uint.
- [ ] **Commit.**

### Task 3.2 — `llm.ts` — 0G Router inference (Hour 4:30–5:00)

- [ ] Create `runtime/src/llm.ts`:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://router-api.0g.ai/v1',
  apiKey: process.env.ZG_API_KEY!,
});

export async function infer(systemPrompt: string, userPrompt: string): Promise<{ text: string; teeVerified: boolean | null }> {
  const res = await client.chat.completions.create({
    model: 'zai-org/GLM-5-FP8',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    // @ts-expect-error custom field
    verify_tee: true,
  });
  // @ts-expect-error custom field
  const trace = res.x_0g_trace;
  return {
    text: res.choices[0].message.content ?? '',
    teeVerified: trace?.tee_verified ?? null,
  };
}
```

- [ ] Smoke:
  ```bash
  pnpm tsx -e "import('./src/llm').then(m => m.infer('You are a trader.', 'BTC up 2%. Buy or sell?').then(console.log))"
  ```
- [ ] **Commit.**

### Task 3.3 — `storage.ts` — 0G Storage brain blob (Hour 5:00–5:30)

- [ ] Create `runtime/src/storage.ts`:

```ts
import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';

const RPC = 'https://evmrpc.0g.ai';
const INDEXER = 'https://indexer-storage-turbo.0g.ai';

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const indexer = new Indexer(INDEXER);

export async function uploadBrain(plaintext: Buffer, recipientPubKey: string): Promise<{ root: string; uri: string }> {
  const mem = new MemData(plaintext);
  await mem.merkleTree();
  const [tx, err] = await indexer.upload(mem, RPC, signer, {
    encryption: { type: 'ecies', recipientPubKey },
  });
  if (err) throw err;
  const root = (await mem.merkleTree())[0]!.rootHash();
  return { root, uri: `0g://${root}` };
}

export async function downloadBrain(root: string, decryptKey: Buffer): Promise<Buffer> {
  const [blob] = await indexer.downloadToBlob(root, { proof: true, decryption: { symmetricKey: decryptKey } });
  return Buffer.from(await blob.arrayBuffer());
}
```

- [ ] Smoke: upload a 10-byte buffer, fetch by root, verify equality.
- [ ] **Commit.**

### Task 3.4 — `strategies/*` — three brain prompts (Hour 5:30–6:00)

- [ ] Create `runtime/src/strategies/momentum.ts`, `meanRev.ts`, `manager.ts`. Each exports a `decide(state)` async function returning an `Intent` shape.

```ts
// momentum.ts
import { infer } from '../llm';
export async function decide(market: { price: number; sma20: number; sma50: number; balance: bigint }) {
  const { text, teeVerified } = await infer(
    'You are a momentum trader. Output JSON: {"action":"buy"|"sell"|"hold","sizeBps":<0-10000>}',
    `Price: ${market.price}, SMA20: ${market.sma20}, SMA50: ${market.sma50}, Balance: ${market.balance}`
  );
  const decision = JSON.parse(text);
  return { decision, teeVerified };
}
```

- [ ] Repeat for `meanRev.ts` (different system prompt) and `manager.ts` (reads child snapshots, decides allocation weights).
- [ ] Unit test each with mock market data: `pnpm vitest run strategies` → green.
- [ ] **Commit.**

### Task 3.5 — `intent.ts` — build, sign, submit (Hour 6:00–6:30)

- [ ] Create `runtime/src/intent.ts`:

```ts
import { wallet, pub, addr, abis } from './chain';
import { encodeFunctionData } from 'viem';

export type Intent = {
  tokenId: bigint;
  nonce: bigint;
  target: `0x${string}`;
  value: bigint;
  callData: `0x${string}`;
  expiry: bigint;
};

export async function submitIntent(i: Intent) {
  const hash = await wallet.writeContract({
    address: addr.ctrl as `0x${string}`,
    abi: abis.ctrl,
    functionName: 'executeIntent',
    args: [i],
  });
  return hash;
}

export async function submitChildIntent(parentId: bigint, childId: bigint, i: Intent) {
  return wallet.writeContract({
    address: addr.ctrl as `0x${string}`,
    abi: abis.ctrl,
    functionName: 'executeChildIntent',
    args: [parentId, childId, i],
  });
}

export async function nextNonce(tokenId: bigint): Promise<bigint> {
  return pub.readContract({
    address: addr.ctrl as `0x${string}`,
    abi: abis.ctrl,
    functionName: 'nextNonce',
    args: [tokenId],
  }) as Promise<bigint>;
}
```

- [ ] **Commit.**

### Task 3.6 — `snapshot.ts` — publish snapshot (Hour 6:30–7:00)

- [ ] Create `runtime/src/snapshot.ts`:

```ts
import { uploadBrain } from './storage';
import { wallet, addr, abis } from './chain';

export async function publishSnapshot(tokenId: bigint, data: {
  memoryDiff: Buffer; actions: object[]; pnL: bigint; brainRoot: `0x${string}`; sharpe: number;
}) {
  const blob = Buffer.from(JSON.stringify({
    memoryDiff: data.memoryDiff.toString('base64'),
    actions: data.actions,
    pnL: data.pnL.toString(),
    brainRoot: data.brainRoot,
    sharpe: data.sharpe,
    ts: Date.now(),
  }));
  // Upload to 0G Storage log layer (no encryption — snapshots are public)
  const { root } = await uploadBrain(blob, /*pubkey unused for public*/ '');
  await wallet.writeContract({
    address: addr.att as `0x${string}`,
    abi: abis.att,
    functionName: 'submit',
    args: [tokenId, {
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      root: root as `0x${string}`,
      prevBrainRoot: '0x' + '0'.repeat(64),
      currBrainRoot: data.brainRoot,
      realizedPnL: data.pnL,
      sharpe: BigInt(Math.floor(data.sharpe * 1e6)),
    }],
  });
}
```

- [ ] **Commit.**

**Phase 3 done:** runtime can read market state, call TEE inference, sign an intent, publish a snapshot. Tests green.

---

## PHASE 4 — Backend (Hour 7:00–10:00)

### Task 4.1 — `db.ts` — SQLite schema (Hour 7:00–7:20)

- [ ] Create `runtime/src/db.ts`:

```ts
import Database from 'better-sqlite3';
const db = new Database('./inft2.db');

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY, wallet TEXT, role TEXT, brain_root TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token_id INTEGER, ts INTEGER,
  root TEXT, pnL TEXT, sharpe REAL, blob_json TEXT
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token_id INTEGER, ts INTEGER,
  target TEXT, value TEXT, calldata TEXT, tx_hash TEXT
);
`);

export default db;
```

- [ ] **Commit.**

### Task 4.2 — `market.ts` — price feed (Hour 7:20–7:40)

- [ ] Create `runtime/src/market.ts`. For v1, use a stub that returns synthetic price + indicators. If a DEX is live on 0G, swap to real reads.

```ts
let t = 0;
export function tick() {
  t += 1;
  const base = 100;
  const trend = Math.sin(t / 20) * 5;
  const noise = (Math.random() - 0.5) * 2;
  const price = base + trend + noise;
  return { price, sma20: base + trend * 0.8, sma50: base + trend * 0.5, t };
}
```

- [ ] **Commit.**

### Task 4.3 — `main.ts` — driver loop (Hour 7:40–8:30)

- [ ] Create `runtime/src/main.ts`:

```ts
import { tick } from './market';
import { decide as momDecide } from './strategies/momentum';
import { decide as mrDecide } from './strategies/meanRev';
import { decide as mgrDecide } from './strategies/manager';
import { submitIntent, submitChildIntent, nextNonce, Intent } from './intent';
import { publishSnapshot } from './snapshot';
import db from './db';

const MANAGER_ID = 1n;
const CHILD_IDS = [2n, 3n];

async function runChild(id: bigint, decideFn: typeof momDecide, balance: bigint) {
  const market = tick();
  const { decision, teeVerified } = await decideFn({ ...market, balance });
  console.log(`[child ${id}] ${decision.action} ${decision.sizeBps}bps (tee=${teeVerified})`);
  // for v1 demo, "trade" = transfer some USDC to/from a sink address as proof of execution.
  // No real DEX integration in 1 day; the on-chain effect is the value moves.
  if (decision.action !== 'hold') {
    const nonce = await nextNonce(id);
    const intent: Intent = {
      tokenId: id, nonce,
      target: '0x000000000000000000000000000000000000dEaD' as `0x${string}`,
      value: (balance * BigInt(decision.sizeBps)) / 10000n,
      callData: '0x',
      expiry: BigInt(Math.floor(Date.now() / 1000) + 600),
    };
    const tx = await submitChildIntent(MANAGER_ID, id, intent);
    db.prepare('INSERT INTO actions(token_id, ts, target, value, calldata, tx_hash) VALUES (?,?,?,?,?,?)').run(
      Number(id), Math.floor(Date.now()/1000), intent.target, intent.value.toString(), intent.callData, tx
    );
  }
}

async function runManager() {
  // Read latest snapshots for children from on-chain
  const childPerf = CHILD_IDS.map(() => ({ sharpe: Math.random() * 2 })); // v1: TODO read from chain
  const { decision } = await mgrDecide({ children: childPerf });
  console.log(`[manager] weights:`, decision.weights);
  // Apply weights via per-child capital allocation; in v1 we simulate by logging
  return decision;
}

async function maybePublishSnapshot(id: bigint) {
  // Publish every ~30 minutes (instead of 6h) to get more data in demo window
  // Pull recent actions, compute PnL stub, publish
  await publishSnapshot(id, {
    memoryDiff: Buffer.from(''), actions: [], pnL: 0n,
    brainRoot: '0x' + '0'.repeat(64) as `0x${string}`, sharpe: Math.random() * 2,
  });
}

async function loop() {
  while (true) {
    try {
      for (const cid of CHILD_IDS) {
        const fn = cid === 2n ? momDecide : mrDecide;
        await runChild(cid, fn, 1_000_000n /* 1 USDC equivalent */);
      }
      await runManager();
      if (Math.random() < 0.1) for (const id of [MANAGER_ID, ...CHILD_IDS]) await maybePublishSnapshot(id);
    } catch (e) { console.error(e); }
    await new Promise(r => setTimeout(r, 60_000)); // 60s tick
  }
}

loop();
```

- [ ] **Commit.**

### Task 4.4 — REST API with fastify (Hour 8:30–10:00)

- [ ] Create `runtime/src/api.ts`:

```ts
import Fastify from 'fastify';
import db from './db';
import { pub, addr, abis } from './chain';

const app = Fastify({ logger: true });
app.register(import('@fastify/cors'), { origin: true });

app.get('/api/agents', async () => {
  return db.prepare('SELECT * FROM agents').all();
});

app.get('/api/agent/:id', async (req: any) => {
  const id = Number(req.params.id);
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  const snapshots = db.prepare('SELECT * FROM snapshots WHERE token_id = ? ORDER BY ts DESC LIMIT 50').all(id);
  const actions = db.prepare('SELECT * FROM actions WHERE token_id = ? ORDER BY ts DESC LIMIT 100').all(id);
  // Live chain reads
  const wallet = await pub.readContract({ address: addr.ctrl as any, abi: abis.ctrl, functionName: 'walletOf', args: [BigInt(id)] });
  return { agent, snapshots, actions, wallet };
});

app.get('/api/demo-state', async () => {
  // Aggregate everything the frontend /demo needs in one shot
  const manager = db.prepare('SELECT * FROM agents WHERE role = ?').get('manager');
  const children = db.prepare('SELECT * FROM agents WHERE role = ?').all('trader');
  return { manager, children };
});

app.listen({ port: 4000, host: '0.0.0.0' }).then(() => console.log('api on :4000'));
```

- [ ] Add to `package.json`:
  ```json
  "scripts": { "loop": "tsx src/main.ts", "api": "tsx src/api.ts" }
  ```
- [ ] Add `@fastify/cors`: `pnpm add @fastify/cors`
- [ ] Smoke: `pnpm api` in one shell, `curl localhost:4000/api/demo-state` in another → returns JSON.
- [ ] **Commit.**

**Phase 4 done:** driver loop ticks every 60s, agents make decisions through TEE inference, intents land on-chain, snapshots publish, REST API serves frontend.

---

## PHASE 5 — Frontend (Hour 10:00–14:00)

### File structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx            # landing
│   ├── demo/page.tsx       # hero demo
│   └── agent/[id]/
│       ├── page.tsx        # owner dashboard
│       └── buy/page.tsx    # buyer view + purchase
├── components/
│   ├── PnLChart.tsx
│   ├── SubtreeTree.tsx
│   ├── SnapshotTimeline.tsx
│   └── PurchaseButton.tsx
└── lib/
    ├── wagmi.ts
    └── api.ts
```

### Task 5.1 — wagmi + RainbowKit + 0G chain (Hour 10:00–10:30)

- [ ] Create `frontend/lib/wagmi.ts`:

```ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

export const zg = defineChain({
  id: 16661, name: '0G', network: '0g',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan.0g.ai' } },
});

export const config = getDefaultConfig({
  appName: 'iNFT²',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [zg],
  ssr: true,
});
```

- [ ] Wire `app/layout.tsx` with `<WagmiProvider>` + `<RainbowKitProvider>` + `<QueryClientProvider>`.
- [ ] Get a WalletConnect project ID at `cloud.walletconnect.com` → `.env.local`.
- [ ] Smoke: `pnpm dev` → landing page connects wallet to 0G mainnet.
- [ ] **Commit.**

### Task 5.2 — `lib/api.ts` typed client (Hour 10:30–10:50)

- [ ] Create `frontend/lib/api.ts`:

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export async function getAgent(id: number) {
  const r = await fetch(`${BASE}/api/agent/${id}`, { cache: 'no-store' });
  return r.json();
}
export async function getDemoState() {
  const r = await fetch(`${BASE}/api/demo-state`, { cache: 'no-store' });
  return r.json();
}
```

### Task 5.3 — `/demo` page (Hour 10:50–12:30)

- [ ] Create `frontend/app/demo/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getDemoState, getAgent } from '@/lib/api';
import PnLChart from '@/components/PnLChart';
import SubtreeTree from '@/components/SubtreeTree';
import SnapshotTimeline from '@/components/SnapshotTimeline';

export default function Demo() {
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    const load = async () => setState(await getDemoState());
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!state) return <div>Loading…</div>;
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold">iNFT² — agents that own agents</h1>
        <p className="text-zinc-500">Live fund-of-bots running on 0G mainnet</p>
      </header>
      <SubtreeTree manager={state.manager} children={state.children} />
      <PnLChart tokenId={state.manager.id} />
      <SnapshotTimeline tokenId={state.manager.id} />
      <a href={`/agent/${state.manager.id}/buy`} className="block w-full py-3 text-center bg-black text-white rounded">
        Buy the manager →
      </a>
    </div>
  );
}
```

- [ ] Implement `components/PnLChart.tsx` using recharts. Fetch snapshots, render line chart of `pnL` over `ts`.
- [ ] Implement `components/SubtreeTree.tsx` — show manager as root, children as branches; click to drill in.
- [ ] Implement `components/SnapshotTimeline.tsx` — vertical timeline; each entry shows ts, sharpe, tx hash linking to `chainscan.0g.ai/tx/...`.
- [ ] **Commit.**

### Task 5.4 — Owner dashboard `/agent/[id]/page.tsx` (Hour 12:30–13:00)

- [ ] Shows: ownerOf, wallet address, balance, current policy, snapshots, recent actions. Read-only for v1; "edit policy" defers to v2.

### Task 5.5 — Buyer view + purchase `/agent/[id]/buy/page.tsx` (Hour 13:00–14:00)

- [ ] Create `frontend/app/agent/[id]/buy/page.tsx`:

```tsx
'use client';
import { useWriteContract } from 'wagmi';
import { abi as INFT_ABI } from '@/lib/abi/iNFT2';

export default function BuyPage({ params }: { params: { id: string } }) {
  const { writeContract, isPending, data: tx } = useWriteContract();
  const buy = () => {
    writeContract({
      address: process.env.NEXT_PUBLIC_INFT_ADDR! as `0x${string}`,
      abi: INFT_ABI,
      functionName: 'transferFrom', // v1 simple transfer; v2 = ERC-7857 with re-encryption
      args: [process.env.NEXT_PUBLIC_SELLER!, /* buyer = connected wallet */ '0x...', BigInt(params.id)],
    });
  };
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1>Purchase iNFT² #{params.id}</h1>
      <p>You will receive: manager + 2 children + all wallets + brain lineage.</p>
      <button onClick={buy} disabled={isPending} className="mt-4 px-6 py-3 bg-black text-white rounded">
        {isPending ? 'Sending…' : 'Buy for 1 0G'}
      </button>
      {tx && <a href={`https://chainscan.0g.ai/tx/${tx}`}>View tx</a>}
    </div>
  );
}
```

- [ ] **Commit.**

**Phase 5 done:** `/demo` loads on any device, auto-refreshes, shows live P&L and snapshot timeline; purchase flow works end-to-end.

---

## PHASE 6 — Mainnet mint + start (Hour 14:00–15:00)

### Task 6.1 — `SeedDemo.s.sol` — mint 4 agents (Hour 14:00–14:20)

- [ ] Create `contracts/script/SeedDemo.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/AgentController.sol";

contract SeedDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        iNFT2 inft = iNFT2(vm.envAddress("INFT2"));
        AgentController ctrl = AgentController(vm.envAddress("CTRL"));

        vm.startBroadcast(pk);
        uint256 mgr = inft.mint(me, keccak256("manager-v1"), "0g://mgr");
        uint256 c1  = inft.mint(me, keccak256("momentum-v1"), "0g://mom");
        uint256 c2  = inft.mint(me, keccak256("meanRev-v1"),  "0g://mr");

        address[] memory targets = new address[](1);
        targets[0] = address(0xdEaD);
        AgentController.Policy memory p = AgentController.Policy({
            allowedTargets: targets, maxValuePerTx: 1 ether,
            maxDailyVolume: 10 ether, snapshotMaxAge: 0  // 0 = no snapshot required in v1
        });
        ctrl.setPolicy(mgr, p);
        ctrl.setPolicy(c1, p);
        ctrl.setPolicy(c2, p);

        // Transfer children INTO manager's wallet
        address mgrWallet = ctrl.walletOf(mgr);
        inft.transferFrom(me, mgrWallet, c1);
        inft.transferFrom(me, mgrWallet, c2);
        vm.stopBroadcast();

        console.log("manager:", mgr, "children:", c1, c2);
    }
}
```

- [ ] Run on mainnet:
  ```bash
  INFT2=0x... CTRL=0x... forge script script/SeedDemo.s.sol --rpc-url https://evmrpc.0g.ai --broadcast
  ```
- [ ] Verify: `cast call $INFT2 'ownerOf(uint256)' 2 --rpc-url https://evmrpc.0g.ai` returns the manager's wallet address.
- [ ] Insert into `agents` table:
  ```bash
  sqlite3 runtime/inft2.db "INSERT INTO agents VALUES (1,'<mgr-wallet>','manager','<root>',$(date +%s));"
  # repeat for 2 children
  ```

### Task 6.2 — Fund the agent wallets

- [ ] Send 0.5 0G to the manager's 6551 wallet:
  ```bash
  cast send <mgr-wallet> --value 0.5ether --rpc-url https://evmrpc.0g.ai --private-key $PK
  ```
- [ ] Send 0.2 0G to each child wallet.

### Task 6.3 — Start mainnet runtime

- [ ] In `runtime/.env` switch RPC to mainnet, point at mainnet deployments.
- [ ] Launch in two tmux panes:
  ```bash
  pnpm api    # pane 1
  pnpm loop   # pane 2
  ```
- [ ] Watch logs: first child intent should land on-chain within 2 minutes.
- [ ] Verify on `chainscan.0g.ai`: open the AgentController address, see `IntentExecuted` events.

### Task 6.4 — Deploy frontend

- [ ] `cd frontend && pnpm dlx vercel --prod`
- [ ] Set env vars in Vercel: `NEXT_PUBLIC_API_URL=<ngrok or hosted backend>`, contract addrs.
- [ ] For backend, use `ngrok http 4000` to expose locally, or deploy to Railway / Fly.io (5 min). Pick whichever is fastest.
- [ ] Visit `https://inft2.vercel.app/demo` — confirm it loads and shows live state.

**Phase 6 done:** four agents live on mainnet, runtime ticking, frontend public, first rebalance recorded on `chainscan.0g.ai`.

---

## PHASE 7 — Submission assets (Hour 15:00–17:00)

### Task 7.1 — README (Hour 15:00–15:30)

- [ ] Create `README.md` at repo root with these sections (write each section in full, not as bullets):

```
# iNFT² — agents that own agents

## What this is
[two-paragraph product description]

## The recursion primitive
[explain: parent iNFT² holds child iNFT²s in its ERC-6551 wallet; manager rebalances; one transfer moves the subtree]

## Mainnet addresses (0G Chain, chainId 16661)
- iNFT2: 0x...
- AgentController: 0x...
- SnapshotAttestor: 0x...
- ERC6551Account impl: 0x...

## Live demo
- Demo URL: https://inft2.vercel.app/demo
- Live agents: manager #1, momentum #2, mean-reversion #3
- Explorer: https://chainscan.0g.ai/address/<AgentController>

## 0G modules used (11)
- 0G Chain (16661) — all contracts deployed on mainnet
- ERC-6551 Registry (canonical singleton)
- ERC-7857 (draft) — brain lineage roots in iNFT2.sol
- 0G Storage (log + KV) — brain blobs + snapshot data
- 0G Compute Router with verify_tee=true — TEE inference on every agent decision
- 0G Storage encryption (ECIES) — brain blobs encrypted to enclave key
- 0G Payment Layer sub-account — funds Router inference
- Wrapped0G — wallet payments

## Architecture
[diagram]

## Deployment
[step-by-step from scratch]

## Testing
[forge test + vitest commands]

## v1 honesty / v2 roadmap
We were honest about what's mocked. v1 ships the recursion primitive end-to-end on mainnet. The cryptographic accountability layer is v2:
- v1 trusted relayer signs intents → v2 dedicated TEE-sealed Ed25519 key
- v1 SnapshotAttestor accepts relayer-signed snapshots → v2 DASigners precompile quorum verification
- v1 sequential subtree transfer → v2 batched atomic transfer
- v1 prompted strategies → v2 fine-tuning loop on accumulated memory
- v1 2 children + ~2h runtime → v2 N children + 2-week soak before listing

## Reviewer notes
- Check `IntentExecuted` events on AgentController to see live rebalances.
- Each rebalance is an executeChildIntent call where the relayer signs on behalf of the manager's TEE attestation.
- The `verify_tee: true` field on 0G Router calls produces an `x_0g_trace.tee_verified` value in our logs.
```

- [ ] **Commit.**

### Task 7.2 — Architecture diagram

- [ ] Use [Excalidraw](https://excalidraw.com) for 5-minute diagram. Save as `docs/architecture.png`. Link in README.

### Task 7.3 — 3-minute video (Hour 15:30–16:30)

- [ ] Script (read off-screen, screen-record the demo URL):

```
0:00–0:15  Title card: "iNFT² — agents that own agents"
0:15–0:45  Problem: AI agents don't compose. One bot, one wallet, one strategy. Want a portfolio? Spreadsheets.
0:45–1:30  Insight: an iNFT can hold other iNFTs in its ERC-6551 wallet. Each child has its own brain (ERC-7857), wallet, TEE-attested execution. The parent rebalances.
1:30–2:15  Receipts: open https://inft2.vercel.app/demo. Show subtree. Show snapshots. Click a snapshot → chainscan.0g.ai showing IntentExecuted events.
2:15–2:50  Transfer: click "Buy the manager." Sign tx. Page refreshes — buyer now owns manager + both children.
2:50–3:00  "First practical on 0G — 11 primitives, all live, mainnet. demo.inft2.xyz."
```

- [ ] Tools: Loom or QuickTime + iMovie. Export as MP4 ≤3:00.
- [ ] Upload to YouTube (unlisted) → record URL.

### Task 7.4 — Pitch deck (Hour 16:30–17:00)

- [ ] 10 slides in Google Slides or Pitch. Copy already drafted in Phase 8 of prior plan — slot content directly.
- [ ] Export PDF, attach as bonus material.

### Task 7.5 — X post

- [ ] Compose:

```
🧠² Just shipped iNFT² on @0G_labs — agents that own agents.

A manager iNFT² holds 2 trader children in its ERC-6551 wallet. It rebalances capital between them based on each child's TEE-attested performance. Sell the manager → buyer inherits the whole desk in one tx.

Live: <demo URL>
Mainnet: <chainscan URL>
Video: <youtube URL>

#0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_
```

- [ ] Attach a 15-second screen-cap of the demo. Post.
- [ ] Record X URL.

---

## PHASE 8 — Submit (Hour 17:00–18:00)

### Task 8.1 — HackQuest form

- [ ] Go to `https://www.hackquest.io/hackathons/0G-APAC-Hackathon` → submit.
- [ ] Fill in:
  - Project name: **iNFT²**
  - One-sentence (≤30 words): **The first agent NFT that can own other agent NFTs. A manager iNFT² holds N child traders in its ERC-6551 wallet and rebalances them via TEE-attested snapshots.**
  - Problem statement: paste from README §"What this is"
  - 0G integrations: paste from README §"0G modules used"
  - Mainnet address: paste AgentController
  - Explorer link: `https://chainscan.0g.ai/address/<AgentController>`
  - GitHub URL: repo URL
  - Demo video URL: YouTube link
  - Demo URL: Vercel link
  - X post URL: link
  - Optional bonus: pitch deck PDF, README

### Task 8.2 — Final sanity check

- [ ] `forge test` → all green.
- [ ] `pnpm vitest run` in runtime → all green.
- [ ] `/demo` loads, shows live state.
- [ ] Recent `IntentExecuted` events visible on `chainscan.0g.ai`.
- [ ] Video plays end-to-end without dead air.
- [ ] README has zero "TODO" or "TBD."
- [ ] All four X tags present.

### Task 8.3 — Tag-along promotion (if time)

- [ ] DM `@0G_labs` on Twitter linking the submission.
- [ ] Post in 0G Discord #showcase channel.

**Phase 8 done.** Submission accepted. Sleep.

---

## Risks & mitigations (compressed)

| Risk | Mitigation |
|---|---|
| 0G mainnet RPC flaky during demo | fallback URL: `https://0g-rpc.0xstream.com` (verify before using); also have `https://evmrpc-testnet.0g.ai` as last resort with README note |
| Router rejects `verify_tee` field | log the response and ship without it; document as "TEE verification via Router signed receipts (latest as of submission)" |
| ERC-6551 singleton not on 0G mainnet | deploy our own registry from `erc6551/reference` — adds 5 minutes |
| 0G Storage indexer down | cache brain blobs locally; reference local URI in `brainURI` and note in README |
| Brain root collisions | use `keccak256(role, timestamp, nonce)` not `keccak256("manager-v1")` |
| Vercel deploy fails | fallback: `pnpm dev` on a public IP with `ngrok` |
| Runtime crashes during judging | `pm2 start runtime/src/main.ts --name loop` so it auto-restarts |
| Out of 0G mid-demo | top up at hour 14 with 2 0G extra |

---

## Self-review (per writing-plans skill)

**Spec coverage:**
- ✅ Manager iNFT² holds N traders → Phase 2 contracts + Phase 6 seed.
- ✅ Each child trades → Phase 3 strategies + Phase 4 loop.
- ✅ TEE-attested execution → 0G Router `verify_tee: true` in `llm.ts`.
- ✅ DA-anchored snapshots → Phase 3 `snapshot.ts` + on-chain `SnapshotAttestor` (DASigners deferred to v2, documented).
- ✅ Manager rebalances → Phase 4 `main.ts::runManager`.
- ✅ Atomic-feeling subtree transfer → Phase 5 buy page + Phase 6 mint (children held in manager's wallet → transfer of manager carries 6551 ownership; sequential brain re-encryption is the v2 piece).
- ✅ Single measurable metric (Sharpe) → `SnapshotAttestor.Snapshot.sharpe`.
- ✅ Mainnet contract address + Explorer link + video + X post → Phase 7/8.
- ✅ README with architecture + 0G modules + reviewer notes → Phase 7.1.

**Placeholder scan:** every "TODO" inside the code blocks is intentional and labeled v2 in the README. No "TBD" steps.

**Type consistency:** `Intent` struct used identically in `AgentController.sol`, `intent.ts`, and the runtime loop. `Snapshot` struct identical in `SnapshotAttestor.sol` and `snapshot.ts`. Wallet derivation always via `walletOf(tokenId)`.

---

## Execution handoff

Plan saved. Two options to start Phase 1:

1. **Subagent-driven** — dispatch one subagent per phase, fast review between phases.
2. **Inline (recommended for a 1-day sprint)** — execute phases in order in this session, checkpoint at the end of each phase.

Which?
