#!/usr/bin/env bun
/**
 * Phase 2 OpenRouter smoke test — real Fas + real Nefas coordinators.
 *
 * Runs 20 stratified historical candidates through the full swarm pipeline
 * with REAL OpenRouter API calls for workers AND coordinators.
 * Hard cap: $0.50 cost ceiling.
 */

import "dotenv/config";
import { TrenchLensBridge, type HistoricalCandidate } from "../db/trenchlens-bridge.js";
import {
  runPipelineOpenRouterPhase2,
  type Phase2PipelineResult,
} from "../coordinators/parallel-fanout.js";
import { DEFAULT_MODEL } from "../agents/real-openrouter-worker.js";
import { DEFAULT_COORDINATOR_MODEL } from "../agents/real-openrouter-coordinator.js";

// ── Cost constants (GPT-4o-mini pricing via OpenRouter) ─────────────
const INPUT_COST_PER_M = 0.15;
const OUTPUT_COST_PER_M = 0.60;
const COST_CEILING = 0.50;

function computeCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1_000_000) * INPUT_COST_PER_M +
    (completionTokens / 1_000_000) * OUTPUT_COST_PER_M
  );
}

// ── Hard stop counters ──────────────────────────────────────────────
const MAX_CONSECUTIVE_PARSE_FAILURES = 5;
const MAX_CONSECUTIVE_TIMEOUTS = 5;

// ── CLI flags ───────────────────────────────────────────────────────
const VERBOSE = process.argv.includes("--verbose");

// ── Helpers ─────────────────────────────────────────────────────────

