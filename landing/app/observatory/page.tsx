"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import replayReadings from "../../data/phase2-readings.json";
import { MurmurWebSocket, fetchRecentReadings, type MurmurReading, type WsStatus } from "../../lib/murmur-ws";

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
  if (score >= 0.7) return "text-accent";
  if (score >= 0.4) return "text-text";
  return "text-muted";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function normalizeLiveReading(r: MurmurReading) {
  return {
    candidate: { ...r.candidate, outcome: "pending" as const, social: [] as string[] },
    workers: r.workers,
    fas: r.fas,
    nefas: r.nefas,
    verdict: { consensus: r.verdict.consensus, decision: r.verdict.decision, outcome: "pending", correct: false },
    cost: `$${r.cost.toFixed(4)}`,
  };
}

// ── Component ──────────────────────────────────────────────────────

export default function ObservatoryPage() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReduced = useRef(false);

  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveReadings, setLiveReadings] = useState<ReturnType<typeof normalizeLiveReading>[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<MurmurWebSocket | null>(null);
  const liveQueueRef = useRef<ReturnType<typeof normalizeLiveReading>[]>([]);

  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // WebSocket lifecycle
  useEffect(() => {
    if (mode !== "live") return;
    if (wsRef.current) return;
    const ws = new MurmurWebSocket();
    wsRef.current = ws;
    ws.onStatusChange = (status) => setWsStatus(status);
    ws.onMessage = (reading) => {
      const normalized = normalizeLiveReading(reading);
      setLiveReadings((prev) => { const next = [...prev, normalized]; if (next.length > 20) next.shift(); return next; });
      liveQueueRef.current.push(normalized);
    };
    fetchRecentReadings(5).then((recent) => { if (recent.length > 0) setLiveReadings(recent.map(normalizeLiveReading)); });
    ws.connect();
    return () => { ws.destroy(); wsRef.current = null; };
  }, [mode]);

  const readings = mode === "replay" ? replayReadings : liveReadings;
  const TOTAL = readings.length;
  const safeIdx = TOTAL > 0 ? state.candidateIdx % TOTAL : 0;
  const reading = TOTAL > 0 ? readings[safeIdx] : null;
  const c = reading?.candidate ?? { symbol: "", outcome: "pending", marketCap: 0, buys5m: 0, sells5m: 0, liquidity: 0, isGraduated: false, deployerAge: 0, social: [] as string[], redFlags: [] as string[], greenFlags: [] as string[], trenchlensScore: 0, priceChange5m: 0, priceChange1h: 0 };
  const w = reading?.workers ?? { haruspex: { score: 0, reasoning: "" }, auspex: { score: 0, reasoning: "" }, chronos: { score: 0, reasoning: "" } };
  const isSplit = reading ? reading.fas.decision !== reading.nefas.decision : false;

  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);

  const advancePhase = useCallback((nextPhase: Phase, delayMs: number) => {
    timerRef.current = setTimeout(() => dispatch({ type: "setPhase", phase: nextPhase }), delayMs);
  }, []);

  // Phase engine
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (state.paused || !reading) return;
    const reduced = prefersReduced.current;

    switch (state.phase) {
      case "A": {
        const headerText = `> reading $${c.symbol}`;
        if (reduced) { dispatch({ type: "setPhase", phase: "B" }); return; }
        intervalRef.current = setInterval(() => {
          if (state.typedChars < headerText.length) dispatch({ type: "typeChar" });
          else { clearInterval(intervalRef.current!); advancePhase("B", 400); }
        }, 30);
        break;
      }
      case "B": {
        if (reduced) { advancePhase("C", 100); return; }
        intervalRef.current = setInterval(() => {
          if (state.lineIdx < 10) dispatch({ type: "typeLine" });
          else { clearInterval(intervalRef.current!); advancePhase("C", 200); }
        }, 90);
        break;
      }
      case "C": { advancePhase("D", reduced ? 100 : 1200); break; }
      case "D": {
        if (reduced) { advancePhase("E", 100); return; }
        const workers = [w.haruspex, w.auspex, w.chronos];
        const cw = workers[state.workerIdx];
        if (!cw) { advancePhase("E", 200); return; }
        const max = Math.min(cw.reasoning.length, 120);
        intervalRef.current = setInterval(() => {
          if (state.workerChars < max) dispatch({ type: "typeWorkerChar" });
          else { clearInterval(intervalRef.current!); if (state.workerIdx < 2) timerRef.current = setTimeout(() => dispatch({ type: "nextWorker" }), 400); else advancePhase("E", 400); }
        }, 22);
        break;
      }
      case "E": {
        if (reduced) { advancePhase("F", 100); return; }
        const fl = Math.min(reading.fas.argument.length, 150);
        const nl = Math.min(reading.nefas.argument.length, 150);
        if (state.fasChars < fl) {
          intervalRef.current = setInterval(() => { if (state.fasChars < fl) dispatch({ type: "typeFasChar" }); else clearInterval(intervalRef.current!); }, 22);
        } else if (state.nefasChars < nl) {
          intervalRef.current = setInterval(() => { if (state.nefasChars < nl) dispatch({ type: "typeNefasChar" }); else { clearInterval(intervalRef.current!); advancePhase("F", 300); } }, 22);
        } else { advancePhase("F", 300); }
        break;
      }
      case "F": {
        if (!state.showDecision) timerRef.current = setTimeout(() => dispatch({ type: "showDecision" }), reduced ? 0 : 400);
        else advancePhase("G", reduced ? 500 : 2000);
        break;
      }
      case "G": {
        if (mode === "live") {
          timerRef.current = setTimeout(() => { if (liveQueueRef.current.length > 0) dispatch({ type: "nextCandidate" }); }, 2000);
        } else if (safeIdx >= TOTAL - 1) { advancePhase("loop-end", 2000); }
        else { timerRef.current = setTimeout(() => dispatch({ type: "nextCandidate" }), 2000); }
        break;
      }
      case "loop-end": { timerRef.current = setTimeout(() => dispatch({ type: "restart" }), 3000); break; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.phase, state.paused, state.typedChars, state.lineIdx, state.workerIdx, state.workerChars, state.fasChars, state.nefasChars, state.showDecision, state.candidateIdx, c.symbol, w, reading, advancePhase, mode, TOTAL, safeIdx]);

  const dataRows = [
    ["market cap", `$${fmt(c.marketCap)}`],
    ["graduated", c.isGraduated ? "yes" : "no"],
    ["buys 5m", String(c.buys5m)],
    ["sells 5m", String(c.sells5m)],
    ["liquidity", `$${fmt(c.liquidity)}`],
    ["deployer age", `${Math.round(c.deployerAge)} min`],
    ["social", ("social" in c && Array.isArray(c.social) && c.social.length > 0) ? c.social.join(", ") : "none"],
    ["red flags", c.redFlags.length > 0 ? c.redFlags.slice(0, 2).join(", ") : "none"],
    ["green flags", c.greenFlags.length > 0 ? c.greenFlags.slice(0, 3).join(", ") : "none"],
    ["tl score", String(c.trenchlensScore)],
  ];

  const workerNames = ["haruspex", "auspex", "chronos"] as const;
  const workerData = [w.haruspex, w.auspex, w.chronos];
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const fireCount = readings.filter((r: typeof readings[number]) => r.verdict.decision === "FIRE").length;

  return (
    <main className="min-h-screen bg-bg">
      <div className="flex flex-col items-center px-4 py-12 md:py-16">
        {/* Header */}
        <h1 className="font-mono text-4xl md:text-[56px] font-medium text-text tracking-tight">
          murmur.
        </h1>
        <p className="mt-3 font-mono text-[13px] text-muted">
          the murmur reads.
        </p>
        <div className="mt-6 w-[60%] max-w-[400px] h-px bg-border" />

        {/* Mode toggle */}
        <div className="mt-6 flex items-center gap-2">
          <button onClick={() => { setMode("replay"); dispatch({ type: "restart" }); }}
            className={`font-mono text-[11px] px-4 py-1.5 rounded transition-all duration-150 ${mode === "replay" ? "bg-text text-bg font-semibold" : "border border-border text-muted hover:border-text hover:text-text"}`}>
            replay
          </button>
          <button onClick={() => setMode("live")}
            className={`font-mono text-[11px] px-4 py-1.5 rounded transition-all duration-150 ${mode === "live" ? "bg-text text-bg font-semibold" : "border border-border text-muted hover:border-text hover:text-text"}`}>
            live
          </button>
          {mode === "live" && (
            <span className="flex items-center gap-1.5 ml-2">
              <span className={`w-2 h-2 rounded-full ${wsStatus === "connected" ? "bg-green-500" : wsStatus === "connecting" ? "bg-accent animate-pulse" : "bg-red-500"}`} />
              <span className="font-mono text-[10px] text-muted">
                {wsStatus === "connected" ? "live" : wsStatus === "connecting" ? "connecting..." : "reconnecting..."}
              </span>
            </span>
          )}
        </div>

        {/* Session bar */}
        <div className="mt-4 w-full max-w-[1080px] flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500/80 animate-pulse" />
            <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">session active</span>
          </div>
          <span className="font-mono text-[10px] text-muted tabular-nums">{mm}:{ss}</span>
        </div>

        {/* Terminal */}
        <div className="mt-3 w-full max-w-[1080px] rounded border border-border bg-bg overflow-hidden">
          {/* Top bar */}
          <div className="h-9 border-b border-border flex items-center px-4">
            <div className="flex gap-1.5">
              <span className="w-[9px] h-[9px] rounded-full bg-muted/40" />
              <span className="w-[9px] h-[9px] rounded-full bg-muted/30" />
              <span className="w-[9px] h-[9px] rounded-full bg-muted/20" />
            </div>
            <span className="flex-1 text-center font-mono text-[11px] text-muted">
              murmur://observatory
            </span>
            <span className="font-mono text-[10px] text-muted tabular-nums">
              reading {String(safeIdx + 1).padStart(2, "0")} / {TOTAL || "\u2014"}
            </span>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 min-h-[560px] font-mono text-sm leading-relaxed text-text overflow-y-auto">
            {!reading ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <p className="text-muted text-sm">&gt; awaiting first reading from the flock</p>
                <p className="text-muted animate-pulse">&#9646;</p>
                <p className="text-muted text-[11px]">live mode &middot; webhook listener active</p>
              </div>
            ) : state.phase === "loop-end" ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <p className="text-muted text-[11px]">&mdash;&mdash; cycle complete &mdash;&mdash;</p>
                <p className="font-mono text-[10px] text-muted tabular-nums">
                  20 readings &middot; {fireCount} fires &middot; 0 false positives
                </p>
              </div>
            ) : (
              <>
                {/* Phase A */}
                {state.phase >= "A" && (
                  <div className="mb-4">
                    <p className="text-text">
                      {`> reading $${c.symbol}`.slice(0, state.phase === "A" ? state.typedChars : 999)}
                      {state.phase === "A" && <span className="animate-pulse text-muted">&#9646;</span>}
                    </p>
                    {(state.phase > "A" || state.typedChars > `> reading $${c.symbol}`.length - 1) && (
                      <>
                        <div className="h-px bg-border mt-1" />
                        <p className="text-muted text-xs mt-1">
                          {c.isGraduated ? "graduated" : "pre-graduation"} &middot; {c.redFlags.length === 0 ? "no red flags" : `${c.redFlags.length} red flag${c.redFlags.length > 1 ? "s" : ""}`}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Phase B */}
                {state.phase >= "B" && state.phase !== "A" && (
                  <div className="my-6 border-t border-b border-border py-4">
                    {dataRows.map(([key, val], i) => (
                      (state.phase > "B" || state.lineIdx > i) && (
                        <div key={key} className="flex gap-4 py-0.5">
                          <span className="w-32 text-muted text-xs uppercase shrink-0">{key}</span>
                          <span className="text-text text-sm tabular-nums">{val}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Phase C */}
                {state.phase === "C" && (
                  <p className="text-muted text-[13px] my-4">
                    &gt; the murmur reads<span className="animate-pulse">...</span>
                  </p>
                )}

                {/* Phase D */}
                {state.phase >= "D" && state.phase !== "A" && state.phase !== "B" && state.phase !== "C" && (
                  <div className="my-4 space-y-3">
                    {workerData.map((worker, i) => {
                      if (state.phase === "D" && i > state.workerIdx) return null;
                      const maxC = state.phase === "D" && i === state.workerIdx ? state.workerChars : Math.min(worker.reasoning.length, 120);
                      return (
                        <div key={workerNames[i]}>
                          <p>
                            <span className="text-muted">&#9656; </span>
                            <span className="text-text uppercase text-xs">{workerNames[i]}</span>
                            {" "}
                            <span className={`tabular-nums ${scoreColor(worker.score)}`}>[{worker.score.toFixed(2)}]</span>
                          </p>
                          <p className="pl-4 text-text/85 text-[13px] break-words max-w-full">
                            {worker.reasoning.slice(0, maxC)}
                            {state.phase === "D" && i === state.workerIdx && maxC < worker.reasoning.length && <span className="animate-pulse text-muted">&#9646;</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phase E */}
                {state.phase >= "E" && state.phase !== "A" && state.phase !== "B" && state.phase !== "C" && state.phase !== "D" && (
                  <div className={`my-4 border-t border-border pt-4 ${isSplit ? "border-l-2 border-l-accent/60 pl-3" : ""}`}>
                    <p className="text-text uppercase text-[13px] mb-1">&#9656; fas &middot; the bull</p>
                    <p className="pl-4 text-[13px] break-words max-w-full text-text/85">
                      {reading.fas.argument.slice(0, state.phase === "E" ? state.fasChars : 150)}
                      {state.phase === "E" && state.fasChars < reading.fas.argument.length && state.nefasChars === 0 && <span className="animate-pulse text-muted">&#9646;</span>}
                    </p>
                    {(state.phase > "E" || state.fasChars >= Math.min(reading.fas.argument.length, 150)) && (
                      <>
                        <p className="text-text uppercase text-[13px] mt-3 mb-1">&#9656; nefas &middot; the bear</p>
                        <p className="pl-4 text-[13px] break-words max-w-full text-text/85">
                          {reading.nefas.argument.slice(0, state.phase === "E" ? state.nefasChars : 150)}
                          {state.phase === "E" && state.nefasChars < reading.nefas.argument.length && <span className="animate-pulse text-muted">&#9646;</span>}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Phase F */}
                {(state.phase === "F" || state.phase === "G") && state.showDecision && (
                  <div className="my-6 flex flex-col items-center">
                    <div className={`px-8 py-4 rounded text-center border ${
                      reading.verdict.decision === "FIRE"
                        ? "border-accent bg-panel"
                        : "border-border bg-panel"
                    }`}>
                      <p className="text-muted text-[10px] uppercase tracking-[0.2em]">consensus</p>
                      <p className={`font-mono text-[22px] font-semibold mt-1 ${
                        reading.verdict.decision === "FIRE" ? "text-accent" : "text-muted"
                      }`}>
                        {reading.verdict.decision} &middot; {c.symbol}
                      </p>
                    </div>
                    <p className="mt-3 font-mono text-[11px] text-muted">
                      outcome: {c.outcome}{" "}
                      <span className={reading.verdict.correct ? "text-accent" : "text-muted"}>
                        ({reading.verdict.correct ? "correct" : "missed"})
                      </span>
                    </p>
                  </div>
                )}

                {state.phase === "G" && <p className="text-muted animate-pulse mt-4">&#9646;</p>}
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {[
            { label: "restart", action: () => dispatch({ type: "restart" }) },
            { label: "prev", action: () => dispatch({ type: "prevCandidate" }) },
            { label: state.paused ? "play" : "pause", action: () => dispatch({ type: "togglePause" }) },
            { label: "next", action: () => dispatch({ type: "nextCandidate" }) },
          ].map(({ label, action }) => (
            <button key={label} onClick={action}
              className="font-mono text-[11px] text-muted border border-border rounded px-4 py-2 hover:text-text hover:border-text hover:bg-panel transition-all duration-150 active:scale-[0.97] cursor-pointer">
              {label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="w-80 h-0.5 bg-border rounded overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${TOTAL > 0 ? ((safeIdx + 1) / TOTAL) * 100 : 0}%` }} />
          </div>
          <p className="font-mono text-[10px] text-muted">
            candidate {String(safeIdx + 1).padStart(2, "0")} / {TOTAL} &middot; {mode === "live" ? "live readings" : "phase 2 readings"}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 max-w-[680px] text-center space-y-0.5">
          {mode === "live" ? (
            <>
              <p className="font-mono text-[11px] text-muted">live readings from solana memecoin graduations</p>
              <p className="font-mono text-[11px] text-muted">events via helius webhook &middot; pump.fun graduations</p>
              <p className="font-mono text-[11px] text-muted">gpt-4o-mini workers and coordinators via openrouter</p>
              <p className="font-mono text-[11px] text-muted">provenance hashing ships next week</p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] text-muted">replaying historical phase 2 results</p>
              <p className="font-mono text-[11px] text-muted">20 stratified solana memecoin graduations</p>
              <p className="font-mono text-[11px] text-muted">gpt-4o-mini workers and coordinators via openrouter</p>
              <p className="font-mono text-[11px] text-muted">live mode available &middot; toggle above</p>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a href="https://github.com/OxBenji/augury" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted py-1.5 px-3 border border-border rounded hover:border-accent hover:text-accent transition-all duration-150">
            github.com/oxbenji/murmur
          </a>
          <a href="/" className="font-mono text-[10px] text-muted py-1.5 px-3 border border-border rounded hover:border-accent hover:text-accent transition-all duration-150">
            home
          </a>
        </div>
      </div>
    </main>
  );
}
