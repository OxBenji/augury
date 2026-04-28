/**
 * Speculum — reflects the past.
 *
 * Historical backtester and disagreement surface. Not in the hot path —
 * runs on a schedule to score past Augury readings against actual price
 * outcomes from the TrenchLens DB. Primary validation mechanism before
 * cutover. Feeds disagreement data to Sibyl for cold-start training.
 *
 * ⚠️  ALL TRENCHLENS DB ACCESS IS READ-ONLY ⚠️
 */

import type { TrenchLensBridge } from "../db/trenchlens-bridge.js";

// ── Types ──────────────────────────────────────────────────────────

export type ReflectionWindow = "1h" | "6h" | "24h";

export interface AuguryReading {
  id: string;
  mint: string;
  readAt: Date;
  verdict: "STRONG" | "MODERATE" | "WEAK" | "SCAM";
  confidence: number;
  fasThesis: string;
  nefasThesis: string;
  coordinatorReasoning: string;
  workerResults: Record<string, unknown>;
}

export interface ReflectionScore {
  readingId: string;
  mint: string;
  window: ReflectionWindow;
  priceAtReading: number;
  priceAtReflection: number;
  pctChange: number;
  verdictCorrect: boolean;
  reflectedAt: Date;
}

export interface ReflectionReport {
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalReadings: number;
  byVerdict: Record<string, VerdictStats>;
  byWindow: Record<ReflectionWindow, WindowStats>;
  baselineComparison: BaselineComparison;
  disagreementSurface: DisagreementEntry[];
  regimeFlags: string[];
}

interface VerdictStats {
  count: number;
  correctCount: number;
  accuracy: number;
  avgConfidence: number;
}

interface WindowStats {
  scored: number;
  correct: number;
  accuracy: number;
}

interface BaselineComparison {
  auguryAccuracy: number;
  trenchlensBaseline: number; // ~39%
  delta: number;
  significanceNote: string;
}

interface DisagreementEntry {
  readingId: string;
  fasConfidence: number;
  nefasConfidence: number;
  outcome: "fas-correct" | "nefas-correct" | "both-wrong";
  lesson: string;
}

// ── Speculum ───────────────────────────────────────────────────────

export class Speculum {
  constructor(private bridge: TrenchLensBridge) {}

  /**
   * Score a single past reading at a given window.
   * Returns null if price data isn't available yet.
   */
  async scoreReading(
    _reading: AuguryReading,
    _window: ReflectionWindow,
  ): Promise<ReflectionScore | null> {
    // TODO: implement
    // 1. Read price at reading time from TrenchLens DB (read-only)
    // 2. Read price at reading time + window offset
    // 3. Compute pct change
    // 4. Evaluate if verdict was correct given the outcome
    // 5. Return ReflectionScore
    throw new Error("Speculum.scoreReading not implemented");
  }

  /**
   * Batch score all readings due for evaluation.
   * Called on a schedule (e.g., every 10 minutes).
   */
  async scorePendingBatch(): Promise<ReflectionScore[]> {
    // TODO: implement
    // 1. Query Augury DB for unscored readings per window
    // 2. Filter to those where enough time has elapsed
    // 3. Score each via scoreReading()
    // 4. Write scores to Augury DB
    // 5. Return completed scores
    throw new Error("Speculum.scorePendingBatch not implemented");
  }

  /**
   * Generate a full reflection report comparing Augury vs TrenchLens baseline.
   * This is the primary validation gate before cutover.
   */
  async generateReport(
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<ReflectionReport> {
    // TODO: implement
    // 1. Pull all scored readings in the period
    // 2. Compute per-verdict and per-window accuracy
    // 3. Compare against TrenchLens baseline (~39%)
    // 4. Build disagreement surface (Fas vs Nefas outcomes)
    // 5. Detect regime changes (accuracy drift over time)
    // 6. Flag systematic biases
    throw new Error("Speculum.generateReport not implemented");
  }

  /**
   * Identify which worker/verdict combinations are underperforming.
   * Feeds into Sibyl's weight recalibration.
   */
  async identifyWeakSpots(
    _since: Date,
  ): Promise<Array<{ area: string; accuracy: number; sampleSize: number; note: string }>> {
    // TODO: implement
    // Slice accuracy by worker contribution patterns and verdict types
    throw new Error("Speculum.identifyWeakSpots not implemented");
  }
}
