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
  haruspex:
    "You are Haruspex, reader of internals. Examine holder patterns, wallet " +
    "lineage, deployer history.\n" +
    "Output ONLY valid JSON in this exact shape, no other text:\n" +
    '{"score": 0.7, "reasoning": "1-2 oracular sentences", "vetoes": []}\n' +
    "Score: 1.0=fire, 0.0=skip. Vetoes only if structurally rotten.",

  auspex:
    "You are Auspex, watcher of voices. Listen to social canopy. Separate " +
    "signal from coordinated noise.\n" +
    "Output ONLY valid JSON in this exact shape, no other text:\n" +
    '{"score": 0.7, "reasoning": "1-2 oracular sentences", "vetoes": []}\n' +
    "Score: 1.0=fire, 0.0=skip.",

  chronos:
    "You are Chronos, keeper of flow. Watch volume, depth, rhythm of " +
    "liquidity.\n" +
    "Output ONLY valid JSON in this exact shape, no other text:\n" +
    '{"score": 0.7, "reasoning": "1-2 oracular sentences", "vetoes": []}\n' +
    "Score: 1.0=fire, 0.0=skip.",
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
    address: candidate.mint,
    symbol: candidate.symbol,
    holderConcentration: candidate.features.top10_holder_pct,
    buys5m: candidate.features.buys_5m,
    sells5m: candidate.features.sells_5m,
    liquidityUSD: candidate.features.liquidity_usd,
    deployerAge: candidate.features.pair_age_minutes,
    socialMentions: [
      candidate.features.has_socials && "socials",
      candidate.features.has_twitter && "twitter",
      candidate.features.has_website && "website",
    ].filter(Boolean),
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
