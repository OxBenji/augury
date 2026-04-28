/**
 * Augury — Parallel fan-out + adversarial consensus pipeline.
 *
 * Phase 1: Fan out candidate to 3 Haiku workers in PARALLEL (3s timeout)
 *          Haruspex (internals) + Auspex (chatter) + Chronos (flow)
 * Phase 2: Feed worker results into Fas + Nefas in PARALLEL (5s timeout)
 *          — runs AFTER worker fanout completes
 * Phase 3: Consensus check — both must agree to fire
 *
 * Degrades gracefully: partial worker results are fine, but if both
 * Fas and Nefas fail, the reading is dropped (not fired).
 */

import type {
  CandidateReading,
  WorkerReading,
  AdversarialVerdict,
  ConsensusResult,
  SwarmBus,
} from "../swarm/bus.js";
import type { WeightVector } from "../agents/sibyl/tuner.js";

// ── Configuration ──────────────────────────────────────────────────

const WORKER_TIMEOUT_MS = 3000;
const ADVERSARIAL_TIMEOUT_MS = 5000;

const WORKERS = ["haruspex", "auspex", "chronos"] as const;

// ── Worker stubs (replace with elizaOS runtime invocations) ────────

async function runHaruspex(
  _candidate: CandidateReading,
): Promise<Record<string, unknown>> {
  // TODO: invoke Haruspex character via elizaOS runtime
  // Input: dev wallet history, holder distribution, sniper count, LP status
  // Output: { dev_quality, holder_health, sniper_exposure, bundle_risk, early_concentration, composite, reading }
  throw new Error("Haruspex worker not implemented");
}

async function runAuspex(
  _candidate: CandidateReading,
): Promise<Record<string, unknown>> {
  // TODO: invoke Auspex character via elizaOS runtime
  // Input: X mentions, KOL pickups with hit rates, pump.fun velocity, sentiment
  // Output: { kol_quality, chatter_velocity, sentiment, viral_potential, composite, reading }
  throw new Error("Auspex worker not implemented");
}

async function runChronos(
  _candidate: CandidateReading,
): Promise<Record<string, unknown>> {
  // TODO: invoke Chronos character via elizaOS runtime
  // Input: orderbook depth, buy/sell ratio, volume curve, minutes since graduation
  // Output: { depth, imbalance, volume_shape, moment_quality, composite, reading }
  throw new Error("Chronos worker not implemented");
}

// ── Adversarial stubs ──────────────────────────────────────────────

async function runFas(
  _candidate: CandidateReading,
  _workerReadings: WorkerReading[],
  _weights: WeightVector,
): Promise<AdversarialVerdict> {
  // TODO: invoke Fas character via elizaOS runtime
  // Input: three worker readings + weight vector
  // Output: { decision, confidence, weighted_score, reasoning, speech }
  throw new Error("Fas not implemented");
}

async function runNefas(
  _candidate: CandidateReading,
  _workerReadings: WorkerReading[],
  _weights: WeightVector,
): Promise<AdversarialVerdict> {
  // TODO: invoke Nefas character via elizaOS runtime
  // Input: three worker readings + weight vector
  // Output: { decision, confidence, weighted_score, reasoning, speech }
  throw new Error("Nefas not implemented");
}

// ── Timeout wrapper ────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms`)),
      ms,
    );
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Phase 1: Worker fan-out ────────────────────────────────────────
// Haruspex + Auspex + Chronos run SIMULTANEOUSLY, 3s hard timeout each.

