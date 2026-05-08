/**
 * Real Haiku 4.5 workers for Phase 1 smoke test.
 * Replaces mock heuristics with actual LLM calls.
 * Each worker gets the same candidate data but a different system prompt.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { HistoricalCandidate } from "../db/trenchlens-bridge.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ── Types ──────────────────────────────────────────────────────────

export type WorkerName = "haruspex" | "auspex" | "chronos";

export interface RealWorkerResult {
  score: number;
  reasoning: string;
  vetoes: string[];
  usage: { input_tokens: number; output_tokens: number };
  durationMs: number;
  status: "success" | "parse_failure" | "timeout" | "error";
}

// ── System prompts ─────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<WorkerName, string> = {
  haruspex:
    'You are Haruspex, reader of internals. Examine holder patterns, wallet ' +
    'lineage, deployer history. Output ONLY valid JSON with this shape:\n' +
    '{"score": 0.0 to 1.0, "reasoning": "1-2 oracular sentences", "vetoes": ["reason1"]}\n' +
    'Score: 1.0=fire, 0.0=skip. Vetoes only if structurally rotten.',

  auspex:
    'You are Auspex, watcher of voices. Listen to social canopy. Separate ' +
    'signal from coordinated noise. Output ONLY valid JSON:\n' +
    '{"score": 0.0 to 1.0, "reasoning": "1-2 oracular sentences", "vetoes": ["reason1"]}\n' +
    'Score: 1.0=fire, 0.0=skip.',

  chronos:
    'You are Chronos, keeper of flow. Watch volume, depth, rhythm of ' +
    'liquidity. Output ONLY valid JSON:\n' +
    '{"score": 0.0 to 1.0, "reasoning": "1-2 oracular sentences", "vetoes": ["reason1"]}\n' +
    'Score: 1.0=fire, 0.0=skip.',
};

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
  // Try to extract from ```json ... ``` or ``` ... ``` fences
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

// ── Main worker call ───────────────────────────────────────────────

export async function callHaikuWorker(
  workerName: WorkerName,
  candidate: HistoricalCandidate,
): Promise<RealWorkerResult> {
  const start = performance.now();
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

  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: payload }],
      }),
      5000, // 5s timeout per worker
    );

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const usage = response.usage;

    // Parse the JSON response
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
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
        durationMs: Math.round(performance.now() - start),
        status: "success",
      };
    } catch {
      return {
        score: 0,
        reasoning: "parse failed",
        vetoes: ["parse_failure"],
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
        durationMs: Math.round(performance.now() - start),
        status: "parse_failure",
      };
    }
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.message.startsWith("timeout");
    return {
      score: 0,
      reasoning: isTimeout
        ? "timeout"
        : `error: ${err instanceof Error ? err.message : "unknown"}`,
      vetoes: [isTimeout ? "timeout" : "api_error"],
      usage: { input_tokens: 0, output_tokens: 0 },
      durationMs: Math.round(performance.now() - start),
      status: isTimeout ? "timeout" : "error",
    };
  }
}
