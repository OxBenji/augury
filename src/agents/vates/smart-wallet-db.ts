/**
 * Smart wallet database.
 *
 * Tracks wallets by their 30-day memecoin PnL. Wallets are classified:
 * - smart: positive 30d PnL, win rate > 50%
 * - neutral: insufficient data or middling performance
 * - rugger: negative 30d PnL or high rug exposure
 *
 * Stored as JSON. Bootstraps empty. Populates as Augury runs live
 * and tracks early buyer wallets across all candidates for 30 days.
 */

import { readFile, writeFile } from "node:fs/promises";

// ── Types ──────────────────────────────────────────────────────────

export interface SmartWalletEntry {
  address: string;
  pnl_30d_usd: number;
  pnl_30d_pct: number;
  win_rate: number;
  total_positions: number;
  rugged_count: number;
  last_updated: string;
  tier: "smart" | "neutral" | "rugger";
}

export interface WalletClassification {
  smart: number;
  neutral: number;
  rugger: number;
}

// ── Database ───────────────────────────────────────────────────────

export class SmartWalletDb {
  private path: string;
  private wallets = new Map<string, SmartWalletEntry>();
  private loaded = false;

  constructor(path: string = "./data/smart-wallets.json") {
    this.path = path;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf8");
      const entries: SmartWalletEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        this.wallets.set(entry.address, entry);
      }
    } catch {
      // File doesn't exist yet — start empty
      this.wallets = new Map();
    }
    this.loaded = true;
  }

  async lookup(address: string): Promise<SmartWalletEntry | null> {
    if (!this.loaded) await this.load();
    return this.wallets.get(address) ?? null;
  }

  async classifyWallets(addresses: string[]): Promise<WalletClassification> {
    if (!this.loaded) await this.load();

    const result: WalletClassification = { smart: 0, neutral: 0, rugger: 0 };
    for (const addr of addresses) {
      const entry = this.wallets.get(addr);
      if (!entry) {
        result.neutral++;
      } else {
        result[entry.tier]++;
      }
    }
    return result;
  }

  async upsert(entry: SmartWalletEntry): Promise<void> {
    if (!this.loaded) await this.load();
    this.wallets.set(entry.address, entry);
    await this.save();
  }

  private async save(): Promise<void> {
    const entries = Array.from(this.wallets.values());
    await writeFile(this.path, JSON.stringify(entries, null, 2));
  }

  get size(): number {
    return this.wallets.size;
  }
}
