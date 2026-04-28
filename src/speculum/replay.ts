/**
 * Speculum replay engine.
 *
 * Runs historical candidates through the mock swarm pipeline,
 * compares swarm decisions against actual market outcomes.
 * The old bot's decisions are reference context only — the swarm
 * is judged on its own merits against ground truth.
 */

import { TrenchLensBridge, type HistoricalCandidate } from "../db/trenchlens-bridge.js";
import { runHaruspexMock, runAuspexMock, runChronosMock } from "../agents/mock-workers.js";
import {
  runFasMock, runNefasMock, DEFAULT_WEIGHTS,
  type MockWorkerReading, type MockVerdict,
} from "../agents/mock-coordinators.js";
import type { WeightVector } from "../agents/sibyl/tuner.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ReplayResult {
  candidateMint: string;
  candidateSymbol: string;
  swarmDecision: "fire" | "skip";
  swarmConsensus: "fire" | "skip" | "split";
  outcomeClass: "hit" | "good" | "neutral" | "loss" | "rug" | "unknown";
  peak_return_pct: number | null;
  return_6h_pct: number | null;
  category:
    | "swarm_caught_winner"
    | "swarm_filtered_rug"
    | "swarm_filtered_loss"
    | "swarm_fired_into_rug"
    | "swarm_fired_into_loss"
    | "swarm_skipped_winner"
    | "swarm_neutral_call"
    | "no_outcome_data";
  oldBotAction: "SEND" | "CAUTION" | "SKIP";
  workerScores: { haruspex: number; auspex: number; chronos: number };
  fasSpeech: string;
  nefasSpeech: string;
  reading: string;
}

export interface ReplayReport {
  generatedAt: string;
  snapshotPeriod: { start: string; end: string };
  candidatesProcessed: number;
  swarmFireCount: number;
  swarmSkipCount: number;
  swarmFireWinRate: number;
  swarmFireRugRate: number;
  swarmFireLossRate: number;
  swarmSkipPrecision: number;
  swarmSkipRegret: number;
  adversarialDisagreementRate: number;
  adversarialAgreementRate: number;
  categoryBreakdown: Record<string, number>;
  topWinners: ReplayResult[];
  topAvoidedRugs: ReplayResult[];
  topMistakes: ReplayResult[];
  topRegrets: ReplayResult[];
  fullResults: ReplayResult[];
}

// ── Categorization ─────────────────────────────────────────────────

function categorize(
  swarmDecision: "fire" | "skip",
  outcomeClass: string,
): ReplayResult["category"] {
  if (outcomeClass === "unknown") return "no_outcome_data";
  if (outcomeClass === "neutral") return "swarm_neutral_call";

  if (swarmDecision === "fire") {
    if (outcomeClass === "hit" || outcomeClass === "good") return "swarm_caught_winner";
    if (outcomeClass === "rug") return "swarm_fired_into_rug";
    return "swarm_fired_into_loss"; // loss
  } else {
    if (outcomeClass === "hit" || outcomeClass === "good") return "swarm_skipped_winner";
    if (outcomeClass === "rug") return "swarm_filtered_rug";
    return "swarm_filtered_loss"; // loss
  }
}

function oracleReading(category: ReplayResult["category"]): string {
  switch (category) {
    case "swarm_caught_winner": return "The flock saw clearly. The fire was true.";
    case "swarm_filtered_rug": return "The flock walked past poison. Correct.";
    case "swarm_filtered_loss": return "The flock refused a sinking ship.";
    case "swarm_fired_into_rug": return "The flock fired into ruin. A wound to learn from.";
    case "swarm_fired_into_loss": return "The flock fired into decline.";
    case "swarm_skipped_winner": return "The flock walked past gold. A regret.";
    case "swarm_neutral_call": return "Neither profit nor poison. The flat hour.";
    case "no_outcome_data": return "The mirror shows nothing. Outcome unknown.";
  }
}

// ── Process one candidate ──────────────────────────────────────────

async function processCandidate(
  c: HistoricalCandidate,
  weights: WeightVector,
): Promise<{ result: ReplayResult; disagreed: boolean }> {
  // Run workers in parallel
  const [haruspex, auspex, chronos] = await Promise.all([
    runHaruspexMock(c),
    runAuspexMock(c),
    runChronosMock(c),
  ]);

  const workerReadings: MockWorkerReading[] = [
    { worker: "haruspex", composite: haruspex.composite },
    { worker: "auspex", composite: auspex.composite },
    { worker: "chronos", composite: chronos.composite },
  ];

  // Run Fas + Nefas in parallel
  const [fas, nefas] = await Promise.all([
    runFasMock(c, workerReadings, weights),
    runNefasMock(c, workerReadings, weights),
  ]);

  // Consensus: both must agree to fire
  const disagreed = fas.decision !== nefas.decision;
  let consensus: "fire" | "skip" | "split";
  let finalDecision: "fire" | "skip";

  if (fas.decision === "fire" && nefas.decision === "fire") {
    consensus = "fire";
    finalDecision = "fire";
  } else if (fas.decision === "skip" && nefas.decision === "skip") {
    consensus = "skip";
    finalDecision = "skip";
  } else {
    consensus = "split";
    finalDecision = "skip"; // caution wins on split
  }

  const category = categorize(finalDecision, c.outcome.classification);

  return {
    result: {
      candidateMint: c.mint,
      candidateSymbol: c.symbol,
      swarmDecision: finalDecision,
      swarmConsensus: consensus,
      outcomeClass: c.outcome.classification,
      peak_return_pct: c.outcome.peak_return_pct,
      return_6h_pct: c.outcome.return_6h_pct,
      category,
      oldBotAction: c.oldBot.aiAction,
      workerScores: {
        haruspex: haruspex.composite,
        auspex: auspex.composite,
        chronos: chronos.composite,
      },
      fasSpeech: fas.speech,
      nefasSpeech: nefas.speech,
      reading: oracleReading(category),
    },
    disagreed,
  };
}

