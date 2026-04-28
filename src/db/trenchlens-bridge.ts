/**
 * TrenchLens JSON bridge.
 *
 * Reads flat JSON snapshot files from the old TrenchLens bot.
 * Primary source: ai_decisions.json (4716 decisions with features + outcomes).
 * Fallback: performance.json (401 fired signals with outcome data).
 *
 * This is READ-ONLY. The old bot's decisions are reference context, not
 * a comparison target. We use the archive as labeled market data.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────

export interface HistoricalCandidate {
  mint: string;
  symbol: string;
  name: string;
  alertedAt: Date;
  oldBot: {
    aiAction: "SEND" | "CAUTION" | "SKIP";
    aiConfidence: "HIGH" | "MEDIUM" | "LOW";
    note: string;
  };
  outcome: {
    classification: "hit" | "good" | "neutral" | "loss" | "rug" | "unknown";
    return_1h_pct: number | null;
    return_6h_pct: number | null;
    return_24h_pct: number | null;
    peak_return_pct: number | null;
  };
  features: {
    score: number;
    liquidity_usd: number;
    market_cap: number;
    pair_age_minutes: number;
    buys_5m: number;
    sells_5m: number;
    buys_1h: number;
    sells_1h: number;
    volume_5m: number;
    volume_1h: number;
    change_5m: number;
    change_1h: number;
    change_6h: number;
    has_socials: boolean;
    has_twitter: boolean;
    has_website: boolean;
    top10_holder_pct: number;
    holder_count: number;
    is_graduated: boolean;
    red_flags: string[];
    green_flags: string[];
  };
  safety: {
    lpBurned: boolean | null;
    lpLocked: boolean | null;
    lpLockUntil: number | null;
    isHoneypot: boolean | null;
    mintAuthorityRenounced: boolean | null;
    freezeAuthorityRenounced: boolean | null;
    devSoldOut: boolean | null;
    devHoldingPct: number | null;
    smartWalletCount: number | null;
    knownRugWalletCount: number | null;
    checkedAt: Date | null;
    source: "vates" | "archive" | null;
  };
  raw: Record<string, unknown>;
}

export interface WeeklyAggregate {
  [key: string]: unknown;
}

// ── Raw JSON shapes ────────────────────────────────────────────────

interface RawAiDecision {
  token_address: string;
  token_symbol: string;
  token_name: string;
  pair_address: string;
  dex_id: string;
  price_usd: number;
  market_cap: number;
  liquidity_usd: number;
  fdv: number;
  pair_age_minutes: number;
  score: number;
  is_graduated: boolean;
  buys_5m: number;
  sells_5m: number;
  volume_5m: number;
  buys_1h: number;
  sells_1h: number;
  volume_1h: number;
  change_5m: number;
  change_1h: number;
  change_6h: number;
  has_socials: boolean;
  has_website: boolean;
  has_image: boolean;
  has_twitter: boolean;
  top_holder_pct: number;
  top10_holder_pct: number;
  holder_count: number;
  ai_action: "SEND" | "CAUTION" | "SKIP";
  ai_confidence: "HIGH" | "MEDIUM" | "LOW";
  ai_reasoning: string;
  ai_score: number;
  rule_passed: boolean;
  red_flags: string[];
  green_flags: string[];
  was_sent: boolean;
  decision_time: number;
  decision_time_utc: string;
  outcome_checked: boolean;
  outcome_price_1h: number | null;
  outcome_price_6h: number | null;
  outcome_price_24h: number | null;
  outcome_return_1h_pct: number | null;
  outcome_return_6h_pct: number | null;
  outcome_return_24h_pct: number | null;
  outcome_peak_return_pct: number | null;
  outcome_classification: "hit" | "good" | "neutral" | "loss" | "rug" | null;
}

interface RawPerformanceSignal {
  token_address: string;
  token_symbol: string;
  token_name: string;
  return_1h_pct: number;
  return_6h_pct: number;
  return_24h_pct: number;
  peak_return_pct: number;
  classification: string;
  completed: boolean;
}

// ── Bridge ─────────────────────────────────────────────────────────

export class TrenchLensBridge {
  private snapshotDir: string;
  private decisions: RawAiDecision[] = [];
  private performanceMap = new Map<string, RawPerformanceSignal>();
  private weeklyHistory: WeeklyAggregate[] = [];
  private lastScan: Record<string, unknown>[] = [];
  private loaded = false;
  public snapshotMtime: Date = new Date();

  constructor(snapshotDir: string = "./data/trenchlens-snapshot") {
    this.snapshotDir = snapshotDir;
  }

  async loadSnapshot(): Promise<void> {
    // ai_decisions.json — primary
    const decisionsPath = join(this.snapshotDir, "ai_decisions.json");
    const decisionsRaw = await readFile(decisionsPath, "utf8");
    const decisionsData = JSON.parse(decisionsRaw);
    this.decisions = decisionsData.decisions ?? [];

    // snapshot mtime
    const st = await stat(decisionsPath);
    this.snapshotMtime = st.mtime;

    // performance.json — fallback for outcomes
    try {
      const perfRaw = await readFile(join(this.snapshotDir, "performance.json"), "utf8");
      const perfData = JSON.parse(perfRaw);
      const signals = perfData.signals ?? {};
      for (const [addr, sig] of Object.entries(signals)) {
        this.performanceMap.set(addr, sig as RawPerformanceSignal);
      }
      this.weeklyHistory = perfData.weekly_history ?? [];
    } catch {
      // performance.json is optional fallback
    }

    // last_scan.json — for live sample
    try {
      const scanRaw = await readFile(join(this.snapshotDir, "last_scan.json"), "utf8");
      this.lastScan = JSON.parse(scanRaw);
    } catch {
      // optional
    }

    this.loaded = true;
  }

  async getHistoricalCandidates(opts: {
    limit?: number;
    offset?: number;
  } = {}): Promise<HistoricalCandidate[]> {
    if (!this.loaded) await this.loadSnapshot();

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? this.decisions.length;
    const slice = this.decisions.slice(offset, offset + limit);

    return slice.map((d) => this.mapDecision(d));
  }

  async getWeeklyHistory(): Promise<WeeklyAggregate[]> {
    if (!this.loaded) await this.loadSnapshot();
    return this.weeklyHistory;
  }

  async getLiveSample(): Promise<HistoricalCandidate | null> {
    if (!this.loaded) await this.loadSnapshot();
    if (this.lastScan.length === 0) return null;
    const raw = this.lastScan[0];
    // Map last_scan entry into a minimal HistoricalCandidate
    return {
      mint: (raw.token_address as string) ?? "",
      symbol: (raw.token_symbol as string) ?? "",
      name: (raw.token_name as string) ?? "",
      alertedAt: new Date((raw.timestamp as string) ?? Date.now()),
      oldBot: { aiAction: "SKIP", aiConfidence: "LOW", note: "live sample — no old bot decision" },
      outcome: { classification: "unknown", return_1h_pct: null, return_6h_pct: null, return_24h_pct: null, peak_return_pct: null },
      features: {
        score: (raw.score as number) ?? 0,
        liquidity_usd: (raw.liquidity_usd as number) ?? 0,
        market_cap: (raw.market_cap as number) ?? 0,
        pair_age_minutes: (raw.pair_age_minutes as number) ?? 0,
        buys_5m: (raw.buys_5m as number) ?? 0,
        sells_5m: (raw.sells_5m as number) ?? 0,
        buys_1h: (raw.buys_1h as number) ?? 0,
        sells_1h: (raw.sells_1h as number) ?? 0,
        volume_5m: (raw.volume_5m as number) ?? 0,
        volume_1h: (raw.volume_1h as number) ?? 0,
        change_5m: (raw.change_5m as number) ?? 0,
        change_1h: (raw.change_1h as number) ?? 0,
        change_6h: (raw.change_6h as number) ?? 0,
        has_socials: false, has_twitter: false, has_website: false,
        top10_holder_pct: 0, holder_count: 0, is_graduated: false,
        red_flags: [], green_flags: [],
      },
      safety: {
        lpBurned: null, lpLocked: null, lpLockUntil: null,
        isHoneypot: null, mintAuthorityRenounced: null, freezeAuthorityRenounced: null,
        devSoldOut: null, devHoldingPct: null,
        smartWalletCount: null, knownRugWalletCount: null,
        checkedAt: null, source: "archive",
      },
      raw: raw as Record<string, unknown>,
    };
  }

  async disconnect(): Promise<void> {
    // no-op — JSON files, no connection to close
  }

  get totalDecisions(): number {
    return this.decisions.length;
  }

  // ── Private mapping ──────────────────────────────────────────────

  private mapDecision(d: RawAiDecision): HistoricalCandidate {
    // Outcome: prefer ai_decisions, fallback to performance.json
    let outcomeClass: HistoricalCandidate["outcome"]["classification"] = "unknown";
    let r1h = d.outcome_return_1h_pct;
    let r6h = d.outcome_return_6h_pct;
    let r24h = d.outcome_return_24h_pct;
    let peak = d.outcome_peak_return_pct;

    if (d.outcome_classification) {
      outcomeClass = d.outcome_classification;
    } else {
      const perf = this.performanceMap.get(d.token_address);
      if (perf?.classification) {
        const valid = ["hit", "good", "neutral", "loss", "rug"];
        outcomeClass = valid.includes(perf.classification)
          ? (perf.classification as typeof outcomeClass)
          : "unknown";
      }
      if (perf && r1h == null) r1h = perf.return_1h_pct ?? null;
      if (perf && r6h == null) r6h = perf.return_6h_pct ?? null;
      if (perf && r24h == null) r24h = perf.return_24h_pct ?? null;
      if (perf && peak == null) peak = perf.peak_return_pct ?? null;
    }

    return {
      mint: d.token_address,
      symbol: d.token_symbol ?? "",
      name: d.token_name ?? "",
      alertedAt: d.decision_time_utc
        ? new Date(d.decision_time_utc)
        : new Date(d.decision_time * 1000),
      oldBot: {
        aiAction: d.ai_action ?? "SKIP",
        aiConfidence: d.ai_confidence ?? "LOW",
        note: "reference only — bot had known issues",
      },
      outcome: {
        classification: outcomeClass,
        return_1h_pct: r1h,
        return_6h_pct: r6h,
        return_24h_pct: r24h,
        peak_return_pct: peak,
      },
      features: {
        score: d.score ?? 0,
        liquidity_usd: d.liquidity_usd ?? 0,
        market_cap: d.market_cap ?? 0,
        pair_age_minutes: d.pair_age_minutes ?? 0,
        buys_5m: d.buys_5m ?? 0,
        sells_5m: d.sells_5m ?? 0,
        buys_1h: d.buys_1h ?? 0,
        sells_1h: d.sells_1h ?? 0,
        volume_5m: d.volume_5m ?? 0,
        volume_1h: d.volume_1h ?? 0,
        change_5m: d.change_5m ?? 0,
        change_1h: d.change_1h ?? 0,
        change_6h: d.change_6h ?? 0,
        has_socials: d.has_socials ?? false,
        has_twitter: d.has_twitter ?? false,
        has_website: d.has_website ?? false,
        top10_holder_pct: d.top10_holder_pct ?? 0,
        holder_count: d.holder_count ?? 0,
        is_graduated: d.is_graduated ?? false,
        red_flags: d.red_flags ?? [],
        green_flags: d.green_flags ?? [],
      },
      safety: {
        lpBurned: null,
        lpLocked: null,
        lpLockUntil: null,
        isHoneypot: null,
        mintAuthorityRenounced: null,
        freezeAuthorityRenounced: null,
        devSoldOut: null,
        devHoldingPct: null,
        smartWalletCount: null,
        knownRugWalletCount: null,
        checkedAt: null,
        source: "archive",
      },
      raw: d as unknown as Record<string, unknown>,
    };
  }
}
