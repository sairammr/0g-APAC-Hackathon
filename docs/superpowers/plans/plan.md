iNFT² Implementation Plan



For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. This is a master plan at milestone granularity. Each subsystem section ends with a pointer to a sibling sub-plan file (2026-05-14-inft-squared-<subsystem>.md) which expands its tasks into bite-sized TDD steps with full code blocks. Write each sub-plan immediately before starting that subsystem, not all upfront — assumptions move fast in week 1.

Goal: Ship a working iNFT² — an autonomous trading agent ("manager") that holds other autonomous trading agents ("traders") inside its ERC-6551 wallet, allocates capital between them based on DA-attested Sharpe, and transfers atomically with full subtree on sale. Submit to the 0G APAC Hackathon Track 2 (Agentic Trading Arena) by 2026-05-16.

Architecture: Five subsystems on top of the 0G stack: (1) Solidity contracts on 0G Chain mainnet (chainId 16661), (2) TEE-attested agent runtime on 0G Compute, (3) off-chain backend (relayer, indexer, snapshot composer), (4) frontend (owner dashboard + buyer view + live-demo URL), (5) demo orchestration + pitch. Each subsystem is independently testable. Integration happens in week 6.

Tech Stack:





Contracts: Solidity 0.8.20, Foundry, OpenZeppelin ERC-721, ERC-6551 Registry singleton (0x000000006551c19487814612e58FE06813775758), 0gfoundation/0g-agent-nft (eip-7857-draft branch).



0G primitives used: Chain (16661), Storage KV + log, DA + DASigners precompile, Compute Router (TeeML), Direct SDK (Payment Layer sub-accounts), Wrapped0G precompile.



Runtime: TypeScript inside a TeeML enclave; Ed25519 sealed key; OpenAI-SDK client against 0G Router.



Backend: Node.js (TS) for relayer + indexer + snapshot composer; viem; @0gfoundation/0g-storage-ts-sdk; @0gfoundation/0g-compute-ts-sdk.



Frontend: Next.js 14 (App Router), wagmi + viem + Privy for wallet, Tailwind, recharts for P&L curve.



DevOps: Docker for enclave + backend; Vercel for frontend; GitHub Actions CI; Foundry test suite.



0. Project Core — Locked Understanding

Before any code, anyone touching this plan must internalize these five sentences. If a feature would violate one of them, do not build it.





The product is the recursion. iNFT² is the first agent NFT that can hold other agent NFTs in its own ERC-6551 wallet. The "²" is "agents that own agents." Every feature serves that headline.



The v1 demo is fund-of-bots. One manager iNFT² holds three trader children. The manager allocates capital between the three based on each child's DA-attested rolling Sharpe. No other configurations ship in v1.



Children are sovereign. A parent cannot override a child's policy. A parent can only invoke what the child already permits. This is what makes the primitive trustworthy in any future multi-party setting.



The transfer story is the close. The whole point is "one transaction → buyer inherits manager + three children + all wallets + all history." If subtree transfer doesn't work in the demo, the demo doesn't work.



0G is the substrate, not the product. We use 11 of its primitives (Chain, Storage KV, Storage log, DA, DASigners, Wrapped0G, Compute Router TeeML, Direct SDK, Payment Layer, ERC-7857, ERC-6551). We do not invent new ones. Where 0G provides a primitive, use it — don't reimplement.

What we are explicitly NOT building (the focus discipline):





No multi-party economy (royalties, LP shares, strategy marketplaces) — vision slide only.



No autonomous agent acquisition by the parent — vision slide only.



No clone/breeding/offspring — vision slide only.



No agent insurance, no swarm DAOs, no skill marketplaces in v1.



No cross-chain — same-chain (16661) only.



No new models — we run Qwen/GLM via 0G Compute Router.



No web wallet, no custom RPC — Privy + standard 0G RPC.



No marketplace UI competing with existing ones — we ship a single buyer view on the demo agent.



1. System Architecture Map

