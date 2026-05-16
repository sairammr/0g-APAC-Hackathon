# ERC-7857 — Disadvantages, Limitations, and Open Problems

> Honest prep doc for hackathon Q&A. Every weakness is sourced. For each one, we list how iNFT² mitigates it (so we're not blind-sided) and what gaps still remain.

ERC-7857 was introduced by 0G Labs in January 2025 as a draft EIP for AI-agent NFTs with encrypted, transferable metadata. The standard solves real problems (the "transfer ownership but not the brain" gap of ERC-721) but it ships with a non-trivial set of trade-offs that judges will probe.

---

## Severity 1 — structural; cannot be engineered away

### 1. Trusted oracle is a hard dependency

Every transfer requires an off-chain oracle (TEE or ZKP) to decrypt and re-encrypt the brain blob. The chain itself cannot do this natively because EVM operations are public. If the oracle is offline, censoring, or compromised, the entire iNFT marketplace stalls for that asset. *([0G docs](https://docs.0g.ai/developer-hub/building-on-0g/inft/erc7857))*

### 2. TEE trust is not trustless

Re-encryption inside Intel TDX / Nvidia Confidential Compute / AMD SEV-SNP assumes:
- The chip vendor's attestation root key has not been compromised
- The enclave is not vulnerable to side-channel attacks (LVI, ÆPIC, Downfall are all published, real attacks against Intel SGX/TDX in 2022–2024)
- Non-collusion between multiple TEE operators

Academic research explicitly identifies this as a weakness: *"overly strong security assumptions (e.g., non-collusion among multiple servers and the absolute security of TEE) are misaligned with practical scenarios."* ([arXiv 2412.01073](https://arxiv.org/html/2412.01073v1))

### 3. Centralization risk via cloud-hosted TEEs

In practice, TEE compute almost always runs on AWS Nitro, GCP Confidential, Alibaba Cloud, or similar. The trust model effectively migrates from the chain back to the cloud provider. The 0G ecosystem mitigates this with decentralized TEE compute providers, but the *option* of cloud-hosting is always present.

### 4. Lost private key = dead agent

If the owner's secp256k1 private key is lost, the brain blob on 0G Storage is permanently undecryptable. There is no social recovery, MPC custody, or escrow mechanism in the ERC-7857 standard itself. NFT custody patterns like Argent's social recovery don't extend to encrypted-metadata NFTs.

---

## Severity 2 — adoption and ecosystem

### 5. ERC-721 tooling is broken by design

To prevent plaintext metadata from leaking, vanilla `safeTransferFrom` **must revert** on an iNFT (our `iNFT2.sol` does this; the test `test_safeTransferFrom_reverts` enforces it). The consequence: every existing wallet, marketplace, and aggregator that calls `safeTransferFrom` will fail. **OpenSea, Blur, Rarible, MetaMask's built-in transfer flow, every NFT API on Alchemy / Moralis** — none of them work on an iNFT without integrating `transferWithReKey`.

This is the single biggest reason iNFT-7857 will not be a drop-in upgrade to ERC-721.

### 6. Near-zero installed base

ERC-7857 was published January 2025. As of mid-2026 there are very few reference implementations in production. We are one of them. Compare to ERC-721, which has 7 years of marketplace, wallet, indexer, and analytics infrastructure built around it. The network-effects gap is enormous.

### 7. Draft status; interface can still change

The EIP is still in draft. The function signatures (`transfer`, `clone`, `authorizeUsage`, the `IDataVerifier` interface) can be modified before final acceptance. A competing standard, **ERC-7662** (also for dynamic NFTs), was raised in the magicians thread as overlapping. Mindshare battle is not yet decided. *([Ethereum Magicians thread](https://ethereum-magicians.org/t/erc-7857-an-nft-standard-for-ai-agents-with-private-metadata/22391))*

### 8. ZKP path is mostly theoretical

The standard specifies "TEE or ZKP" via the `IDataVerifier` interface. In practice, ZKP-based re-encryption at production cost and latency does not yet exist. ZK-FHE proof generation for an LLM-sized blob would take minutes-to-hours and cost orders of magnitude more than TEE attestation. In 2026, "ERC-7857" practically means "TEE-attested only."

---

## Severity 3 — engineering and operational

### 9. Cryptographic implementation complexity

A correct ERC-7857 implementation requires:
- secp256k1 ECDH for key agreement
- ECIES envelope encryption for the brain blob (asymmetric to symmetric)
- AES-256-GCM with proper IV / tag handling for the blob itself
- EIP-712 typed-data signing for transfers
- Merkle commitments for blob roots
- Oracle attestation verification (TEE quote chain or ZKP)

That's a lot of cryptographic surface area. Lots of places to misimplement (AES-GCM tag truncation, IV reuse, ECIES MAC missing — all real-world bugs). We have 14 vitest tests on `brainKey.ts` for exactly this reason.

### 10. Gas cost compounds with update frequency

Every brain mutation is an on-chain commit. For agents that update state often (every tick, every hour, every snapshot), gas dominates the operating cost. On Ethereum L1 this would be prohibitive at our cadence — only sponsor-chain economics (0G's ~$0.0001-class storage and 11k TPS) make a 6-hour snapshot cadence viable.

### 11. Cross-chain transfers are undefined

Bridging an iNFT to another chain requires the bridge contract itself to re-key inside an enclave on the receiving chain. No bridge supports this today. iNFTs are effectively chain-locked — the opposite of the "blockchain agnostic" framing some early articles imply.

### 12. Regulatory exposure

A transferable asset whose holder receives encrypted yield-generating output (trading PnL) plausibly meets the Howey-style "investment contract" test in some jurisdictions. The standard has no built-in compliance hooks (KYC, transfer restrictions, jurisdictional gating). Marketplace operators integrating ERC-7857 will likely face open legal questions in the US and EU.

---

## How iNFT² already mitigates these (Q&A defenses)

| Weakness | Our mitigation |
|---|---|
| Oracle SPOF (#1) | Operator never holds user funds. If the oracle is offline, holdings remain safe inside the ERC-6551 TBA. Only *transfers* pause — trading continues. |
| TEE trust assumptions (#2) | Every inference is **independently re-verified onchain** via `broker.inference.processResponse` after the response is received. We don't trust the attestation; we re-check it. |
| Cloud centralization (#3) | We use the 0G Compute Router, which load-balances across multiple TEE providers and lets the client pin or strategy-select. No single AWS dependency. |
| Lost key (#4) | Privy embedded wallet (current); MPC custody integration is the obvious follow-up. |
| ERC-721 tooling broken (#5) | We ship our own buy flow at `/agent/[id]/buy`. We do not rely on OpenSea for v1. |
| Implementation complexity (#9) | 21 forge tests + 14 vitest tests cover the full crypto stack including AES-GCM tag enforcement, ECIES MAC verification, and EIP-712 digest cases. |
| Gas cost (#10) | Snapshot cadence is configurable via `SNAPSHOT_EVERY_MS`. 0G Storage is ~95% cheaper than S3 and orders of magnitude cheaper than Ethereum calldata. |
| Standard volatility (#7) | Our `IERC7857.sol` is a single interface file — the surface area to update if the EIP changes is small. |

---

## Gaps in iNFT² (honest disclosures)

These are real limits in our current implementation. Mention only if pressed:

1. **Re-key oracle = operator EOA (today).** A production deployment needs either (a) a TEE-attested re-key service, or (b) client-side re-encryption by the buyer with a published TEE proof. We have not built either yet.
2. **No ZKP fallback.** TEE-only. If the TEE trust assumption breaks, our security model breaks with it.
3. **Browser-side blob download.** The 0G Storage SDK's `indexer.download()` is node-only. Our frontend uses `downloadToBlob` as a workaround, but it's bandwidth-heavy for large brain blobs.
4. **Buy flow drainage.** The transfer queue exists; the runtime drainer that processes queued buy requests is a planned follow-up, not wired in v1.
5. **Brain root recovery on snapshot fork.** If two snapshots race and one wins the chain commit, the loser's brain blob is orphaned in 0G Storage. Cleanup is manual.

---

## Sources

- [ERC-7857: AI Agents NFT with Private Metadata (EIPs.ethereum.org)](https://eips.ethereum.org/EIPS/eip-7857)
- [Ethereum Magicians discussion thread](https://ethereum-magicians.org/t/erc-7857-an-nft-standard-for-ai-agents-with-private-metadata/22391)
- [0G Labs — Introducing ERC-7857](https://0g.ai/blog/0g-introducing-erc-7857)
- [0G Documentation — ERC-7857 Standard](https://docs.0g.ai/developer-hub/building-on-0g/inft/erc7857)
- [Thirdweb — ERC-7857: Intelligent NFTs for AI Agents](https://blog.thirdweb.com/erc-7857-intelligent-nfts-for-ai-agents/)
- [NFT News Today — ERC-7857 Explained (May 2025)](https://nftnewstoday.com/2025/05/27/erc-7857-explained-your-guide-to-creating-owning-and-evolving-intelligent-nfts)
- [arXiv 2412.01073 — TRUST: A Toolkit for TEE-Assisted Secure Outsourced Computation (TEE limitations)](https://arxiv.org/html/2412.01073v1)
- [Messari — TEE: Building Trust for the AI Era](https://messari.io/report/tee-building-trust-for-the-ai-era)
- [arXiv 2506.23706 — Attestable Audits: Verifiable AI Safety Benchmarks Using TEEs (2025)](https://arxiv.org/html/2506.23706v1)
