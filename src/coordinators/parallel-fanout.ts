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
import type { HistoricalCandidate } from "../db/trenchlens-bridge.js";
import {
  callHaikuWorker,
  type RealWorkerResult,
} from "../agents/real-haiku-worker.js";
import {
  callOpenRouterWorker,
  type OpenRouterWorkerResult,
  DEFAULT_MODEL as OPENROUTER_DEFAULT_MODEL,
} from "../agents/real-openrouter-worker.js";
import {
  callCoordinator,
  type CoordinatorResult,
  type WorkerReadings,
  DEFAULT_COORDINATOR_MODEL,
} from "../agents/real-openrouter-coordinator.js";
import {
  runFasMock,
  runNefasMock,
  DEFAULT_WEIGHTS,
  type MockWorkerReading,
  type MockVerdict,
} from "../agents/mock-coordinators.js";

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

// ── Real Haiku pipeline (Phase 1 smoke test) ──────────────────────
// Workers: real Haiku 4.5 API calls
// Fas/Nefas: MOCK (stay deterministic for Phase 1)

export interface RealHaikuPipelineResult {
  consensus: "fire" | "skip" | "split";
  finalDecision: "fire" | "skip";
  workers: {
    haruspex: RealWorkerResult;
    auspex: RealWorkerResult;
    chronos: RealWorkerResult;
  };
  fas: MockVerdict;
  nefas: MockVerdict;
  totalUsage: { input_tokens: number; output_tokens: number };
  totalDurationMs: number;
}

function fallbackWorkerResult(name: string): RealWorkerResult {
  return {
    score: 0,
    reasoning: `${name} promise rejected`,
    vetoes: ["promise_rejected"],
    usage: { input_tokens: 0, output_tokens: 0 },
    durationMs: 0,
    status: "error",
  };
}

export async function runPipelineRealHaiku(
  candidate: HistoricalCandidate,
  weights?: WeightVector,
): Promise<RealHaikuPipelineResult> {
  const w = weights ?? DEFAULT_WEIGHTS;
  const start = performance.now();

  // Phase 1: Real Haiku workers in parallel
  const [hSettled, aSettled, cSettled] = await Promise.allSettled([
    callHaikuWorker("haruspex", candidate),
    callHaikuWorker("auspex", candidate),
    callHaikuWorker("chronos", candidate),
  ]);

  const haruspex =
    hSettled.status === "fulfilled"
      ? hSettled.value
      : fallbackWorkerResult("haruspex");
  const auspex =
    aSettled.status === "fulfilled"
      ? aSettled.value
      : fallbackWorkerResult("auspex");
  const chronos =
    cSettled.status === "fulfilled"
      ? cSettled.value
      : fallbackWorkerResult("chronos");

  // Map real scores → MockWorkerReading for Fas/Nefas
  const workerReadings: MockWorkerReading[] = [
    { worker: "haruspex", composite: haruspex.score },
    { worker: "auspex", composite: auspex.score },
    { worker: "chronos", composite: chronos.score },
  ];

  // Phase 2: Mock Fas/Nefas (staying mock for Phase 1)
  const [fas, nefas] = await Promise.all([
    runFasMock(candidate, workerReadings, w),
    runNefasMock(candidate, workerReadings, w),
  ]);

  // Phase 3: Consensus — both must agree to fire
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
    finalDecision = "skip";
  }

  const totalUsage = {
    input_tokens:
      haruspex.usage.input_tokens +
      auspex.usage.input_tokens +
      chronos.usage.input_tokens,
    output_tokens:
      haruspex.usage.output_tokens +
      auspex.usage.output_tokens +
      chronos.usage.output_tokens,
  };

  return {
    consensus,
    finalDecision,
    workers: { haruspex, auspex, chronos },
    fas,
    nefas,
    totalUsage,
    totalDurationMs: Math.round(performance.now() - start),
  };
}

// ── OpenRouter pipeline (Phase 1 OpenRouter smoke test) ─────────────
// Workers: OpenRouter API calls (configurable model)
// Fas/Nefas: MOCK (stay deterministic for Phase 1)

export interface OpenRouterPipelineResult {
  consensus: "fire" | "skip" | "split";
  finalDecision: "fire" | "skip";
  model: string;
  workers: {
    haruspex: OpenRouterWorkerResult;
    auspex: OpenRouterWorkerResult;
    chronos: OpenRouterWorkerResult;
  };
  fas: MockVerdict;
  nefas: MockVerdict;
  totalUsage: { prompt_tokens: number; completion_tokens: number };
  totalDurationMs: number;
}

function fallbackOpenRouterResult(name: string): OpenRouterWorkerResult {
  return {
    score: 0,
    reasoning: `${name} promise rejected`,
    vetoes: ["promise_rejected"],
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    durationMs: 0,
    status: "error",
  };
}

