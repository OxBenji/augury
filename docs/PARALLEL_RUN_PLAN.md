# Augury — Parallel Run & Validation Plan

## Overview

Augury runs alongside the existing TrenchLens bot. Both see the same candidate tokens (via shared read-only DB access). Augury writes its own classifications to a separate pglite database. **Speculum** (the historical backtester) is the primary validation mechanism — it backtests Augury's classifications against real price outcomes before any live cutover happens.

## Why Speculum-first, not live A/B-first

Live A/B requires 2 weeks of real signals and carries risk if the swarm is miscalibrated. Speculum can backtest against the full TrenchLens historical DB immediately — we get statistical signal in hours, not weeks. Live A/B becomes the *confirmation* step after Speculum validation passes.

## Validation phases

### Phase 1: Historical backtest (Speculum-driven) — Days 1–3

1. Augury processes the last 30 days of TrenchLens candidates from the historical DB
2. Speculum scores every Augury classification against actual 1h/6h/24h price outcomes
3. Generate baseline comparison report: Augury accuracy vs TrenchLens ~39% hit rate

**Gate criteria to proceed:**
- Minimum 500 classifications scored
- Augury 24h accuracy ≥ 45% (meaningful improvement over 39% baseline)
- No systematic bias: SCAM verdict false-positive rate < 15%
- Fas/Nefas disagreement rate between 30–70% (adversarial step is working, not rubber-stamping)

### Phase 2: Shadow run (live signals, no delivery) — Days 4–10

1. Augury processes live candidates in real-time alongside TrenchLens
2. Classifications written to pglite, NOT delivered to Telegram
3. Speculum scores both systems against same outcomes at 1h/6h/24h
4. Daily comparison reports generated automatically
5. Sibyl observes but is READ-ONLY (cold-start period)

**Gate criteria to proceed:**
- Minimum 200 live classifications scored
- Augury 6h accuracy ≥ TrenchLens baseline + 5pp
- Augury latency p95 < 10s (Lituus → Telegram draft ready)
- No worker timeout rate > 20%
- Cost per candidate < $0.03

### Phase 3: Canary delivery — Days 11–14

1. Augury delivers to a separate Telegram test channel
2. Both TrenchLens and Augury alerts visible side-by-side
3. Manual review of Telegram message quality and timing

**Gate criteria for cutover:**
- All Phase 2 gates still passing
- Telegram message quality approved (manual review)
- No regressions in any metric for 3 consecutive days

### Phase 4: Cutover

1. Augury takes over Telegram delivery to production channel
2. TrenchLens continues running in shadow mode (fallback)
3. Speculum continues scoring both systems for 1 week post-cutover
4. Kill switch: revert to TrenchLens if Augury 24h accuracy drops below baseline
5. Sibyl exits cold-start at week 5 (first auto-recalibration cycle)

## Metrics tracked

| Metric | Source | Frequency |
|--------|--------|-----------|
| Classification accuracy (1h/6h/24h) | Speculum | Continuous |
| Verdict distribution | Augury DB | Per-batch |
| Worker timeout rate | Fanout logs | Per-candidate |
| Fas/Nefas disagreement rate | Adversarial logs | Per-candidate |
| Cost per candidate | Anthropic billing | Daily |
| End-to-end latency | Fanout timing | Per-candidate |
| TrenchLens baseline accuracy | Speculum (read-only) | Daily |
| Sibyl proposed weight deltas | Sibyl logs | Weekly |

## Rollback plan

At any phase, if gate criteria are not met:
1. Stop Augury delivery (if active)
2. Revert to TrenchLens-only operation
3. Analyze Speculum weak-spot report to identify what failed
4. Fix and restart from Phase 1
