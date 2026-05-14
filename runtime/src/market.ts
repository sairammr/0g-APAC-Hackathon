// Synthetic price tick source for trading strategies.
//
// Note: spec assumed a deployed Uniswap V2 pair to read reserves from, but
// no V2 fork is available on 0G Galileo testnet, so we generate a
// deterministic-but-realistic synthetic price walk instead. This keeps the
// rest of the runtime (strategies, PnL, snapshots) testable end-to-end.
//
// Single code path = synthetic. Do not add a real-DEX fallback.

export type MarketTick = {
  ts: number;       // unix seconds
  price: number;    // dUSD per dRISK
  reserve0: bigint; // synthetic dUSD reserve
  reserve1: bigint; // synthetic dRISK reserve
};

const WINDOW_MAX = 60;
const BASE_PRICE = 10;

// --- seedable RNG (xorshift32) ---------------------------------------------
function xorshift32(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0x100000000);
  };
}

// Pure step function for testability.
function stepPrice(price: number, rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  const logReturn = (u1 - u2) * 0.02;
  return price * Math.exp(logReturn);
}

// --- internal state --------------------------------------------------------
const seed = Number(process.env.MARKET_SEED ?? 1);
const rng = xorshift32(seed);
let lastPrice = BASE_PRICE;
const windowTicks: MarketTick[] = [];

if (process.env.PAIR_ADDR) {
  // eslint-disable-next-line no-console
  console.warn(
    `[market] PAIR_ADDR=${process.env.PAIR_ADDR} set, but no Uniswap V2 ` +
      `fork is deployed on 0G Galileo — using synthetic price walk instead.`,
  );
}

// --- public API ------------------------------------------------------------
const ONE_E18 = 10n ** 18n;
const RESERVE0_BASE = 1_000_000n * ONE_E18;

function priceToBigIntE18(p: number): bigint {
  // Convert float price to bigint scaled by 1e18 with integer rounding.
  // Precision doesn't matter for the demo; we just need DEX-looking numbers.
  const scaled = Math.round(p * 1e18);
  return BigInt(scaled);
}

export async function tick(): Promise<MarketTick> {
  lastPrice = stepPrice(lastPrice, rng);
  const ts = Math.floor(Date.now() / 1000);

  const priceE18 = priceToBigIntE18(lastPrice);
  // reserve1 = reserve0 * 1e18 / priceE18  → keeps integer math safe
  const reserve0 = RESERVE0_BASE;
  const reserve1 = priceE18 > 0n ? (reserve0 * ONE_E18) / priceE18 : 0n;

  const t: MarketTick = { ts, price: lastPrice, reserve0, reserve1 };
  windowTicks.push(t);
  if (windowTicks.length > WINDOW_MAX) windowTicks.shift();
  return t;
}

function sma(arr: number[], n: number): number {
  if (arr.length === 0) return 0;
  const slice = arr.slice(-n);
  let sum = 0;
  for (const v of slice) sum += v;
  return sum / slice.length;
}

export function indicators(): { price: number; sma20: number; sma50: number } {
  const prices = windowTicks.map((t) => t.price);
  const price = prices.length > 0 ? prices[prices.length - 1]! : lastPrice;
  return {
    price,
    sma20: sma(prices, 20),
    sma50: sma(prices, 50),
  };
}

// Exported for testing only.
export const _internals = { xorshift32, stepPrice, WINDOW_MAX };