┌────────────────────────────────────────────────────────────────────────┐
│ Frontend (Next.js, Vercel)                                             │
│  • /agent/[id]            owner dashboard                              │
│  • /agent/[id]/buy        buyer view (P&L + lineage + purchase)        │
│  • /demo                  the always-on hero demo URL                  │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │ reads
┌──────────────────────────┴─────────────────────────────────────────────┐
│ Backend (Node TS, Docker)                                              │
│  • relayer        submits intents + snapshots to chain                 │
│  • indexer        reads chain + storage; serves REST to FE             │
│  • snapshot-composer  builds DA blob every 6h per agent                │
└────┬────────────────────┬───────────────────────┬──────────────────────┘
     │ submit             │ read state            │ submit blob
┌────┴───────────┐  ┌─────┴──────────┐  ┌─────────┴──────────────┐
│ 0G Chain       │  │ 0G Storage     │  │ 0G DA + DASigners      │
│  (16661)       │  │  KV + log      │  │  precompile 0x...1000  │
│                │  │                │  │                        │
│  iNFT2.sol     │  │  memory shards │  │  daily snapshot blobs  │
│  AgentCtrl.sol │  │  action log    │  │                        │
│  6551 Registry │  │  brain blob    │  │                        │
│  SnapshotAttes │  │                │  │                        │
└────────────────┘  └────────────────┘  └────────────────────────┘
     ▲                       ▲
     │ signed intents        │ encrypted writes
┌────┴───────────────────────┴───────────────────────────────────────────┐
│ TEE Runtime (TeeML enclave on 0G Compute)                              │
│  • brain decrypt / re-encrypt with sealed key                          │
│  • inference via 0G Router (Qwen / GLM)                                │
│  • sign Intent + Snapshot with sealed Ed25519                          │
└────────────────────────────────────────────────────────────────────────┘



2. Subsystem Decomposition







#



Subsystem



Owner



Sub-plan file





A



Contracts



Solidity dev



2026-05-14-inft-squared-contracts.md





B



TEE Runtime



Runtime/ML dev



2026-05-14-inft-squared-runtime.md





C



Backend



Backend dev



2026-05-14-inft-squared-backend.md





D



Frontend



Frontend dev



2026-05-14-inft-squared-frontend.md





E



Demo + Pitch



Founder



2026-05-14-inft-squared-demo.md

Each sub-plan file gets written the week before that subsystem's first task starts, using the superpowers:writing-plans discipline (bite-sized TDD steps, exact code, exact commands). The master plan stops at milestone granularity to stay navigable.



3. Pre-implementation Week (Week 0 — May 17–23, 2026)



STOP. Do not start any subsystem until these four assumptions are validated. If any returns "no," the design changes.

Task 0.1: Confirm 0G Chain CREATE2 deployer presence

Why: ERC-6551 Registry must deploy at the singleton address 0x000000006551c19487814612e58FE06813775758. That requires the standard CREATE2 deployer at 0x4e59b44847b379578588920cA78FbF26c0B4956C to be live on 0G mainnet.





Query eth_getCode on 0x4e59b44847b379578588920cA78FbF26c0B4956C at https://evmrpc.0g.ai.



If code present → singleton works. If empty → deploy our own ERC-6551 Registry at a non-canonical address and document the deviation in the README.

Task 0.2: Ask 0G Discord — does TeeML accept user-supplied enclave code?

Why: Our agent runtime needs to run our binary inside a TEE, not just call a foundation-blessed model. If TeeML is closed to user code, we fall back to TeeTLS (broker-in-TEE proxying to an external LLM).





Post the question in 0G Discord #dev-help.



If yes → proceed with TeeML enclave plan in subsystem B.



If no → switch B to TeeTLS pattern: enclave only verifies TLS to external LLM, signs the response. Document the trust degradation.

Task 0.3: Confirm DASigners precompile gas cost

Why: Every executeChildIntent calls freshSnapshot(childId) which hits the DASigners precompile at 0x...1000. If that call costs >200k gas, the manager's rebalance becomes expensive.





Write a one-line Foundry test that calls IDASigners(0x...1000).isSigner(epoch, addr).



Run forge test --gas-report against testnet fork.



