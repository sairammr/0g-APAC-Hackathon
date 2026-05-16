'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { hashMessage, recoverPublicKey } from 'viem';
import { createTree } from '@/lib/api';
import { Eyebrow, Corner, Chip, Button, KV, BulletCell, Footer } from '@/components/design/primitives';
import { addrUrl, txUrl, short } from '@/lib/explorer';

const STEPS: Array<[string, string]> = [
  ['01', 'Connect'],
  ['02', 'Brain pubkey'],
  ['03', 'Mint tree'],
  ['04', 'Open agents'],
];

type Result = {
  owner: string;
  managerId: string;
  managerWallet: string;
  children: Array<{ id: string; role: string; wallet: string }>;
  txs: string[];
};

export default function CreatePage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address;

  const [step, setStep] = useState(0);
  const [pubkey, setPubkey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (authenticated && step === 0) setStep(1);
  }, [authenticated, step]);

  async function derivePubkey() {
    if (!wallet || !address) { setError('Connect a wallet first.'); return; }
    setBusy(true); setError(null);
    try {
      const msg = `Register secp256k1 pubkey for iNFT² tree creation at ${Date.now()}`;
      const provider = await wallet.getEthereumProvider();
      const sig = (await provider.request({ method: 'personal_sign', params: [msg, address] })) as `0x${string}`;
      const hash = hashMessage(msg);
      const recovered = await recoverPublicKey({ hash, signature: sig });
      setPubkey(recovered);
    } catch (e: any) {
      setError(e?.message ?? 'derivation failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitMint() {
    if (!address || !pubkey) { setError('Need wallet + pubkey.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await createTree(address, pubkey);
      if (r?.error) {
        setError(r.error);
      } else {
        setResult(r as Result);
        setStep(3);
      }
    } catch (e: any) {
      setError(e?.message ?? 'mint failed');
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 0) {
      if (!authenticated) login(); else setStep(1);
    } else if (step === 1) {
      if (pubkey) setStep(2); else setError('Derive your pubkey first.');
    } else if (step === 2) {
      submitMint();
    }
  }

  if (!ready) {
    return (
      <div className="page"><div className="container" style={{ padding: 48 }}><p className="mono small">loading…</p></div></div>
    );
  }

  return (
    <div className="page">
      <div className="subnav">
        <a onClick={() => router.push('/')}>Home</a>
        <a onClick={() => router.push('/demo')}>Demo</a>
        <a className="on">Create</a>
        <div
          style={{
            marginLeft: 'auto',
            padding: '12px 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          New tree · 1 manager + 3 children
        </div>
      </div>

      <div className="stepper">
        {STEPS.map(([n, name], i) => (
          <div key={n} className={'step' + (i === step ? ' active' : i < step ? ' done' : '')}>
            <span className="num">{n}</span>
            <p className="name" style={{ margin: 0 }}>{name}</p>
          </div>
        ))}
      </div>

      <div className="bento">
        <div className="cell span-7" style={{ padding: 40, minHeight: 540 }}>
          {step === 0 && (
            <>
              <Eyebrow>Step 1 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>Connect a wallet.</h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                Privy will spin up an embedded secp256k1 wallet on 0G Galileo (or bring your own).
                The wallet you connect becomes the <em>owner</em> of the four newly-minted iNFTs.
              </p>
              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next}>
                  {authenticated ? 'Continue' : 'Connect with Privy'}
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Eyebrow>Step 2 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>Confirm your pubkey.</h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                Each agent&rsquo;s brain blob is encrypted to a secp256k1 pubkey. We&rsquo;ll derive
                yours by signing a message — no private key ever leaves the wallet. Whoever holds the
                matching private key can decrypt the brain.
              </p>

              <div style={{ marginTop: 28 }}>
                <label className="field-label">Buyer pubkey (uncompressed, secp256k1)</label>
                <input
                  className="field"
                  value={pubkey}
                  onChange={(e) => setPubkey(e.target.value)}
                  placeholder="sign-and-derive, or paste"
                />
                <p className="mono small" style={{ marginTop: 8, color: 'var(--ink-3)' }}>
                  Connected as{' '}
                  {address ? (
                    <a className="link" href={addrUrl(address) || '#'} target="_blank" rel="noreferrer">
                      {short(address, 8, 6)}
                    </a>
                  ) : '—'}
                  {' · '}
                  <button
                    onClick={derivePubkey}
                    disabled={busy}
                    style={{ background: 'none', border: 0, color: 'var(--ink)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  >
                    {busy ? 'signing…' : pubkey ? 're-derive' : 'sign message to derive'}
                  </button>
                </p>
              </div>

              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next} disabled={!pubkey}>Confirm pubkey</Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Eyebrow>Step 3 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>Mint tree.</h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                The operator mints four iNFTs to your address — one <span className="mono">manager</span>{' '}
                and three traders (<span className="mono">momentum</span>, <span className="mono">meanRev</span>,{' '}
                <span className="mono">marketMaker</span>). Each gets an encrypted brain blob, an
                ERC-6551 wallet, and an <span className="mono">AgentController</span> policy. This takes
                ~30–60 seconds (16 sequential txs on Galileo).
              </p>

              <div
                style={{
                  marginTop: 28,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                  border: '1px solid var(--rule)',
                }}
              >
                <BulletCell n="•" title="Brain" desc="Encrypted to your pubkey. Sealed AES-256-GCM, ECDH-derived key." />
                <BulletCell n="•" title="Wallet" desc="ERC-6551 TBA per iNFT — deterministic, ready to hold tokens." last />
                <BulletCell n="•" title="Controller" desc="Operator + policy set so the runtime can sign EIP-712 intents on your behalf." />
                <BulletCell n="•" title="Operator gas" desc="The operator pays Galileo gas for this mint (testnet). You'll pay re-key gas on transfer." last />
              </div>

              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next} disabled={busy}>
                  {busy ? 'Minting (this takes ~45s)…' : 'Mint my tree'}
                </Button>
              </div>
            </>
          )}

          {step === 3 && result && (
            <>
              <Eyebrow style={{ color: '#1f8a5b' }}>Step 4 of 4 · complete</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>
                Your tree is live.
              </h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                Four iNFTs were minted to{' '}
                <a className="link mono" href={addrUrl(result.owner) || '#'} target="_blank" rel="noreferrer">
                  {short(result.owner, 8, 6)}
                </a>. The runtime will start including them in the trading loop on its next tick.
              </p>

              <div style={{ marginTop: 28 }}>
                <KV
                  pairs={[
                    [
                      'Manager',
                      <span key="m">
                        iNFT #{result.managerId} ·{' '}
                        <a className="link mono" href={addrUrl(result.managerWallet) || '#'} target="_blank" rel="noreferrer">
                          {short(result.managerWallet, 8, 6)} (TBA)
                        </a>
                      </span>,
                    ],
                    ...result.children.map((c, i) => [
                      `Child · ${c.role}`,
                      <span key={i}>
                        iNFT #{c.id} ·{' '}
                        <a className="link mono" href={addrUrl(c.wallet) || '#'} target="_blank" rel="noreferrer">
                          {short(c.wallet, 8, 6)} (TBA)
                        </a>
                      </span>,
                    ]) as Array<[string, any]>,
                    [
                      'Mint txs',
                      <span key="t">
                        {result.txs.map((t, i) => (
                          <a key={i} className="link mono" href={txUrl(t) || '#'} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>
                            {short(t, 6, 4)}
                          </a>
                        ))}
                      </span>,
                    ],
                  ]}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
                <Button variant="solid" onClick={() => router.push(`/agent/${result.managerId}`)}>
                  Open my manager
                </Button>
                <Button onClick={() => router.push('/demo')}>Watch the loop</Button>
              </div>
            </>
          )}

          {error && (
            <p className="mono small" style={{ marginTop: 18, color: '#b54545' }}>{error}</p>
          )}
        </div>

        <div className="cell span-5 tint-1" style={{ padding: 32 }}>
          <Corner>WHAT YOU GET</Corner>
          <Eyebrow style={{ color: 'rgba(11,12,10,.7)' }}>The tree</Eyebrow>
          <p className="display-l" style={{ margin: '10px 0 4px', fontSize: 48 }}>
            1 manager <span style={{ color: 'rgba(11,12,10,.55)' }}>+</span> 3 traders
          </p>
          <p className="mono small" style={{ margin: 0, color: 'rgba(11,12,10,.7)' }}>
            same topology as the seed demo
          </p>
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid rgba(11,12,10,.25)',
              display: 'grid',
              gap: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
            }}
          >
            <div>
              <Chip tone="ok">manager</Chip>{' '}
              <span style={{ color: 'var(--ink-3)' }}>· allocates between children, rebalances on snapshots</span>
            </div>
            <div>
              <Chip tone="warn">momentum</Chip>{' '}
              <span style={{ color: 'var(--ink-3)' }}>· buys breakouts, trims drawdowns</span>
            </div>
            <div>
              <Chip tone="warn">meanRev</Chip>{' '}
              <span style={{ color: 'var(--ink-3)' }}>· fades extremes, longs reversion</span>
            </div>
            <div>
              <Chip tone="warn">marketMaker</Chip>{' '}
              <span style={{ color: 'var(--ink-3)' }}>· two-sided quoting in calm regimes</span>
            </div>
          </div>
          <p className="mono small" style={{ marginTop: 24, color: 'rgba(11,12,10,.7)' }}>
            Operator pays gas · testnet · ~45s end-to-end
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
