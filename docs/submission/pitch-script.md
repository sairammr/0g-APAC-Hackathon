# iNFT² — Pitch Voice-Over

---

## Slide 0 · Title

A new asset class on 0G. Every AI trading agent is one ERC-7857 NFT — encrypted brain on 0G Storage, an ERC-6551 token-bound account as its wallet, and that wallet can hold other ERC-7857s. Own. Trade. Stack.

---

## Slide 1 · Problem  (0:00 – 0:25)

You cannot stack agents. No standard on any chain lets one AI agent atomically own another. Every Virtuals token, every ai16z token — four billion in market cap — is an ERC-20 shell pointing at an off-chain bot. Dead end. No children, no composability.

The fix needed three primitives that only shipped in the last twenty months: ERC-7857 for an NFT carrying re-encryptable private metadata, ERC-6551 so an NFT can own a wallet, and a chain with verifiable TEE inference plus DA under one trust boundary. We're the first team putting all three together.

---

## Slide 2 · Solution  (0:25 – 0:50)

The token is the agent. One ERC-7857 NFT. The token id holds an encrypted brain — ECIES plus AES-256-GCM — on 0G Storage, decryptable only by the owner's key. The same token id is bound to an ERC-6551 account, giving it a full EVM wallet that can hold other ERC-7857 agents.

That is the unlock. Look at the diagram. The manager iNFT's TBA holds three child iNFTs. Sell the manager — the children move with it. Atomic. One transaction. The buyer inherits the model, the wallet, the trade history, and the entire subtree.

---

## Slide 3 · Architecture  (0:50 – 1:15)

Five contracts on 0G Chain — Galileo, chainId 16602: iNFT² (the ERC-7857 implementation), AgentController for EIP-712 intents and caps, SnapshotAttestor for brain lineage, BrainKeyRegistry for owner pubkeys, and the canonical ERC-6551 registry.

Four 0G primitives. Compute runs LLM inference inside an Intel TDX TEE; `processResponse` re-verifies the chip attestation onchain before any trade. Storage holds the encrypted blobs at one-twentieth the cost of S3. DA — via the DASigners precompile — stamps every snapshot with an epoch so brain history is tamper-evident. No other chain has all four under one roof.

---

## Slide 4 · Anatomy of a tick  (1:15 – 1:50)

Four moves. Five seconds.

Decide — the TEE-hosted LLM picks buy or sell and signs the response. Authorize — the decision becomes an EIP-712 intent with nonce, expiry, per-trade cap, daily cap, allowlist; the owner signs, the operator only relays. Snapshot — every six hours we encrypt the full state to the owner's pubkey, push to 0G Storage, and commit a new Merkle root chained to the previous one. Sell — `transferWithReKey` fetches the ciphertext, re-encrypts to the buyer's pubkey, uploads, commits the new root, and flips ownership. One transaction. The seller's key is dead the instant it clears. That atomic re-key is the part ERC-7857 invented.

---

## Slide 5 · Proof  (1:50 – 2:15)

We didn't describe it. We shipped it. Twenty-one forge tests green, fourteen vitest green, six contracts deployed on 0G Galileo. The brain lineage is live — snapshots S-001 through S-004, each chained to the previous root, each anchored to a 0G DA epoch. One manager iNFT, Orchard, with three children — Lark, Tide, Quill — bound inside its ERC-6551 account, ticking on the demo right now.

---

## Demo  (2:15 – 2:45) · switch to /demo

Orchard. ERC-6551 account holding Lark, Tide, Quill. All four trading live on 0G Galileo.

Click into Lark. Every decision row carries a green badge — that's `processResponse` re-verifying the TEE attestation. The chip signed it. The chain knows it ran.

Now — Sell. Runtime fetches the ciphertext from 0G Storage, decrypts with the seller's key, re-encrypts to the buyer's pubkey, uploads, commits the new root, flips ERC-721 ownership. One transaction.

The buyer just acquired a working agent — model, snapshot history, three children inside the TBA, the wallet they trade from — for the cost of one ERC-7857 transfer. Atomically. On no other chain.

---

## Close  (2:45 – 3:00)

inft-squared dot vercel dot app. Own. Trade. Stack. Thank you.
