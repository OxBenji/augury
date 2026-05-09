/**
 * Parse data/phase2-verbose.txt into landing/data/phase2-readings.json
 * Splits on [N/20] headers, uses indexOf for em-dash matching
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const EM = String.fromCodePoint(0x2014); // — U+2014

const raw = readFileSync("data/phase2-verbose.txt", "utf8");
const allLines = raw.split("\n");

// Find line indices where candidate blocks start: "[N/20] SYMBOL · outcome=X"
const headerIndices: number[] = [];
for (let i = 0; i < allLines.length; i++) {
  if (/\[\d+\/20\]/.test(allLines[i])) {
    headerIndices.push(i);
  }
}

interface Reading {
  candidate: {
    symbol: string; outcome: string; marketCap: number; buys5m: number;
    sells5m: number; liquidity: number; isGraduated: boolean;
    deployerAge: number; social: string[]; redFlags: string[];
    greenFlags: string[]; trenchlensScore: number;
    priceChange5m: number; priceChange1h: number;
  };
  workers: {
    haruspex: { score: number; reasoning: string };
    auspex: { score: number; reasoning: string };
    chronos: { score: number; reasoning: string };
  };
  fas: { decision: string; argument: string; citedFlags: string[] };
  nefas: { decision: string; argument: string; citedFlags: string[] };
  verdict: { consensus: string; decision: string; outcome: string; correct: boolean };
  cost: string;
}

const readings: Reading[] = [];

for (let h = 0; h < headerIndices.length; h++) {
  const startIdx = headerIndices[h];
  const endIdx = h + 1 < headerIndices.length ? headerIndices[h + 1] : allLines.length;
  const lines = allLines.slice(startIdx, endIdx);

  // Header
  const headerLine = lines[0];
  const hm = headerLine.match(/\[\d+\/20\]\s+(.+?)\s+\S\s+outcome=(\w+)/);
  if (!hm) continue;
  const symbol = hm[1].trim();
  const outcome = hm[2];

  // Helper: find value after a key prefix
  const findVal = (prefix: string): string => {
    const l = lines.find(l => l.trim().startsWith(prefix));
    if (!l) return "";
    return l.trim().slice(prefix.length).trim();
  };

  const parseNum = (s: string): number => parseFloat(s.replace(/[$,]/g, "")) || 0;

  const mcap = parseNum(findVal("mcap:"));
  const liqRaw = findVal("liquidity:");
  const isPreGrad = liqRaw.includes("pre-grad");
  const liquidity = parseNum(liqRaw.replace(/\(pre-grad\)/, ""));

  const bsRaw = findVal("buys 5m:");
  const bsm = bsRaw.match(/(\d+)\s*\|\s*sells 5m:\s*(\d+)/);
  const buys5m = bsm ? parseInt(bsm[1]) : 0;
  const sells5m = bsm ? parseInt(bsm[2]) : 0;

  const chgRaw = findVal("chg 5m:");
  const chgm = chgRaw.match(/([-\d.]+)%\s*\|\s*chg 1h:\s*([-\d.]+)%/);
  const priceChange5m = chgm ? parseFloat(chgm[1]) : 0;
  const priceChange1h = chgm ? parseFloat(chgm[2]) : 0;

  const deployerAge = parseFloat(findVal("age:").replace(/\s*min.*/, "")) || 0;
  const trenchlensScore = parseFloat(findVal("score:")) || 0;

  const socialRaw = findVal("social:");
  const social = socialRaw && socialRaw !== "none"
    ? socialRaw.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const rfRaw = findVal("red flags:");
  const redFlags = rfRaw && rfRaw !== "none"
    ? rfRaw.split(" | ").map(s => s.trim()).filter(Boolean)
    : [];

  const gfRaw = findVal("green flags:");
  const greenFlags = gfRaw
    ? gfRaw.split(" | ").map(s => s.trim()).filter(Boolean)
    : [];

  // Parse worker using indexOf for em-dash
  const parseWorker = (name: string): { score: number; reasoning: string } => {
    const l = lines.find(l => l.trim().startsWith(name + ":") && l.includes(EM));
    if (!l) return { score: 0, reasoning: "timeout" };
    const t = l.trim();
    const colonIdx = t.indexOf(":");
    const afterColon = t.slice(colonIdx + 1).trim();
    const dashIdx = afterColon.indexOf(EM);
    if (dashIdx === -1) return { score: 0, reasoning: "no dash" };
    const scorePart = afterColon.slice(0, dashIdx).trim();
    const reasonPart = afterColon.slice(dashIdx + 1).trim();
    return {
      score: parseFloat(scorePart) || 0,
      reasoning: reasonPart.replace(/^"/, "").replace(/"$/, ""),
    };
  };

  // Parse coordinator using indexOf for em-dash
  const parseCoord = (name: string): { decision: string; argument: string; citedFlags: string[] } => {
    const l = lines.find(l => l.trim().startsWith(name + ":") && l.includes(EM));
    if (!l) return { decision: "skip", argument: "not found", citedFlags: [] };
    const t = l.trim();
    const colonIdx = t.indexOf(":");
    const afterColon = t.slice(colonIdx + 1).trim();
    const dashIdx = afterColon.indexOf(EM);
    if (dashIdx === -1) return { decision: "skip", argument: "no dash", citedFlags: [] };
    const decPart = afterColon.slice(0, dashIdx).trim();
    const argPart = afterColon.slice(dashIdx + 1).trim();
    return {
      decision: decPart === "fire" ? "fire" : "skip",
      argument: argPart.replace(/^"/, "").replace(/"$/, ""),
      citedFlags: [],
    };
  };

  const haruspex = parseWorker("Haruspex");
  const auspex = parseWorker("Auspex");
  const chronos = parseWorker("Chronos");
  const fas = parseCoord("Fas");
  const nefas = parseCoord("Nefas");

  // Consensus
  let consensus: string;
  if (fas.decision === "fire" && nefas.decision === "fire") consensus = "fire";
  else if (fas.decision === "skip" && nefas.decision === "skip") consensus = "skip";
  else consensus = "split";

  const decision = consensus === "fire" ? "FIRE" : "SKIP";

  const correct =
    (decision === "FIRE" && (outcome === "hit" || outcome === "good")) ||
    (decision === "SKIP" && (outcome === "loss" || outcome === "rug"));

  const costLine = lines.find(l => l.trim().startsWith("Cost:"));
  const cost = costLine ? costLine.trim().replace("Cost:", "").trim() : "$0.0000";

  readings.push({
    candidate: {
      symbol, outcome, marketCap: mcap, buys5m, sells5m, liquidity,
      isGraduated: !isPreGrad && liquidity > 0,
      deployerAge, social, redFlags, greenFlags, trenchlensScore,
      priceChange5m, priceChange1h,
    },
    workers: { haruspex, auspex, chronos },
    fas, nefas,
    verdict: { consensus, decision, outcome, correct },
    cost,
  });
}

mkdirSync("landing/data", { recursive: true });
writeFileSync("landing/data/phase2-readings.json", JSON.stringify(readings, null, 2));

// Report
console.log(`${readings.length} readings parsed`);
const hScores = readings.map(r => r.workers.haruspex.score);
console.log(`Score range (haruspex): ${Math.min(...hScores)} - ${Math.max(...hScores)}`);
console.log(`Fires: ${readings.filter(r => r.verdict.decision === "FIRE").length}`);
console.log(`Splits: ${readings.filter(r => r.verdict.consensus === "split").length}`);

const laika = readings.find(r => r.candidate.symbol === "LAIKA");
if (laika) {
  console.log(`LAIKA: h=${laika.workers.haruspex.score} a=${laika.workers.auspex.score} c=${laika.workers.chronos.score} fas=${laika.fas.decision} nefas=${laika.nefas.decision}`);
}
