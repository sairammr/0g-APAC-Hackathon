'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { hashMessage, recoverPublicKey } from 'viem';
import { getAgent, getDemoState } from '@/lib/api';
import { mapManager, mapWorker, shortAddr, type DesignAgent } from '@/lib/adapter';
import { Eyebrow, Corner, Chip, Button, KV, Stat, BulletCell, Footer } from '@/components/design/primitives';
import { addrUrl, txUrl, short } from '@/lib/explorer';

const STEPS: Array<[string, string]> = [
  ['01', 'Connect'],
  ['02', 'Buyer pubkey'],
  ['03', 'Re-key terms'],
  ['04', 'Confirm'],
];

export default function BuyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address;

  const [agent, setAgent] = useState<DesignAgent | null>(null);
  const [step, setStep] = useState(0);
  const [pubkey, setPubkey] = useState('');
  const [agreeRe, setAgreeRe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ from?: string; tx?: string; status?: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, demo] = await Promise.all([getAgent(id), getDemoState()]);
        if (cancelled) return;
        const role = a?.agent?.role;
        const idx = Math.max(0, (demo?.children ?? []).findIndex((c: any) => String(c.token_id) === String(id)));
        setAgent(role === 'manager' ? mapManager(a.agent, a.snapshots, 0) : mapWorker(a.agent, idx, a.snapshots, 0));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (authenticated && step === 0) setStep(1);
  }, [authenticated, step]);

  async function derivePubkey() {
    if (!wallet || !address) {
      setError('Connect a wallet first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = `Register secp256k1 pubkey for iNFT² purchase of token ${id} at ${Date.now()}`;
      const provider = await wallet.getEthereumProvider();
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, address],
      })) as `0x${string}`;
      const hash = hashMessage(message);
      const recovered = await recoverPublicKey({ hash, signature });
      setPubkey(recovered);
    } catch (e: any) {
      setError(e?.message ?? 'derivation failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitTransfer() {
    if (!address || !pubkey) {
      setError('Need a wallet and a derived pubkey.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/transfer/initiate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tokenId: id, buyer: address, buyerPubkey: pubkey }),
        }
      );
      const j = await r.json();
      if (j.error) {
        setError(j.error);
      } else {
        setResult({ from: j.from, tx: j.tx, status: j.status });
        setStep(3);
      }
    } catch (e: any) {
      setError(e?.message ?? 'submit failed');
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 0) {
      if (!authenticated) login();
      else setStep(1);
    } else if (step === 1) {
      if (pubkey) setStep(2);
      else setError('Derive your pubkey first.');
    } else if (step === 2) {
      if (!agreeRe) {
        setError('Confirm the re-key terms.');
        return;
      }
      submitTransfer();
    }
  }

  if (!agent || !ready) {
    return (
      <div className="page">
        <div className="container" style={{ padding: 48 }}>
          <p className="mono small">loading…</p>
        </div>
      </div>
    );
  }

  const accentClass = agent.accent === 'ink' ? 'ink' : agent.accent;

  return (
    <div className="page">
      <div className="subnav">
        <a onClick={() => router.push(`/agent/${agent.tokenId}`)}>Overview</a>
        <a onClick={() => router.push('/audit')}>Lineage</a>
        <a className="on">Buy</a>
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
          Acquiring iNFT #{agent.tokenId} · {agent.name}
        </div>
      </div>

      <div className="stepper">
        {STEPS.map(([n, name], i) => (
          <div key={n} className={'step' + (i === step ? ' active' : i < step ? ' done' : '')}>
            <span className="num">{n}</span>
            <p className="name" style={{ margin: 0 }}>
              {name}
            </p>
          </div>
        ))}
      </div>

      <div className="bento">
        <div className="cell span-7" style={{ padding: 40, minHeight: 540 }}>
          {step === 0 ? (
            <>
              <Eyebrow>Step 1 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>
                Connect a wallet.
              </h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                We&rsquo;ll use Privy to spin up an embedded secp256k1 wallet on 0G Galileo, or
                you can bring your own. Either way, your pubkey is what we&rsquo;ll re-encrypt
                the brain blob to in the next step.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                  marginTop: 36,
                  border: '1px solid var(--rule)',
                }}
              >
                <div style={{ padding: 24, borderRight: '1px solid var(--rule)' }}>
                  <Eyebrow>Recommended</Eyebrow>
                  <p className="display-s" style={{ margin: '12px 0 8px', fontSize: 24 }}>
                    Privy embedded
                  </p>
                  <p className="small">Email or social login · pubkey derived locally</p>
                </div>
                <div style={{ padding: 24 }}>
                  <Eyebrow>Existing</Eyebrow>
                  <p className="display-s" style={{ margin: '12px 0 8px', fontSize: 24 }}>
                    Browser wallet
                  </p>
                  <p className="small">MetaMask, Rabby — must hold tOG</p>
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next}>
                  {authenticated ? 'Continue' : 'Connect with Privy'}
                </Button>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Eyebrow>Step 2 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>
                Confirm your pubkey.
              </h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                This is the secp256k1 public key the brain blob will be re-encrypted to.
                Whoever holds the matching private key can decrypt the brain after transfer.
                Anyone else — including the previous owner — cannot.
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
                      {shortAddr(address, 8, 6)}
                    </a>
                  ) : (
                    '—'
                  )}
                  {' · '}
                  <button
                    onClick={derivePubkey}
                    disabled={busy}
                    style={{
                      background: 'none',
                      border: 0,
                      color: 'var(--ink)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    {busy ? 'signing…' : pubkey ? 're-derive' : 'sign message to derive'}
                  </button>
                </p>
              </div>

              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next} disabled={!pubkey}>
                  Confirm pubkey
                </Button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Eyebrow>Step 3 of 4</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>
                Re-key terms.
              </h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                On submit, the operator downloads the encrypted blob, decrypts in memory with
                the seller&rsquo;s private key, re-encrypts to your pubkey, uploads the new
                ciphertext to 0G Storage, and submits <span className="mono">reKeyAndTransfer</span> —
                all in one transaction.
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
                <BulletCell n="•" title="Atomicity" desc="Ownership flips iff the new root commits. No half-states." />
                <BulletCell
                  n="•"
                  title="Old key"
                  desc="Seller key cannot decrypt the new ciphertext. Past blobs remain history."
                  last
                />
                <BulletCell
                  n="•"
                  title="Children"
                  desc={
                    agent.role === 'manager'
                      ? 'All children transfer with this token — they live in the TBA.'
                      : 'No children — this is a leaf agent.'
                  }
                />
                <BulletCell n="•" title="Oracle" desc="Co-signature binds new root to new owner address." last />
              </div>

              <label style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: '1px solid var(--rule)',
                    display: 'inline-block',
                    background: agreeRe ? 'var(--ink)' : 'transparent',
                    color: 'var(--bg)',
                    textAlign: 'center',
                    lineHeight: '16px',
                    fontSize: 12,
                  }}
                  onClick={() => setAgreeRe((v) => !v)}
                >
                  {agreeRe ? '✓' : ''}
                </span>
                <span className="body" style={{ margin: 0, maxWidth: '48ch' }}>
                  I understand the brain blob will be re-encrypted to my pubkey and the seller will
                  lose decryption access after this transaction.
                </span>
              </label>

              <div style={{ marginTop: 32 }}>
                <Button variant="solid" onClick={next} disabled={busy || !agreeRe}>
                  {busy ? 'Submitting…' : 'Submit reKeyAndTransfer'}
                </Button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Eyebrow style={{ color: '#1f8a5b' }}>Step 4 of 4 · {result?.status ?? 'complete'}</Eyebrow>
              <h2 className="display-m cursive" style={{ margin: '16px 0 12px' }}>
                iNFT #{agent.tokenId} is queued.
              </h2>
              <p className="body" style={{ maxWidth: '52ch' }}>
                The transfer is queued for the operator runtime, which will re-encrypt the brain
                blob to your pubkey, upload the new ciphertext to 0G Storage, and call{' '}
                <span className="mono">reKeyAndTransfer</span>. Watch this agent&rsquo;s page for
                the new brain root.{' '}
                {agent.role === 'manager' ? 'All children transfer with this token.' : ''}
              </p>

              <div style={{ marginTop: 28 }}>
                <KV
                  pairs={[
                    [
                      'Buyer',
                      address ? (
                        <a className="link" href={addrUrl(address) || '#'} target="_blank" rel="noreferrer">
                          {shortAddr(address, 8, 6)}
                        </a>
                      ) : (
                        '—'
                      ),
                    ],
                    ['Buyer pubkey', shortAddr(pubkey, 12, 8)],
                    [
                      'Previous owner',
                      result?.from ? (
                        <a className="link" href={addrUrl(result.from) || '#'} target="_blank" rel="noreferrer">
                          {shortAddr(result.from, 8, 6)}
                        </a>
                      ) : (
                        '—'
                      ),
                    ],
                    [
                      'Transfer tx',
                      result?.tx && txUrl(result.tx) ? (
                        <a className="link" href={txUrl(result.tx) || '#'} target="_blank" rel="noreferrer">
                          {short(result.tx)}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--ink-3)' }}>pending · runtime will submit</span>
                      ),
                    ],
                    ['Queued at', new Date().toLocaleString('en-US', { hour12: false })],
                  ]}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
                <Button variant="solid" onClick={() => router.push(`/agent/${agent.tokenId}`)}>
                  Open my agent
                </Button>
                <Button onClick={() => router.push('/audit')}>View lineage receipt</Button>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="mono small" style={{ marginTop: 18, color: '#b54545' }}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="cell span-5" style={{ padding: 0 }}>
          <div
            className={'cell ' + accentClass}
            style={{ borderRight: 0, borderBottom: '1px solid var(--rule)', padding: 32 }}
          >
            <Corner>SUMMARY</Corner>
            <Eyebrow style={{ color: agent.accent === 'ink' ? 'rgba(236,238,233,.7)' : 'rgba(11,12,10,.7)' }}>
              You are buying
            </Eyebrow>
            <p className="display-l" style={{ margin: '10px 0 4px', fontSize: 60 }}>
              {agent.name}
            </p>
            <p
              className="mono small"
              style={{
                margin: 0,
                color: agent.accent === 'ink' ? 'rgba(236,238,233,.7)' : 'rgba(11,12,10,.7)',
              }}
            >
              {agent.kind} · iNFT #{agent.tokenId}{' '}
              {agent.role === 'manager' ? '· owns children' : ''}
            </p>
            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop:
                  agent.accent === 'ink' ? '1px solid rgba(236,238,233,.25)' : '1px solid rgba(11,12,10,.25)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <Stat label="Return" value={`${agent.pnlBps >= 0 ? '+' : '−'}${(Math.abs(agent.pnlBps) / 100).toFixed(2)}%`} />
              <Stat label="Sharpe" value={agent.sharpe.toFixed(2)} />
              <Stat label="AUM" value={`$${agent.aum.toLocaleString()}`} />
              <Stat label="Cadence" value="60s" />
            </div>
          </div>

          <div style={{ padding: 32 }}>
            <Eyebrow dot>Cost</Eyebrow>
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '10px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>Re-key gas (est.)</span>
              <span className="num" style={{ textAlign: 'right' }}>0.0082 tOG</span>
              <span style={{ color: 'var(--ink-3)' }}>0G Storage</span>
              <span className="num" style={{ textAlign: 'right' }}>0.0014 tOG</span>
              <span style={{ color: 'var(--ink-3)' }}>Floor</span>
              <span className="num" style={{ textAlign: 'right' }}>0 tOG · testnet</span>
              <span style={{ borderTop: '1px solid var(--rule)', paddingTop: 12, color: 'var(--ink)', fontWeight: 500 }}>
                Total
              </span>
              <span
                className="num"
                style={{
                  borderTop: '1px solid var(--rule)',
                  paddingTop: 12,
                  textAlign: 'right',
                  color: 'var(--ink)',
                  fontWeight: 500,
                }}
              >
                ≈ 0.0096 tOG
              </span>
            </div>
            <p className="mono small" style={{ marginTop: 16 }}>
              Estimated time to confirmed: &lt; 60s · testnet
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
