# iNFT² Demo Video — Script & Shot List

**Length:** 3:00 max (HackQuest cap).
**Aspect:** 1920×1080.
**Audio:** clean voiceover + light underscore (no music spikes).
**Recording:** Loom or OBS, 30 fps minimum, 1080p.

---

## Cold open — 0:00–0:12 (12s)

**Shot:** Browser at `/demo`, four rows of live PnL sparklines streaming. Cursor hovers the Manager row.

**VO:**
> "This is a trading fund where every trader is an NFT. The fund itself is an NFT. And selling the fund moves the encrypted brain — on-chain."

*On-screen lower-third:* `iNFT² — Recursive Intelligent NFTs · 0G Galileo`

---

## Beat 1 — Why "iNFT squared" — 0:12–0:30 (18s)

**Shot A** (0:12–0:18): Animated diagram (still asset — `docs/submission/recursion.png` if we make one, otherwise hand-drawn on Excalidraw):

```
iNFT #2 (Manager)
   │  owns via ERC-6551 TBA
   ├── iNFT #3  (Momentum)
   ├── iNFT #4  (Mean-rev)
   └── iNFT #5  (Market-maker)
```

**VO:**
> "Every agent is an ERC-7857 iNFT. Its brain — the model state, the prompt history — lives encrypted in 0G Storage. Its wallet is an ERC-6551 token-bound account. And because a token-bound account can *own other tokens*, an NFT can own NFTs. That's the recursion."

**Shot B** (0:18–0:30): Zoom out to show *manager → three children*. Highlight: "one transfer of #2 moves the entire subtree."

---

## Beat 2 — How a tick works — 0:30–1:00 (30s)

**Shot:** Split screen. Left: terminal tailing `runtime` loop logs. Right: 0G chainscan tx list filtered to AgentController.

**VO:**
> "Every minute the children read a price tick from market.ts and call 0G Compute for an inference."

*Highlight log line:* `mom: BUY 800 dRISK — sharpe e6=412000`

**VO:**
> "Compute runs in a TEE — we verify the attestation on every response. The strategy returns an intent. The operator signs it EIP-712 and submits it to AgentController on 0G Chain."

*Highlight chainscan row:* `executeChildIntent  ·  manager #2 → child #3  ·  3s ago`

---

## Beat 3 — The 6-hour rebalance — 1:00–1:30 (30s)

**Shot A:** Switch to `/agent/2` (manager dashboard). PnL chart, three children listed with Sharpe values, button: **"Force snapshot"** (we click it for the video — pretends to be the 6h trigger).

**VO:**
> "Every six hours the manager wakes up. It reads each child's recent Sharpe, re-weights the fund, and publishes a full snapshot."

**Shot B:** Cut to terminal showing `publishSnapshot` log:
```
snapshot ok  root=0xab… epoch=482  da=verified  txHash=0x91…
```

**VO:**
> "The snapshot blob lands in 0G Storage. The Merkle root is committed to SnapshotAttestor. The 0G DA epoch is tagged on-chain. So anyone — judges, future buyers, the next operator — can reconstruct the fund's history end to end."

---

## Beat 4 — The sale — 1:30–2:30 (60s)

**Shot A** (1:30–1:42): Open second window — `/agent/3/buy`. Connect with Privy embedded wallet. Modal: "Buy iNFT #3 — Momentum — current PnL +$1,420".

**VO:**
> "Now the interesting part. I want to buy the Momentum agent. Not a copy — the agent itself, brain and all."

**Shot B** (1:42–1:58): Click **Buy**. UI shows a 3-step pipeline:
1. *Registering buyer pubkey…*
2. *Re-keying brain blob…*
3. *Submitting transferWithReKey…*

**VO:**
> "Behind the scenes: my Privy wallet registers its secp256k1 pubkey. The operator downloads the encrypted brain from 0G Storage, decrypts with the seller's key, re-encrypts to my pubkey, uploads, and signs a transfer digest. One transaction settles it: ownership flips, brain blob URI rotates, the seller's key is now useless."

**Shot C** (1:58–2:15): Cut back to `/agent/3` showing new owner = my address, brain blob root has changed. Briefly show the on-chain `Transfer` event in chainscan.

**Shot D** (2:15–2:30): Highlight subtree behavior — go to `/agent/2` and show the lineage tree: only #3 changed hands. Then mention: "If I'd bought #2 instead, all three would have moved with it."

---

## Beat 5 — 0G stack summary — 2:30–2:50 (20s)

**Shot:** Single slide (static), six rows:

| 0G primitive | What we used it for |
|---|---|
| 0G Chain | iNFT² + TBA + AgentController, all on Galileo (16602) |
| 0G Storage | Encrypted brain blobs + full snapshots, content-addressed |
| 0G Compute | TEE-attested LLM inference for all 4 strategies |
| 0G DA | Epoch tag on every snapshot |
| ERC-7857 | Brain lineage + `transferWithReKey` |
| ERC-6551 | One TBA wallet per iNFT |

**VO:**
> "Four 0G primitives, two ERC standards, one recursive idea. Every brain, every trade, every transfer is verifiable from public state."

---

## Close — 2:50–3:00 (10s)

**Shot:** End card with repo URL + chainscan link to iNFT2 contract + demo URL.

```
github.com/<owner>/0g-APAC-Hackathon
demo: inft2.vercel.app/demo
contract: chainscan-galileo.0g.ai/address/0xc9CA0707BcD500Bd00361e6e615DF42F6C08eD6b
```

**VO:**
> "iNFT squared. Built on 0G."

*Lower-third tags:* `#0GHackathon  #BuildOn0G  @0G_labs  @0g_Eco`

---

## Pre-shoot checklist

- [ ] Runtime loop running locally for at least 30 minutes so PnL charts are populated.
- [ ] At least one snapshot already published (so the explorer row exists when we cut to it).
- [ ] Buyer Privy wallet pre-funded with a tiny amount of 0G for gas.
- [ ] Test the buy flow end-to-end once before recording.
- [ ] OBS scenes laid out: `demo-page`, `terminal`, `chainscan`, `agent-page`, `buy-page`, `end-card`.
- [ ] Subtitles drafted (paste this script into the Loom transcript before upload).

## Post-shoot checklist

- [ ] Upload to YouTube *unlisted* + Loom (one of the two must be public per Hackathon §4).
- [ ] Add YouTube description with timestamps matching the beats above.
- [ ] Drop the URL into README §2 and the X submission post.