If <200k gas → fine. If >200k → cache the quorum result for an epoch in SnapshotAttestor.

Task 0.4: Read 0gfoundation/0g-agent-nft (eip-7857-draft branch) end to end

Why: Our iNFT2.sol inherits from this. We must know exactly what transfer() expects in sealedKey and proof, and whether the reference oracle is currently mocked or real.





Clone https://github.com/0gfoundation/0g-agent-nft at branch eip-7857-draft.



Read every Solidity file under contracts/.



Document in docs/notes/erc7857-reference-notes.md: oracle interface, proof format, whether re-encryption is mocked, any open issues we'll need to work around.

Task 0.5: Mainnet vs testnet decision

Why: Hackathon mandates a mainnet contract address + Explorer link. But mainnet gas costs real 0G. Decide funding strategy.





Apply for 0G mainnet faucet/grant via 0G Discord; or budget ~$200 of 0G to deploy + run demo for 2 weeks.



All development on testnet (Galileo, chainId 16602). Final deploy on mainnet in week 8.



4. Subsystem A — Contracts (Weeks 1–3)

Goal: Five contracts on 0G mainnet, fully tested with Foundry, gas-profiled, deployed to testnet by end of week 2 and mainnet by end of week 8.

File structure

contracts/
├── src/
│   ├── iNFT2.sol                  # ERC-721 + ERC-7857-draft + brain lineage roots
│   ├── AgentController.sol        # TEE registry, policy, intent gate, recursion math
│   ├── SnapshotAttestor.sol       # DASigners precompile wrapper + snapshot storage
│   ├── ERC6551AccountImpl.sol     # Custom impl with EIP-1271 → TEE attestation
│   ├── LeaseManager.sol           # ERC-7857 authorizeUsage wrapper (v1.5, deferred)
│   └── interfaces/
│       ├── IDASigners.sol         # 0G precompile interface
│       ├── IERC7857.sol           # from 0g-agent-nft reference
│       └── IERC6551.sol           # standard
├── test/
│   ├── iNFT2.t.sol
│   ├── AgentController.t.sol
│   ├── Recursion.t.sol            # transitive ownership, cycle guard
│   ├── PolicyEnforcement.t.sol
│   ├── SnapshotAttestor.t.sol
│   └── Integration.t.sol          # full mint → trade → snapshot → transfer flow
├── script/
│   ├── Deploy.s.sol
│   └── SeedDemo.s.sol             # mints the 4 demo agents
└── foundry.toml

Milestones





Week 1 — A1: Mint, wallet, transfer skeleton.





iNFT2.sol extending ERC-721 + ERC-7857 stub. mint, latestBrainRoot, prevBrainRoot, transfer stub that just rotates ownership (re-encryption deferred).



ERC6551AccountImpl.sol with execute() gated by isValidSigner(AgentController).



Deploy ERC-6551 Registry singleton (Task 0.1 result determines if canonical or custom).



Test: mint token, derive 6551 address, transfer funds, sale rotates control.



Week 2 — A2: Controller + policy + recursion math.





AgentController.sol with registerEnclave, setPolicy, executeIntent (single agent), executeChildIntent (parent → child).



ownsTransitively(parentId, childId, MAX_DEPTH=3) with cycle guard in _beforeTokenTransfer.



Policy struct fully implemented: allowedTargets, maxValuePerTx, maxDailyVolume, snapshotMaxAge.



Tests for: TEE-sig verification (use mock pubkey for now), nonce replay rejection, policy denial paths, depth-3 walk, cycle rejection.



Week 3 — A3: SnapshotAttestor + DASigners + EIP-1271.





SnapshotAttestor.sol — store latest snapshot per token, verify DASigners quorum via precompile (0x...1000).



freshSnapshot(tokenId, maxAge) view.



ERC6551AccountImpl.isValidSignature returns the EIP-1271 magic value when the signer is the AgentController on behalf of the token's owner.



Integration test (Integration.t.sol): full flow — mint manager + 3 children, register fake TEE pubkeys, submit snapshots, manager rebalances via executeChildIntent, sell manager, verify subtree.

