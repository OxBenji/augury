/**
 * Enriches a Helius webhook event into a HistoricalCandidate for the swarm pipeline.
 * Calls Helius RPC/DAS API for token metadata and recent transaction data.
 */

import type { HistoricalCandidate } from "../../src/db/trenchlens-bridge.js";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// ── Helius RPC helper ──────────────────────────────────────────────

async function heliusRpc(method: string, params: unknown): Promise<unknown> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "murmur",
      method,
      params,
    }),
  });
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`Helius ${method}: ${json.error.message}`);
  return json.result;
}

// ── Extract mint from various event shapes ─────────────────────────

function extractMint(event: Record<string, unknown>): string | null {
  // Try direct tokenMint field
  if (typeof event.tokenMint === "string") return event.tokenMint;

  // Try accountData[].account patterns
  if (Array.isArray(event.accountData)) {
    for (const acc of event.accountData) {
      if (acc && typeof acc === "object" && "account" in acc) {
        return (acc as Record<string, unknown>).account as string;
      }
    }
  }

  // Try events.tokenTransfers
  if (event.events && typeof event.events === "object") {
    const evts = event.events as Record<string, unknown>;
    if (Array.isArray(evts.tokenTransfers) && evts.tokenTransfers.length > 0) {
      const tf = evts.tokenTransfers[0] as Record<string, unknown>;
      if (typeof tf.mint === "string") return tf.mint;
    }
  }

  // Try nativeTransfers or tokenBalanceChanges
  if (Array.isArray(event.tokenBalanceChanges)) {
    for (const tbc of event.tokenBalanceChanges) {
      if (tbc && typeof tbc === "object" && "mint" in tbc) {
        return (tbc as Record<string, unknown>).mint as string;
      }
    }
  }

  return null;
}

// ── Main enrichment function ───────────────────────────────────────

export async function enrichEvent(event: unknown): Promise<HistoricalCandidate | null> {
  if (!event || typeof event !== "object") return null;
  const ev = event as Record<string, unknown>;

  const mint = extractMint(ev);
  if (!mint) {
    console.log("[enrich] no mint address found in event");
    return null;
  }

  console.log(`[enrich] enriching mint: ${mint}`);

  let symbol = "UNKNOWN";
  let name = "Unknown Token";
  let marketCap = 0;
  let isGraduated = false;

  // Fetch asset metadata via DAS
  try {
    const asset = await heliusRpc("getAsset", { id: mint }) as Record<string, unknown>;
    if (asset) {
      const content = asset.content as Record<string, unknown> | undefined;
      const metadata = content?.metadata as Record<string, unknown> | undefined;
      symbol = (metadata?.symbol as string) || "UNKNOWN";
      name = (metadata?.name as string) || "Unknown Token";

      // Token info for supply-based market cap estimate
      const tokenInfo = asset.token_info as Record<string, unknown> | undefined;
      const priceInfo = tokenInfo?.price_info as Record<string, unknown> | undefined;
      if (priceInfo?.total_price) {
        marketCap = Number(priceInfo.total_price) || 0;
      }
    }
  } catch (err) {
    console.log(`[enrich] getAsset failed for ${mint}:`, (err as Error).message);
  }

  // Fetch recent signatures for transaction analysis
  let buys5m = 0;
  let sells5m = 0;
  let volume5m = 0;
  let volume1h = 0;

  try {
    const sigs = await heliusRpc("getSignaturesForAddress", [mint, { limit: 50 }]) as Array<Record<string, unknown>>;
    if (Array.isArray(sigs)) {
      const now = Date.now() / 1000;
      const fiveMinAgo = now - 300;
      const oneHourAgo = now - 3600;

      for (const sig of sigs) {
        const blockTime = Number(sig.blockTime) || 0;
        if (blockTime > fiveMinAgo) {
          // Simplified: assume alternating buys/sells based on memo or instruction type
          // In reality, we'd parse the transaction for swap direction
          buys5m++;
          volume5m += 100; // Placeholder — real volume requires tx parsing
        } else if (blockTime > oneHourAgo) {
          volume1h += 100;
        }
      }
      // Rough buy/sell split (70/30 by default, refined later)
      sells5m = Math.floor(buys5m * 0.4);
      buys5m = Math.ceil(buys5m * 0.6);
    }
  } catch (err) {
    console.log(`[enrich] getSignatures failed:`, (err as Error).message);
  }

  // Determine graduation status
  // Graduated tokens typically have Raydium/Orca pools
  // Simplified: if we have > $1000 liquidity marker or event type says graduation
  const eventType = String(ev.type || "");
  if (eventType.includes("GRADUATION") || eventType.includes("SWAP") || marketCap > 60000) {
    isGraduated = true;
  }

  // Deployer age — placeholder (would need deployer wallet analysis)
  const deployerAge = 30; // Default 30 min

  // Red/green flags — simplified for v1
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  if (sells5m > buys5m * 2) redFlags.push("5m sells > buys — active dumping");
  if (buys5m > 0 && sells5m === 0) greenFlags.push("Pure buy pressure in 5m window");
  if (isGraduated) greenFlags.push("Graduated to DEX — has real liquidity pool");

  // Simple score computation
  const buyPressure = buys5m + sells5m > 0 ? buys5m / (buys5m + sells5m) : 0.5;
  const volumeVelocity = Math.min(volume5m / Math.max(marketCap, 1000), 1);
  const score = Math.round(
    buyPressure * 30 +
    volumeVelocity * 25 +
    (redFlags.length === 0 ? 20 : 0) +
    (isGraduated ? 15 : 0) +
    10 // baseline
  );

  const candidate: HistoricalCandidate = {
    mint,
    symbol,
    name,
    alertedAt: new Date(),
    oldBot: { aiAction: "SKIP", aiConfidence: "LOW", note: "live event — no old bot" },
    outcome: { classification: "unknown", return_1h_pct: null, return_6h_pct: null, return_24h_pct: null, peak_return_pct: null },
    features: {
      score,
      liquidity_usd: isGraduated ? marketCap * 0.3 : 0,
      market_cap: marketCap,
      pair_age_minutes: deployerAge,
      buys_5m: buys5m,
      sells_5m: sells5m,
      buys_1h: buys5m * 5,
      sells_1h: sells5m * 5,
      volume_5m: volume5m,
      volume_1h: volume1h || volume5m * 8,
      change_5m: buys5m > sells5m ? 5 : -5,
      change_1h: buys5m > sells5m ? 20 : -10,
      change_6h: 0,
      has_socials: false,
      has_twitter: false,
      has_website: false,
      top10_holder_pct: 0,
      holder_count: 0,
      is_graduated: isGraduated,
      red_flags: redFlags,
      green_flags: greenFlags,
    },
    safety: {
      lpBurned: null, lpLocked: null, lpLockUntil: null,
      isHoneypot: null, mintAuthorityRenounced: null, freezeAuthorityRenounced: null,
      devSoldOut: null, devHoldingPct: null,
      smartWalletCount: null, knownRugWalletCount: null,
      checkedAt: null, source: null,
    },
    raw: ev,
  };

  console.log(`[enrich] success: ${symbol} mcap=$${marketCap} buys=${buys5m} sells=${sells5m} score=${score}`);
  return candidate;
}
