"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import replayReadings from "../../data/phase2-readings.json";
import { AuguryWebSocket, fetchRecentReadings, type AuguryReading, type WsStatus } from "../../lib/augury-ws";

// ── Types ──────────────────────────────────────────────────────────

type Phase = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "loop-end";

interface State {
  candidateIdx: number;
  phase: Phase;
  paused: boolean;
  typedChars: number;
  lineIdx: number;
  workerIdx: number;
  workerChars: number;
  fasChars: number;
  nefasChars: number;
  showDecision: boolean;
}

type Action =
  | { type: "tick" }
  | { type: "setPhase"; phase: Phase }
  | { type: "nextCandidate" }
  | { type: "prevCandidate" }
  | { type: "restart" }
  | { type: "togglePause" }
  | { type: "typeChar" }
  | { type: "typeLine" }
  | { type: "typeWorkerChar" }
  | { type: "nextWorker" }
  | { type: "typeFasChar" }
  | { type: "typeNefasChar" }
  | { type: "showDecision" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setPhase":
      return { ...state, phase: action.phase, typedChars: 0, lineIdx: 0, workerIdx: 0, workerChars: 0, fasChars: 0, nefasChars: 0, showDecision: false };
    case "nextCandidate":
      return { ...state, candidateIdx: state.candidateIdx + 1, phase: "A", typedChars: 0, lineIdx: 0, workerIdx: 0, workerChars: 0, fasChars: 0, nefasChars: 0, showDecision: false };
    case "prevCandidate":
      return { ...state, candidateIdx: Math.max(0, state.candidateIdx - 1), phase: "A", typedChars: 0, lineIdx: 0, workerIdx: 0, workerChars: 0, fasChars: 0, nefasChars: 0, showDecision: false };
    case "restart":
      return { ...state, candidateIdx: 0, phase: "A", typedChars: 0, lineIdx: 0, workerIdx: 0, workerChars: 0, fasChars: 0, nefasChars: 0, showDecision: false, paused: false };
    case "togglePause":
      return { ...state, paused: !state.paused };
    case "typeChar":
      return { ...state, typedChars: state.typedChars + 1 };
    case "typeLine":
      return { ...state, lineIdx: state.lineIdx + 1 };
    case "typeWorkerChar":
      return { ...state, workerChars: state.workerChars + 1 };
    case "nextWorker":
      return { ...state, workerIdx: state.workerIdx + 1, workerChars: 0 };
    case "typeFasChar":
      return { ...state, fasChars: state.fasChars + 1 };
    case "typeNefasChar":
      return { ...state, nefasChars: state.nefasChars + 1 };
    case "showDecision":
      return { ...state, showDecision: true };
    default:
      return state;
  }
}

const initial: State = {
  candidateIdx: 0, phase: "A", paused: false,
  typedChars: 0, lineIdx: 0, workerIdx: 0, workerChars: 0,
  fasChars: 0, nefasChars: 0, showDecision: false,
};

// ── Helpers ────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.7) return "text-bone";
  if (score >= 0.4) return "text-patina";
  return "text-ash";
}