Sub-plan handoff

Write 2026-05-14-inft-squared-contracts.md on May 17 using superpowers:writing-plans. Each contract has its own task with: failing test, run-and-fail, minimal impl, run-and-pass, commit. Every test gets its actual Solidity code in the plan, not "test the policy."

Done-criteria





forge test shows 100% coverage on src/iNFT2.sol, src/AgentController.sol, src/SnapshotAttestor.sol, src/ERC6551AccountImpl.sol.



forge test --gas-report shows executeChildIntent < 350k gas including DASigners verification.



Deployed to Galileo testnet (16602) end of week 2. Mainnet (16661) end of week 8.



Etherscan-style verification on chainscan.0g.ai.



5. Subsystem B — TEE Runtime (Weeks 3–5)

Goal: A signed Docker image (or whatever 0G TeeML accepts — confirmed in Task 0.2) that, given a tokenId and a brain storage root, decrypts the brain, runs inference, signs an Intent. Same binary signs Snapshots every 6h.

File structure

runtime/
├── src/
│   ├── enclave/
│   │   ├── keygen.ts              # generate + seal Ed25519 keypair
│   │   ├── attest.ts              # remote attestation quote → on-chain registration payload
│   │   ├── brain.ts               # decrypt/encrypt brain via ECIES to sealed key
│   │   ├── infer.ts               # OpenAI-compatible call to 0G Router
│   │   ├── intent.ts              # build + sign Intent struct
│   │   └── snapshot.ts            # assemble + sign 6h Snapshot blob
│   ├── agent/
│   │   ├── manager.ts             # manager strategy: read child snapshots, rebalance
│   │   ├── momentum.ts            # child strategy 1
│   │   ├── mean-reversion.ts      # child strategy 2
│   │   └── market-maker.ts        # child strategy 3
│   └── main.ts                    # CLI entry; loop tick per N seconds
├── test/
│   └── strategies/                # unit tests for each strategy with mock market data
├── Dockerfile.tee                 # builds the enclave image
└── package.json

Milestones





Week 3 — B1: Key + attestation + intent signing.





Sealed Ed25519 keypair generation inside enclave.



Attestation quote → payload that AgentController.registerEnclave can accept (format depends on Task 0.2 outcome).



signIntent(intent: Intent): bytes producing a signature that matches what the controller verifies.



Unit test on host: simulate enclave, verify signature on-chain via a Foundry test (AgentController.executeIntent with a real Ed25519 sig).



Week 4 — B2: Brain encryption + inference loop.





ECIES decrypt brain blob from 0G Storage KV.



Call 0G Router (zai-org/GLM-5-FP8 or Qwen) with the agent's prompt + market state.



Re-encrypt updated brain, write back to Storage KV.



Three child strategies as separate brain prompts (momentum / mean-reversion / market-maker).



Week 5 — B3: Snapshot composer + manager strategy.





Every 6h, enclave assembles: encrypted memory diff (Storage log), action log, realized P&L (USDC delta in the 6551 wallet), brain root.



Sign blob, submit to 0G DA (one blob per agent per 6h cycle).



Manager strategy reads three children's snapshots via the backend indexer, computes trailing Sharpe, signs executeChildIntent to reallocate capital.

Sub-plan handoff

Write 2026-05-14-inft-squared-runtime.md on May 31. Each function gets a failing TS test with vitest, then implementation, then pass. The enclave-specific parts (sealing, attestation) test against a TEE emulator until we have provider acceptance.

Done-criteria





Three child agents running 24/7 on testnet by end of week 5, generating real on-chain trades on a Uniswap-style DEX on 0G (or mock DEX if none ships in time).



Manager rebalancing every 6h based on real child snapshots.



One snapshot per agent per 6h, all DASigners-quorum-signed.



6. Subsystem C — Backend (Weeks 4–6)

Goal: A small Node service that (a) relays intents and snapshots to chain, (b) indexes chain + storage state, (c) serves REST to the frontend.

File structure

