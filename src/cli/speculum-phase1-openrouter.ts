#!/usr/bin/env bun
/**
 * Phase 1 OpenRouter smoke test — paid model workers via OpenRouter.
 *
 * Runs 20 stratified historical candidates through the swarm pipeline
 * with REAL OpenRouter API calls for workers, MOCK Fas/Nefas coordinators.
 * Hard cap: $0.50 cost ceiling.
 */

import "dotenv/config";
import { TrenchLensBridge, type HistoricalCandidate } from "../db/trenchlens-bridge.js";
import {
  runPipelineOpenRouter,
  type OpenRouterPipelineResult,
} from "../coordinators/parallel-fanout.js";
import { DEFAULT_MODEL } from "../agents/real-openrouter-worker.js";

// ── Cost constants (GPT-4o-mini pricing via OpenRouter) ─────────────
const INPUT_COST_PER_M = 0.15;   // $0.15 / 1M input tokens
const OUTPUT_COST_PER_M = 0.60;  // $0.60 / 1M output tokens
const COST_CEILING = 0.50;       // hard stop at $0.50

function computeCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1_000_000) * INPUT_COST_PER_M +
    (completionTokens / 1_000_000) * OUTPUT_COST_PER_M
  );
}

// ── Hard stop counters ──────────────────────────────────────────────
const MAX_CONSECUTIVE_PARSE_FAILURES = 5;
const MAX_CONSECUTIVE_TIMEOUTS = 5;
const SLOW_CALL_WARN_MS = 25000; // warn if >25s

// ── CLI flags ───────────────────────────────────────────────────────
const VERBOSE = process.argv.includes("--verbose");

// ── Helpers ─────────────────────────────────────────────────────────

function pickStratified(
  candidates: HistoricalCandidate[],
): HistoricalCandidate[] {
  const buckets: Record<string, HistoricalCandidate[]> = {
    hit: [],
    good: [],
    loss: [],
    rug: [],
    neutral: [],
  };

  for (const c of candidates) {
    const cls = c.outcome.classification;
    if (cls in buckets) buckets[cls].push(c);
  }

  const picks: HistoricalCandidate[] = [];
  for (const outcome of ["hit", "good", "loss", "rug", "neutral"] as const) {
    const bucket = buckets[outcome];
    // Fisher-Yates shuffle
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    picks.push(...bucket.slice(0, 4));
  }

  return picks;
}

// ── Report printer ──────────────────────────────────────────────────

interface CandidateResult {
  candidate: HistoricalCandidate;
  pipeline: OpenRouterPipelineResult;
}

