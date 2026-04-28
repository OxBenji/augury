/**
 * Deterministic mock workers for Speculum replay.
 * No LLM calls. Score real fields from the TrenchLens archive.
 * Each mock delays 1ms to simulate async behavior without wasting 50ms.
 */

import type { HistoricalCandidate } from "../db/trenchlens-bridge.js";

// ── Output shapes (matching real character specs) ──────────────────

export interface HaruspexReading {
  dev_quality: number;
  holder_health: number;
  sniper_exposure: number;
  bundle_risk: number;
  early_concentration: number;
  composite: number;
  reading: string;
}

export interface AuspexReading {
  kol_quality: number;
  chatter_velocity: number;
  sentiment: number;
  viral_potential: number;
  composite: number;
  reading: string;
}

export interface ChronosReading {
  depth: number;
  imbalance: number;
  volume_shape: "accelerating" | "stable" | "decelerating";
  moment_quality: number;
  composite: number;
  reading: string;
}

// ── Oracle lines ───────────────────────────────────────────────────

function oracleLine(score: number, agent: "haruspex" | "auspex" | "chronos"): string {
  const lines = {
    haruspex: {
      high: "Entrails clean. The flock may approach.",
      mid: "Entrails uncertain. Read again.",
      low: "The marks of three burials.",
    },
    auspex: {
      high: "Voices in concert.",
      mid: "Murmuring without conviction.",
      low: "Silence. No bird sings.",
    },
    chronos: {
      high: "The moment opens.",
      mid: "The hour is uncertain.",
      low: "The window has closed.",
    },
  };
  const tier = score >= 0.7 ? "high" : score >= 0.4 ? "mid" : "low";
  return lines[agent][tier];
}

// ── Mock workers ───────────────────────────────────────────────────

export async function runHaruspexMock(c: HistoricalCandidate): Promise<HaruspexReading> {
  await delay();
  const f = c.features;

  const dev_quality = 0.5; // archive lacks dev wallet history — neutral
  const holder_health = f.top10_holder_pct === 0
    ? 0.5
    : Math.max(0, 1 - f.top10_holder_pct / 100);
  const sniper_exposure = f.red_flags.some((fl) => /sniper/i.test(fl)) ? 0.3 : 0.7;
  const bundle_risk = f.red_flags.some((fl) => /bundle/i.test(fl)) ? 0.3 : 0.7;
  const early_concentration = holder_health;
  const composite = 0.3 * dev_quality + 0.3 * holder_health + 0.2 * sniper_exposure + 0.2 * bundle_risk;

  return {
    dev_quality,
    holder_health,
    sniper_exposure,
    bundle_risk,
    early_concentration,
    composite,
    reading: oracleLine(composite, "haruspex"),
  };
}

export async function runAuspexMock(c: HistoricalCandidate): Promise<AuspexReading> {
  await delay();
  const f = c.features;

  const socialCount = [f.has_socials, f.has_twitter, f.has_website].filter(Boolean).length;
  const kol_quality = socialCount / 3;
  const chatter_velocity = Math.min(1, Math.log1p(f.buys_5m) / 8);
  const sentiment = f.change_5m > 0
    ? Math.min(1, f.change_5m / 50)
    : Math.max(-1, f.change_5m / 50);
  const viral_potential = chatter_velocity * (sentiment > 0 ? 1 : 0.3);
  const composite = 0.4 * kol_quality + 0.3 * chatter_velocity + 0.3 * Math.max(0, viral_potential);

  return {
    kol_quality,
    chatter_velocity,
    sentiment,
    viral_potential,
    composite,
    reading: oracleLine(composite, "auspex"),
  };
}

export async function runChronosMock(c: HistoricalCandidate): Promise<ChronosReading> {
  await delay();
  const f = c.features;

  const total_5m = f.buys_5m + f.sells_5m;
  const total_1h = f.buys_1h + f.sells_1h;
  const bs_1h = total_1h === 0 ? 0 : f.buys_1h / Math.max(1, f.sells_1h);
  const depth = Math.min(1, Math.log1p(f.liquidity_usd) / 14);
  const imbalance_5m = total_5m === 0 ? 0 : (f.buys_5m - f.sells_5m) / total_5m;
  const vol_liq_ratio = f.liquidity_usd === 0 ? 999 : f.volume_1h / f.liquidity_usd;
  const wash_signal = vol_liq_ratio > 50 ? 0.2 : 1.0;

  const volume_shape: ChronosReading["volume_shape"] =
    f.change_5m > 0 && f.change_1h > 0 ? "accelerating" :
    f.change_5m < 0 && f.change_1h > 0 ? "decelerating" :
    "stable";

  const moment_quality = depth * (imbalance_5m > 0 ? 1 : 0.4) * wash_signal;
  const composite = 0.35 * depth + 0.35 * moment_quality + 0.3 * Math.min(1, bs_1h / 2);

  return {
    depth,
    imbalance: imbalance_5m,
    volume_shape,
    moment_quality,
    composite,
    reading: oracleLine(composite, "chronos"),
  };
}

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 1));
}