backend/
├── src/
│   ├── relayer/
│   │   ├── intent-relayer.ts      # receive signed Intent → submit executeIntent / executeChildIntent
│   │   └── snapshot-relayer.ts    # receive signed Snapshot blob → DA submit → submitSnapshot
│   ├── indexer/
│   │   ├── chain-indexer.ts       # listen to iNFT2 + AgentController events; postgres
│   │   ├── storage-indexer.ts     # resolve brain root → metadata
│   │   └── snapshot-fetcher.ts    # download DA blob, verify KZG, expose to FE
│   ├── api/
│   │   ├── agent.ts               # GET /api/agent/:id  → composite view
│   │   ├── snapshot.ts            # GET /api/agent/:id/snapshots
│   │   └── lineage.ts             # GET /api/agent/:id/lineage  (brain root chain)
│   └── main.ts
├── test/
│   ├── relayer.test.ts
│   └── indexer.test.ts
├── docker-compose.yml             # postgres + backend
└── package.json

Milestones





Week 4 — C1: Relayer. Accept signed Intent JSON over HTTP, submit on-chain, return tx hash. Same for Snapshot.



Week 5 — C2: Indexer. Listen to all chain events; persist agents, owners, snapshots, intents to Postgres.



Week 6 — C3: API. Three endpoints listed above + a single /api/demo-state that returns everything the frontend needs to render /demo in one round trip.

Sub-plan handoff

Write 2026-05-14-inft-squared-backend.md on June 7.

Done-criteria





vitest covers relayer + indexer happy paths and one failure path each.



API responds <200ms for the demo agent (cached/indexed reads only — never RPC at request time).



Postgres schema migrated via drizzle-kit or similar.



7. Subsystem D — Frontend (Weeks 5–7)

Goal: Three pages that make the demo legible to a judge in <60 seconds.

File structure

frontend/
├── app/
│   ├── page.tsx                   # marketing landing
│   ├── demo/
│   │   └── page.tsx               # the always-on hero demo
│   └── agent/
│       └── [id]/
│           ├── page.tsx           # owner dashboard
│           ├── buy/page.tsx       # buyer view
│           └── lineage/page.tsx   # brain root history
├── components/
│   ├── PnLChart.tsx
│   ├── SubtreeTree.tsx            # visual recursion tree
│   ├── SnapshotTimeline.tsx
│   ├── PolicyEditor.tsx
│   └── PurchaseButton.tsx         # one-click buy → triggers ERC-7857 transfer
├── lib/
│   ├── wagmi.ts
│   ├── api.ts                     # typed client to backend
│   └── chain.ts                   # 0G mainnet config
└── package.json

Milestones





Week 5 — D1: Layout + wallet connect. Privy integration, 0G mainnet in wagmi config.



Week 6 — D2: Demo page. Live P&L chart + subtree visualization + snapshot timeline. Read-only.



Week 7 — D3: Owner dashboard + buyer view + purchase flow. Buyer sees attested P&L; one button → triggers iNFT2.transfer via wallet; success state renders new owner.

Sub-plan handoff

Write 2026-05-14-inft-squared-frontend.md on June 14.

Done-criteria





/demo URL is shareable, public, loads in <2s, shows current state with auto-refresh every 30s.



Buyer purchase flow has been completed end-to-end on testnet at least 10 times.



Lighthouse score >90 on /demo.



8. Subsystem E — Demo + Pitch (Weeks 6–8)

Goal: The 3-minute video, the 10-slide deck, the X/Twitter campaign, and the live demo agent that has been running for 2 weeks by judging time.

Deliverables





E1 (week 6): Mint the four demo agents (1 manager + 3 traders) on testnet. Fund them. Start the runtime. They must run 24/7 from this moment until submission.



E2 (week 7): Record the 3-minute video. Storyline below.



E3 (week 7): Draft pitch deck (10 slides). Storyline below.



E4 (week 7): X/Twitter campaign — 4 posts spaced across the week, hashtags #0GHackathon #BuildOn0G, tags @0G_labs @0g_CN @0g_Eco @HackQuest_.



