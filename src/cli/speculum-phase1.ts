#!/usr/bin/env bun
/**
 * Phase 1 Speculum smoke test — real Haiku 4.5 workers.
 *
 * Runs 20 stratified historical candidates through the swarm pipeline
 * with REAL Haiku API calls for workers, MOCK Fas/Nefas coordinators.
 * Hard cap: $1.00 max spend. Circuit breaker at $0.80.
 */

import "dotenv/config";
import { TrenchLensBridge, type HistoricalCandidate } from "../db/trenchlens-bridge.js";
import {
  runPipelineRealHaiku,
  type RealHaikuPipelineResult,
} from "../coordinators/parallel-fanout.js";

// ── Cost constants (Haiku 4.5 pricing) ─────────────────────────────
const INPUT_COST_PER_M = 1.0;   // $1.00 / 1M input tokens
const OUTPUT_COST_PER_M = 5.0;  // $5.00 / 1M output tokens
const COST_CEILING = 0.80;      // stop loop at $0.80 to stay under $1.00

// ── Hard stop counters ─────────────────────────────────────────────
const MAX_CONSECUTIVE_PARSE_FAILURES = 5;
const MAX_CONSECUTIVE_TIMEOUTS = 5;

// ── Helpers ────────────────────────────────────────────────────────

function computeCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_M
  );
}

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

// ── Report printer ─────────────────────────────────────────────────

interface CandidateResult {
  candidate: HistoricalCandidate;
  pipeline: RealHaikuPipelineResult;
}

