/**
 * Deterministic mock coordinators for Speculum replay.
 * No LLM calls. Apply weights + veto rules from training brief.
 *
 * Tuning pass: relaxed Nefas vetoes to quorum model, lowered thresholds.
 * Fas: 0.45 → 0.40. Nefas: 0.65 → 0.55. Nefas soft vetoes need 2+ to skip.
 */

import type { HistoricalCandidate } from "../db/trenchlens-bridge.js";
import type { WeightVector } from "../agents/sibyl/tuner.js";

// ── Types ──────────────────────────────────────────────────────────

export interface MockWorkerReading {
  worker: "haruspex" | "auspex" | "chronos";
  composite: number;
}

export interface MockVerdict {
  side: "fas" | "nefas";
  decision: "fire" | "skip";
  confidence: number;
  weightedScore: number;
  reasoning: string;
  speech: string;
}

// ── Default weights from training brief ────────────────────────────

export const DEFAULT_WEIGHTS: WeightVector = {
  haruspex: 0.20,
  auspex: 0.25,
  chronos: 0.55,
  updatedAt: new Date(),
  cycle: 0,
};

// ── Helpers ────────────────────────────────────────────────────────

function computeWeightedScore(
  readings: MockWorkerReading[],
  weights: WeightVector,
): number {
  let score = 0;
  for (const r of readings) {
    const w = weights[r.worker as keyof Pick<WeightVector, "haruspex" | "auspex" | "chronos">];
    score += r.composite * w;
  }
  return score;
}

// ── Fas — divine yes (default-fire bias, threshold 0.40) ───────────

export async function runFasMock(
  c: HistoricalCandidate,
  workerReadings: MockWorkerReading[],
  weights: WeightVector,
): Promise<MockVerdict> {
  const weighted = computeWeightedScore(workerReadings, weights);

  // Hard vetoes even Fas respects
  if (c.features.red_flags.some((f) => /active dumping/i.test(f))) {
    return {
      side: "fas",
      decision: "skip",
      confidence: 0.9,
      weightedScore: weighted,
      reasoning: "Active dumping detected. Even the divine yes must yield.",
      speech: "The dumping is plain. Even I cannot speak yes.",
    };
  }
  if (c.features.buys_5m === 0 && c.features.sells_5m === 0) {
    return {
      side: "fas",
      decision: "skip",
      confidence: 0.85,
      weightedScore: weighted,
      reasoning: "Zero transactions in the last 5 minutes. The hour is dead.",
      speech: "Zero transactions. The hour is dead.",
    };
  }

  // Default-fire bias: threshold 0.40
  const decision = weighted >= 0.40 ? "fire" : "skip";
  const confidence = decision === "fire"
    ? 0.5 + (weighted - 0.40) * 2
    : 0.5 + (0.40 - weighted) * 2;

  return {
    side: "fas",
    decision,
    confidence: Math.min(1, Math.max(0, confidence)),
    weightedScore: weighted,
    reasoning: decision === "fire"
      ? `Weighted score ${weighted.toFixed(2)} clears the threshold. The omens permit.`
      : `Weighted score ${weighted.toFixed(2)} below threshold. Even I cannot find the case.`,
    speech: decision === "fire"
      ? "Fas. The omens align. Fire."
      : "Even I cannot speak yes here. Skip.",
  };
}

// ── Nefas — divine no (default-skip bias, threshold 0.55) ──────────
// Quorum model: hard vetoes (any 1 = skip), soft vetoes (need 2+ to skip).

export async function runNefasMock(
  c: HistoricalCandidate,
  workerReadings: MockWorkerReading[],
  weights: WeightVector,
): Promise<MockVerdict> {
  const weighted = computeWeightedScore(workerReadings, weights);
  const f = c.features;

  // ── Hard vetoes (any 1 = instant skip) ──────────────────────────
  if (f.red_flags.some((fl) => /active dumping/i.test(fl))) {
    return {
      side: "nefas",
      decision: "skip",
      confidence: 0.95,
      weightedScore: weighted,
      reasoning: "Active dumping. No quorum needed.",
      speech: "Nefas. Active dumping. Skip.",
    };
  }
  if (f.buys_5m === 0 && f.sells_5m === 0) {
    return {
      side: "nefas",
      decision: "skip",
      confidence: 0.9,
      weightedScore: weighted,
      reasoning: "Zero transactions. The hour is dead.",
      speech: "Nefas. Zero transactions. Skip.",
    };
  }
  if (c.safety.isHoneypot === true) {
    return {
      side: "nefas",
      decision: "skip",
      confidence: 0.99,
      weightedScore: weighted,
      reasoning: "Honeypot confirmed. No quorum needed.",
      speech: "Nefas. Honeypot. Skip.",
    };
  }

  // ── Soft vetoes (need 2+ to trigger skip) ───────────────────────
  const softVetoes: string[] = [];
  if (f.red_flags.some((fl) => /Vol\/Liq/i.test(fl))) softVetoes.push("wash trading");
  const bs_5m = f.buys_5m / Math.max(1, f.sells_5m);
  if (bs_5m < 1.2 && f.sells_5m > 0) softVetoes.push("weak buy/sell ratio");
  if (f.liquidity_usd >= 15000 && f.liquidity_usd < 50000 && f.green_flags.length < 3) {
    softVetoes.push("rug-zone liquidity");
  }
  if (f.liquidity_usd < 5000 && f.market_cap < 10000) {
    softVetoes.push("micro liquidity + micro cap");
  }

  if (softVetoes.length >= 2) {
    return {
      side: "nefas",
      decision: "skip",
      confidence: 0.75 + softVetoes.length * 0.05,
      weightedScore: weighted,
      reasoning: `Quorum reached (${softVetoes.length} soft vetoes): ${softVetoes.join(", ")}.`,
      speech: `Nefas. ${softVetoes.join(", ")}. Skip.`,
    };
  }

  // ── Score-based decision (threshold 0.55) ───────────────────────
  const decision = weighted >= 0.55 ? "fire" : "skip";
  const confidence = decision === "fire"
    ? 0.5 + (weighted - 0.55) * 3
    : 0.5 + (0.55 - weighted) * 1.5;

  return {
    side: "nefas",
    decision,
    confidence: Math.min(1, Math.max(0, confidence)),
    weightedScore: weighted,
    reasoning: decision === "fire"
      ? `Weighted score ${weighted.toFixed(2)} overwhelms restraint.${softVetoes.length === 1 ? ` One soft veto (${softVetoes[0]}) noted but insufficient alone.` : ""}`
      : `Weighted score ${weighted.toFixed(2)} below threshold.${softVetoes.length === 1 ? ` Plus one soft veto: ${softVetoes[0]}.` : ""}`,
    speech: decision === "fire"
      ? "Nefas yields. The evidence overwhelms restraint. Fire."
      : "Nefas. The entrails are sour. Skip.",
  };
}
