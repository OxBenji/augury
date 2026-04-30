import { Murmuration } from "@/components/Murmuration";
import { AgentCard } from "@/components/AgentCard";
import { Mechanism } from "@/components/Mechanism";
import { MirrorSection } from "@/components/MirrorSection";

const agents = [
  {
    name: "Lituus",
    spanishName: "Lituo",
    role: "Sky-quadrant filter",
    model: "Deterministic",
    description: "Deterministic gate. No oracle needed to draw the quadrant.",
  },
  {
    name: "Haruspex",
    spanishName: "Har\u00FAspice",
    role: "Reader of internals",
    model: "Haiku",
    description: "Examines holder patterns, wallet lineage, and deployer history.",
  },
  {
    name: "Auspex",
    spanishName: "\u00C1uspice",
    role: "Watcher of voices",
    model: "Haiku",
    description: "Listens to the social canopy. Separates signal from coordinated noise.",
  },
  {
    name: "Chronos",
    spanishName: "Cronos",
    role: "Keeper of flow",
    model: "Haiku",
    description: "Watches volume, depth, and the rhythm of liquidity.",
  },
  {
    name: "Fas",
    spanishName: "Fas",
    role: "The divine yes",
    model: "Sonnet",
    description: "Argues the strongest case to fire. Must name what it cannot explain.",
  },
  {
    name: "Nefas",
    spanishName: "Nefas",
    role: "The divine no",
    model: "Sonnet",
    description: "Argues the strongest case to pass. Must name what it cannot dismiss.",
  },
  {
    name: "Sibyl",
    spanishName: "Sibila",
    role: "Keeper of the record",
    model: "Haiku",
    description: "Scores every reading against what actually happened. Recalibrates weekly.",
  },
  {
    name: "Speculum",
    spanishName: "Esp\u00E9culo",
    role: "The backward mirror",
    model: "Haiku",
    description: "Backtests the flock against history. The mirror that does not flatter.",
  },
  {
    name: "Vates",
    spanishName: "Vates",
    role: "The lightning-reader",
    model: "Deterministic",
    description: "Reads on-chain signals the archive does not see. LP burn, honeypot status, smart wallets, dev silence.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ── 1. Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <Murmuration />
        </div>
        <div className="relative z-10 text-center">
          <h1 className="font-cinzel text-5xl sm:text-7xl md:text-8xl tracking-[0.15em] text-bone">
            AUGURY
          </h1>
          <p className="mt-4 text-ash text-lg sm:text-xl font-geist tracking-wide uppercase">
            Read the swarm.
          </p>
          <p className="mt-2 font-cinzel text-patina text-xs sm:text-sm tracking-[0.25em] uppercase">
            lee la bandada
          </p>
          <p className="mt-3 text-bone/60 text-sm sm:text-base font-geist max-w-md mx-auto">
            A flock of agents reading onchain markets in adversarial consensus.
          </p>
          <a
            href="https://github.com/OxBenji/augury"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Augury source code on GitHub"
            className="inline-block mt-10 px-10 py-3.5 bg-oxblood text-bone text-sm font-cinzel tracking-widest uppercase hover:bg-oxblood/80 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* ── 2. The Reading ───────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-bone/80 text-lg leading-relaxed font-geist">
          Augury is a swarm of specialist AI agents reading onchain markets.
          Nine agents. Each with one role. Together they form a reading — a
          single judgment delivered only when the divine yes (Fas) and the
          divine no (Nefas) agree.
        </p>
        <p className="text-bone/60 text-base mt-4 font-geist">
          Built on elizaOS. Open source.
        </p>
        <p className="text-[rgba(245,241,232,0.55)] text-sm mt-6 leading-relaxed font-geist italic">
          Augurio es una bandada de agentes especialistas leyendo los mercados
          onchain. Nueve agentes. Cada uno con un rol. Juntos forman una
          lectura — un solo juicio entregado solo cuando el divino s&iacute; (Fas) y
          el divino no (Nefas) est&aacute;n de acuerdo. Construido en elizaOS.
        </p>
      </section>

      {/* ── 3. The Flock ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-cinzel text-3xl text-center tracking-wide mb-12">
          The Flock
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.name} {...agent} />
          ))}
        </div>
      </section>

      {/* ── 4. The Mechanism ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h2 className="font-cinzel text-3xl text-center tracking-wide mb-12">
          The Mechanism
        </h2>
        <Mechanism />
      </section>

      {/* ── 5. The Mirror ────────────────────────────────────────── */}
      <MirrorSection />

      {/* ── 6. The Stack ─────────────────────────────────────────── */}
      <section className="py-20 text-center">
        <div className="flex flex-col gap-4 items-center">
          <a
            href="https://elizaos.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cinzel text-sm tracking-widest uppercase text-ash hover:text-bone transition-colors"
          >
            Built on elizaOS
          </a>
          <a
            href="https://anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cinzel text-sm tracking-widest uppercase text-ash hover:text-bone transition-colors"
          >
            Reasoning by Anthropic Claude
          </a>
          <a
            href="https://solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-cinzel text-sm tracking-widest uppercase text-ash hover:text-bone transition-colors"
          >
            Solana-native
          </a>
        </div>
      </section>

      {/* ── 7. Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-smoke/20 py-10 text-center text-sm text-ash font-geist">
        <p>
          An augury by{" "}
          <a
            href="https://x.com/litboy11"
            className="text-bone hover:underline hover:decoration-oxblood"
            target="_blank"
            rel="noopener noreferrer"
          >
            @litboy11
          </a>
          {" "}&middot;{" "}
          <a
            href="https://github.com/OxBenji/augury"
            className="text-bone hover:underline hover:decoration-oxblood"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub
          </a>
          {" "}&middot;{" "}
          <a
            href="https://x.com/litboy11"
            className="text-bone hover:underline hover:decoration-oxblood"
            target="_blank"
            rel="noopener noreferrer"
          >
            Built in public
          </a>
        </p>
        <p className="mt-3 text-ash/50 text-xs italic font-geist">
          un augurio biling&uuml;e — construido en p&uacute;blico
        </p>
      </footer>
    </main>
  );
}
