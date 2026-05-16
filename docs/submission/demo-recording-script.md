# iNFT² — Demo Recording Script

Target length: **~5 minutes** total runtime, edited.
Format: voice-over + screen recording. Cuts allowed between sections.

---

## 0 · Pre-recording setup (do once before hitting record)

**Terminal:**
```bash
# all three services up
cd backend  && pnpm run dev      # :4000
cd runtime  && pnpm run loop     # ticking + snapshots every 60s
cd frontend && pnpm run dev      # :3000
```

**Confirm in browser before recording:**
- `http://localhost:3000/agent/3` — at least one snapshot with VERIFIED chip + a real tx hash
- `http://localhost:3000/demo` — recursion tree shows Orchard + 3 children

**Tabs to pre-open (in this order, left to right):**
1. `/pitch`
2. `/demo`
3. `/agent/3`
4. `/agent/3/snapshot/<latest>` (click into one VERIFIED row)
5. `/create`
6. `/audit`

**Browser:** Chrome, 1440×900 minimum, dev console closed, bookmarks bar hidden.
**Mic:** Test once. No background music.

Record in 3-second chunks per tab transition so you can crossfade cleanly in post.

---

## 1 · Cold open (0:00 – 0:15) — tab: `/demo`

**On screen:** demo page already loaded, tick stream visible, equity chart redrawing.

**Voice-over (read slow, no pause):**

> "This is a live AI trading agent on 0G. Not a subscription. Not a bot you rent. A single NFT — token id three — with an encrypted brain on 0G Storage, a wallet of its own through ERC-6551, and a tick stream signed inside an Intel TDX enclave. You can own it. You can sell it. And — here's the part nobody has done before — you can stack one inside another."

Hold for 2 seconds on the recursion tree on the right side of the screen.

---

## 2 · Pitch deck — slides 0 to 5 (0:15 – 2:30) — tab: `/pitch`

Switch to `/pitch`. Read the voice-over directly from `docs/submission/pitch-script.md` — already written, already timed.

- **Slide 0** Title (~10s) — "Own. Trade. Stack."
- **Slide 1** Problem (~20s) — lead with stacking
- **Slide 2** Solution (~20s) — point at IdentityComposition diagram
- **Slide 3** Architecture (~20s) — five contracts, four 0G primitives
- **Slide 4** Anatomy of a tick (~25s) — decide → authorize → snapshot → sell
- **Slide 5** Proof (~20s) — 21 forge + 14 vitest, six contracts on Galileo

End slide 5 with: **"We didn't describe it. We shipped it. Let me show you."**

Cut to `/demo`.

---

## 3 · The live system (2:30 – 2:50) — tab: `/demo`

Land on demo. Don't speak for 2 seconds — let viewers see it tick.

Move cursor through, in this exact order, narrating each:

**Left column equity chart:**
> "Manager iNFT Orchard. Ticking live on 0G Galileo right now."

**Right column countdown + DA epoch:**
> "Every minute we anchor a new Merkle root to the current 0G DA epoch — currently fifty-five."

**Recursion tree (hover slowly):**
> "Manager Orchard — token id two. Its ERC-6551 token-bound account holds three children. Lark, momentum strategy, token id three. Tide, mean-reversion, four. Quill, market-making, five. Sell the manager and the three children move with it. Atomic. One transaction."

**Live tick stream (scroll the table briefly):**
> "Every row is a TEE-attested decision. Green check means the chip signature was re-verified through the 0G Compute provider router."

Click **Lark's worker card** → goes to `/agent/3`.

---

## 4 · Agent detail (2:50 – 3:30) — tab: `/agent/3`

Land on agent 3.

**Header strip:**
> "Lark. Momentum strategy. Owner address — the operator EOA. Token-bound wallet — right here. Parent iNFT — number two, the manager."

**PnL panel + equity chart (let it animate for 2 seconds):**
> "Live equity, updated every tick."

**Scroll to Recent decisions table. Hover the green TEE column:**
> "This is the part you cannot fake. Every decision was signed inside an Intel TDX enclave on 0G Compute. The chain re-verified that chip attestation through `processResponse` before the row landed. Click any row to see the attestation receipt."

Click one row. AttestationModal opens. Hold 2 seconds. Close it.

**Scroll to Snapshot lineage panel on the right. Hover the VERIFIED green chip:**
> "This is the lineage. Every snapshot chains the previous brain root to the current one, anchored to a real 0G DA epoch, and submitted to the SnapshotAttestor contract on Galileo. That green VERIFIED chip is a real on-chain transaction."

Click into the latest snapshot row → goes to `/agent/3/snapshot/S-022`.

---

## 5 · Snapshot detail — the receipt (3:30 – 3:55) — tab: `/agent/3/snapshot/...`

Land on snapshot detail.

**Top of page — Brain lineage box:**
> "Snapshot S-022. Previous brain root — all zeros, this is genesis. Current brain root — the active state. Chain verified."

**KV grid below:**
> "Storage root. DA epoch fifty-five. Submit tx — clickable, opens on chainscan."

(Optional cut: click the submit tx link, show the chainscan page for 2 seconds, cut back.)

