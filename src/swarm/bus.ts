/**
 * Augury swarm event bus.
 *
 * Central nervous system of the flock. Routes events between agents:
 *   Lituus → [Haruspex, Auspex, Chronos] → [Fas, Nefas] → Consensus → Delivery
 *   Async: Speculum (backtest), Sibyl (tuner)
 *
 * Uses typed EventEmitter. No external dependencies.
 */

import { EventEmitter } from "node:events";

// ── Event payloads ─────────────────────────────────────────────────

export interface CandidateReading {
  mint: string;
  name: string;
  symbol: string;
  poolAddress: string;
  liquiditySol: number;
  devWallet: string;
  holderCount: number;
  detectedAt: Date;
  minutesSinceGraduation: number;
  wouldHavePassedOldFilter: boolean;
  metadata: Record<string, unknown>;
}

export interface WorkerReading {
  worker: "haruspex" | "auspex" | "chronos";
  candidateMint: string;
  status: "fulfilled" | "rejected" | "timeout";
  data: Record<string, unknown> | null;
  durationMs: number;
}

export interface AdversarialVerdict {
  side: "fas" | "nefas";
  candidateMint: string;
  decision: "fire" | "skip";
  confidence: number;
  weightedScore: number;
  reasoning: string;
  speech: string;
  durationMs: number;
}

export interface ConsensusResult {
  candidateMint: string;
  fas: AdversarialVerdict;
  nefas: AdversarialVerdict;
  consensus: "fire" | "skip" | "split";
  finalDecision: "fire" | "skip";
  candidateReading: CandidateReading;
  workerReadings: WorkerReading[];
  totalDurationMs: number;
}

export interface DeliveryPayload {
  candidateMint: string;
  consensus: ConsensusResult;
  telegramMessage: string;
  deliveredAt: Date;
}

// ── Event map ──────────────────────────────────────────────────────

export interface SwarmEvents {
  /** Lituus emits when a candidate passes pre-filter */
  "candidate:reading": [CandidateReading];
  /** Workers emit their individual readings */
  "worker:reading": [WorkerReading];
  /** Fas/Nefas emit their verdicts */
  "adversarial:verdict": [AdversarialVerdict];
  /** Coordinator emits after consensus check */
  "consensus:result": [ConsensusResult];
  /** Delivery agent emits after Telegram send */
  "delivery:sent": [DeliveryPayload];
  /** Speculum emits backtest results */
  "speculum:reflection": [Record<string, unknown>];
  /** Sibyl emits weight updates */
  "sibyl:recalibration": [Record<string, unknown>];
  /** General error events */
  "swarm:error": [{ agent: string; error: Error; candidateMint?: string }];
}

// ── Typed bus ──────────────────────────────────────────────────────

export class SwarmBus extends EventEmitter {
  private agentRegistry = new Map<string, AgentRegistration>();

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  // ── Typed emit/on wrappers ─────────────────────────────────────

  override emit<K extends keyof SwarmEvents>(
    event: K,
    ...args: SwarmEvents[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof SwarmEvents>(
    event: K,
    listener: (...args: SwarmEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  // ── Agent registration ─────────────────────────────────────────

  registerAgent(registration: AgentRegistration): void {
    this.agentRegistry.set(registration.name, registration);
  }

  getAgent(name: string): AgentRegistration | undefined {
    return this.agentRegistry.get(name);
  }

  getRegisteredAgents(): string[] {
    return Array.from(this.agentRegistry.keys());
  }
}

// ── Agent registration type ────────────────────────────────────────

export interface AgentRegistration {
  name: string;
  role: "pre-filter" | "worker" | "adversarial" | "coordinator" | "tuner" | "backtester" | "safety";
  model: string;
  characterFile: string;
}

// ── Factory: create bus with all 8 agents registered ───────────────

export function createSwarmBus(): SwarmBus {
  const bus = new SwarmBus();

  const agents: AgentRegistration[] = [
    {
      name: "lituus",
      role: "pre-filter",
      model: "none",
      characterFile: "characters/lituus.json",
    },
    {
      name: "haruspex",
      role: "worker",
      model: "claude-haiku-4-5-20251001",
      characterFile: "characters/haruspex.json",
    },
    {
      name: "auspex",
      role: "worker",
      model: "claude-haiku-4-5-20251001",
      characterFile: "characters/auspex.json",
    },
    {
      name: "chronos",
      role: "worker",
      model: "claude-haiku-4-5-20251001",
      characterFile: "characters/chronos.json",
    },
    {
      name: "fas",
      role: "adversarial",
      model: "claude-sonnet-4-5",
      characterFile: "characters/fas.json",
    },
    {
      name: "nefas",
      role: "adversarial",
      model: "claude-sonnet-4-5",
      characterFile: "characters/nefas.json",
    },
    {
      name: "sibyl",
      role: "tuner",
      model: "claude-haiku-4-5-20251001",
      characterFile: "characters/sibyl.json",
    },
    {
      name: "speculum",
      role: "backtester",
      model: "claude-haiku-4-5-20251001",
      characterFile: "characters/speculum.json",
    },
    {
      name: "vates",
      role: "safety",
      model: "none",
      characterFile: "characters/vates.json",
    },
  ];

  for (const agent of agents) {
    bus.registerAgent(agent);
  }

  return bus;
}
