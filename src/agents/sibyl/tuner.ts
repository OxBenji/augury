/**
 * Sibyl — deterministic weight tuner.
 *
 * This is the MATH side of Sibyl. No LLM calls here.
 * The LLM (Haiku) is only used for writing changelog narration
 * in the character file. This module does the actual optimization.
 *
 * See /docs/TUNER_SPEC.md for full specification.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface WeightVector {
  haruspex: number;
  auspex: number;
  chronos: number;
  updatedAt: Date;
  cycle: number;
}

export interface OutcomeRecord {
  readingId: string;
  mint: string;
  verdict: "fire" | "skip";
  workerScores: {
    haruspex: number;
    auspex: number;
    chronos: number;
  };
  outcome1h: number | null;  // pct change
  outcome6h: number | null;
  outcome24h: number | null;
  wasRug: boolean;
  wouldHavePassedOldFilter: boolean;
}

export interface RecalibrationProposal {
  previousWeights: WeightVector;
  proposedWeights: WeightVector;
  deltas: { haruspex: number; auspex: number; chronos: number };
  compositeScoreBefore: number;
  compositeScoreAfter: number;
  sampleSize: number;
}

// ── Constants ──────────────────────────────────────────────────────

export const MIN_WEIGHT = 0.05;
export const MAX_DELTA_PER_CYCLE = 0.15;
export const TRIPWIRE_THRESHOLD = 0.05;
export const COLD_START_CYCLES = 4;

// ── Composite score ────────────────────────────────────────────────
// score = hit_rate * log(signal_volume + 1) * (1 - rug_rate)

export function computeCompositeScore(
  hitRate: number,
  signalVolume: number,
  rugRate: number,
): number {
  return hitRate * Math.log(signalVolume + 1) * (1 - rugRate);
}

// ── Weight normalization ───────────────────────────────────────────

function normalizeWeights(w: { haruspex: number; auspex: number; chronos: number }): { haruspex: number; auspex: number; chronos: number } {
  // Enforce minimum floor
  const clamped = {
    haruspex: Math.max(w.haruspex, MIN_WEIGHT),
    auspex: Math.max(w.auspex, MIN_WEIGHT),
    chronos: Math.max(w.chronos, MIN_WEIGHT),
  };

  // Normalize to sum to 1.0
  const sum = clamped.haruspex + clamped.auspex + clamped.chronos;
  return {
    haruspex: clamped.haruspex / sum,
    auspex: clamped.auspex / sum,
    chronos: clamped.chronos / sum,
  };
}

// ── Delta clamping ─────────────────────────────────────────────────

function clampDeltas(
  current: { haruspex: number; auspex: number; chronos: number },
  proposed: { haruspex: number; auspex: number; chronos: number },
): { haruspex: number; auspex: number; chronos: number } {
  const clamp = (cur: number, prop: number) => {
    const delta = prop - cur;
    const maxDelta = cur * MAX_DELTA_PER_CYCLE;
    if (Math.abs(delta) <= maxDelta) return prop;
    return cur + Math.sign(delta) * maxDelta;
  };

  return {
    haruspex: clamp(current.haruspex, proposed.haruspex),
    auspex: clamp(current.auspex, proposed.auspex),
    chronos: clamp(current.chronos, proposed.chronos),
  };
}

// ── Recalibration ──────────────────────────────────────────────────

export function proposeRecalibration(
  currentWeights: WeightVector,
  _outcomes: OutcomeRecord[],
): RecalibrationProposal {
  // TODO: implement the actual optimization loop
  // 1. For each outcome, compute weighted score with current weights
  // 2. Compute hit rate, signal volume, rug rate with current weights
  // 3. Grid search or gradient-free optimization over weight space
  // 4. Find weights that maximize composite score
  // 5. Clamp deltas, normalize, enforce floors

  // Placeholder: return unchanged weights
  const proposed = clampDeltas(
    { haruspex: currentWeights.haruspex, auspex: currentWeights.auspex, chronos: currentWeights.chronos },
    { haruspex: currentWeights.haruspex, auspex: currentWeights.auspex, chronos: currentWeights.chronos },
  );

  const normalized = normalizeWeights(proposed);

  return {
    previousWeights: currentWeights,
    proposedWeights: {
      ...normalized,
      updatedAt: new Date(),
      cycle: currentWeights.cycle + 1,
    },
    deltas: {
      haruspex: normalized.haruspex - currentWeights.haruspex,
      auspex: normalized.auspex - currentWeights.auspex,
      chronos: normalized.chronos - currentWeights.chronos,
    },
    compositeScoreBefore: 0, // TODO: compute
    compositeScoreAfter: 0,  // TODO: compute
    sampleSize: _outcomes.length,
  };
}

// ── Tripwire check ─────────────────────────────────────────────────

export function runTripwire(
  _proposedWeights: WeightVector,
  _curatedSet: OutcomeRecord[],
): { passed: boolean; misclassificationRate: number } {
  // TODO: implement
  // 1. Simulate classifications on curated set with proposed weights
  // 2. Compute misclassification rate
  // 3. Return pass/fail against TRIPWIRE_THRESHOLD
  throw new Error("runTripwire not implemented");
}
