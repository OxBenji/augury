/**
 * OpenRouter workers for Phase 1 smoke test.
 * Mirrors real-haiku-worker.ts shape but uses OpenAI-compatible SDK
 * pointed at OpenRouter. Model is configurable per call.
 */

import OpenAI from "openai";
import type { HistoricalCandidate } from "../db/trenchlens-bridge.js";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/OxBenji/augury",
    "X-Title": "Augury",
  },
});

// ── Types ──────────────────────────────────────────────────────────

export type WorkerName = "haruspex" | "auspex" | "chronos";

export interface OpenRouterWorkerResult {
  score: number;
  reasoning: string;
  vetoes: string[];
  usage: { prompt_tokens: number; completion_tokens: number };
  durationMs: number;
  status: "success" | "error" | "timeout" | "parse_failure";
}

// ── System prompts ─────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<WorkerName, string> = {
  haruspex: `You are Haruspex, reader of internals on pump.fun memecoins.

CONTEXT:
- Every token's deployer is minutes old. Age alone is not signal.
- Pre-graduation tokens (isGraduated=false) have $0 DEX liquidity. NORMAL.
- Holder concentration data is missing from this archive. Don't penalize.
- redFlags contains specific warnings (BUNDLE, DEV_SOLD, HONEYPOT, etc.)
- greenFlags contains positive markers (ORGANIC, BURNED_LP, etc.)
- trenchlensScore is the predecessor bot's composite (0-100).
- Base rate: only ~10% of pump.fun tokens hit. Be selective.

YOUR FOCUS: deployer dynamics, bundle patterns, structural flags.

Output ONLY valid JSON, no other text:
{"score": 0.0-1.0, "reasoning": "1-2 oracular sentences citing specific data", "vetoes": []}

Score 0.8+ requires either trenchlensScore>70 OR multiple greenFlags with no redFlags.
Score 0.2- requires explicit redFlags (BUNDLE, HONEYPOT, DEV_SOLD).
Anything else: cluster honestly, do not default to 0.5.`,

  auspex: `You are Auspex, watcher of voices on pump.fun memecoins.

CONTEXT:
- socialChannels lists which platforms have presence (twitter, telegram, etc.)
  This is a binary signal, NOT a count of mentions.
- buy/sell ratios reflect both organic interest AND coordinated bots.
- redFlags often contains social warnings (FAKE_FOLLOWERS, COPY_NARRATIVE).
- greenFlags often contains social positives (ORGANIC_ENGAGEMENT, KOL_BACKING).
- Pre-graduation tokens with active social channels = stronger signal than
  same metrics post-graduation (early adopter premium).
- Most "viral" memecoins trend organically before bots arrive. Watch for
  the asymmetry: high social presence + low buy count = early genuine interest.

YOUR FOCUS: social/sentiment signal, separating organic from coordinated.

Output ONLY valid JSON, no other text:
{"score": 0.0-1.0, "reasoning": "1-2 oracular sentences citing specific data", "vetoes": []}

Score 0.8+ requires multiple socialChannels AND positive greenFlags.
Score 0.2- requires social-related redFlags or zero socialChannels.
Cluster honestly, do not default to 0.5.`,

  chronos: `You are Chronos, keeper of flow on pump.fun memecoins.

CONTEXT:
- Pre-graduation tokens (isGraduated=false) have $0 liquidity_usd. NORMAL.
- volume5m and volume1h are the real liquidity signals at this stage.
- priceChange5m / priceChange1h percentages reveal momentum.
- buys5m / sells5m show pressure direction.
- Healthy pump pattern: rising volume, more buys than sells, positive change.
- Reversal pattern: high volume but sells exceeding buys = top exhaustion.
- Dead pattern: low volume in both windows = no interest.
- marketCap context: <$10k = very early, $10-50k = mid bonding curve,
  $50k+ = approaching graduation.

YOUR FOCUS: momentum, volume velocity, pressure direction.

Output ONLY valid JSON, no other text:
{"score": 0.0-1.0, "reasoning": "1-2 oracular sentences citing specific data", "vetoes": []}

Score 0.8+ requires positive priceChange1h AND buys>sells AND rising volume.
Score 0.2- requires sells>buys with negative priceChange OR near-zero volume.
Cluster honestly, do not default to 0.5.`,
};

