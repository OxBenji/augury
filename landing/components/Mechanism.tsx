/**
 * Static SVG architecture diagram.
 * Helius → Lituus → [Haruspex | Auspex | Chronos] → [Fas | Nefas] → Reading
 * Side loops: Sibyl (tuner), Speculum (mirror).
 * Thin oxblood lines on obsidian. Cinzel labels. Scales to 380px.
 */

export function Mechanism() {
  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox="0 0 800 520"
        className="w-full max-w-3xl mx-auto"
        role="img"
        aria-label="Augury swarm architecture: Helius webhooks flow through Lituus filter (with Vates safety checks) to three parallel workers (Haruspex, Auspex, Chronos), then to adversarial coordinators Fas and Nefas, through a consensus gate, to produce a reading. Sibyl tunes weights, Speculum backtests."
      >
        {/* Background */}
        <rect width="800" height="520" fill="var(--obsidian)" />

        {/* ── Main pipeline ──────────────────────────── */}

        {/* Helius */}
        <rect x="340" y="16" width="120" height="32" rx="2" fill="none" stroke="var(--smoke)" strokeWidth="1" />
        <text x="400" y="37" textAnchor="middle" fill="var(--ash)" fontSize="11" fontFamily="var(--font-cinzel)">HELIUS</text>

        {/* Arrow: Helius → Lituus */}
        <line x1="400" y1="48" x2="400" y2="72" stroke="var(--oxblood)" strokeWidth="1" />
        <polygon points="396,70 400,78 404,70" fill="var(--oxblood)" />

        {/* Lituus */}
        <rect x="330" y="78" width="140" height="36" rx="2" fill="none" stroke="var(--oxblood)" strokeWidth="1.5" />
        <text x="400" y="97" textAnchor="middle" fill="var(--bone)" fontSize="12" fontFamily="var(--font-cinzel)">LITUUS</text>
        <text x="400" y="110" textAnchor="middle" fill="var(--oxblood)" fontSize="7" fontFamily="var(--font-cinzel)" letterSpacing="1" opacity="0.7">+ VATES SAFETY</text>

        {/* Arrow: Lituus → fan-out */}
        <line x1="400" y1="114" x2="400" y2="138" stroke="var(--oxblood)" strokeWidth="1" />

        {/* Fan-out lines */}
        <line x1="400" y1="138" x2="160" y2="158" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="400" y1="138" x2="400" y2="158" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="400" y1="138" x2="640" y2="158" stroke="var(--oxblood)" strokeWidth="1" />

        {/* Arrows into workers */}
        <polygon points="156,156 160,164 164,156" fill="var(--oxblood)" />
        <polygon points="396,156 400,164 404,156" fill="var(--oxblood)" />
        <polygon points="636,156 640,164 644,156" fill="var(--oxblood)" />

        {/* ── Workers (parallel) ─────────────────────── */}

        {/* PARALLEL label */}
        <text x="400" y="153" textAnchor="middle" fill="var(--smoke)" fontSize="8" fontFamily="var(--font-geist)" letterSpacing="2">PARALLEL · 3s</text>

        {/* Haruspex */}
        <rect x="90" y="164" width="140" height="48" rx="2" fill="none" stroke="var(--oxblood)" strokeWidth="1" />
        <text x="160" y="185" textAnchor="middle" fill="var(--bone)" fontSize="11" fontFamily="var(--font-cinzel)">HARUSPEX</text>
        <text x="160" y="200" textAnchor="middle" fill="var(--ash)" fontSize="8" fontFamily="var(--font-geist)">internals · Haiku</text>

        {/* Auspex */}
        <rect x="330" y="164" width="140" height="48" rx="2" fill="none" stroke="var(--oxblood)" strokeWidth="1" />
        <text x="400" y="185" textAnchor="middle" fill="var(--bone)" fontSize="11" fontFamily="var(--font-cinzel)">AUSPEX</text>
        <text x="400" y="200" textAnchor="middle" fill="var(--ash)" fontSize="8" fontFamily="var(--font-geist)">chatter · Haiku</text>

        {/* Chronos */}
        <rect x="570" y="164" width="140" height="48" rx="2" fill="none" stroke="var(--oxblood)" strokeWidth="1" />
        <text x="640" y="185" textAnchor="middle" fill="var(--bone)" fontSize="11" fontFamily="var(--font-cinzel)">CHRONOS</text>
        <text x="640" y="200" textAnchor="middle" fill="var(--ash)" fontSize="8" fontFamily="var(--font-geist)">flow · Haiku</text>

        {/* Converge lines from workers */}
        <line x1="160" y1="212" x2="160" y2="232" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="400" y1="212" x2="400" y2="232" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="640" y1="212" x2="640" y2="232" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="160" y1="232" x2="400" y2="252" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="400" y1="232" x2="400" y2="252" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="640" y1="232" x2="400" y2="252" stroke="var(--oxblood)" strokeWidth="1" />

        {/* Arrow into adversarial */}
        <polygon points="396,250 400,258 404,250" fill="var(--oxblood)" />

        {/* ── Adversarial consensus ──────────────────── */}

        <text x="400" y="268" textAnchor="middle" fill="var(--smoke)" fontSize="8" fontFamily="var(--font-geist)" letterSpacing="2">ADVERSARIAL</text>

        {/* Fan to Fas + Nefas */}
        <line x1="400" y1="272" x2="280" y2="290" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="400" y1="272" x2="520" y2="290" stroke="var(--oxblood)" strokeWidth="1" />
        <polygon points="276,288 280,296 284,288" fill="var(--oxblood)" />
        <polygon points="516,288 520,296 524,288" fill="var(--oxblood)" />

        {/* Fas */}
        <rect x="210" y="296" width="140" height="48" rx="2" fill="none" stroke="var(--verdant)" strokeWidth="1.5" />
        <text x="280" y="317" textAnchor="middle" fill="var(--verdant)" fontSize="12" fontFamily="var(--font-cinzel)">FAS</text>
        <text x="280" y="333" textAnchor="middle" fill="var(--ash)" fontSize="8" fontFamily="var(--font-geist)">divine yes · Sonnet</text>

        {/* Nefas */}
        <rect x="450" y="296" width="140" height="48" rx="2" fill="none" stroke="var(--oxblood)" strokeWidth="1.5" />
        <text x="520" y="317" textAnchor="middle" fill="var(--oxblood)" fontSize="12" fontFamily="var(--font-cinzel)">NEFAS</text>
        <text x="520" y="333" textAnchor="middle" fill="var(--ash)" fontSize="8" fontFamily="var(--font-geist)">divine no · Sonnet</text>

        {/* vs label */}
        <text x="400" y="324" textAnchor="middle" fill="var(--smoke)" fontSize="9" fontFamily="var(--font-geist)">vs</text>

        {/* Converge to consensus gate */}
        <line x1="280" y1="344" x2="400" y2="372" stroke="var(--oxblood)" strokeWidth="1" />
        <line x1="520" y1="344" x2="400" y2="372" stroke="var(--oxblood)" strokeWidth="1" />
        <polygon points="396,370 400,378 404,370" fill="var(--oxblood)" />

        {/* Consensus gate */}
        <rect x="330" y="378" width="140" height="36" rx="2" fill="none" stroke="var(--patina)" strokeWidth="1.5" />
        <text x="400" y="400" textAnchor="middle" fill="var(--patina)" fontSize="11" fontFamily="var(--font-cinzel)" letterSpacing="1">CONSENSUS</text>

        {/* Arrow to Reading */}
        <line x1="400" y1="414" x2="400" y2="440" stroke="var(--patina)" strokeWidth="1" />
        <polygon points="396,438 400,446 404,438" fill="var(--patina)" />

        {/* Reading */}
        <rect x="340" y="446" width="120" height="36" rx="2" fill="var(--oxblood)" fillOpacity="0.15" stroke="var(--patina)" strokeWidth="1.5" />
        <text x="400" y="469" textAnchor="middle" fill="var(--patina)" fontSize="12" fontFamily="var(--font-cinzel)" letterSpacing="2">READING</text>

        {/* ── Side loops (dotted) ────────────────────── */}

        {/* Sibyl — dotted line from Reading back up to Fas/Nefas area */}
        <rect x="40" y="320" width="110" height="40" rx="2" fill="none" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="95" y="337" textAnchor="middle" fill="var(--ash)" fontSize="10" fontFamily="var(--font-cinzel)">SIBYL</text>
        <text x="95" y="350" textAnchor="middle" fill="var(--smoke)" fontSize="7" fontFamily="var(--font-geist)">tuner · Haiku</text>
        {/* Dotted line: Sibyl → Fas/Nefas (weights) */}
        <line x1="150" y1="340" x2="210" y2="320" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />
        {/* Dotted line: Reading → Sibyl (outcomes) */}
        <path d="M 340 464 Q 200 464 95 360" fill="none" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />

        {/* Speculum — dotted line from historical data */}
        <rect x="650" y="320" width="120" height="40" rx="2" fill="none" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="710" y="337" textAnchor="middle" fill="var(--ash)" fontSize="10" fontFamily="var(--font-cinzel)">SPECULUM</text>
        <text x="710" y="350" textAnchor="middle" fill="var(--smoke)" fontSize="7" fontFamily="var(--font-geist)">mirror · Haiku</text>
        {/* Dotted line: Reading → Speculum (backtest) */}
        <path d="M 460 464 Q 600 464 710 360" fill="none" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />

        {/* Legend */}
        <line x1="300" y1="505" x2="330" y2="505" stroke="var(--oxblood)" strokeWidth="1.5" />
        <text x="336" y="508" fill="var(--smoke)" fontSize="8" fontFamily="var(--font-geist)">hot path</text>
        <line x1="420" y1="505" x2="450" y2="505" stroke="var(--ash)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="456" y="508" fill="var(--smoke)" fontSize="8" fontFamily="var(--font-geist)">async loop</text>
      </svg>
    </div>
  );
}
