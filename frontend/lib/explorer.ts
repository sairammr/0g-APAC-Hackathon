// Block / storage / compute explorer URL helpers for 0G Galileo testnet.

const CHAINSCAN = 'https://chainscan-galileo.0g.ai';
const STORAGESCAN = 'https://storagescan-galileo.0g.ai';

const isHex = (s: unknown): s is string =>
  typeof s === 'string' && /^0x[0-9a-fA-F]+$/.test(s);

export const txUrl = (hash: unknown): string | null =>
  isHex(hash) && hash !== '0xstub' && hash !== '0xpending'
    ? `${CHAINSCAN}/tx/${hash}`
    : null;

export const addrUrl = (addr: unknown): string | null =>
  isHex(addr) && addr.length === 42 ? `${CHAINSCAN}/address/${addr}` : null;

export const blockUrl = (n: number | string): string =>
  `${CHAINSCAN}/block/${n}`;

// 0G Storage Merkle root. The scanner serves real uploads under /file/<root>,
// but on Galileo today the runtime's 0G Storage SDK (0.3.3) hits a selector
// mismatch and falls back to a process-local keccak256 stub. The resulting
// root is valid hex but no public node has the blob, so storagescan 404s.
// Return null until the upload path is fixed — every caller already degrades
// gracefully to displaying the short hash without a link. _STORAGESCAN ref'd
// here only to keep the constant alive for the day we re-enable it.
export const storageUrl = (_root: unknown): string | null => {
  void STORAGESCAN;
  return null;
};

// 0G Compute receipts are not browsable on a public scanner today — the
// chatId / request_id is the broker's internal correlation id. We surface it
// inline as proof of TEE attestation, but no link.
export const computeReceiptLabel = (chatId: unknown): string | null =>
  typeof chatId === 'string' && chatId.length > 0 ? chatId : null;

export const short = (s: unknown, head = 6, tail = 4): string => {
  if (typeof s !== 'string') return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
};
