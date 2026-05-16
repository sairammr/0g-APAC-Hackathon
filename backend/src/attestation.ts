import { createRequire } from 'node:module';
import 'dotenv/config';

const require = createRequire(import.meta.url);
const { createReadOnlyInferenceBroker } = require(
  '@0gfoundation/0g-compute-ts-sdk'
) as { createReadOnlyInferenceBroker: any };

const RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const ENV_MODEL = process.env.ZG_MODEL || 'qwen/qwen-2.5-7b-instruct';

export type ProviderInfo = {
  provider: string;
  url: string;
  model: string;
  verifiability: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
};

let _cached: Promise<ProviderInfo> | null = null;

/**
 * Look up the TEE provider for ZG_MODEL via the read-only broker. Cached
 * for the process lifetime — services don't change often, and even if a
 * provider goes down the cached info is fine for surfacing past
 * attestations.
 */
export function getProviderInfo(): Promise<ProviderInfo> {
  if (_cached) return _cached;
  _cached = (async () => {
    const ro = await createReadOnlyInferenceBroker(RPC);
    const services = await ro.listService();
    const match = services.find(
      (s: any) =>
        String(s.model) === ENV_MODEL &&
        String(s.verifiability) === 'TeeML' &&
        s.teeSignerAcknowledged === true
    );
    if (!match) {
      throw new Error(`No TEE-enabled provider for model ${ENV_MODEL}`);
    }
    return {
      provider: String(match.provider),
      url: String(match.url),
      model: String(match.model),
      verifiability: String(match.verifiability),
      teeSignerAddress: String(match.teeSignerAddress),
      teeSignerAcknowledged: !!match.teeSignerAcknowledged,
    };
  })().catch((e) => {
    _cached = null;
    throw e;
  });
  return _cached;
}

/**
 * Construct the two off-chain attestation URLs that the broker SDK uses.
 * These are public per the broker SDK source — no auth required to fetch.
 *
 *  - chat signature: <providerUrl>/v1/proxy/signature/<chatId>
 *  - RA report:      <providerUrl>/v1/proxy/attestation/report
 */
export function chatSignatureUrl(providerUrl: string, chatId: string): string {
  return `${providerUrl}/v1/proxy/signature/${chatId}`;
}

export function raReportUrl(providerUrl: string): string {
  return `${providerUrl}/v1/proxy/attestation/report`;
}