function printReport(
  results: CandidateResult[],
  totalInputTokens: number,
  totalOutputTokens: number,
  successfulCalls: number,
  parseFailures: number,
  timeouts: number,
  errors: number,
): void {
  const totalCost = computeCost(totalInputTokens, totalOutputTokens);
  const totalCalls = results.length * 3;

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

  const bar = "=".repeat(55);

  console.log(`\n${bar}`);
  console.log(`   PHASE 1 SMOKE TEST · ${results.length} CANDIDATES`);
  console.log(bar);
  console.log();
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(
    `Total tokens: ${totalInputTokens} input + ${totalOutputTokens} output`,
  );
  console.log(
    `Successful API calls: ${successfulCalls}/${totalCalls} (3 workers x ${results.length} candidates)`,
  );
  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Timeouts: ${timeouts}`);
  console.log(`Errors: ${errors}`);
  console.log();
  console.log(`Outcomes when swarm FIRED (${fired.length}):`);
  console.log(`  Hit: ${firedOutcomes.hit}`);
  console.log(`  Good: ${firedOutcomes.good}`);
  console.log(`  Loss: ${firedOutcomes.loss}`);
  console.log(`  Rug: ${firedOutcomes.rug}`);
  console.log(`  Neutral: ${firedOutcomes.neutral}`);
  console.log();
  console.log(`Outcomes when swarm SKIPPED (${skipped.length}):`);
  console.log(`  Hit (missed wins): ${skippedOutcomes.hit}`);
  console.log(`  Good (missed): ${skippedOutcomes.good}`);
  console.log(`  Loss (correct skip): ${skippedOutcomes.loss}`);
  console.log(`  Rug (correct skip): ${skippedOutcomes.rug}`);
  console.log(`  Neutral: ${skippedOutcomes.neutral}`);

  if (sampleFire) {
    console.log();
    console.log(
      `Sample reasoning from one FIRE (${sampleFire.candidate.symbol}):`,
    );
    console.log(
      `  Haruspex [${sampleFire.pipeline.workers.haruspex.score.toFixed(2)}]: "${sampleFire.pipeline.workers.haruspex.reasoning}"`,
    );
    console.log(
      `  Auspex   [${sampleFire.pipeline.workers.auspex.score.toFixed(2)}]: "${sampleFire.pipeline.workers.auspex.reasoning}"`,
    );
    console.log(
      `  Chronos  [${sampleFire.pipeline.workers.chronos.score.toFixed(2)}]: "${sampleFire.pipeline.workers.chronos.reasoning}"`,
    );
    console.log(`  Fas:   "${sampleFire.pipeline.fas.speech}"`);
    console.log(`  Nefas: "${sampleFire.pipeline.nefas.speech}"`);
  }

  if (sampleSkip) {
    console.log();
    console.log(
      `Sample reasoning from one SKIP (${sampleSkip.candidate.symbol}):`,
    );
    console.log(
      `  Haruspex [${sampleSkip.pipeline.workers.haruspex.score.toFixed(2)}]: "${sampleSkip.pipeline.workers.haruspex.reasoning}"`,
    );
    console.log(
      `  Auspex   [${sampleSkip.pipeline.workers.auspex.score.toFixed(2)}]: "${sampleSkip.pipeline.workers.auspex.reasoning}"`,
    );
    console.log(
      `  Chronos  [${sampleSkip.pipeline.workers.chronos.score.toFixed(2)}]: "${sampleSkip.pipeline.workers.chronos.reasoning}"`,
    );
    console.log(`  Fas:   "${sampleSkip.pipeline.fas.speech}"`);
    console.log(`  Nefas: "${sampleSkip.pipeline.nefas.speech}"`);
  }

  console.log();
  console.log(bar);
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Pre-flight: verify API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not loaded. STOP.");
    process.exit(1);
  }

  console.log("Phase 1 Speculum smoke test — real Haiku 4.5 workers");
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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let successfulCalls = 0;
  let parseFailures = 0;
  let timeouts = 0;
  let errorCount = 0;
  let consecutiveParseFailures = 0;
  let consecutiveTimeouts = 0;
  let stoppedEarly = false;

  const results: CandidateResult[] = [];

  for (let i = 0; i < picks.length; i++) {
    const c = picks[i];
    process.stdout.write(
      `[${(i + 1).toString().padStart(2)}/${picks.length}] ${c.symbol.padEnd(20)} `,
    );

    const pipeline = await runPipelineRealHaiku(c);
    results.push({ candidate: c, pipeline });

    // Track tokens
    totalInputTokens += pipeline.totalUsage.input_tokens;
    totalOutputTokens += pipeline.totalUsage.output_tokens;

    // Track statuses per worker
    for (const worker of [
      pipeline.workers.haruspex,
      pipeline.workers.auspex,
      pipeline.workers.chronos,
    ]) {
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

    const runningCost = computeCost(totalInputTokens, totalOutputTokens);
    console.log(
      `${pipeline.finalDecision.toUpperCase().padEnd(5)} ` +
        `h=${pipeline.workers.haruspex.score.toFixed(2)} ` +
        `a=${pipeline.workers.auspex.score.toFixed(2)} ` +
        `c=${pipeline.workers.chronos.score.toFixed(2)} ` +
        `[${pipeline.totalDurationMs}ms] ` +
        `$${runningCost.toFixed(4)}`,
    );

    // HARD STOPS
    if (consecutiveParseFailures > MAX_CONSECUTIVE_PARSE_FAILURES) {
      console.error(
        `\nHARD STOP: >${MAX_CONSECUTIVE_PARSE_FAILURES} consecutive parse failures. Prompt may be broken.`,
      );
      stoppedEarly = true;
      break;
    }
    if (consecutiveTimeouts > MAX_CONSECUTIVE_TIMEOUTS) {
      console.error(
        `\nHARD STOP: >${MAX_CONSECUTIVE_TIMEOUTS} consecutive timeouts. API issue.`,
      );
      stoppedEarly = true;
      break;
    }
    if (runningCost > COST_CEILING) {
      console.error(
        `\nHARD STOP: Running cost $${runningCost.toFixed(4)} exceeds $${COST_CEILING} ceiling.`,
      );
      stoppedEarly = true;
      break;
    }
  }

  if (stoppedEarly) {
    console.log(`\nStopped early after ${results.length}/${picks.length} candidates.`);
  }

  printReport(
    results,
    totalInputTokens,
    totalOutputTokens,
    successfulCalls,
    parseFailures,
    timeouts,
    errorCount,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
