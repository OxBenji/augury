/**
 * Sibyl — keeps the record.
 *
 * The learning loop. Watches outcomes and recalibrates the weights that
 * Fas and Nefas apply to Haruspex/Auspex/Chronos worker outputs.
 * Turns Augury from a static rules engine into an adaptive system.
 *
 * See /docs/TUNER_SPEC.md for full specification.
 *
 * Uses Haiku for log narration ONLY — weight math is deterministic.
 * READ-ONLY for first 30 days (cold-start period).
 */

import type { TrenchLensBridge } from "../db/trenchlens-bridge.js";

// ── Types ──────────────────────────────────────────────────────────

export interface WeightVector {
  haruspex: number;
  auspex: number;
  chronos: number;
  updatedAt: Date;
  cycle: number;
}

export interface RecalibrationResult {
  previousWeights: WeightVector;
  proposedWeights: WeightVector;
  deltas: { haruspex: number; auspex: number; chronos: number };
  evidence: string;
  approved: boolean; // false during cold-start (human review required)
}

export interface TripwireResult {
  curatedSetSize: number;
  misclassified: number;
  misclassificationRate: number;
  passed: boolean; // false if >5% → ROLLBACK
}

// ── Constants ──────────────────────────────────────────────────────

const MIN_WEIGHT = 0.05;           // floor per worker — prevents collapse
const MAX_DELTA_PER_CYCLE = 0.15;  // max 15% weight change per recalibration
const TRIPWIRE_THRESHOLD = 0.05;   // >5% misclass on curated set → rollback
const COLD_START_CYCLES = 4;       // first 4 weekly cycles need human approval

// ── Sibyl ──────────────────────────────────────────────────────────

export class Sibyl {
  constructor(private bridge: TrenchLensBridge) {}

  /**
   * Get current weight vector.
   */
  async getCurrentWeights(): Promise<WeightVector> {
    // TODO: implement — read from Augury DB
    // Default weights: equal (0.33 each)
    throw new Error("Sibyl.getCurrentWeights not implemented");
  }

  /**
   * Compute the composite optimization metric.
   * score = hit_rate * log(signal_volume + 1) * (1 - rug_rate)
   */
  computeScore(hitRate: number, signalVolume: number, rugRate: number): number {
    return hitRate * Math.log(signalVolume + 1) * (1 - rugRate);
  }

  /**
   * Propose new weights based on Speculum's outcome data.
   * Does NOT apply them — returns a proposal for review.
   * Weekly cadence. Max 15% delta per cycle.
   */
  async proposeRecalibration(
    _since: Date,
  ): Promise<RecalibrationResult> {
    // TODO: implement
    // 1. Pull scored outcomes from Speculum
    // 2. Compute per-worker accuracy contribution
    // 3. Optimize composite score: hit_rate * log(volume+1) * (1-rug_rate)
    // 4. Clamp deltas to MAX_DELTA_PER_CYCLE
    // 5. Enforce MIN_WEIGHT floor
    // 6. If cycle <= COLD_START_CYCLES, mark approved=false
    throw new Error("Sibyl.proposeRecalibration not implemented");
  }

  /**
   * Run tripwire check against held-out curated set.
   * If misclassification > 5%, ROLLBACK to previous weights.
   */
  async runTripwireCheck(
    _proposedWeights: WeightVector,
  ): Promise<TripwireResult> {
    // TODO: implement
    // 1. Load curated "obvious yes" and "obvious no" cases
    // 2. Simulate classifications with proposed weights
    // 3. Compute misclassification rate
    // 4. Return pass/fail
    throw new Error("Sibyl.runTripwireCheck not implemented");
  }

  /**
   * Apply approved weights to Augury DB.
   * Only callable after human approval during cold-start,
   * or after tripwire passes post-cold-start.
   */
  async applyWeights(
    _weights: WeightVector,
  ): Promise<void> {
    // TODO: implement — write to Augury DB + audit log
    throw new Error("Sibyl.applyWeights not implemented");
  }
}

export { MIN_WEIGHT, MAX_DELTA_PER_CYCLE, TRIPWIRE_THRESHOLD, COLD_START_CYCLES };
