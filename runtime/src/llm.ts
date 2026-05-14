import OpenAI from 'openai';
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

const ROUTER_URL = process.env.ROUTER_URL || 'https://router-api.0g.ai/v1';
const RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';

const client = new OpenAI({
  baseURL: ROUTER_URL,
  apiKey: process.env.ZG_API_KEY ?? 'no-key',
});

/**
 * Lazy broker init. The 0G Compute Network broker requires an ethers Wallet
 * and performs network calls during construction, so we defer until first
 * use. This keeps imports of `infer` cheap and avoids forcing top-level
 * await semantics on every consumer.
 */
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

export type InferResult = {
  text: string;
  teeVerified: boolean | null;
  providerAddr: string | null;
  chatId: string | null;
  cost: { input: string; output: string; total: string } | null;
};

/**
 * Run a chat completion through the 0G Compute Router (OpenAI-compatible
 * proxy) with TEE attestation. The router responds with an extra
 * `x_0g_trace` block carrying `tee_verified`, `provider`, `request_id`,
 * and `billing`. We surface those, and additionally do an independent
 * verification round-trip via the broker SDK's `processResponse` so the
 * caller can cross-check what the router self-reports against an on-chain
 * signed attestation.
 */
export async function infer(
  systemPrompt: string,
  userPrompt: string,
  model = 'zai-org/GLM-5-FP8'
): Promise<InferResult> {
  // The OpenAI SDK's request type doesn't know about 0G's custom fields
  // (`verify_tee`, `chat_template_kwargs`); we pass them through as
  // additional properties via a single cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    verify_tee: true,
    chat_template_kwargs: { enable_thinking: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const trace = res.x_0g_trace;
  const text: string = res.choices?.[0]?.message?.content ?? '';

  // Independent verification via broker SDK. processResponse returns
  // Promise<boolean | null> per @0gfoundation/0g-compute-ts-sdk types:
  //   processResponse(providerAddress, chatID?, content?)
  // - true  => signature checks out
  // - false => signature invalid
  // - null  => verification skipped (no chatID)
  let independentlyVerified: boolean | null = null;
  if (trace?.provider && trace?.request_id) {
    try {
      const broker = await getBroker();
      independentlyVerified = await broker.inference.processResponse(
        trace.provider,
        trace.request_id,
        // pass usage payload back to the broker so it can update its fee
        // cache; harmless when undefined
        typeof res.usage === 'object' ? JSON.stringify(res.usage) : undefined
      );
    } catch {
      independentlyVerified = null;
    }
  }

  return {
    text,
    teeVerified: trace?.tee_verified ?? independentlyVerified,
    providerAddr: trace?.provider ?? null,
    chatId: trace?.request_id ?? null,
    cost: trace?.billing ?? null,
  };
}