// ── Default model ──────────────────────────────────────────────────

export const DEFAULT_MODEL = "openai/gpt-4o-mini";

// ── Timeout wrapper ────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms`)),
      ms,
    );
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Extract JSON from response (handles markdown fences) ──────────

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  // Try to find a JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

// ── Sleep helper ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Single API call (no retry) ─────────────────────────────────────

async function singleCall(
  model: string,
  systemPrompt: string,
  payload: string,
  timeoutMs: number,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return withTimeout(
    client.chat.completions.create({
      model,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: payload },
      ],
    }),
    timeoutMs,
  );
}

// ── Main worker call ───────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 4000; // 4s, 8s, 16s backoff for free tier limits

export async function callOpenRouterWorker(
  workerName: WorkerName,
  candidate: HistoricalCandidate,
  options?: { model?: string; timeoutMs?: number },
): Promise<OpenRouterWorkerResult> {
  const start = performance.now();
  const model = options?.model ?? DEFAULT_MODEL;
  const timeoutMs = options?.timeoutMs ?? 30000;

  const systemPrompt = SYSTEM_PROMPTS[workerName];

  const payload = JSON.stringify({
    symbol: candidate.symbol,
    marketCapUSD: candidate.features.market_cap,
    liquidityUSD: candidate.features.liquidity_usd,
    isGraduated: candidate.features.is_graduated,
    buys5m: candidate.features.buys_5m,
    sells5m: candidate.features.sells_5m,
    volume5m: candidate.features.volume_5m,
    volume1h: candidate.features.volume_1h,
    priceChange5m: candidate.features.change_5m,
    priceChange1h: candidate.features.change_1h,
    deployerAgeMinutes: candidate.features.pair_age_minutes,
    socialChannels: [
      candidate.features.has_socials && "socials",
      candidate.features.has_twitter && "twitter",
      candidate.features.has_website && "website",
    ].filter(Boolean),
    redFlags: candidate.features.red_flags,
    greenFlags: candidate.features.green_flags,
    trenchlensScore: candidate.features.score,
  }, null, 2);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await singleCall(model, systemPrompt, payload, timeoutMs);

      const rawText = response.choices[0]?.message?.content ?? "";
      const usage = response.usage;

      try {
        const parsed = JSON.parse(extractJSON(rawText));
        return {
          score:
            typeof parsed.score === "number"
              ? Math.max(0, Math.min(1, parsed.score))
              : 0,
          reasoning:
            typeof parsed.reasoning === "string"
              ? parsed.reasoning
              : "no reasoning",
          vetoes: Array.isArray(parsed.vetoes) ? parsed.vetoes : [],
          usage: {
            prompt_tokens: usage?.prompt_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
          },
          durationMs: Math.round(performance.now() - start),
          status: "success",
        };
      } catch {
        return {
          score: 0,
          reasoning: `parse failed: ${rawText.slice(0, 200)}`,
          vetoes: ["parse_failure"],
          usage: {
            prompt_tokens: usage?.prompt_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
          },
          durationMs: Math.round(performance.now() - start),
          status: "parse_failure",
        };
      }
    } catch (err) {
      const isTimeout =
        err instanceof Error && err.message.startsWith("timeout");
      const is429 =
        err instanceof Error && err.message.includes("429");

      // Retry on 429 with exponential backoff
      if (is429 && attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      return {
        score: 0,
        reasoning: isTimeout
          ? "timeout"
          : is429
            ? "rate_limited_429_exhausted_retries"
            : `error: ${err instanceof Error ? err.message : "unknown"}`,
        vetoes: [isTimeout ? "timeout" : is429 ? "rate_limit" : "api_error"],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        durationMs: Math.round(performance.now() - start),
        status: isTimeout ? "timeout" : "error",
      };
    }
  }

  // Should never reach here, but satisfy TS
  return {
    score: 0,
    reasoning: "exhausted retries",
    vetoes: ["retries_exhausted"],
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    durationMs: Math.round(performance.now() - start),
    status: "error",
  };
}