E5 (week 8): Mainnet deploy. Mint mainnet versions of the four agents. Fund. 48h of mainnet runtime before submission.



E6 (week 8): Submit to HackQuest with: mainnet contract address, Explorer link, video URL, X post URL, README.

The 3-minute video — shot list







Time



Shot



What happens





0:00–0:15



Title card + tagline



"iNFT² — agents that own agents"





0:15–0:45



The problem



Split screen: 5 isolated bots on a dashboard vs. one iNFT² holding 3 children. Voiceover: "AI agents today don't compose. They live in silos."





0:45–1:30



The mechanic



Diagram of the recursion: manager → 6551 wallet → 3 child iNFTs → their wallets → DEXes. Show one rebalance happening live on-chain via the Explorer.





1:30–2:15



The receipts



/demo URL. Manager's 2-week P&L curve. Click any child → see its DA-attested track record + brain lineage. Snapshot timeline.





2:15–2:50



The transfer



Buyer hits purchase. One transaction. Manager + 3 children + all wallets move atomically. Show the seller's next rebalance attempt being refused.





2:50–3:00



Close + URL + CTA



"First practical on 0G. Try it: demo.inft2.xyz"

The 10-slide deck





Title — iNFT² — agents that own agents



Problem — AI agents don't compose



Insight — Recursion is the missing primitive



Product — one screen, the manager + 3 children diagram



How it works — one paragraph each on 7857, 6551, TEE, DA



Demo — /demo URL screenshot + key numbers



Why 0G — the four-primitive co-location (honest framing)



What's new — the 7857 + 6551 + TEE + DA composition has not shipped



Roadmap — v1 fund-of-bots → v2 multi-party (royalties, autonomous acquisition)



Ask — submit + contact

Sub-plan handoff

Write 2026-05-14-inft-squared-demo.md on June 14. This sub-plan includes the script line-by-line, the slide content slide-by-slide, the X post copy, and the README content.

Done-criteria





Video uploaded to YouTube unlisted, <3:00.



Deck exported to PDF, submitted as bonus material.



X post live with required tags + hashtags.



README has: project overview, architecture diagram, 0G modules used, deploy instructions, test instructions, reviewer notes.



Mainnet contract address + Explorer link in README and HackQuest submission.



9. Integration Week (Week 6)

End-of-week-5 must give us: testnet contracts deployed, three runtimes generating real trades + snapshots, backend indexing them, frontend rendering them. Week 6 is the only week where the cross-team work happens.

Integration milestones





Mon: Manager rebalance happens end-to-end (TEE → relayer → controller → child 6551 wallets → DEX). Recorded as the first integration video.



Tue: Frontend /demo reflects state from chain + DA blobs within 30s.



Wed: Subtree transfer dry-run on testnet. Manager + 3 children transfer to a second wallet. New wallet rebalances next cycle. Old wallet's intent gets rejected.



Thu: Snapshot DA blob round-trip — submit, KZG-commit, DASigners sign, submitSnapshot lands, freshSnapshot returns true.



Fri: Full demo dress rehearsal recorded.



10. Selling / Demonstrating — beyond the hackathon submission

Three audiences, three asks. The hackathon submission is just audience #1.

Audience 1 — 0G hackathon judges (May 16 deadline)