// ── Main replay function ───────────────────────────────────────────

export async function runReplay(opts: {
  limit?: number;
  bridge: TrenchLensBridge;
  weights?: WeightVector;
  onProgress?: (done: number, total: number) => void;
}): Promise<ReplayReport> {
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const candidates = await opts.bridge.getHistoricalCandidates({
    limit: opts.limit,
  });

  const results: ReplayResult[] = [];
  let disagreements = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { result, disagreed } = await processCandidate(candidates[i], weights);
    results.push(result);
    if (disagreed) disagreements++;

    if (opts.onProgress && (i + 1) % 100 === 0) {
      opts.onProgress(i + 1, candidates.length);
    }
  }

  // ── Compute metrics ────────────────────────────────────────────

  const fires = results.filter((r) => r.swarmDecision === "fire");
  const skips = results.filter((r) => r.swarmDecision === "skip");

  // Fire metrics (exclude no_outcome_data)
  const firesWithOutcome = fires.filter((r) => r.category !== "no_outcome_data");
  const fireWins = firesWithOutcome.filter((r) => r.category === "swarm_caught_winner").length;
  const fireRugs = firesWithOutcome.filter((r) => r.category === "swarm_fired_into_rug").length;
  const fireLosses = firesWithOutcome.filter((r) => r.category === "swarm_fired_into_loss").length;

  // Skip metrics (exclude no_outcome_data and neutral)
  const skipsWithOutcome = skips.filter(
    (r) => r.category !== "no_outcome_data" && r.category !== "swarm_neutral_call",
  );
  const skipCorrect = skipsWithOutcome.filter(
    (r) => r.category === "swarm_filtered_rug" || r.category === "swarm_filtered_loss",
  ).length;
  const skipRegret = skipsWithOutcome.filter(
    (r) => r.category === "swarm_skipped_winner",
  ).length;

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const r of results) {
    categoryBreakdown[r.category] = (categoryBreakdown[r.category] ?? 0) + 1;
  }

  // Snapshot period
  const dates = candidates
    .map((c) => c.alertedAt.getTime())
    .filter((t) => t > 0);
  const start = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : "unknown";
  const end = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : "unknown";

  // Top lists
  const topWinners = fires
    .filter((r) => r.category === "swarm_caught_winner")
    .sort((a, b) => (b.peak_return_pct ?? 0) - (a.peak_return_pct ?? 0))
    .slice(0, 10);

  const topAvoidedRugs = skips
    .filter((r) => r.category === "swarm_filtered_rug")
    .sort((a, b) => (a.return_6h_pct ?? 0) - (b.return_6h_pct ?? 0))
    .slice(0, 10);

  const topMistakes = fires
    .filter((r) => r.category === "swarm_fired_into_rug")
    .sort((a, b) => (a.return_6h_pct ?? 0) - (b.return_6h_pct ?? 0))
    .slice(0, 10);

  const topRegrets = skips
    .filter((r) => r.category === "swarm_skipped_winner")
    .sort((a, b) => (b.peak_return_pct ?? 0) - (a.peak_return_pct ?? 0))
    .slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    snapshotPeriod: { start, end },
    candidatesProcessed: results.length,
    swarmFireCount: fires.length,
    swarmSkipCount: skips.length,
    swarmFireWinRate: firesWithOutcome.length > 0 ? fireWins / firesWithOutcome.length : 0,
    swarmFireRugRate: firesWithOutcome.length > 0 ? fireRugs / firesWithOutcome.length : 0,
    swarmFireLossRate: firesWithOutcome.length > 0 ? fireLosses / firesWithOutcome.length : 0,
    swarmSkipPrecision: skipsWithOutcome.length > 0 ? skipCorrect / skipsWithOutcome.length : 0,
    swarmSkipRegret: skipsWithOutcome.length > 0 ? skipRegret / skipsWithOutcome.length : 0,
    adversarialDisagreementRate: results.length > 0 ? disagreements / results.length : 0,
    adversarialAgreementRate: results.length > 0 ? 1 - disagreements / results.length : 0,
    categoryBreakdown,
    topWinners,
    topAvoidedRugs,
    topMistakes,
    topRegrets,
    fullResults: results,
  };
}