async function fanOutWorkers(
  candidate: CandidateReading,
): Promise<WorkerReading[]> {
  const workerFns: Record<
    (typeof WORKERS)[number],
    (c: CandidateReading) => Promise<Record<string, unknown>>
  > = {
    haruspex: runHaruspex,
    auspex: runAuspex,
    chronos: runChronos,
  };

  const settled = await Promise.allSettled(
    WORKERS.map(async (name): Promise<WorkerReading> => {
      const start = performance.now();
      try {
        const data = await withTimeout(workerFns[name](candidate), WORKER_TIMEOUT_MS);
        return {
          worker: name,
          candidateMint: candidate.mint,
          status: "fulfilled",
          data,
          durationMs: Math.round(performance.now() - start),
        };
      } catch (err) {
        const isTimeout = err instanceof Error && err.message.startsWith("timeout");
        return {
          worker: name,
          candidateMint: candidate.mint,
          status: isTimeout ? "timeout" : "rejected",
          data: null,
          durationMs: Math.round(performance.now() - start),
        };
      }
    }),
  );

  return settled.map((s) => {
    if (s.status === "fulfilled") return s.value;
    // Promise.allSettled with inner try/catch means rejections are already caught,
    // but handle defensively
    return {
      worker: "haruspex" as const,
      candidateMint: candidate.mint,
      status: "rejected" as const,
      data: null,
      durationMs: 0,
    };
  });
}

// ── Phase 2: Adversarial consensus ─────────────────────────────────
// Fas + Nefas see the SAME worker data, argue opposite sides.
// They run in PARALLEL against each other, AFTER workers complete.

async function runAdversarialConsensus(
  candidate: CandidateReading,
  workerReadings: WorkerReading[],
  weights: WeightVector,
): Promise<{ fas: AdversarialVerdict | null; nefas: AdversarialVerdict | null }> {
  const [fasSettled, nefasSettled] = await Promise.allSettled([
    withTimeout(runFas(candidate, workerReadings, weights), ADVERSARIAL_TIMEOUT_MS),
    withTimeout(runNefas(candidate, workerReadings, weights), ADVERSARIAL_TIMEOUT_MS),
  ]);

  return {
    fas: fasSettled.status === "fulfilled" ? fasSettled.value : null,
    nefas: nefasSettled.status === "fulfilled" ? nefasSettled.value : null,
  };
}

// ── Phase 3: Consensus check ───────────────────────────────────────
// A reading fires ONLY when both Fas and Nefas say "fire".
// If either is null (timed out / errored), default to skip.

function checkConsensus(
  fas: AdversarialVerdict | null,
  nefas: AdversarialVerdict | null,
): { consensus: "fire" | "skip" | "split"; finalDecision: "fire" | "skip" } {
  if (!fas || !nefas) {
    return { consensus: "split", finalDecision: "skip" };
  }

  if (fas.decision === "fire" && nefas.decision === "fire") {
    return { consensus: "fire", finalDecision: "fire" };
  }

  if (fas.decision === "skip" && nefas.decision === "skip") {
    return { consensus: "skip", finalDecision: "skip" };
  }

  // Fas and Nefas disagree — default to skip (caution wins)
  return { consensus: "split", finalDecision: "skip" };
}

// ── Full pipeline ──────────────────────────────────────────────────

export async function runPipeline(
  candidate: CandidateReading,
  weights: WeightVector,
  bus?: SwarmBus,
): Promise<ConsensusResult> {
  const start = performance.now();

  // Phase 1: parallel worker fan-out (3s timeout per worker)
  const workerReadings = await fanOutWorkers(candidate);

  // Emit worker readings to bus
  if (bus) {
    for (const reading of workerReadings) {
      bus.emit("worker:reading", reading);
    }
  }

  // Phase 2: adversarial consensus AFTER workers complete
  const adversarial = await runAdversarialConsensus(candidate, workerReadings, weights);

  // Emit adversarial verdicts to bus
  if (bus) {
    if (adversarial.fas) bus.emit("adversarial:verdict", adversarial.fas);
    if (adversarial.nefas) bus.emit("adversarial:verdict", adversarial.nefas);
  }

  // Phase 3: consensus check
  const { consensus, finalDecision } = checkConsensus(adversarial.fas, adversarial.nefas);

  const result: ConsensusResult = {
    candidateMint: candidate.mint,
    fas: adversarial.fas!,
    nefas: adversarial.nefas!,
    consensus,
    finalDecision,
    candidateReading: candidate,
    workerReadings,
    totalDurationMs: Math.round(performance.now() - start),
  };

  // Emit consensus to bus
  if (bus) {
    bus.emit("consensus:result", result);
  }

  return result;
}

export {
  WORKER_TIMEOUT_MS,
  ADVERSARIAL_TIMEOUT_MS,
  WORKERS,
  checkConsensus,
};