function printReport(
  results: CandidateResult[],
  totalPromptTokens: number,
  totalCompletionTokens: number,
  successfulCalls: number,
  parseFailures: number,
  timeouts: number,
  errors: number,
  totalWorkerDurationMs: number,
  totalWorkerCalls: number,
  model: string,
): void {
  const totalCalls = results.length * 3;
  const totalCost = computeCost(totalPromptTokens, totalCompletionTokens);

  // Bucket outcomes by fire/skip
  const fired = results.filter((r) => r.pipeline.finalDecision === "fire");
  const skipped = results.filter((r) => r.pipeline.finalDecision === "skip");

  const countByOutcome = (
    arr: CandidateResult[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {
      hit: 0, good: 0, loss: 0, rug: 0, neutral: 0,
    };
    for (const r of arr) {
      const cls = r.candidate.outcome.classification;
      if (cls in counts) counts[cls]++;
    }
    return counts;
  };

  const firedOutcomes = countByOutcome(fired);
  const skippedOutcomes = countByOutcome(skipped);

  // Find sample fire and skip for reasoning display
  const sampleFire = fired[0] ?? null;
  const sampleSkip = skipped[0] ?? null;

  const avgLatency = totalWorkerCalls > 0
    ? Math.round(totalWorkerDurationMs / totalWorkerCalls)
    : 0;

  const bar = "═".repeat(55);

  console.log(`\n${bar}`);
  console.log(`   PHASE 1 OPENROUTER · ${results.length} CANDIDATES`);
  console.log(`   Model: ${model}`);
  console.log(bar);
  console.log();
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(
    `Total tokens: in=${totalPromptTokens}, out=${totalCompletionTokens}`,
  );
  console.log(
    `Successful API calls: ${successfulCalls}/${totalCalls}`,
  );
  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Timeouts: ${timeouts}`);
  console.log(`Average latency per worker call: ${avgLatency}ms`);
  console.log();
  console.log(`Outcomes when swarm fired (${fired.length}):`);
  console.log(`  Hit: ${firedOutcomes.hit}, Good: ${firedOutcomes.good}, Loss: ${firedOutcomes.loss}, Rug: ${firedOutcomes.rug}, Neutral: ${firedOutcomes.neutral}`);
  console.log();
  console.log(`Outcomes when swarm skipped (${skipped.length}):`);
  console.log(`  Hit (missed): ${skippedOutcomes.hit}, Good (missed): ${skippedOutcomes.good}, Loss (correct): ${skippedOutcomes.loss}, Rug (correct): ${skippedOutcomes.rug}`);

  if (sampleFire) {
    console.log();
    console.log(
      `Sample fire reasoning (${sampleFire.candidate.symbol}):`,
    );
    console.log(
      `  Haruspex: "${sampleFire.pipeline.workers.haruspex.reasoning}"`,
    );
    console.log(
      `  Auspex:   "${sampleFire.pipeline.workers.auspex.reasoning}"`,
    );
    console.log(
      `  Chronos:  "${sampleFire.pipeline.workers.chronos.reasoning}"`,
    );
  }

  if (sampleSkip) {
    console.log();
    console.log(
      `Sample skip reasoning (${sampleSkip.candidate.symbol}):`,
    );
    console.log(
      `  Haruspex: "${sampleSkip.pipeline.workers.haruspex.reasoning}"`,
    );
    console.log(
      `  Auspex:   "${sampleSkip.pipeline.workers.auspex.reasoning}"`,
    );
    console.log(
      `  Chronos:  "${sampleSkip.pipeline.workers.chronos.reasoning}"`,
    );
  }

  console.log();
  console.log(bar);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Pre-flight: verify API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not loaded. STOP.");
    process.exit(1);
  }

  const model = DEFAULT_MODEL;

  console.log("Phase 1 OpenRouter smoke test — paid model workers");
  console.log(`Model: ${model}`);
  console.log("=====================================================\n");

  // Load data
  const bridge = new TrenchLensBridge();
  await bridge.loadSnapshot();

  const allCandidates = await bridge.getHistoricalCandidates({});
  console.log(`Loaded ${allCandidates.length} historical candidates`);

  const picks = pickStratified(allCandidates);
  console.log(`Selected ${picks.length} stratified candidates`);
  console.log(
    `  Breakdown: ${["hit", "good", "loss", "rug", "neutral"]
      .map(
        (o) =>
          `${o}=${picks.filter((p) => p.outcome.classification === o).length}`,
      )
      .join(", ")}`,
  );
  console.log();

  // Tracking
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let successfulCalls = 0;
  let parseFailures = 0;
  let timeouts = 0;
  let errorCount = 0;
  let consecutiveParseFailures = 0;
  let consecutiveTimeouts = 0;
  let totalWorkerDurationMs = 0;
  let totalWorkerCalls = 0;
  let stoppedEarly = false;

  const results: CandidateResult[] = [];

  for (let i = 0; i < picks.length; i++) {
    const c = picks[i];
    const divider = "───────────────────────────────────────────────";

    if (VERBOSE) {
      const socials = [
        c.features.has_socials && "socials",
        c.features.has_twitter && "twitter",
        c.features.has_website && "website",
      ].filter(Boolean);
      const f = c.features;

      console.log(divider);
      console.log(`[${i + 1}/${picks.length}] ${c.symbol} · outcome=${c.outcome.classification}`);
      console.log(divider);
      console.log(`  mcap:       $${f.market_cap.toLocaleString()}`);
      console.log(`  liquidity:  $${f.liquidity_usd.toLocaleString()}${f.is_graduated ? "" : " (pre-grad)"}`);
      console.log(`  buys 5m:    ${f.buys_5m}  |  sells 5m: ${f.sells_5m}`);
      console.log(`  vol 5m:     $${f.volume_5m.toLocaleString()}  |  vol 1h: $${f.volume_1h.toLocaleString()}`);
      console.log(`  chg 5m:     ${f.change_5m}%  |  chg 1h: ${f.change_1h}%`);
      console.log(`  age:        ${Math.round(f.pair_age_minutes)} min`);
      console.log(`  social:     ${socials.length > 0 ? socials.join(", ") : "none"}`);
      console.log(`  score:      ${f.score}`);
      if (f.red_flags.length > 0) console.log(`  red flags:  ${f.red_flags.join(" | ")}`);
      if (f.green_flags.length > 0) console.log(`  green flags: ${f.green_flags.join(" | ")}`);
      console.log();
    } else {
      process.stdout.write(
        `[${(i + 1).toString().padStart(2)}/${picks.length}] ${c.symbol.padEnd(20)} `,
      );
    }

    const pipeline = await runPipelineOpenRouter(c, { model });
    results.push({ candidate: c, pipeline });

    // Track tokens
    totalPromptTokens += pipeline.totalUsage.prompt_tokens;
    totalCompletionTokens += pipeline.totalUsage.completion_tokens;

    // Track statuses per worker
    for (const worker of [
      pipeline.workers.haruspex,
      pipeline.workers.auspex,
      pipeline.workers.chronos,
    ]) {
      totalWorkerCalls++;
      totalWorkerDurationMs += worker.durationMs;

      if (!VERBOSE && worker.durationMs > SLOW_CALL_WARN_MS) {
        process.stdout.write(`\u26A0${worker.durationMs}ms `);
      }

      if (worker.status === "success") {
        successfulCalls++;
        consecutiveParseFailures = 0;
        consecutiveTimeouts = 0;
      } else if (worker.status === "parse_failure") {
        parseFailures++;
        consecutiveParseFailures++;
        consecutiveTimeouts = 0;
      } else if (worker.status === "timeout") {
        timeouts++;
        consecutiveTimeouts++;
        consecutiveParseFailures = 0;
      } else {
        errorCount++;
        consecutiveParseFailures = 0;
        consecutiveTimeouts = 0;
      }
    }

    const runningCost = computeCost(totalPromptTokens, totalCompletionTokens);

    if (VERBOSE) {
      const decision = pipeline.finalDecision.toUpperCase();
      const outcome = c.outcome.classification;
      const correct = (decision === "FIRE" && (outcome === "hit" || outcome === "good"))
        || (decision === "SKIP" && (outcome === "loss" || outcome === "rug"))
        ? "correct" : "missed";

      console.log(`  Haruspex: ${pipeline.workers.haruspex.score.toFixed(2)} — "${pipeline.workers.haruspex.reasoning}"`);
      console.log(`  Auspex:   ${pipeline.workers.auspex.score.toFixed(2)} — "${pipeline.workers.auspex.reasoning}"`);
      console.log(`  Chronos:  ${pipeline.workers.chronos.score.toFixed(2)} — "${pipeline.workers.chronos.reasoning}"`);
      console.log();
      console.log(`  Decision: ${decision}  (Fas:${pipeline.fas.decision}, Nefas:${pipeline.nefas.decision})`);
      console.log(`  Outcome:  ${outcome}  <- ${correct}`);
      console.log(`  Cost:     $${runningCost.toFixed(4)}`);
      console.log();
    } else {
      console.log(
        `${pipeline.finalDecision.toUpperCase().padEnd(5)} ` +
          `h=${pipeline.workers.haruspex.score.toFixed(2)} ` +
          `a=${pipeline.workers.auspex.score.toFixed(2)} ` +
          `c=${pipeline.workers.chronos.score.toFixed(2)} ` +
          `[${pipeline.totalDurationMs}ms] ` +
          `$${runningCost.toFixed(4)}`,
      );
    }

    // HARD STOPS
    if (runningCost > COST_CEILING) {
      console.error(
        `\nHARD STOP: Running cost $${runningCost.toFixed(4)} exceeds $${COST_CEILING} ceiling.`,
      );
      stoppedEarly = true;
      break;
    }
    if (consecutiveParseFailures >= MAX_CONSECUTIVE_PARSE_FAILURES) {
      console.error(
        `\nHARD STOP: ${MAX_CONSECUTIVE_PARSE_FAILURES}+ consecutive parse failures. Prompt may be broken for this model.`,
      );
      stoppedEarly = true;
      break;
    }
    if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
      console.error(
        `\nHARD STOP: ${MAX_CONSECUTIVE_TIMEOUTS}+ consecutive timeouts. Rate limit or API issue.`,
      );
      stoppedEarly = true;
      break;
    }

    // Check for exhausted 429 retries (all 3 workers failed after retries)
    const allRateLimited = [
      pipeline.workers.haruspex,
      pipeline.workers.auspex,
      pipeline.workers.chronos,
    ].every((w) => w.reasoning.includes("rate_limited_429"));

    if (allRateLimited) {
      console.error("\nHARD STOP: All workers exhausted 429 retries. Free tier limit fully saturated.");
      stoppedEarly = true;
      break;
    }
  }

  if (stoppedEarly) {
    console.log(`\nStopped early after ${results.length}/${picks.length} candidates.`);
  }

  printReport(
    results,
    totalPromptTokens,
    totalCompletionTokens,
    successfulCalls,
    parseFailures,
    timeouts,
    errorCount,
    totalWorkerDurationMs,
    totalWorkerCalls,
    model,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
