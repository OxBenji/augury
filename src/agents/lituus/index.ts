/**
 * Lituus — deterministic pre-filter.
 *
 * Watches Helius webhook firehose for graduation events.
 * Applies rule-based gating: Vates safety first, then liquidity,
 * dev wallet blacklist, basic sanity.
 *
 * Intentionally LOOSER than old TrenchLens filter to widen training
 * distribution for Sibyl (survivorship bias mitigation).
 *
 * No LLM. Pure TypeScript.
 */

import type { SwarmBus, CandidateReading } from "../../swarm/bus.js";
import type { Vates, SafetyCheckResult } from "../vates/index.js";

// ── Configuration ──────────────────────────────────────────────────

export interface LituusConfig {
  minLiquiditySol: number;
  maxMinutesSinceGraduation: number;
  knownBadDevWallets: Set<string>;
  oldFilterMinLiquidity: number;
  oldFilterMinHolders: number;
}

const DEFAULT_CONFIG: LituusConfig = {
  minLiquiditySol: 5,
  maxMinutesSinceGraduation: 60,
  knownBadDevWallets: new Set(),
  oldFilterMinLiquidity: 15,
  oldFilterMinHolders: 50,
};

// ── Helius webhook event types ─────────────────────────────────────

export interface HeliusWebhookEvent {
  type: string;
  timestamp: number;
  data: {
    mint: string;
    name: string;
    symbol: string;
    poolAddress: string;
    liquiditySol: number;
    devWallet: string;
    holderCount: number;
    graduatedAt: number;
    metadata: Record<string, unknown>;
  };
}

// ── Filter results ─────────────────────────────────────────────────

export interface FilterResult {
  passed: boolean;
  reason?: string;
  wouldHavePassedOldFilter: boolean;
  safety?: SafetyCheckResult;
}

// ── Lituus agent ───────────────────────────────────────────────────

export class Lituus {
  private config: LituusConfig;
  private bus: SwarmBus;
  private vates: Vates | null;

  constructor(bus: SwarmBus, config: Partial<LituusConfig> = {}, vates?: Vates) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bus = bus;
    this.vates = vates ?? null;
  }

  /**
   * Process a Helius webhook event. If it passes the filter,
   * emit a CandidateReading to the swarm bus.
   */
  async processWebhookEvent(event: HeliusWebhookEvent): Promise<FilterResult> {
    const { data } = event;

    const wouldHavePassedOldFilter =
      data.liquiditySol >= this.config.oldFilterMinLiquidity &&
      data.holderCount >= this.config.oldFilterMinHolders;

    // ── Gate 1: Vates safety check (first, cheapest) ──────────
    let safety: SafetyCheckResult | undefined;
    if (this.vates) {
      safety = await this.vates.readTheChain(data.mint);

      // Only enforce hard vetoes if Vates has actual data (not all-null)
      const safetyDataAvailable =
        safety.lpBurned !== null || safety.isHoneypot !== null;

      if (safetyDataAvailable) {
        const { skip, reasons } = this.vates.shouldHardSkip(safety);
        if (skip) {
          return {
            passed: false,
            reason: `Vates veto: ${reasons.join("; ")}`,
            wouldHavePassedOldFilter,
            safety,
          };
        }
      }
    }

    // ── Gate 2: Event type ────────────────────────────────────
    if (event.type !== "GRADUATION") {
      return { passed: false, reason: "not a graduation event", wouldHavePassedOldFilter };
    }

    // ── Gate 3: Liquidity ────────────────────────────────────
    if (data.liquiditySol < this.config.minLiquiditySol) {
      return {
        passed: false,
        reason: `liquidity ${data.liquiditySol} SOL below minimum ${this.config.minLiquiditySol}`,
        wouldHavePassedOldFilter,
      };
    }

    // ── Gate 4: Dev wallet blacklist ─────────────────────────
    if (this.config.knownBadDevWallets.has(data.devWallet)) {
      return { passed: false, reason: "dev wallet in known-bad list", wouldHavePassedOldFilter };
    }

    // ── Gate 5: Age ──────────────────────────────────────────
    const minutesSinceGrad = (Date.now() - data.graduatedAt) / 60_000;
    if (minutesSinceGrad > this.config.maxMinutesSinceGraduation) {
      return {
        passed: false,
        reason: `${Math.round(minutesSinceGrad)}m since graduation exceeds max`,
        wouldHavePassedOldFilter,
      };
    }

    // ── Passed — emit to swarm bus ───────────────────────────
    const candidate: CandidateReading = {
      mint: data.mint,
      name: data.name,
      symbol: data.symbol,
      poolAddress: data.poolAddress,
      liquiditySol: data.liquiditySol,
      devWallet: data.devWallet,
      holderCount: data.holderCount,
      detectedAt: new Date(),
      minutesSinceGraduation: minutesSinceGrad,
      wouldHavePassedOldFilter,
      metadata: data.metadata,
    };

    this.bus.emit("candidate:reading", candidate);

    return { passed: true, wouldHavePassedOldFilter, safety };
  }

  /**
   * Start listening for Helius webhook events.
   */
  start(): void {
    // TODO: implement HTTP server that receives Helius webhook POST
    throw new Error("Lituus.start not implemented — wire Helius webhook receiver");
  }

  /**
   * Load known-bad dev wallets from DB.
   */
  async loadBlacklist(): Promise<void> {
    // TODO: load from persistent store
    throw new Error("Lituus.loadBlacklist not implemented");
  }
}
