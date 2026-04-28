/**
 * Speculum CLI — run the replay engine against the TrenchLens snapshot.
 *
 * Usage:
 *   bun run src/cli/speculum.ts --limit=200
 *   bun run speculum:replay -- --limit=200
 */

import { writeFile } from "node:fs/promises";
import { TrenchLensBridge } from "../db/trenchlens-bridge.js";
import { runReplay, type ReplayReport, type ReplayResult } from "../speculum/replay.js";

// ── Parse args ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
let limit: number | undefined;

for (const arg of args) {
  const m = arg.match(/^--limit=(\d+)$/);
  if (m) limit = parseInt(m[1], 10);
}

// ── Formatting helpers ─────────────────────────────────────────────

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

function printEntry(r: ReplayResult, metric: string): string {
  return `  $${pad(r.candidateSymbol, 16)} ${metric}`;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const bridge = new TrenchLensBridge("./data/trenchlens-snapshot");
  await bridge.loadSnapshot();

  const total = limit ?? bridge.totalDecisions;
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("        AUGURY · SPECULUM REPLAY");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Processing ${total} candidates...`);
  console.log("");

  const report = await runReplay({
    limit,
    bridge,
    onProgress: (done, tot) => {
      console.log(`  [${done}/${tot}] processed...`);
    },
  });

  printReport(report);

  // Save full report
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `./speculum-report-${ts}.json`;
  const { fullResults, ...summary } = report;
  const output = { ...summary, resultCount: fullResults.length, results: fullResults };
  await writeFile(filename, JSON.stringify(output, null, 2));
  console.log(`\nFull report: ${filename}`);

  await bridge.disconnect();
}

function printReport(r: ReplayReport) {
  console.log(`Snapshot: ${r.snapshotPeriod.start.slice(0, 10)} → ${r.snapshotPeriod.end.slice(0, 10)}`);
  console.log(`Candidates processed: ${r.candidatesProcessed}`);

  console.log("");
  console.log("── The Swarm Spoke ──────────────────────────────");
  console.log(`Fired:    ${r.swarmFireCount}  (${pct(r.swarmFireCount / r.candidatesProcessed)} of pool)`);
  console.log(`Skipped:  ${r.swarmSkipCount}  (${pct(r.swarmSkipCount / r.candidatesProcessed)} of pool)`);

  console.log("");
  console.log("── Of the swarm's fires (with known outcomes) ──");
  console.log(`Win rate (hit + good):  ${pct(r.swarmFireWinRate)}`);
  console.log(`Loss rate:              ${pct(r.swarmFireLossRate)}`);
  console.log(`Rug rate:               ${pct(r.swarmFireRugRate)}`);

  console.log("");
  console.log("── Of the swarm's skips (with known outcomes) ──");
  console.log(`Correctly avoided rug+loss:  ${pct(r.swarmSkipPrecision)}`);
  console.log(`Skipped a winner (regret):   ${pct(r.swarmSkipRegret)}`);

  console.log("");
  console.log("── Adversarial Consensus ───────────────────────");
  console.log(`Fas/Nefas agreement:    ${pct(r.adversarialAgreementRate)}`);
  console.log(`Disagreement (split):   ${pct(r.adversarialDisagreementRate)}`);

  console.log("");
  console.log("── Category Breakdown ─────────────────────────");
  for (const [cat, count] of Object.entries(r.categoryBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(cat, 28)} ${count}`);
  }

  if (r.topWinners.length > 0) {
    console.log("");
    console.log("── Top 5 Caught Winners ────────────────────────");
    for (const w of r.topWinners.slice(0, 5)) {
      console.log(printEntry(w, `peak +${(w.peak_return_pct ?? 0).toFixed(0)}%`));
    }
  }

  if (r.topAvoidedRugs.length > 0) {
    console.log("");
    console.log("── Top 5 Avoided Rugs ──────────────────────────");
    for (const w of r.topAvoidedRugs.slice(0, 5)) {
      console.log(printEntry(w, `6h ${(w.return_6h_pct ?? 0).toFixed(0)}%`));
    }
  }

  if (r.topMistakes.length > 0) {
    console.log("");
    console.log("── Top 5 Swarm Mistakes ────────────────────────");
    for (const w of r.topMistakes.slice(0, 5)) {
      console.log(printEntry(w, `6h ${(w.return_6h_pct ?? 0).toFixed(0)}%  (fired anyway)`));
    }
  }

  if (r.topRegrets.length > 0) {
    console.log("");
    console.log("── Top 5 Swarm Regrets ─────────────────────────");
    for (const w of r.topRegrets.slice(0, 5)) {
      console.log(printEntry(w, `peak +${(w.peak_return_pct ?? 0).toFixed(0)}%  (skipped)`));
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Speculum replay failed:", err);
  process.exit(1);
});
