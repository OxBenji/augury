import { Murmuration } from "@/components/Murmuration";
import { AgentCard } from "@/components/AgentCard";
import { Mechanism } from "@/components/Mechanism";
import { MirrorSection } from "@/components/MirrorSection";

const agents = [
  {
    name: "Lituus",
    spanishName: "Lituo",
    role: "sky-quadrant filter",
    model: "deterministic",
    description: "deterministic gate. no oracle needed to draw the quadrant.",
  },
  {
    name: "Haruspex",
    spanishName: "The Anatomist",
    role: "reader of internals",
    model: "gpt-4o-mini",
    description: "examines holder patterns, wallet lineage, and deployer history.",
  },
  {
    name: "Auspex",
    spanishName: "The Watcher",
    role: "watcher of voices",
    model: "gpt-4o-mini",
    description: "listens to the social canopy. separates signal from coordinated noise.",
  },
  {
    name: "Chronos",
    spanishName: "The Clock",
    role: "keeper of flow",
    model: "gpt-4o-mini",
    description: "watches volume, depth, and the rhythm of liquidity.",
  },
  {
    name: "Fas",
    spanishName: "The Bull",
    role: "the divine yes",
    model: "gpt-4o-mini",
    description: "argues the strongest case to fire. must name what it cannot explain.",
  },
  {
    name: "Nefas",
    spanishName: "The Bear",
    role: "the divine no",
    model: "gpt-4o-mini",
    description: "argues the strongest case to pass. must name what it cannot dismiss.",
  },
  {
    name: "Sibyl",
    spanishName: "The Scorer",
    role: "keeper of the record",
    model: "gpt-4o-mini",
    description: "scores every reading against what actually happened. recalibrates weekly.",
  },
  {
    name: "Speculum",
    spanishName: "The Mirror",
    role: "the backward mirror",
    model: "gpt-4o-mini",
    description: "backtests the flock against history. the mirror that does not flatter.",
  },
  {
    name: "Vates",
    spanishName: "The Lightning Reader",
    role: "the lightning-reader",
    model: "deterministic",
    description: "reads on-chain signals the archive does not see. lp burn, honeypot status, smart wallets, dev silence.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      {/* ── 1. Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <Murmuration />
        </div>
        <div className="relative z-10 text-center">
          <h1 className="font-mono text-5xl sm:text-7xl md:text-8xl font-medium text-text tracking-tight">
            murmur.
          </h1>
          <p className="mt-4 text-muted text-lg sm:text-xl font-mono tracking-wide">
            the murmur reads.
          </p>
          <p className="mt-6 text-text/60 text-sm sm:text-base font-mono max-w-lg mx-auto">
            adversarial-swarm intelligence infrastructure.
            reads chaotic systems. produces verifiable readings.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/OxBenji/augury"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-accent text-bg text-sm font-mono tracking-wide hover:bg-accent/80 transition-colors"
            >
              source
            </a>
            <a
              href="/observatory"
              className="inline-block px-8 py-3 border border-border text-muted text-sm font-mono tracking-wide hover:border-text hover:text-text transition-all duration-150"
            >
              observatory →
            </a>
          </div>
        </div>
      </section>

      {/* ── 2. The Reading ───────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center border-t border-border">
        <p className="text-text/80 text-base leading-relaxed font-mono">
          murmur is a swarm of specialist AI agents reading onchain markets.
          nine agents. each with one role. together they form a reading — a
          single judgment delivered only when the bull (Fas) and the
          bear (Nefas) agree.
        </p>
        <p className="text-muted text-sm mt-4 font-mono">
          built on elizaOS. open source.
        </p>
      </section>

      {/* ── 3. The Flock ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-border">
        <h2 className="font-mono text-2xl text-center tracking-wide mb-12 text-muted">
          the flock
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.name} {...agent} />
          ))}
        </div>
      </section>

      {/* ── 4. The Mechanism ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24 border-t border-border">
        <h2 className="font-mono text-2xl text-center tracking-wide mb-12 text-muted">
          the mechanism
        </h2>
        <Mechanism />
      </section>

      {/* ── 5. The Mirror ────────────────────────────────────────── */}
      <MirrorSection />

      {/* ── 6. The Stack ─────────────────────────────────────────── */}
      <section className="py-20 text-center border-t border-border">
        <div className="flex flex-col gap-4 items-center">
          <a href="https://elizaos.ai" target="_blank" rel="noopener noreferrer"
            className="font-mono text-sm text-muted hover:text-text transition-colors">
            built on elizaOS
          </a>
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer"
            className="font-mono text-sm text-muted hover:text-text transition-colors">
            reasoning via openrouter
          </a>
          <a href="https://solana.com" target="_blank" rel="noopener noreferrer"
            className="font-mono text-sm text-muted hover:text-text transition-colors">
            solana-native
          </a>
        </div>
      </section>

      {/* ── 7. Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10 text-center text-sm text-muted font-mono">
        <p>
          built by{" "}
          <a href="https://x.com/litboy11" className="text-text hover:underline hover:decoration-accent"
            target="_blank" rel="noopener noreferrer">
            @litboy11
          </a>
          {" "}·{" "}
          <a href="https://github.com/OxBenji/augury" className="text-text hover:underline hover:decoration-accent"
            target="_blank" rel="noopener noreferrer">
            source
          </a>
          {" "}·{" "}
          <a href="https://x.com/litboy11" className="text-text hover:underline hover:decoration-accent"
            target="_blank" rel="noopener noreferrer">
            built in public
          </a>
        </p>
      </footer>
    </main>
  );
}
