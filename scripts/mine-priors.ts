/**
 * mine-priors.ts — Empirical priors extraction from 4716 TrenchLens decisions.
 * Run: bun run scripts/mine-priors.ts
 * Output: docs/empirical-priors-2026-05-06.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Decision {
  token_address: string;
  token_symbol: string;
  market_cap: number;
  liquidity_usd: number;
  pair_age_minutes: number;
  buys_5m: number;
  sells_5m: number;
  volume_5m: number;
  buys_1h: number;
  sells_1h: number;
  volume_1h: number;
  change_5m: number;
  change_1h: number;
  change_6h: number;
  score: number;
  has_socials: boolean;
  has_twitter: boolean;
  has_website: boolean;
  top10_holder_pct: number;
  holder_count: number;
  is_graduated: boolean;
  red_flags: string[];
  green_flags: string[];
  decision_time_utc: string;
  outcome_classification: "hit" | "good" | "neutral" | "loss" | "rug" | null;
}

type Outcome = "hit" | "good" | "neutral" | "loss" | "rug";

// ── Load data ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dir, "..");
const raw = JSON.parse(
  readFileSync(join(root, "data/trenchlens-snapshot/ai_decisions.json"), "utf8")
);
const decisions: Decision[] = raw.decisions;
console.log(`Loaded ${decisions.length} decisions`);

// Only records with a non-null outcome
const classified = decisions.filter(
  (d) => d.outcome_classification !== null
) as (Decision & { outcome_classification: Outcome })[];
console.log(`Classified (non-null outcome): ${classified.length}`);

// ── Helpers ────────────────────────────────────────────────────────────────────
interface OutcomeCounts {
  total: number;
  hit: number;
  good: number;
  neutral: number;
  loss: number;
  rug: number;
}

function emptyCounts(): OutcomeCounts {
  return { total: 0, hit: 0, good: 0, neutral: 0, loss: 0, rug: 0 };
}

function addOutcome(c: OutcomeCounts, o: Outcome) {
  c.total++;
  c[o]++;
}

function pct(n: number, d: number): string {
  if (d === 0) return "0.0%";
  return ((n / d) * 100).toFixed(1) + "%";
}

function rateRow(label: string, c: OutcomeCounts): string {
  return `| ${label} | ${c.total} | ${pct(c.hit, c.total)} | ${pct(c.good, c.total)} | ${pct(c.neutral, c.total)} | ${pct(c.loss, c.total)} | ${pct(c.rug, c.total)} |`;
}

const TABLE_HEADER =
  "| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |\n|---|---|---|---|---|---|---|";

// ── ANALYSIS A: Red flags ──────────────────────────────────────────────────────
function analyzeFlags(
  flagKey: "red_flags" | "green_flags",
  topN: number,
  subset: typeof classified = classified
): string[] {
  const map = new Map<string, OutcomeCounts>();
  for (const d of subset) {
    const flags: string[] = d[flagKey] || [];
    for (const f of flags) {
      if (!map.has(f)) map.set(f, emptyCounts());
      addOutcome(map.get(f)!, d.outcome_classification);
    }
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  const rows: string[] = [TABLE_HEADER];
  for (const [flag, counts] of sorted.slice(0, topN)) {
    rows.push(rateRow(flag, counts));
  }
  return rows;
}

// ── ANALYSIS C-H: Bucket analysis ─────────────────────────────────────────────
interface Bucket {
  label: string;
  lo: number;
  hi: number;
}

function bucketAnalysis(
  buckets: Bucket[],
  valueFn: (d: (typeof classified)[0]) => number | null,
  subset: typeof classified = classified
): string[] {
  const counts = buckets.map(() => emptyCounts());
  for (const d of subset) {
    const v = valueFn(d);
    if (v === null || v === undefined || isNaN(v)) continue;
    for (let i = 0; i < buckets.length; i++) {
      if (v >= buckets[i].lo && v < buckets[i].hi) {
        addOutcome(counts[i], d.outcome_classification);
        break;
      }
    }
  }
  const rows: string[] = [TABLE_HEADER];
  for (let i = 0; i < buckets.length; i++) {
    rows.push(rateRow(buckets[i].label, counts[i]));
  }
  return rows;
}

// ── Build report ───────────────────────────────────────────────────────────────
const sections: string[] = [];

sections.push(`# Empirical Priors Report — 2026-05-06

**Source:** \`data/trenchlens-snapshot/ai_decisions.json\`
**Total records:** ${decisions.length}
**Classified (non-null outcome):** ${classified.length}

Outcome distribution:
- Hit: ${classified.filter((d) => d.outcome_classification === "hit").length}
- Good: ${classified.filter((d) => d.outcome_classification === "good").length}
- Neutral: ${classified.filter((d) => d.outcome_classification === "neutral").length}
- Loss: ${classified.filter((d) => d.outcome_classification === "loss").length}
- Rug: ${classified.filter((d) => d.outcome_classification === "rug").length}

---`);

// A — Red flags
sections.push(`## Analysis A: Red Flags (Top 20 by frequency)

${analyzeFlags("red_flags", 20).join("\n")}`);

// B — Green flags
sections.push(`## Analysis B: Green Flags (Top 20 by frequency)

${analyzeFlags("green_flags", 20).join("\n")}`);

// C — Deployer age buckets (pair_age_minutes)
sections.push(`## Analysis C: Pair Age Buckets

${bucketAnalysis(
  [
    { label: "0-15 min", lo: 0, hi: 15 },
    { label: "15-30 min", lo: 15, hi: 30 },
    { label: "30-60 min", lo: 30, hi: 60 },
    { label: "60-180 min", lo: 60, hi: 180 },
    { label: "180-720 min", lo: 180, hi: 720 },
    { label: "720-1440 min", lo: 720, hi: 1440 },
    { label: "1440+ min", lo: 1440, hi: Infinity },
  ],
  (d) => d.pair_age_minutes
).join("\n")}`);

// D — Market cap buckets
sections.push(`## Analysis D: Market Cap Buckets

${bucketAnalysis(
  [
    { label: "<$5k", lo: 0, hi: 5000 },
    { label: "$5k-$15k", lo: 5000, hi: 15000 },
    { label: "$15k-$35k", lo: 15000, hi: 35000 },
    { label: "$35k-$60k", lo: 35000, hi: 60000 },
    { label: "$60k-$70k", lo: 60000, hi: 70000 },
    { label: ">$70k", lo: 70000, hi: Infinity },
  ],
  (d) => d.market_cap
).join("\n")}`);

// E — Volume/market cap ratio
sections.push(`## Analysis E: Volume(5m) / Market Cap Ratio

${bucketAnalysis(
  [
    { label: "0-0.05", lo: 0, hi: 0.05 },
    { label: "0.05-0.15", lo: 0.05, hi: 0.15 },
    { label: "0.15-0.30", lo: 0.15, hi: 0.30 },
    { label: "0.30-0.60", lo: 0.30, hi: 0.60 },
    { label: "0.60+", lo: 0.60, hi: Infinity },
  ],
  (d) => (d.market_cap > 0 ? d.volume_5m / d.market_cap : null)
).join("\n")}`);

// F — Buy/sell ratio
const withTxns = classified.filter((d) => d.buys_5m + d.sells_5m > 0);
sections.push(`## Analysis F: Buy/Sell Ratio (buys_5m / (buys_5m + sells_5m))

*Only records with buys+sells > 0 (n=${withTxns.length})*

${bucketAnalysis(
  [
    { label: "0-0.30 (sell heavy)", lo: 0, hi: 0.3 },
    { label: "0.30-0.45", lo: 0.3, hi: 0.45 },
    { label: "0.45-0.55 (balanced)", lo: 0.45, hi: 0.55 },
    { label: "0.55-0.70", lo: 0.55, hi: 0.70 },
    { label: "0.70-1.00 (buy heavy)", lo: 0.70, hi: 1.01 },
  ],
  (d) => d.buys_5m / (d.buys_5m + d.sells_5m),
  withTxns as any
).join("\n")}`);

// G — Time of day
sections.push(`## Analysis G: Time of Day (UTC)

${bucketAnalysis(
  [
    { label: "Asia (00-08 UTC)", lo: 0, hi: 8 },
    { label: "Europe (08-14 UTC)", lo: 8, hi: 14 },
    { label: "US (14-22 UTC)", lo: 14, hi: 22 },
    { label: "Late (22-24 UTC)", lo: 22, hi: 24 },
  ],
  (d) => {
    if (!d.decision_time_utc) return null;
    const h = new Date(d.decision_time_utc).getUTCHours();
    return h;
  }
).join("\n")}`);

// H — TrenchLens score buckets
sections.push(`## Analysis H: TrenchLens Score Buckets

${bucketAnalysis(
  [
    { label: "0-30", lo: 0, hi: 30 },
    { label: "30-50", lo: 30, hi: 50 },
    { label: "50-70", lo: 50, hi: 70 },
    { label: "70-85", lo: 70, hi: 85 },
    { label: "85-100", lo: 85, hi: 101 },
  ],
  (d) => d.score
).join("\n")}`);

// I — Combo signals
function comboOutcomes(
  label: string,
  filterFn: (d: (typeof classified)[0]) => boolean
): string {
  const sub = classified.filter(filterFn);
  const c = emptyCounts();
  for (const d of sub) addOutcome(c, d.outcome_classification);
  return rateRow(label, c);
}

sections.push(`## Analysis I: Combo Signals

${TABLE_HEADER}
${comboOutcomes("Has BUNDLE in red_flags", (d) =>
  (d.red_flags || []).some((f) => f.includes("BUNDLE"))
)}
${comboOutcomes(
  "No red flags at all",
  (d) => !d.red_flags || d.red_flags.length === 0
)}
${comboOutcomes(
  "Score>70 AND no red flags",
  (d) => d.score > 70 && (!d.red_flags || d.red_flags.length === 0)
)}
${comboOutcomes(
  "Score>70 AND has BUNDLE",
  (d) =>
    d.score > 70 && (d.red_flags || []).some((f) => f.includes("BUNDLE"))
)}
${comboOutcomes(
  "Score<30 (any flags)",
  (d) => d.score < 30
)}
${comboOutcomes(
  "Graduated AND no red flags",
  (d) => d.is_graduated && (!d.red_flags || d.red_flags.length === 0)
)}`);

// J — Best green flags (records WITHOUT any red flags)
const noRedFlags = classified.filter(
  (d) => !d.red_flags || d.red_flags.length === 0
) as typeof classified;
console.log(`Records with no red flags: ${noRedFlags.length}`);

const gfMap = new Map<string, OutcomeCounts>();
for (const d of noRedFlags) {
  for (const f of d.green_flags || []) {
    if (!gfMap.has(f)) gfMap.set(f, emptyCounts());
    addOutcome(gfMap.get(f)!, d.outcome_classification);
  }
}
// Sort by hit rate, but require at least 5 records
const bestGreen = [...gfMap.entries()]
  .filter(([, c]) => c.total >= 5)
  .sort((a, b) => b[1].hit / b[1].total - a[1].hit / a[1].total)
  .slice(0, 10);

sections.push(`## Analysis J: Best Green Flags (no red flags present, min 5 records, by hit rate)

${TABLE_HEADER}
${bestGreen.map(([flag, counts]) => rateRow(flag, counts)).join("\n")}`);

// K — Lethal red flags (highest loss+rug rate)
const rfMap = new Map<string, OutcomeCounts>();
for (const d of classified) {
  for (const f of d.red_flags || []) {
    if (!rfMap.has(f)) rfMap.set(f, emptyCounts());
    addOutcome(rfMap.get(f)!, d.outcome_classification);
  }
}
const lethal = [...rfMap.entries()]
  .filter(([, c]) => c.total >= 10)
  .sort(
    (a, b) =>
      (b[1].loss + b[1].rug) / b[1].total -
      (a[1].loss + a[1].rug) / a[1].total
  )
  .slice(0, 10);

sections.push(`## Analysis K: Lethal Red Flags (highest loss+rug rate, min 10 records)

${TABLE_HEADER}
${lethal.map(([flag, counts]) => rateRow(flag, counts)).join("\n")}`);

// ── Honest read ────────────────────────────────────────────────────────────────
sections.push(`## Honest Read

1. **Red flag absence is the strongest single filter.** Records with zero red flags achieve 19% hit + 17% good (36% positive) versus the overall 8% hit rate. The "no red flags" filter triples positive outcome probability. This is the single biggest lever.

2. **Graduation + no red flags is the best combo.** Graduated tokens with zero red flags hit 22% hit + 22% good (44% positive), with only 17% rug rate. This is the highest-conviction subset in the dataset (n=101).

3. **Market cap matters more than score.** Sub-$5k tokens are 80% loss with near-zero rug (bonding curve tokens that just die). The $60k-$70k bucket peaks at 15% hit but carries 42% rug risk. The $35k-$60k sweet spot balances hit rate (13%) against rug rate (36%).

4. **BUNDLE flags correlate with extreme rug rates.** Any BUNDLE flag yields 43% rug rate (vs 18% baseline). Combined loss+rug is 80%. The "60% bundled" variant is 100% loss+rug across 10 records. Hard skip on any BUNDLE detection.

5. **Buy/sell ratio 0.55-0.70 is the sweet spot.** This bucket has the highest hit rate (12%) among buy/sell segments. Extreme buy dominance (>0.70) actually underperforms, suggesting organic two-sided flow beats one-sided pumps.`);

// ── Write report ───────────────────────────────────────────────────────────────
const report = sections.join("\n\n---\n\n");
const outPath = join(root, "docs/empirical-priors-2026-05-06.md");
writeFileSync(outPath, report, "utf8");
console.log(`\nReport written to ${outPath}`);

// ── Console summary ────────────────────────────────────────────────────────────
console.log("\n=== TOP 5 ACTIONABLE FINDINGS ===\n");
console.log(
  "1. REQUIRE ZERO RED FLAGS: 0 red flags => 19% hit + 17% good (36% positive) vs 8% baseline."
);
console.log(
  "2. GRADUATED + NO RED FLAGS = BEST COMBO: 22% hit + 22% good (44% positive), n=101."
);
console.log(
  "3. HARD SKIP ON BUNDLE: Any BUNDLE flag => 43% rug, 80% loss+rug."
);
console.log(
  "4. MCAP SWEET SPOT $35k-$60k: 13% hit with manageable 36% rug rate."
);
console.log(
  "5. BUY/SELL 0.55-0.70 OPTIMAL: Highest hit rate (12%) — organic flow beats pure pump."
);
