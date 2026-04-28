# Augury — Architecture v2

## What this is
TrenchLens (signal bot, ~39% hit rate baseline) wrapped in Augury, a multi-agent swarm built on elizaOS. Augury doesn't replace TrenchLens — it sits between the existing Helius webhook layer and Telegram delivery. Existing infra is read-only until cutover.

## Why a swarm beats a bigger single bot
Single bots fight one bloated system prompt. Swarms specialize: each agent owns one decision, has its own memory, its own model tier, its own failure mode. We also get capabilities a single bot fundamentally can't have: adversarial consensus, self-auditing, and regime-awareness.

## Topology

```
Helius webhooks ──► TrenchLens DB (existing, read-only)
                          │
                          ▼
                     ┌─────────┐
                     │ Lituus  │  deterministic pre-filter (no LLM)
                     └────┬────┘
                          │ candidates that pass hard filters
                          ▼
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌───────────┐ ┌──────────┐ ┌──────────┐
        │ Haruspex  │ │  Auspex  │ │ Chronos  │   3 workers (Haiku)
        │  (Haiku)  │ │ (Haiku)  │ │ (Haiku)  │   PARALLEL, 3s timeout
        └─────┬─────┘ └────┬─────┘ └────┬─────┘
              │             │            │
              └─────────────┼────────────┘
                            ▼
              ┌─────────────────────────────┐
              │     Adversarial Consensus   │
              │  ┌──────────┐ ┌──────────┐  │
              │  │   Fas    │ │  Nefas   │  │  2 coordinators (Sonnet)
              │  │ (Sonnet) │ │ (Sonnet) │  │  see same data, argue
              │  └────┬─────┘ └────┬─────┘  │  opposite theses
              │       └──────┬─────┘        │
              └──────────────┼──────────────┘
                             ▼
                    ┌────────────────┐
                    │  Coordinator   │  synthesis + Telegram draft (Sonnet)
                    │   (Sonnet)     │  weighs Fas vs Nefas + worker data
                    └───────┬────────┘
                            │
                  ┌─────────┼──────────┐
                  ▼         ▼          ▼
            Telegram    Augury DB    Speculum
            delivery    (pglite)    (async)
                                      │
                            ┌─────────┤
                            ▼         ▼
                     ┌──────────┐ ┌──────────┐
                     │ Speculum │ │  Sibyl   │
                     │ (Haiku)  │ │ (Haiku)  │
                     │ backtest │ │  tuner   │
                     └──────────┘ └──────────┘
```

## The flock

| Agent | Roman role | Model | Function | Cost tier |
|-------|-----------|-------|----------|-----------|
| Lituus | Sky-quadrant selector | None (deterministic) | Pre-filter: liquidity, age, holder count, blacklist | Free |
| Haruspex | Internals reader | Haiku | Holder/dev wallet/sniper analysis | Low |
| Auspex | Chatter reader | Haiku | X chatter + KOL track-record RAG | Low |
| Chronos | Flow reader | Haiku | Raydium orderbook + volume trends | Low |
| Fas | Divine yes | Sonnet | Default-fire coordinator, argues bullish thesis | Medium |
| Nefas | Divine no | Sonnet | Default-skip coordinator, argues bearish thesis | Medium |
| Coordinator | — | Sonnet | Synthesizes Fas/Nefas + worker signals, drafts alert | Medium |
| Sibyl | Record keeper | Haiku | Outcome scorer, weight recalibrator (see TUNER_SPEC.md) | Low |
| Speculum | Past reflector | Haiku | Historical backtester, disagreement surface | Low |

## Data flow

1. **Lituus** polls TrenchLens DB for new candidate tokens, applies deterministic hard filters
2. Surviving candidates are **fanned out in parallel** to Haruspex, Auspex, Chronos (3s hard timeout, partial results OK)
3. Worker results feed into the **adversarial step**: Fas and Nefas receive the same evidence, argue opposite sides
4. **Coordinator** sees worker results + Fas/Nefas arguments, produces final classification (STRONG / MODERATE / WEAK / SCAM) with confidence score
5. Coordinator drafts Telegram alert and writes classification to Augury DB (pglite)
6. **Speculum** runs async (not in the hot path) — reads historical TrenchLens DB to backtest classifications against actual outcomes at 1h/6h/24h windows
7. **Sibyl** recalibrates weights weekly based on Speculum's outcome data (see TUNER_SPEC.md)

## Hard constraints

- Coordinator + Fas/Nefas on Sonnet, all other agents on Haiku (cost control)
- Workers run PARALLEL not series (3s timeout, partial results OK via Promise.allSettled)
- Adversarial consensus step runs AFTER worker fanout completes
- A reading fires only when both Fas and Nefas agree
- READ-ONLY access to TrenchLens DB until cutover
- Augury writes ONLY to its own pglite DB during parallel run
- Speculum is the primary validation mechanism (replaces live A/B as first gate)
- Sibyl is READ-ONLY for first 30 days (see TUNER_SPEC.md cold-start)

## Cost model (estimated per candidate)

- Lituus: $0 (no LLM)
- 3x Haiku workers: ~$0.003
- Fas + Nefas coordinators: ~$0.01
- Coordinator synthesis: ~$0.005
- Speculum (async, amortized): ~$0.001
- Sibyl (weekly, amortized): ~$0.0001
- **Total per candidate: ~$0.019**
