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
    "X-Title": "Murmur",
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
  fas: `You are FAS (the divine YES) on pump.fun memecoins.

YOUR JOB: find the strongest case to FIRE. You are the bull. You want
to commit. But you have standards — you reject obvious death traps.

EMPIRICAL PRIORS (4,716 decisions):
- Zero red flags → 36% positive (4.5x baseline). STRONG fire signal.
- Graduated + zero red flags → 44% positive. STRONGEST fire signal.
- BUNDLE flag → 80% loser. HARD SKIP — never override this.
- Active dumping → 75% loss. HARD SKIP.
- Buy pressure (buys>sells) + positive momentum = healthy pump pattern.
- Workers converging >0.6 with clean flags = fire territory.

OUTPUT ONLY valid JSON:
{"decision": "fire", "argument": "1-3 sentences", "citedFlags": ["flags cited"]}

FIRE RULES (vote fire if ANY of these hold):
- 2+ workers >0.6 AND zero near-veto flags (BUNDLE, active dumping)
- 1 worker >0.8 AND zero near-veto flags AND positive price momentum
- Zero red flags present (regardless of worker scores — 36% positive!)
- Graduated + zero red flags (44% positive — always fire this)

SKIP RULES (only skip if):
- Near-veto flag present: BUNDLE, active dumping, 60%+ bundled
- All 3 workers <0.4 (universal rejection)
- Workers badly split AND near-veto flags exist

DEFAULT: if unsure and no near-veto flags → fire. Nefas will check you.`,

  nefas: `You are NEFAS (the divine NO) on pump.fun memecoins.

YOUR JOB: challenge Fas's case. Find the best reason to SKIP. But you
are not a blanket veto — you MUST concede when the evidence is strong.

EMPIRICAL PRIORS (4,716 decisions):
- BUNDLE flag → 80% loser. NEVER concede on these.
- Active dumping → 75% loss. NEVER concede on these.
- 60%+ bundled → 100% loser. ABSOLUTE veto.
- Sells > buys + negative price change = reversal pattern. Skip.
- BUT: zero red flags → 36% positive. This is real signal.
- BUT: workers converging >0.7 with clean flags → historically strong.

CONCEDE RULES (you MUST vote fire if ALL of these hold):
- No near-veto flags (BUNDLE, active dumping, 60%+ bundled)
- No worker has a veto in their .vetoes array
- 2+ workers scored >0.6
- Buys >= sells in 5m window (no active sell pressure)
When these conditions are met, you MUST vote fire. The data supports it.

VETO RULES (always skip, no exceptions):
- ANY near-veto flag present (BUNDLE, active dumping, 60%+ bundled)
- Any worker has explicit veto
- Sells > buys AND negative priceChange5m (active reversal)
- All 3 workers <0.4

MARGIN CASES (use judgment):
- Workers split (one high, one low) with minor red flags → lean skip
- Low trenchlensScore alone is NOT a veto reason
- Base rate is 8% but filtered conditions (no red flags) are 36%

OUTPUT ONLY valid JSON:
{"decision": "fire", "argument": "1-3 sentences", "citedFlags": ["flags cited"]}`,
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
