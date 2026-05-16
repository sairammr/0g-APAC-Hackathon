import type {
  createZGComputeNetworkBroker as CreateBroker,
  ZGComputeNetworkBroker,
} from '@0gfoundation/0g-compute-ts-sdk';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
import 'dotenv/config';

// The 0G SDK ships a broken ESM build (rollup output references symbol
// names that aren't exported from the chunk file); the CJS build works.
// Use createRequire to pull the CJS entry directly under ESM.
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require(
  '@0gfoundation/0g-compute-ts-sdk'
) as { createZGComputeNetworkBroker: typeof CreateBroker };

const RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const ENV_PROVIDER = process.env.ZG_PROVIDER || '';
const ENV_MODEL = process.env.ZG_MODEL || 'qwen/qwen-2.5-7b-instruct';

let _broker: ZGComputeNetworkBroker | null = null;
let _brokerInit: Promise<ZGComputeNetworkBroker> | null = null;
async function getBroker(): Promise<ZGComputeNetworkBroker> {
  if (_broker) return _broker;
  if (!_brokerInit) {
    if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY required');
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    _brokerInit = createZGComputeNetworkBroker(wallet).then((b) => {
      _broker = b;
      return b;
    });
  }
  return _brokerInit;
}

/**
 * Resolve the TEE provider address once per process. Honors ZG_PROVIDER if
 * set; otherwise scans listService() for a provider whose `model` matches
 * ZG_MODEL and whose TEE signer has been acknowledged on-chain. We also
 * confirm the per-user acknowledgement and call acknowledgeProviderSigner
 * if missing — this is the consent step that lets the broker sign requests
 * on behalf of this wallet.
 */
let _providerInit: Promise<string> | null = null;
async function getProviderAddress(): Promise<string> {
  if (_providerInit) return _providerInit;
  _providerInit = (async () => {
    const broker = await getBroker();
    let providerAddress = ENV_PROVIDER;
    if (!providerAddress) {
      const services = await broker.inference.listService();
      const match = services.find(
        (s: any) =>
          String(s.model) === ENV_MODEL &&
          String(s.verifiability) === 'TeeML' &&
          s.teeSignerAcknowledged === true
      );
      if (!match) {
        const available = services
          .map((s: any) => `${s.provider} model=${s.model} v=${s.verifiability}`)
          .join('\n  ');
        throw new Error(
          `No TEE-enabled provider found for model ${ENV_MODEL}. Available:\n  ${available}`
        );
      }
      providerAddress = match.provider;
    }
    const userAck = await broker.inference.acknowledged(providerAddress);
    if (!userAck) {
      await broker.inference.acknowledgeProviderSigner(providerAddress);
    }
    return providerAddress;
  })().catch((e) => {
    _providerInit = null;
    throw e;
  });
  return _providerInit;
}

export type InferResult = {
  text: string;
  teeVerified: boolean | null;
  providerAddr: string | null;
  chatId: string | null;
  cost: { input: string; output: string; total: string } | null;
};

/**
 * Run a chat completion through 0G Compute with TEE attestation.
 *
 * Flow:
 *  1. Resolve a TEE-enabled provider for ZG_MODEL.
 *  2. Ask the broker for service metadata (endpoint + model) and signed
 *     request headers tied to this wallet's ledger sub-account.
 *  3. POST directly to the provider's OpenAI-compatible endpoint with
 *     those headers — this is the settlement proof the provider needs.
 *  4. Read `ZG-Res-Key` from the response headers; fall back to
 *     `completion.id` if missing.
 *  5. Call broker.inference.processResponse with the chatId to fetch the
 *     provider's TEE signature and verify it independently.
 *
 * `verify_tee: true` from the old code is unnecessary here — the broker
 * flow itself is the verification path. The boolean returned by
 * processResponse is the attestation result.
 */
export async function infer(
  systemPrompt: string,
  userPrompt: string,
  model = ENV_MODEL
): Promise<InferResult> {
  const broker = await getBroker();
  const providerAddress = await getProviderAddress();
  const { endpoint, model: providerModel } =
    await broker.inference.getServiceMetadata(providerAddress);

  // Content used by the broker to size the request and bill correctly.
  // Mirror what we'll send in the body.
  const content = `${systemPrompt}\n\n${userPrompt}`;
  const headers = await broker.inference.getRequestHeaders(providerAddress, content);

  const body = {
    model: providerModel || model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    chat_template_kwargs: { enable_thinking: false },
  };

  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers as unknown as Record<string, string>),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`0G inference HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }
  const completion: any = await res.json();
  const text: string = completion?.choices?.[0]?.message?.content ?? '';
  const chatId: string | null =
    res.headers.get('zg-res-key') ||
    res.headers.get('ZG-Res-Key') ||
    completion?.id ||
    null;

  // Independent TEE verification. processResponse fetches the provider's
  // signature for `chatId` and checks it against the TEE signer registered
  // on-chain. Returns true/false/null per SDK contract.
  let teeVerified: boolean | null = null;
  if (chatId) {
    try {
      teeVerified = await broker.inference.processResponse(
        providerAddress,
        chatId,
        typeof completion?.usage === 'object' ? JSON.stringify(completion.usage) : undefined
      );
    } catch {
      teeVerified = null;
    }
  }

  const usage = completion?.usage ?? {};
  const cost = usage
    ? {
        input: String(usage.prompt_tokens ?? ''),
        output: String(usage.completion_tokens ?? ''),
        total: String(usage.total_tokens ?? ''),
      }
    : null;

  return {
    text,
    teeVerified,
    providerAddr: providerAddress,
    chatId,
    cost,
  };
}
