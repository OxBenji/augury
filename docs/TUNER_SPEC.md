# Sibyl — Tuner Specification

## Purpose
Sibyl is the learning loop. She watches outcomes and recalibrates the weights
that Fas and Nefas apply to Haruspex/Auspex/Chronos worker outputs. She is the
brain that turns Augury from a static rules engine into an adaptive system.

## Inputs
- Outcome database (1h/6h/24h price + rug status for every reading Augury fired or skipped)
- Held-out human-curated set of "obvious yes" and "obvious no" cases (tripwire)
- Current weight vector

## Output
- Updated weight vector (read by Fas and Nefas at decision time)
- Audit log (what changed, why, on which evidence)

## Optimization metric (composite, NOT pure hit rate)
score = hit_rate × log(signal_volume + 1) × (1 − rug_rate)

Why composite: pure hit rate optimization collapses to a conservative bot that
only fires on slam dunks. Volume term forces the system to keep firing on
ambiguous-but-positive-EV readings. Rug term punishes scaling into garbage.

## Survivorship bias mitigation
- Lituus runs LOOSER than the original TrenchLens filter. More candidates
  enter the swarm than the old bot would have admitted. Fas and Nefas do
  the actual rejecting downstream.
- This widens the training distribution and lets Sibyl learn from candidates
  the old bot would have silently killed.
- Track "would-have-been-skipped-by-old-filter" as a tag on every reading.
  Sibyl reports separate metrics for that subset.

## Reward hacking guard
- Held-out curated set runs nightly. If Sibyl's recalibrated weights cause
  >5% misclassification on the curated set, ROLLBACK to previous weights and
  flag for human review.
- Maximum weight delta per recalibration cycle: 15%. Slow learning, no spirals.
- Recalibration cadence: weekly, not real-time. Real-time tuning is how
  systems eat their own tail.

## Cold-start period
First 30 days post-launch: Sibyl is READ-ONLY. She logs what she would change
but does not actually update weights. Human reviews her proposed changes
and approves the first 4 weekly cycles. Auto-mode unlocks at week 5.

## Failure modes
- Weight collapse to zero on one input → minimum weight floor of 0.05 per worker
- All-fire / all-skip degenerate strategies → enforced disagreement budget;
  Fas and Nefas must disagree on at least 15% of readings or the system
  flags itself as miscalibrated
- Catastrophic regime change → manual rollback to weight snapshot N weeks ago

## Dependencies
- Speculum's historical disagreement DB (cold-start training data)
- Outcome scoring pipeline (1h/6h/24h price feed)
- Anthropic API key (Sibyl uses Haiku for log narration only,
  not for weight math — math is deterministic Python/TS)
