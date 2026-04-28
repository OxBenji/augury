/**
 * Outcome scoring types and thresholds.
 *
 * Shared by Speculum (backtester) and Sibyl (tuner).
 * Defines what "correct" means for each verdict at each time window.
 */

// ── Types ──────────────────────────────────────────────────────────

export type EvalWindow = "1h" | "6h" | "24h";

export interface Reading {
  id: string;
  mint: string;
  readAt: Date;
  verdict: "STRONG" | "MODERATE" | "WEAK" | "SCAM";
  confidence: number;
  coordinatorReasoning: string;
  workerResults: Record<string, unknown>;
}

export interface OutcomeScore {
  readingId: string;
  mint: string;
  window: EvalWindow;
  priceAtReading: number;
  priceAtEval: number;
  pctChange: number;
  hitThreshold: boolean;
  evaluatedAt: Date;
}

// ── Thresholds for "correct" call per verdict ──────────────────────

const OUTCOME_THRESHOLDS: Record<string, Record<EvalWindow, number>> = {
  STRONG: { "1h": 0.1, "6h": 0.25, "24h": 0.5 },   // expected +10/25/50%
  MODERATE: { "1h": 0.03, "6h": 0.1, "24h": 0.2 },
  WEAK: { "1h": -0.05, "6h": -0.1, "24h": -0.2 },   // expected flat/down
  SCAM: { "1h": -0.3, "6h": -0.5, "24h": -0.8 },    // expected rug
};

export { OUTCOME_THRESHOLDS };
