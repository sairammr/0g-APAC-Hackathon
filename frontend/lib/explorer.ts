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

// 0G Storage Merkle root. The blob hosting layer is content-addressed; the
// scanner serves the file directly under /file/<root>.
export const storageUrl = (root: unknown): string | null =>
  isHex(root) && root !== '0xstub' ? `${STORAGESCAN}/file/${root}` : null;

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
