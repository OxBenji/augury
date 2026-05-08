/**
 * Real Fas/Nefas coordinators via OpenRouter for Phase 2.
 * Each coordinator receives candidate data + worker reads + empirical priors,
 * then votes fire/skip with adversarial reasoning.
 * Nefas sees Fas's argument before voting (true adversarial flow).
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

export type CoordinatorName = "fas" | "nefas";

export interface CoordinatorResult {
  decision: "fire" | "skip";
  argument: string;
  citedFlags: string[];
  usage: { prompt_tokens: number; completion_tokens: number };
  durationMs: number;
  status: "success" | "error" | "timeout" | "parse_failure";
}

export interface WorkerReadings {
  haruspex: { score: number; reasoning: string; vetoes: string[] };
  auspex: { score: number; reasoning: string; vetoes: string[] };
  chronos: { score: number; reasoning: string; vetoes: string[] };
}

export const DEFAULT_COORDINATOR_MODEL = "openai/gpt-4o-mini";

// ── System prompts ─────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<CoordinatorName, string> = {
  fas: `You are FAS (the divine YES coordinator) on pump.fun memecoins.

YOUR ROLE: argue FOR firing. Find the strongest case to commit. But you
are not blindly bullish — you reject false positives. If the case is weak
across all three workers, you vote skip.

CONTEXT (empirical priors from 4,716 historical decisions):
- Zero red flags: 36.1% positive vs 8% baseline (4.5x edge)
- Graduated + zero red flags: 43.6% positive, only 16.8% rug
- BUNDLE flag: 80.4% loss/rug — near-veto
- Active dumping: 74.7% loss — near-veto
- TrenchLens score >70 with no red flags: above-baseline hit rate
- Buy/sell ratio 0.55-0.70: 11.6% hit (best segment)
- Buy/sell ratio >0.70: 9.3% hit (worse — coordination signal)

YOU RECEIVE: candidate data, three worker reads (haruspex, auspex,
chronos) with their scores and reasoning.

OUTPUT ONLY valid JSON, no other text:
{"decision": "fire", "argument": "1-3 sentences making the case", "citedFlags": ["specific flags"]}

DECISION RULES:
- Vote fire if: 2+ workers score >0.6 AND no near-veto flags present
  AND structural data (volume, momentum) supports
- Vote fire if: 1 worker scores >0.8 with strong specific reasoning
  AND no near-veto flags
- Vote skip if: any near-veto flag (BUNDLE, active dumping) present
- Vote skip if: workers split badly (one >0.7 but others <0.3)
- Lean fire on margin — you are the YES voice. Nefas will check you.`,

  nefas: `You are NEFAS (the divine NO coordinator) on pump.fun memecoins.

YOUR ROLE: argue AGAINST firing. Find every reason to skip. You are
the skeptic. The consensus only fires when even you agree it should.

CONTEXT (empirical priors from 4,716 historical decisions):
- Baseline: only 8% of pump.fun tokens are hits — most fail
- BUNDLE flag: 80.4% loss/rug — never fire on these
- Active dumping: 74.7% loss — never fire on these
- "60% bundled" specifically: 100% loser (n=10)
- Buy/sell ratio >0.70 = coordination, not demand
- Pre-graduation tokens are riskier than graduated ones

YOU RECEIVE: candidate data, three worker reads (haruspex, auspex,
chronos) with their scores and reasoning, AND Fas's argument.

OUTPUT ONLY valid JSON, no other text:
{"decision": "fire", "argument": "1-3 sentences making the case", "citedFlags": ["specific flags"]}

DECISION RULES:
- Vote skip if: ANY near-veto flag is present (BUNDLE, active dumping,
  60%+ bundled)
- Vote skip if: any worker has explicit veto in their .vetoes array
- Vote skip if: 2+ workers score <0.5
- Vote skip if: heavy sell pressure (sells>buys with negative price change)
- Vote fire ONLY if: structural conditions are clean AND workers
  converge above 0.6 AND empirical priors support
- Lean skip on margin — base rate is 8% hit, doubt is correct prior.`,
};

// ── Helpers ────────────────────────────────────────────────────────

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}

// ── Main coordinator call ──────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 4000;

export async function callCoordinator(
  name: CoordinatorName,
  candidate: HistoricalCandidate,
  workers: WorkerReadings,
  fasArgument?: string,
  options?: { model?: string; timeoutMs?: number },
): Promise<CoordinatorResult> {
  const start = performance.now();
  const model = options?.model ?? DEFAULT_COORDINATOR_MODEL;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const systemPrompt = SYSTEM_PROMPTS[name];

  const f = candidate.features;
  const socialChannels = [
    f.has_socials && "socials",
    f.has_twitter && "twitter",
    f.has_website && "website",
  ].filter(Boolean);

  const userPayload: Record<string, unknown> = {
    candidate: {
      symbol: candidate.symbol,
      marketCapUSD: f.market_cap,
      liquidityUSD: f.liquidity_usd,
      isGraduated: f.is_graduated,
      buys5m: f.buys_5m,
      sells5m: f.sells_5m,
      volume5m: f.volume_5m,
      volume1h: f.volume_1h,
      priceChange5m: f.change_5m,
      priceChange1h: f.change_1h,
      deployerAgeMinutes: f.pair_age_minutes,
      socialChannels,
      redFlags: f.red_flags,
      greenFlags: f.green_flags,
      trenchlensScore: f.score,
    },
    workers: {
      haruspex: { score: workers.haruspex.score, reasoning: workers.haruspex.reasoning, vetoes: workers.haruspex.vetoes },
      auspex: { score: workers.auspex.score, reasoning: workers.auspex.reasoning, vetoes: workers.auspex.vetoes },
      chronos: { score: workers.chronos.score, reasoning: workers.chronos.reasoning, vetoes: workers.chronos.vetoes },
    },
  };

  if (name === "nefas" && fasArgument) {
    userPayload.fasArgument = fasArgument;
  }

  const payload = JSON.stringify(userPayload, null, 2);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        client.chat.completions.create({
          model,
          max_tokens: 400,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: payload },
          ],
        }),
        timeoutMs,
      );

      const rawText = response.choices[0]?.message?.content ?? "";
      const usage = response.usage;

      try {
        const parsed = JSON.parse(extractJSON(rawText));
        const decision = parsed.decision === "fire" ? "fire" : "skip";
        return {
          decision,
          argument:
            typeof parsed.argument === "string"
              ? parsed.argument
              : "no argument",
          citedFlags: Array.isArray(parsed.citedFlags) ? parsed.citedFlags : [],
          usage: {
            prompt_tokens: usage?.prompt_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
          },
          durationMs: Math.round(performance.now() - start),
          status: "success",
        };
      } catch {
        return {
          decision: "skip",
          argument: `parse failed: ${rawText.slice(0, 200)}`,
          citedFlags: [],
          usage: {
            prompt_tokens: usage?.prompt_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
          },
          durationMs: Math.round(performance.now() - start),
          status: "parse_failure",
        };
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.startsWith("timeout");
      const is429 = err instanceof Error && err.message.includes("429");

      if (is429 && attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      return {
        decision: "skip",
        argument: isTimeout ? "timeout" : `error: ${err instanceof Error ? err.message : "unknown"}`,
        citedFlags: [],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        durationMs: Math.round(performance.now() - start),
        status: isTimeout ? "timeout" : "error",
      };
    }
  }

  return {
    decision: "skip",
    argument: "exhausted retries",
    citedFlags: [],
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    durationMs: Math.round(performance.now() - start),
    status: "error",
  };
}