function pickStratified(
  candidates: HistoricalCandidate[],
): HistoricalCandidate[] {
  const buckets: Record<string, HistoricalCandidate[]> = {
    hit: [], good: [], loss: [], rug: [], neutral: [],
  };

  for (const c of candidates) {
    const cls = c.outcome.classification;
    if (cls in buckets) buckets[cls].push(c);
  }

  const picks: HistoricalCandidate[] = [];
  for (const outcome of ["hit", "good", "loss", "rug", "neutral"] as const) {
    const bucket = buckets[outcome];
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
  pipeline: Phase2PipelineResult;
}

function printReport(
  results: CandidateResult[],
  totalPromptTokens: number,
  totalCompletionTokens: number,
  successfulWorkerCalls: number,
  successfulCoordCalls: number,
  parseFailures: number,
  timeouts: number,
  errors: number,
  totalDurationMs: number,
  totalCalls: number,
  model: string,
  coordModel: string,
): void {
  const totalCost = computeCost(totalPromptTokens, totalCompletionTokens);

  const fired = results.filter((r) => r.pipeline.finalDecision === "fire");
  const skipped = results.filter((r) => r.pipeline.finalDecision === "skip");
  const splits = results.filter((r) => r.pipeline.consensus === "split");

  const countByOutcome = (arr: CandidateResult[]): Record<string, number> => {
    const counts: Record<string, number> = { hit: 0, good: 0, loss: 0, rug: 0, neutral: 0 };
    for (const r of arr) {
      const cls = r.candidate.outcome.classification;
      if (cls in counts) counts[cls]++;
    }
    return counts;
  };

  const firedOutcomes = countByOutcome(fired);
  const skippedOutcomes = countByOutcome(skipped);

  const sampleFire = fired[0] ?? null;
  const sampleSkip = skipped[0] ?? null;
  const sampleSplit = splits[0] ?? null;

  const avgLatency = totalCalls > 0 ? Math.round(totalDurationMs / totalCalls) : 0;

  const bar = "═".repeat(55);

  console.log(`\n${bar}`);
  console.log(`   PHASE 2 OPENROUTER · ${results.length} CANDIDATES`);
  console.log(`   Workers: ${model}`);
  console.log(`   Coordinators: ${coordModel}`);
  console.log(bar);
  console.log();
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Total tokens: in=${totalPromptTokens}, out=${totalCompletionTokens}`);
  console.log(`Successful worker calls: ${successfulWorkerCalls}/${results.length * 3}`);
  console.log(`Successful coordinator calls: ${successfulCoordCalls}/${results.length * 2}`);
  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Timeouts: ${timeouts}`);
  console.log(`Splits (fas/nefas disagreed): ${splits.length}`);
  console.log(`Average latency per call: ${avgLatency}ms`);
  console.log();
  console.log(`Outcomes when swarm fired (${fired.length}):`);
  console.log(`  Hit: ${firedOutcomes.hit}, Good: ${firedOutcomes.good}, Loss: ${firedOutcomes.loss}, Rug: ${firedOutcomes.rug}, Neutral: ${firedOutcomes.neutral}`);
  console.log();
  console.log(`Outcomes when swarm skipped (${skipped.length}):`);
  console.log(`  Hit (missed): ${skippedOutcomes.hit}, Good (missed): ${skippedOutcomes.good}, Loss (correct): ${skippedOutcomes.loss}, Rug (correct): ${skippedOutcomes.rug}`);

  if (sampleFire) {
    const p = sampleFire.pipeline;
    console.log();
    console.log(`Sample FIRE (${sampleFire.candidate.symbol}):`);
    console.log(`  Haruspex: ${p.workers.haruspex.score.toFixed(2)} — "${p.workers.haruspex.reasoning}"`);
    console.log(`  Auspex:   ${p.workers.auspex.score.toFixed(2)} — "${p.workers.auspex.reasoning}"`);
    console.log(`  Chronos:  ${p.workers.chronos.score.toFixed(2)} — "${p.workers.chronos.reasoning}"`);
    console.log(`  Fas:      ${p.fas.decision} — "${p.fas.argument}"`);
    console.log(`  Nefas:    ${p.nefas.decision} — "${p.nefas.argument}"`);
  }

  if (sampleSkip) {
    const p = sampleSkip.pipeline;
    console.log();
    console.log(`Sample SKIP (${sampleSkip.candidate.symbol}):`);
    console.log(`  Haruspex: ${p.workers.haruspex.score.toFixed(2)} — "${p.workers.haruspex.reasoning}"`);
    console.log(`  Auspex:   ${p.workers.auspex.score.toFixed(2)} — "${p.workers.auspex.reasoning}"`);
    console.log(`  Chronos:  ${p.workers.chronos.score.toFixed(2)} — "${p.workers.chronos.reasoning}"`);
    console.log(`  Fas:      ${p.fas.decision} — "${p.fas.argument}"`);
    console.log(`  Nefas:    ${p.nefas.decision} — "${p.nefas.argument}"`);
  }

  if (sampleSplit) {
    const p = sampleSplit.pipeline;
    console.log();
    console.log(`Sample SPLIT (${sampleSplit.candidate.symbol}) — fas/nefas disagreed:`);
    console.log(`  Haruspex: ${p.workers.haruspex.score.toFixed(2)} — "${p.workers.haruspex.reasoning}"`);
    console.log(`  Auspex:   ${p.workers.auspex.score.toFixed(2)} — "${p.workers.auspex.reasoning}"`);
    console.log(`  Chronos:  ${p.workers.chronos.score.toFixed(2)} — "${p.workers.chronos.reasoning}"`);
    console.log(`  Fas:      ${p.fas.decision} — "${p.fas.argument}"`);
    console.log(`  Nefas:    ${p.nefas.decision} — "${p.nefas.argument}"`);
  }

  console.log();
  console.log(bar);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not loaded. STOP.");
    process.exit(1);
  }

  const model = DEFAULT_MODEL;
  const coordModel = DEFAULT_COORDINATOR_MODEL;

  console.log("Phase 2 OpenRouter smoke test — real Fas + real Nefas");
  console.log(`Workers: ${model}`);
  console.log(`Coordinators: ${coordModel}`);
  console.log("=====================================================\n");

  const bridge = new TrenchLensBridge();
  await bridge.loadSnapshot();

  const allCandidates = await bridge.getHistoricalCandidates({});
  console.log(`Loaded ${allCandidates.length} historical candidates`);

  const picks = pickStratified(allCandidates);
  console.log(`Selected ${picks.length} stratified candidates`);
  console.log(
    `  Breakdown: ${["hit", "good", "loss", "rug", "neutral"]
      .map((o) => `${o}=${picks.filter((p) => p.outcome.classification === o).length}`)
      .join(", ")}`,
  );
  console.log();

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let successfulWorkerCalls = 0;
  let successfulCoordCalls = 0;
  let parseFailures = 0;
  let timeouts = 0;
  let errorCount = 0;
  let consecutiveParseFailures = 0;
  let consecutiveTimeouts = 0;
  let totalCallDurationMs = 0;
  let totalCallCount = 0;
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

    const pipeline = await runPipelineOpenRouterPhase2(c, { model, coordinatorModel: coordModel });
    results.push({ candidate: c, pipeline });

    totalPromptTokens += pipeline.totalUsage.prompt_tokens;
    totalCompletionTokens += pipeline.totalUsage.completion_tokens;

    // Track worker statuses
    for (const worker of [pipeline.workers.haruspex, pipeline.workers.auspex, pipeline.workers.chronos]) {
      totalCallCount++;
      totalCallDurationMs += worker.durationMs;
      if (worker.status === "success") { successfulWorkerCalls++; consecutiveParseFailures = 0; consecutiveTimeouts = 0; }
      else if (worker.status === "parse_failure") { parseFailures++; consecutiveParseFailures++; consecutiveTimeouts = 0; }
      else if (worker.status === "timeout") { timeouts++; consecutiveTimeouts++; consecutiveParseFailures = 0; }
      else { errorCount++; consecutiveParseFailures = 0; consecutiveTimeouts = 0; }
    }

    // Track coordinator statuses
    for (const coord of [pipeline.fas, pipeline.nefas]) {
      totalCallCount++;
      totalCallDurationMs += coord.durationMs;
      if (coord.status === "success") { successfulCoordCalls++; consecutiveParseFailures = 0; consecutiveTimeouts = 0; }
      else if (coord.status === "parse_failure") { parseFailures++; consecutiveParseFailures++; consecutiveTimeouts = 0; }
      else if (coord.status === "timeout") { timeouts++; consecutiveTimeouts++; consecutiveParseFailures = 0; }
      else { errorCount++; consecutiveParseFailures = 0; consecutiveTimeouts = 0; }
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
      console.log(`  Fas:      ${pipeline.fas.decision} — "${pipeline.fas.argument}"`);
      console.log(`  Nefas:    ${pipeline.nefas.decision} — "${pipeline.nefas.argument}"`);
      console.log();
      console.log(`  Decision: ${decision}  (consensus: ${pipeline.consensus})`);
      console.log(`  Outcome:  ${outcome}  <- ${correct}`);
      console.log(`  Cost:     $${runningCost.toFixed(4)}`);
      console.log();
    } else {
      console.log(
        `${pipeline.finalDecision.toUpperCase().padEnd(5)} ` +
          `[${pipeline.consensus}] ` +
          `h=${pipeline.workers.haruspex.score.toFixed(2)} ` +
          `a=${pipeline.workers.auspex.score.toFixed(2)} ` +
          `c=${pipeline.workers.chronos.score.toFixed(2)} ` +
          `fas=${pipeline.fas.decision} nef=${pipeline.nefas.decision} ` +
          `[${pipeline.totalDurationMs}ms] ` +
          `$${runningCost.toFixed(4)}`,
      );
    }

    // HARD STOPS
    if (runningCost > COST_CEILING) {
      console.error(`\nHARD STOP: Cost $${runningCost.toFixed(4)} exceeds $${COST_CEILING} ceiling.`);
      stoppedEarly = true;
      break;
    }
    if (consecutiveParseFailures >= MAX_CONSECUTIVE_PARSE_FAILURES) {
      console.error(`\nHARD STOP: ${MAX_CONSECUTIVE_PARSE_FAILURES}+ consecutive parse failures.`);
      stoppedEarly = true;
      break;
    }
    if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
      console.error(`\nHARD STOP: ${MAX_CONSECUTIVE_TIMEOUTS}+ consecutive timeouts.`);
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
    successfulWorkerCalls,
    successfulCoordCalls,
    parseFailures,
    timeouts,
    errorCount,
    totalCallDurationMs,
    totalCallCount,
    model,
    coordModel,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
