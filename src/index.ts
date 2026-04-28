/**
 * Augury — entry point.
 * Bootstraps the swarm bus, registers all 8 agents, wires the pipeline.
 */

export { createSwarmBus } from "./swarm/bus.js";
export { Lituus } from "./agents/lituus/index.js";
export { runPipeline, checkConsensus } from "./coordinators/parallel-fanout.js";
export { Speculum } from "./speculum/index.js";
export { Sibyl } from "./sibyl/index.js";
export { TrenchLensBridge } from "./db/trenchlens-bridge.js";

export type {
  CandidateReading,
  WorkerReading,
  AdversarialVerdict,
  ConsensusResult,
  SwarmBus,
  SwarmEvents,
} from "./swarm/bus.js";

export type { WeightVector } from "./agents/sibyl/tuner.js";

// TODO: wire up elizaOS runtime initialization
// TODO: register characters from /characters/*.json
// TODO: start Lituus webhook listener
// TODO: connect TrenchLens DB bridge (read-only)
// TODO: wire consensus:result → Telegram delivery