export async function runPipelineOpenRouter(
  candidate: HistoricalCandidate,
  options?: { model?: string; weights?: WeightVector; timeoutMs?: number },
): Promise<OpenRouterPipelineResult> {
  const w = options?.weights ?? DEFAULT_WEIGHTS;
  const model = options?.model ?? OPENROUTER_DEFAULT_MODEL;
  const start = performance.now();

  // Phase 1: OpenRouter workers in parallel (paid tier — no rate limit concern)
  const [hSettled, aSettled, cSettled] = await Promise.allSettled([
    callOpenRouterWorker("haruspex", candidate, { model, timeoutMs: options?.timeoutMs }),
    callOpenRouterWorker("auspex", candidate, { model, timeoutMs: options?.timeoutMs }),
    callOpenRouterWorker("chronos", candidate, { model, timeoutMs: options?.timeoutMs }),
  ]);

  const haruspex =
    hSettled.status === "fulfilled"
      ? hSettled.value
      : fallbackOpenRouterResult("haruspex");
  const auspex =
    aSettled.status === "fulfilled"
      ? aSettled.value
      : fallbackOpenRouterResult("auspex");
  const chronos =
    cSettled.status === "fulfilled"
      ? cSettled.value
      : fallbackOpenRouterResult("chronos");

  // Map scores → MockWorkerReading for Fas/Nefas
  const workerReadings: MockWorkerReading[] = [
    { worker: "haruspex", composite: haruspex.score },
    { worker: "auspex", composite: auspex.score },
    { worker: "chronos", composite: chronos.score },
  ];

  // Phase 2: Mock Fas/Nefas (staying mock for Phase 1)
  const [fas, nefas] = await Promise.all([
    runFasMock(candidate, workerReadings, w),
    runNefasMock(candidate, workerReadings, w),
  ]);

  // Phase 3: Consensus — both must agree to fire
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
    finalDecision = "skip";
  }

  const totalUsage = {
    prompt_tokens:
      haruspex.usage.prompt_tokens +
      auspex.usage.prompt_tokens +
      chronos.usage.prompt_tokens,
    completion_tokens:
      haruspex.usage.completion_tokens +
      auspex.usage.completion_tokens +
      chronos.usage.completion_tokens,
  };

  return {
    consensus,
    finalDecision,
    model,
    workers: { haruspex, auspex, chronos },
    fas,
    nefas,
    totalUsage,
    totalDurationMs: Math.round(performance.now() - start),
  };
}

// ── Phase 2 OpenRouter pipeline (real Fas + real Nefas) ─────────────
// Workers: OpenRouter API calls (same as Phase 1)
// Fas/Nefas: REAL LLM coordinators with empirical priors

export interface Phase2PipelineResult {
  consensus: "fire" | "skip" | "split";
  finalDecision: "fire" | "skip";
  model: string;
  workers: {
    haruspex: OpenRouterWorkerResult;
    auspex: OpenRouterWorkerResult;
    chronos: OpenRouterWorkerResult;
  };
  fas: CoordinatorResult;
  nefas: CoordinatorResult;
  totalUsage: { prompt_tokens: number; completion_tokens: number };
  totalDurationMs: number;
}

export async function runPipelineOpenRouterPhase2(
  candidate: HistoricalCandidate,
  options?: { model?: string; coordinatorModel?: string; timeoutMs?: number },
): Promise<Phase2PipelineResult> {
  const model = options?.model ?? OPENROUTER_DEFAULT_MODEL;
  const coordinatorModel = options?.coordinatorModel ?? DEFAULT_COORDINATOR_MODEL;
  const start = performance.now();

  // Phase 1: OpenRouter workers in parallel
  const [hSettled, aSettled, cSettled] = await Promise.allSettled([
    callOpenRouterWorker("haruspex", candidate, { model, timeoutMs: options?.timeoutMs }),
    callOpenRouterWorker("auspex", candidate, { model, timeoutMs: options?.timeoutMs }),
    callOpenRouterWorker("chronos", candidate, { model, timeoutMs: options?.timeoutMs }),
  ]);

  const haruspex =
    hSettled.status === "fulfilled"
      ? hSettled.value
      : fallbackOpenRouterResult("haruspex");
  const auspex =
    aSettled.status === "fulfilled"
      ? aSettled.value
      : fallbackOpenRouterResult("auspex");
  const chronos =
    cSettled.status === "fulfilled"
      ? cSettled.value
      : fallbackOpenRouterResult("chronos");

  // Build worker readings for coordinators
  const workerReadings: WorkerReadings = {
    haruspex: { score: haruspex.score, reasoning: haruspex.reasoning, vetoes: haruspex.vetoes },
    auspex: { score: auspex.score, reasoning: auspex.reasoning, vetoes: auspex.vetoes },
    chronos: { score: chronos.score, reasoning: chronos.reasoning, vetoes: chronos.vetoes },
  };

  // Phase 2: Fas first, then Nefas sees Fas's argument
  const fas = await callCoordinator("fas", candidate, workerReadings, undefined, {
    model: coordinatorModel,
    timeoutMs: options?.timeoutMs,
  });

  const nefas = await callCoordinator("nefas", candidate, workerReadings, fas.argument, {
    model: coordinatorModel,
    timeoutMs: options?.timeoutMs,
  });

  // Phase 3: Consensus — both must agree to fire
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
    finalDecision = "skip";
  }

  const totalUsage = {
    prompt_tokens:
      haruspex.usage.prompt_tokens +
      auspex.usage.prompt_tokens +
      chronos.usage.prompt_tokens +
      fas.usage.prompt_tokens +
      nefas.usage.prompt_tokens,
    completion_tokens:
      haruspex.usage.completion_tokens +
      auspex.usage.completion_tokens +
      chronos.usage.completion_tokens +
      fas.usage.completion_tokens +
      nefas.usage.completion_tokens,
  };

  return {
    consensus,
    finalDecision,
    model,
    workers: { haruspex, auspex, chronos },
    fas,
    nefas,
    totalUsage,
    totalDurationMs: Math.round(performance.now() - start),
  };
}

export {
  WORKER_TIMEOUT_MS,
  ADVERSARIAL_TIMEOUT_MS,
  WORKERS,
  checkConsensus,
};