What they care about: 0G technical integration (criterion #1), demo quality, novelty, completeness.



What we give them: the 3-minute video, the /demo URL with 2 weeks of real on-chain history by judging time, the README with the 11-primitive integration map, the mainnet contract address.



Probability target: Top 10 (Excellence Award $3,700) is the high-confidence outcome (60%). Top 3 ($20K–$45K) is the stretch (20% combined with the pivot).

Audience 2 — 0G ecosystem team (post-submission)





What they care about: does this make 0G's stack look impressive to outsiders? Could they showcase this in a blog post?



What we give them: an offer to write a co-branded post with 0G titled "First practical recursive AI agent on 0G," with a live demo.inft2.xyz link. Tag them in the X campaign every time we ship a new feature.



Outcome: ecosystem listing, possible grant, intros to other 0G builders.

Audience 3 — agent builders + traders (post-hackathon)





What they care about: can they use this to ship something they couldn't before?



What we give them: an SDK (@inft2/sdk) with three functions: mintAgent, composeAgents (deposit children into a parent), verifySnapshot. A 200-word "build a fund-of-bots in 5 lines" guide. Twitter thread + Mirror post.



Outcome: first 10 external developers in 30 days. Their feedback shapes v2.

Three sentences that travel





"AI agents today don't compose. We made them composable."



"iNFT² is the first agent NFT that can own other agent NFTs."



"First practical on 0G — because TEE inference + DA blobs + cheap EVM + a draft iNFT standard finally live in one place."



11. Risks Register







Risk



Likelihood



Mitigation





TeeML doesn't accept user code



Med



Task 0.2 confirms early. Fallback: TeeTLS pattern with documented trust degradation.





ERC-7857 reference oracle is mocked



High



Task 0.4 confirms. Fallback: ship our own minimal oracle, document as "research prototype on emerging standards."





DASigners precompile too expensive



Low



Task 0.3 confirms. Fallback: cache quorum per epoch in SnapshotAttestor.





Sub-second finality on 0G doesn't hold under load



Low



Document observed finality; if degraded, reduce snapshot frequency.





Subtree transfer non-atomicity confuses judges



Med



Documented honestly in the deck (slide 5). Demo recording shows "same block" settlement for all four tokens.





No DEX on 0G mainnet by week 6



Med



Fallback: deploy a UniswapV2 fork to 0G mainnet as part of SeedDemo.s.sol. Treat as part of the demo scaffolding, not a product claim.





Team gets pulled into v2 features mid-build



High



The "Not Doing" list at the top of this doc is the firewall. Any v2 idea goes to docs/ideas/v2-backlog.md.





Mainnet 0G price spike before deploy



Low



Pre-fund the deployer wallet in week 7.



12. Open Questions





Does any DEX on 0G mainnet exist by week 6? If not, scaffold one.



What is the actual oracle implementation in 0gfoundation/0g-agent-nft? Answer in Task 0.4.



Can we get a 0G Compute mainnet API key with $200 of pre-paid inference before week 5?



Does Privy support 0G mainnet out of the box, or do we need a custom chain registration?



HackQuest submission portal — does it accept multiple URLs (demo + repo + video) or one combined doc?



13. Spec coverage self-review

Walking the user's locked v1 spec against the plan:





✅ Manager iNFT² holds N trader children → Subsystem A (AgentController.executeChildIntent), B (manager strategy), D (subtree visualization).



✅ Each child trades autonomously → Subsystem B (3 child strategies, runtime loop).



✅ 6h DA snapshots with Sharpe → Subsystem B (snapshot.ts), A (SnapshotAttestor), C (snapshot-fetcher).



✅ Manager rebalances via executeChildIntent → A + B + C integration in week 6.



✅ Atomic transfer of subtree → A (cycle guard, depth bound), D (purchase button), integration milestone Wed/week 6.



✅ Single measurable metric (aggregate Sharpe) → D (PnLChart), C (/api/agent/:id).



✅ Mainnet address + Explorer link + video + X post → Subsystem E.

No gaps. No "TBD" steps. Every file path is explicit. Every milestone has a done-criterion.



14. Execution Handoff

Plan saved to docs/superpowers/plans/2026-05-14-inft-squared.md.

Sub-plans to be written (each immediately before the subsystem's first week):





2026-05-14-inft-squared-contracts.md — write on May 17.



2026-05-14-inft-squared-runtime.md — write on May 31.



2026-05-14-inft-squared-backend.md — write on June 7.



2026-05-14-inft-squared-frontend.md — write on June 14.



2026-05-14-inft-squared-demo.md — write on June 14.

Two execution options for week 0:

1. Subagent-driven (recommended) — dispatch a fresh subagent per Task 0.x, review answers between tasks, fast validation cycle. Best for the four-question validation week.

2. Inline execution — execute Tasks 0.1–0.5 in this session. Slower but you stay in the driver's seat.

Which approach for the validation week?