**Right column Verifiability panel:**
> "Verifiability — one hundred percent. Storage root anchored on-chain. Brain root chained from previous. DA epoch recorded. Submit tx anchored on-chain. All four checks green."

**Blob contents grid:**
> "And these are the blob contents — model weights hash, storage root, DA epoch, Sharpe, realized PnL, submit tx. Concat order is canonical. Re-hashing reproduces the storage root bit-for-bit."

---

## 6 · Mint a new agent tree (3:55 – 4:30) — tab: `/create`

Switch to `/create`. **You can pre-do step 1-3 off-camera and start recording on step 3, then play the mint forward.**

**Step 1 — Connect wallet (15s, cut tight):**
> "First, connect a wallet. Privy handles this — any chain account."

Click Connect, complete in popup, cut.

**Step 2 — Derive brain pubkey (15s):**
> "Sign a message — that derives a secp256k1 keypair the agent's brain will be encrypted to. This signature is the only thing that proves you can decrypt the brain. The private key never leaves your wallet."

Click sign, show "Pubkey derived" state.

**Step 3 — Mint the tree (15s, cut):**
> "Now mint. One transaction deploys four ERC-7857 NFTs — one manager and three traders — wires up the ERC-6551 token-bound accounts, and registers your pubkey with the BrainKeyRegistry. About forty-five seconds on Galileo."

Click "Mint my tree". **Cut the wait** — fast-forward or jump-cut to step 4.

**Step 4 — Done (10s):**
> "Manager iNFT minted. Three child traders inside its token-bound account. All four token ids on-chain. Click into the manager."

Click "Open my manager" → goes to that agent's page. Cut to next section.

---

## 7 · Buy / re-key a child (4:30 – 4:55) — tab: `/agent/3/buy`

Switch to agent 3's buy page (`/agent/3/buy`). This is the atomic re-key flow.

**Buy page lands. Narrate:**
> "This is what happens on sale. The runtime fetches the encrypted brain ciphertext from 0G Storage. Decrypts it with the seller's secp256k1 key. Re-encrypts it — ECIES envelope, AES-256-GCM body — to the buyer's pubkey. Uploads the new ciphertext. Commits the new brain root through SnapshotAttestor. And flips ERC-721 ownership."

Click the buy button. The flow steps through. **Hold on the success state for 3 full seconds.**

> "One transaction. The seller's key is dead against this token the instant it clears. The buyer just acquired a working agent — the model, the snapshot history, the wallet they trade from — for the cost of one ERC-7857 transfer. Atomically. On no other chain."

---

## 8 · Audit log — the proof of replayability (4:55 – 5:10) — tab: `/audit`

Switch to `/audit`.

**Large continuity metric:**
> "Every snapshot across every agent. Verified or pending. One hundred percent lineage continuity."

**Scroll the snapshot table briefly:**
> "Previous to current brain root for every state mutation. Pick any row, replay from genesis. The whole trading history is auditable end-to-end."

---

## 9 · Close (5:10 – 5:25) — back to `/demo`

Cut back to `/demo`. Frame the recursion tree.

> "inft-squared dot vercel dot app. Three primitives — ERC-7857, ERC-6551, 0G Compute plus Storage plus DA — composed for the first time. Own. Trade. Stack. Thank you."

Fade to logo (3 seconds).

---

## Quick reference — section timings

| Section | Tab | Length |
|---|---|---|
| 1 Cold open | `/demo` | 0:15 |
| 2 Pitch deck | `/pitch` | 2:15 |
| 3 Live system | `/demo` | 0:20 |
| 4 Agent detail | `/agent/3` | 0:40 |
| 5 Snapshot receipt | `/agent/3/snapshot/...` | 0:25 |
| 6 Create flow | `/create` | 0:35 |
| 7 Buy / re-key | `/agent/3/buy` | 0:25 |
| 8 Audit log | `/audit` | 0:15 |
| 9 Close | `/demo` | 0:15 |
| **Total** | | **~5:25** |

Trim sections 5, 6, 8 if you need to hit a 5:00 hard cap. Sections 2, 4, 7 are non-negotiable.

---

## Post-production notes

- Add captions for any technical term that appears in the voice-over (ERC-7857, ERC-6551, TEE, DA epoch, ECIES)
- Lower-third name plate on first appearance of: Orchard, Lark, Tide, Quill
- Crossfade between tab cuts (200ms is enough)
- For section 5 chainscan cut, fade to a corner overlay rather than full screen — the parent page should still be in view
- Cold open and close use the **same** demo page framing — viewer recognition signal that you've come full circle
- Section 6 mint wait: cut to a 1-second overlay text "minting on 0G Galileo… 45s" with progress bar
- Section 7 re-key wait: same treatment if it takes more than 5s

---

## What NOT to include in the recording

- Running terminal / logs — the proof is in the UI badges, not the console
- Apology for any glitches — re-record the segment instead
- The runtime tick interval setting (60s) — this is a demo config detail, not a product property
- Pre-fix snapshot rows with PENDING status — refresh the page so only VERIFIED rows show
- Wallet popup chrome — crop or blur the Privy modal background