function scoreGlow(score: number): string {
  if (score >= 0.7) return "drop-shadow-[0_0_8px_rgba(245,241,232,0.3)]";
  return "";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ── Component ──────────────────────────────────────────────────────

// Normalize live reading to match replay shape
function normalizeLiveReading(r: AuguryReading) {
  return {
    candidate: {
      ...r.candidate,
      outcome: "pending" as const,
      social: [] as string[],
    },
    workers: r.workers,
    fas: r.fas,
    nefas: r.nefas,
    verdict: {
      consensus: r.verdict.consensus,
      decision: r.verdict.decision,
      outcome: "pending",
      correct: false,
    },
    cost: `$${r.cost.toFixed(4)}`,
  };
}

export default function ObservatoryPage() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReduced = useRef(false);

  // Live mode state
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveReadings, setLiveReadings] = useState<ReturnType<typeof normalizeLiveReading>[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<AuguryWebSocket | null>(null);
  const liveQueueRef = useRef<ReturnType<typeof normalizeLiveReading>[]>([]);

  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // WebSocket lifecycle
  useEffect(() => {
    if (mode !== "live") return;
    if (wsRef.current) return; // already connected

    const ws = new AuguryWebSocket();
    wsRef.current = ws;

    ws.onStatusChange = (status) => setWsStatus(status);
    ws.onMessage = (reading) => {
      const normalized = normalizeLiveReading(reading);
      setLiveReadings((prev) => {
        const next = [...prev, normalized];
        if (next.length > 20) next.shift();
        return next;
      });
      liveQueueRef.current.push(normalized);
    };

    // Backfill recent readings
    fetchRecentReadings(5).then((recent) => {
      if (recent.length > 0) {
        setLiveReadings(recent.map(normalizeLiveReading));
      }
    });

    ws.connect();
    return () => { ws.destroy(); wsRef.current = null; };
  }, [mode]);

  // Determine active readings source and current reading
  const readings = mode === "replay" ? replayReadings : liveReadings;
  const TOTAL = readings.length;
  const safeIdx = TOTAL > 0 ? state.candidateIdx % TOTAL : 0;
  const reading = TOTAL > 0 ? readings[safeIdx] : null;
  // Safe: c and w are only accessed inside JSX branches where reading !== null
  const c = reading?.candidate ?? { symbol: "", outcome: "pending", marketCap: 0, buys5m: 0, sells5m: 0, liquidity: 0, isGraduated: false, deployerAge: 0, social: [] as string[], redFlags: [] as string[], greenFlags: [] as string[], trenchlensScore: 0, priceChange5m: 0, priceChange1h: 0 };
  const w = reading?.workers ?? { haruspex: { score: 0, reasoning: "" }, auspex: { score: 0, reasoning: "" }, chronos: { score: 0, reasoning: "" } };
  const isSplit = reading ? reading.fas.decision !== reading.nefas.decision : false;

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Phase advancement engine
  const advancePhase = useCallback((nextPhase: Phase, delayMs: number) => {
    timerRef.current = setTimeout(() => {
      dispatch({ type: "setPhase", phase: nextPhase });
    }, delayMs);
  }, []);

  // Clear intervals on phase change
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (state.paused) return;

    const reduced = prefersReduced.current;

    if (!reading) return; // No reading available yet (live mode, empty)

    switch (state.phase) {
      case "A": {
        const headerText = `\u2192 reading $${c.symbol}`;
        if (reduced) {
          dispatch({ type: "setPhase", phase: "B" });
          return;
        }
        intervalRef.current = setInterval(() => {
          if (state.typedChars < headerText.length) dispatch({ type: "typeChar" });
          else { clearInterval(intervalRef.current!); advancePhase("B", 400); }
        }, 30);
        break;
      }
      case "B": {
        if (reduced) { advancePhase("C", 100); return; }
        const totalLines = 10;
        intervalRef.current = setInterval(() => {
          if (state.lineIdx < totalLines) dispatch({ type: "typeLine" });
          else { clearInterval(intervalRef.current!); advancePhase("C", 200); }
        }, 90);
        break;
      }
      case "C": {
        advancePhase("D", reduced ? 100 : 1200);
        break;
      }
      case "D": {
        if (reduced) { advancePhase("E", 100); return; }
        const workers = [w.haruspex, w.auspex, w.chronos];
        const currentWorker = workers[state.workerIdx];
        if (!currentWorker) { advancePhase("E", 200); return; }
        const maxChars = Math.min(currentWorker.reasoning.length, 120);
        intervalRef.current = setInterval(() => {
          if (state.workerChars < maxChars) dispatch({ type: "typeWorkerChar" });
          else {
            clearInterval(intervalRef.current!);
            if (state.workerIdx < 2) {
              timerRef.current = setTimeout(() => dispatch({ type: "nextWorker" }), 400);
            } else {
              advancePhase("E", 400);
            }
          }
        }, 22);
        break;
      }
      case "E": {
        if (reduced) { advancePhase("F", 100); return; }
        const fasLen = Math.min(reading.fas.argument.length, 150);
        const nefasLen = Math.min(reading.nefas.argument.length, 150);
        if (state.fasChars < fasLen) {
          intervalRef.current = setInterval(() => {
            if (state.fasChars < fasLen) dispatch({ type: "typeFasChar" });
            else { clearInterval(intervalRef.current!); }
          }, 22);
        } else if (state.nefasChars < nefasLen) {
          intervalRef.current = setInterval(() => {
            if (state.nefasChars < nefasLen) dispatch({ type: "typeNefasChar" });
            else { clearInterval(intervalRef.current!); advancePhase("F", 300); }
          }, 22);
        } else {
          advancePhase("F", 300);
        }
        break;
      }
      case "F": {
        if (!state.showDecision) {
          timerRef.current = setTimeout(() => dispatch({ type: "showDecision" }), reduced ? 0 : 400);
        } else {
          advancePhase("G", reduced ? 500 : 2000);
        }
        break;
      }
      case "G": {
        if (mode === "live") {
          // In live mode, wait for next reading from queue
          timerRef.current = setTimeout(() => {
            if (liveQueueRef.current.length > 0) {
              dispatch({ type: "nextCandidate" });
            }
          }, 2000);
        } else if (safeIdx >= TOTAL - 1) {
          advancePhase("loop-end", 2000);
        } else {
          timerRef.current = setTimeout(() => dispatch({ type: "nextCandidate" }), 2000);
        }
        break;
      }
      case "loop-end": {
        timerRef.current = setTimeout(() => dispatch({ type: "restart" }), 3000);
        break;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.phase, state.paused, state.typedChars, state.lineIdx, state.workerIdx, state.workerChars, state.fasChars, state.nefasChars, state.showDecision, state.candidateIdx, c.symbol, w, reading, advancePhase, mode, TOTAL, safeIdx]);

  // Data rows for Phase B
  const dataRows = [
    ["MARKET CAP", `$${fmt(c.marketCap)}`],
    ["GRADUATED", c.isGraduated ? "yes" : "no"],
    ["BUYS 5M", String(c.buys5m)],
    ["SELLS 5M", String(c.sells5m)],
    ["LIQUIDITY", `$${fmt(c.liquidity)}`],
    ["DEPLOYER AGE", `${Math.round(c.deployerAge)} min`],
    ["SOCIAL", c.social.length > 0 ? c.social.join(", ") : "none"],
    ["RED FLAGS", c.redFlags.length > 0 ? c.redFlags.slice(0, 2).join(", ") : "none"],
    ["GREEN FLAGS", c.greenFlags.length > 0 ? c.greenFlags.slice(0, 3).join(", ") : "none"],
    ["TL SCORE", String(c.trenchlensScore)],
  ];

  const workerNames = ["HARUSPEX", "AUSPEX", "CHRONOS"] as const;
  const workerData = [w.haruspex, w.auspex, w.chronos];

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const fireCount = readings.filter((r: typeof readings[number]) => r.verdict.decision === "FIRE").length;

  return (
    <main className="min-h-screen bg-obsidian relative">
      {/* Radial gradient overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top center, rgba(22,22,29,0.4), transparent 60%)" }} />

      <div className="relative z-10 flex flex-col items-center px-4 py-12 md:py-16">
        {/* Header */}
        <h1 className="font-cinzel text-4xl md:text-[56px] font-semibold text-bone tracking-[0.1em]">
          AUGURY
        </h1>
        <p className="mt-3 font-mono text-[13px] text-patina/70 uppercase tracking-[0.15em]">
          lee la bandada
        </p>
        {/* Hairline divider with ornament */}
        <div className="mt-6 flex items-center w-[60%] max-w-[400px]">
          <div className="flex-1 h-px bg-oxblood/30" />
          <span className="px-3 text-oxblood/50 text-xs">&#9671;</span>
          <div className="flex-1 h-px bg-oxblood/30" />
        </div>

        {/* Mode toggle */}
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => { setMode("replay"); dispatch({ type: "restart" }); }}
            className={`font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-1.5 rounded transition-all duration-150 ${
              mode === "replay" ? "bg-bone text-obsidian font-semibold" : "border border-basalt text-ash hover:border-patina hover:text-bone"
            }`}
          >
            Replay
          </button>
          <button
            onClick={() => setMode("live")}
            className={`font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-1.5 rounded transition-all duration-150 ${
              mode === "live" ? "bg-bone text-obsidian font-semibold" : "border border-basalt text-ash hover:border-patina hover:text-bone"
            }`}
          >
            Live
          </button>
          {mode === "live" && (
            <span className="flex items-center gap-1.5 ml-2">
              <span className={`w-2 h-2 rounded-full ${
                wsStatus === "connected" ? "bg-green-500" :
                wsStatus === "connecting" ? "bg-patina animate-pulse" :
                "bg-red-500"
              }`} />
              <span className="font-mono text-[10px] text-ash">
                {wsStatus === "connected" ? "live" :
                 wsStatus === "connecting" ? "connecting\u2026" :
                 "reconnecting\u2026"}
              </span>
            </span>
          )}
        </div>

        {/* Session bar */}
        <div className="mt-4 w-full max-w-[1080px] flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500/80 animate-pulse" />
            <span className="font-mono text-[10px] text-ash uppercase tracking-[0.2em]">Session active</span>
          </div>
          <span className="font-mono text-[10px] text-ash uppercase tabular-nums">{mm}:{ss}</span>
        </div>

        {/* Terminal window */}
        <div className="mt-3 w-full max-w-[1080px] rounded-md border border-oxblood/20 bg-black shadow-[0_0_80px_rgba(139,30,30,0.05),0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top bar */}
          <div className="h-9 border-b border-basalt flex items-center px-4">
            <div className="flex gap-1.5">
              <span className="w-[9px] h-[9px] rounded-full bg-oxblood/60" />
              <span className="w-[9px] h-[9px] rounded-full bg-patina/60" />
              <span className="w-[9px] h-[9px] rounded-full bg-bone/40" />
            </div>
            <span className="flex-1 text-center font-mono text-[11px] text-ash tracking-[0.05em]">
              augur://observatory
            </span>
            <span className="font-mono text-[10px] text-ash uppercase tabular-nums">
              Reading {String(safeIdx + 1).padStart(2, "0")} / {TOTAL || "—"}
            </span>
          </div>

          {/* Terminal body */}
          <div className="p-6 md:p-8 min-h-[560px] font-mono text-sm leading-relaxed text-bone overflow-y-auto">
            {!reading ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <p className="text-ash text-sm">&rarr; awaiting first reading from the flock</p>
                <p className="text-ash animate-pulse">&#9646;</p>
                <p className="text-ash text-[11px]">live mode &middot; webhook listener active</p>
              </div>
            ) : state.phase === "loop-end" ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <p className="text-ash uppercase text-[11px] tracking-[0.1em]">&mdash;&mdash; cycle complete &mdash;&mdash;</p>
                <p className="font-mono text-[10px] text-ash tabular-nums">
                  20 readings &middot; {fireCount} fires &middot; 0 false positives &middot; $0.017 cost
                </p>
              </div>
            ) : (
              <>
                {/* Phase A: Header */}
                {state.phase >= "A" && (
                  <div className="mb-4">
                    <p className="text-bone">
                      {`\u2192 reading $${c.symbol}`.slice(0, state.phase === "A" ? state.typedChars : 999)}
                      {state.phase === "A" && <span className="animate-pulse text-ash">&#9646;</span>}
                    </p>
                    {(state.phase > "A" || state.typedChars > `\u2192 reading $${c.symbol}`.length - 1) && (
                      <>
                        <div className="h-px bg-oxblood/40 mt-1 transition-all duration-300" />
                        <p className="text-ash text-xs mt-1">
                          outcome class: {c.isGraduated ? "graduated" : "pre-graduation"} &middot; {c.redFlags.length === 0 ? "no red flags" : `${c.redFlags.length} red flag${c.redFlags.length > 1 ? "s" : ""}`}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Phase B: Data block */}
                {state.phase >= "B" && state.phase !== "A" && (
                  <div className="my-6 border-t border-b border-basalt py-4">
                    {dataRows.map(([key, val], i) => (
                      (state.phase > "B" || state.lineIdx > i) && (
                        <div key={key} className="flex gap-4 py-0.5 animate-[fadeSlide_0.2s_ease-out]">
                          <span className="w-32 text-ash text-xs uppercase tracking-[0.1em] shrink-0">{key}</span>
                          <span className="text-bone text-sm tabular-nums">{val}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Phase C: Swarm reads */}
                {state.phase === "C" && (
                  <p className="text-patina text-[13px] italic my-4">
                    &rarr; the swarm reads<span className="animate-pulse">...</span>
                  </p>
                )}

                {/* Phase D: Workers */}
                {state.phase >= "D" && state.phase !== "A" && state.phase !== "B" && state.phase !== "C" && (
                  <div className="my-4 space-y-3">
                    {workerData.map((worker, i) => {
                      if (state.phase === "D" && i > state.workerIdx) return null;
                      const maxChars = state.phase === "D" && i === state.workerIdx
                        ? state.workerChars
                        : Math.min(worker.reasoning.length, 120);
                      return (
                        <div key={workerNames[i]}>
                          <p>
                            <span className="text-ash">&#9656; </span>
                            <span className="text-bone uppercase tracking-[0.05em] text-xs">{workerNames[i]}</span>
                            {" "}
                            <span className={`tabular-nums ${scoreColor(worker.score)} ${scoreGlow(worker.score)}`}>
                              [{worker.score.toFixed(2)}]
                            </span>
                          </p>
                          <p className="pl-4 text-bone/85 text-[13px] break-words max-w-full">
                            {worker.reasoning.slice(0, maxChars)}
                            {state.phase === "D" && i === state.workerIdx && maxChars < worker.reasoning.length && (
                              <span className="animate-pulse text-ash">&#9646;</span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phase E: Adversarial */}
                {state.phase >= "E" && state.phase !== "A" && state.phase !== "B" && state.phase !== "C" && state.phase !== "D" && (
                  <div className={`my-4 border-t border-basalt pt-4 ${isSplit ? "border-l-2 border-l-oxblood/60 pl-3" : ""}`}>
                    <p className="text-bone uppercase text-[13px] tracking-[0.05em] mb-1">&#9656; Fas argues</p>
                    <p className={`pl-4 text-[13px] break-words max-w-full ${isSplit ? "text-patina" : "text-bone/85"}`}>
                      {reading.fas.argument.slice(0, state.phase === "E" ? state.fasChars : 150)}
                      {state.phase === "E" && state.fasChars < reading.fas.argument.length && state.nefasChars === 0 && (
                        <span className="animate-pulse text-ash">&#9646;</span>
                      )}
                    </p>
                    {(state.phase > "E" || state.fasChars >= Math.min(reading.fas.argument.length, 150)) && (
                      <>
                        <p className="text-bone uppercase text-[13px] tracking-[0.05em] mt-3 mb-1">&#9656; Nefas argues</p>
                        <p className={`pl-4 text-[13px] break-words max-w-full ${isSplit ? "text-oxblood" : "text-bone/85"}`}>
                          {reading.nefas.argument.slice(0, state.phase === "E" ? state.nefasChars : 150)}
                          {state.phase === "E" && state.nefasChars < reading.nefas.argument.length && (
                            <span className="animate-pulse text-ash">&#9646;</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Phase F: Decision */}
                {(state.phase === "F" || state.phase === "G") && state.showDecision && (
                  <div className="my-6 flex flex-col items-center">
                    <div className={`px-8 py-4 rounded border-[1.5px] text-center transition-all duration-400 ${
                      reading.verdict.decision === "FIRE"
                        ? "border-oxblood bg-gradient-to-b from-[rgba(139,30,30,0.08)] to-[rgba(139,30,30,0.04)]"
                        : "border-ash/60 bg-basalt/30"
                    }`} style={{ animation: "dropIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                      <p className="text-ash text-[10px] uppercase tracking-[0.2em]">Consensus</p>
                      <p className={`font-cinzel text-[22px] font-semibold mt-1 ${
                        reading.verdict.decision === "FIRE"
                          ? "text-oxblood drop-shadow-[0_0_12px_rgba(139,30,30,0.4)]"
                          : "text-ash"
                      }`}>
                        {reading.verdict.decision} &mdash; {c.symbol}
                      </p>
                    </div>
                    <p className="mt-3 font-mono text-[11px] text-ash">
                      outcome: {c.outcome}{" "}
                      <span className={reading.verdict.correct ? "text-patina" : "text-ash"}>
                        ({reading.verdict.correct ? "correct" : "missed"})
                      </span>
                    </p>
                  </div>
                )}

                {/* Phase G: Cursor blink */}
                {state.phase === "G" && (
                  <p className="text-ash animate-pulse mt-4">&#9646;</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {[
            { label: "\u27F2 RESTART", action: () => dispatch({ type: "restart" }) },
            { label: "\u25C0 PREV", action: () => dispatch({ type: "prevCandidate" }) },
            { label: state.paused ? "\u25B6 PLAY" : "\u23F8 PAUSE", action: () => dispatch({ type: "togglePause" }) },
            { label: "NEXT \u25B6", action: () => dispatch({ type: "nextCandidate" }) },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-ash border border-basalt rounded px-4 py-2 hover:text-bone hover:border-ash hover:bg-basalt/50 transition-all duration-150 active:scale-[0.97] cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="w-80 h-0.5 bg-basalt rounded overflow-hidden">
            <div className="h-full bg-oxblood transition-all duration-300" style={{ width: `${TOTAL > 0 ? ((safeIdx + 1) / TOTAL) * 100 : 0}%` }} />
          </div>
          <p className="font-mono text-[10px] text-ash">
            candidate {String(safeIdx + 1).padStart(2, "0")} / {TOTAL} &middot; {mode === "live" ? "live readings" : "phase 2 readings"}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 max-w-[680px] text-center space-y-0.5">
          {mode === "live" ? (
            <>
              <p className="font-mono text-[11px] text-ash leading-relaxed">live readings from solana memecoin graduations</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">events from helius webhook &middot; pump.fun graduations filter</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">gpt-4o-mini workers and coordinators via openrouter</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">all readings hashed for verifiability (provenance shipping next)</p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] text-ash leading-relaxed">replaying historical phase 2 results</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">20 stratified solana memecoin graduations</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">gpt-4o-mini workers and coordinators via openrouter</p>
              <p className="font-mono text-[11px] text-ash leading-relaxed">live mode now available &middot; toggle above</p>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a href="https://github.com/OxBenji/augury" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[10px] text-ash uppercase py-1.5 px-3 border border-basalt rounded hover:border-patina/60 hover:text-patina transition-all duration-150">
            github.com/OxBenji/augury
          </a>
          <a href="/"
            className="font-mono text-[10px] text-ash uppercase py-1.5 px-3 border border-basalt rounded hover:border-patina/60 hover:text-patina transition-all duration-150">
            home
          </a>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
