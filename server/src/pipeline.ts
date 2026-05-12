/**
 * Pipeline runner: enriches events → runs swarm → broadcasts readings.
 * Includes concurrency limits, daily cost cap, and per-reading circuit breaker.
 */

import { runPipelineOpenRouterPhase2 } from "../../src/coordinators/parallel-fanout.js";
import { enrichEvent } from "./enrich.js";
import { broadcast } from "./broadcast.js";
import { persistReading } from "./storage.js";
import type { MurmurReading } from "./types.js";

// ── State ──────────────────────────────────────────────────────────

let runningCount = 0;
let dailyCost = 0;
let dailyResetAt = getNextMidnightUTC();
let readingCount = 0;

// ── Constants ──────────────────────────────────────────────────────

const MAX_CONCURRENT = 5;
const DAILY_COST_CAP = parseFloat(process.env.DAILY_COST_CAP || "5.00");
const PER_READING_CAP = 0.05;
const COST_PER_READING_ESTIMATE = 0.02;

// ── Helpers ───────────────────────────────────────────────────────���

function getNextMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime();
}

function checkDailyReset(): void {
  if (Date.now() > dailyResetAt) {
    console.log(`[pipeline] daily cost reset: was $${dailyCost.toFixed(4)}`);
    dailyCost = 0;
    dailyResetAt = getNextMidnightUTC();
  }
}

// ── Main pipeline function ─────────────────────────────────────────

export async function runPipelineOnEvent(event: unknown): Promise<void> {
  checkDailyReset();

  // Pre-flight: daily cap
  if (dailyCost + COST_PER_READING_ESTIMATE > DAILY_COST_CAP) {
    console.log("[pipeline] daily cost cap reached, skipping");
    broadcast({ type: "status", payload: { message: "daily cap reached", dailyCost, cap: DAILY_COST_CAP }, timestamp: Date.now() });
    return;
  }

  // Pre-flight: concurrency
  if (runningCount >= MAX_CONCURRENT) {
    console.log("[pipeline] queue full, dropping event");
    return;
  }

  // Enrich
  const candidate = await enrichEvent(event);
  if (!candidate) {
    console.log("[pipeline] enrichment failed, skipping");
    return;
  }

  // Run pipeline
  runningCount++;
  try {
    console.log(`[pipeline] running swarm on ${candidate.symbol}...`);
    const result = await runPipelineOpenRouterPhase2(candidate);

    // Compute cost
    const tokens = result.totalUsage;
    const cost =
      (tokens.prompt_tokens * 0.15) / 1_000_000 +
      (tokens.completion_tokens * 0.60) / 1_000_000;

    // Per-reading circuit breaker
    if (cost > PER_READING_CAP) {
      console.log(`[pipeline] reading exceeded per-cap: $${cost.toFixed(4)}`);
      return;
    }

    dailyCost += cost;
    readingCount++;

    const reading: MurmurReading = {
      id: `reading_${Date.now()}_${readingCount}`,
      timestamp: Date.now(),
      candidate: {
        symbol: candidate.symbol,
        mint: candidate.mint,
        marketCap: candidate.features.market_cap,
        buys5m: candidate.features.buys_5m,
        sells5m: candidate.features.sells_5m,
        liquidity: candidate.features.liquidity_usd,
        isGraduated: candidate.features.is_graduated,
        deployerAge: candidate.features.pair_age_minutes,
        redFlags: candidate.features.red_flags,
        greenFlags: candidate.features.green_flags,
        trenchlensScore: candidate.features.score,
        priceChange5m: candidate.features.change_5m,
        priceChange1h: candidate.features.change_1h,
      },
      workers: {
        haruspex: { score: result.workers.haruspex.score, reasoning: result.workers.haruspex.reasoning },
        auspex: { score: result.workers.auspex.score, reasoning: result.workers.auspex.reasoning },
        chronos: { score: result.workers.chronos.score, reasoning: result.workers.chronos.reasoning },
      },
      fas: { decision: result.fas.decision, argument: result.fas.argument, citedFlags: result.fas.citedFlags },
      nefas: { decision: result.nefas.decision, argument: result.nefas.argument, citedFlags: result.nefas.citedFlags },
      verdict: {
        consensus: result.consensus,
        decision: result.finalDecision === "fire" ? "FIRE" : "SKIP",
      },
      cost,
    };

    // Persist and broadcast
    persistReading(reading);
    broadcast({ type: "reading", payload: reading, timestamp: Date.now() });

    console.log(
      `[pipeline] reading ${reading.id} · ${reading.verdict.decision} · $${cost.toFixed(4)} · daily total $${dailyCost.toFixed(4)}`
    );
  } catch (err) {
    console.error("[pipeline] error:", err);
    broadcast({ type: "error", payload: { message: String(err) }, timestamp: Date.now() });
  } finally {
    runningCount--;
  }
}

// ── Cost stats ─────────────────────────────────────────────────────

export function getCostStats() {
  return {
    dailyCost: parseFloat(dailyCost.toFixed(4)),
    dailyCap: DAILY_COST_CAP,
    capReachedPercent: parseFloat((dailyCost / DAILY_COST_CAP * 100).toFixed(1)),
    runningCount,
    maxConcurrent: MAX_CONCURRENT,
    readingCount,
    resetsAt: new Date(dailyResetAt).toISOString(),
  };
}
