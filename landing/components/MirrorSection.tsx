/**
 * Speculum (the self-auditor) explainer section.
 * The headline novel feature — the mirror that reads backward.
 */

export function MirrorSection() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24">
      <div className="flex flex-col items-center gap-10">
        {/* Ornamental speculum (hand mirror) SVG */}
        <svg
          width="64"
          height="96"
          viewBox="0 0 64 96"
          fill="none"
          role="img"
          aria-label="Stylized Roman hand mirror"
          className="opacity-40"
        >
          {/* Mirror face */}
          <circle cx="32" cy="28" r="24" stroke="var(--oxblood)" strokeWidth="1.5" fill="none" />
          <circle cx="32" cy="28" r="18" stroke="var(--oxblood)" strokeWidth="0.5" fill="none" opacity="0.4" />
          {/* Handle */}
          <line x1="32" y1="52" x2="32" y2="90" stroke="var(--oxblood)" strokeWidth="1.5" />
          <line x1="26" y1="88" x2="38" y2="88" stroke="var(--oxblood)" strokeWidth="1.5" />
        </svg>

        <h2 className="font-cinzel text-3xl sm:text-4xl text-bone text-center tracking-wide">
          The mirror reads backward.
        </h2>

        <div className="space-y-6 text-center">
          <p className="text-bone/80 text-lg leading-relaxed font-geist">
            Speculum is the self-auditor. It takes the full history of the predecessor
            bot — every signal it fired, every candidate it skipped — and runs the
            living swarm against that archive. Where the old bot and the new flock
            disagree, Speculum surfaces the difference.
          </p>
          <p className="text-bone/70 text-base leading-relaxed font-geist">
            This is how Augury finds past judgment errors without knowing what they were
            upfront. The disagreements are more valuable than the agreements. A winner
            that was skipped. A rug that was fired on. Each one teaches the flock what
            the old eye could not see.
          </p>
        </div>
      </div>
    </section>
  );
}
