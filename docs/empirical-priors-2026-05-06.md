# Empirical Priors Report — 2026-05-06

**Source:** `data/trenchlens-snapshot/ai_decisions.json`
**Total records:** 4716
**Classified (non-null outcome):** 4675

Outcome distribution:
- Hit: 388
- Good: 284
- Neutral: 467
- Loss: 2689
- Rug: 847

---

---

## Analysis A: Red Flags (Top 20 by frequency)

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| Vol/Liq ratio too high — wash trading? | 1126 | 8.0% | 5.3% | 4.4% | 46.8% | 35.5% |
| 5m sells > buys — active dumping | 933 | 3.5% | 1.9% | 12.2% | 74.7% | 7.6% |
| Weak B/S ratio: 1.1x | 486 | 4.5% | 3.5% | 10.5% | 69.3% | 12.1% |
| Wednesday — high rug rate (37%% rug) | 452 | 8.6% | 7.7% | 11.7% | 54.0% | 17.9% |
| Tuesday — weak day (23%% hit, 31%% rug) | 430 | 6.5% | 7.7% | 8.1% | 57.4% | 20.2% |
| Weak B/S ratio: 1.2x | 319 | 6.3% | 6.3% | 8.2% | 59.6% | 19.7% |
| Only 0 txns in 5m | 299 | 1.0% | 0.7% | 43.8% | 54.5% | 0.0% |
| Weak B/S ratio: 1.0x | 221 | 5.0% | 3.6% | 14.5% | 64.3% | 12.7% |
| Friday — highest rug rate (60%% rug) | 190 | 9.5% | 6.3% | 9.5% | 56.8% | 17.9% |
| Zero liquidity makes token untradeable | 161 | 3.7% | 3.7% | 14.9% | 74.5% | 3.1% |
| Weak B/S ratio: 0.9x | 157 | 5.7% | 5.7% | 13.4% | 59.9% | 15.3% |
| No X/Twitter linked — limited community visibility | 154 | 6.5% | 3.2% | 13.6% | 46.8% | 29.9% |
| Weak time window (14 UTC) — 17% hit rate | 148 | 4.1% | 3.4% | 6.1% | 57.4% | 29.1% |
| Thursday — worst hit rate (6.2%% hit) | 126 | 7.9% | 4.8% | 7.9% | 60.3% | 19.0% |
| Only 1 txns in 5m | 110 | 0.9% | 1.8% | 28.2% | 69.1% | 0.0% |
| Only 2 txns in 5m | 86 | 9.3% | 1.2% | 12.8% | 76.7% | 0.0% |
| Only 4 txns in 5m | 84 | 3.6% | 7.1% | 17.9% | 70.2% | 1.2% |
| Zero liquidity makes token effectively untradeable | 82 | 6.1% | 2.4% | 14.6% | 73.2% | 3.7% |
| Weak B/S ratio: 0.8x | 79 | 2.5% | 1.3% | 13.9% | 74.7% | 7.6% |
| Worst time window (18 UTC) — 9%% hit rate | 78 | 6.4% | 3.8% | 1.3% | 67.9% | 20.5% |

---

## Analysis B: Green Flags (Top 20 by frequency)

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| 30m+ age — past rug danger zone (28%% rug rate) | 4620 | 8.4% | 6.1% | 9.1% | 58.0% | 18.3% |
| Has socials | 4569 | 8.3% | 6.2% | 9.8% | 57.6% | 18.1% |
| Clean first slot — no coordinated launch buys | 2809 | 8.4% | 5.8% | 9.5% | 61.6% | 14.6% |
| Has X/Twitter: https://x.com/i | 2645 | 8.8% | 5.5% | 9.2% | 59.1% | 17.4% |
| Graduated to DEX — has real liquidity pool | 2355 | 10.3% | 7.8% | 5.1% | 47.7% | 29.1% |
| Fresh: 30m old | 1548 | 8.5% | 5.1% | 8.9% | 60.6% | 16.9% |
| Weekend — solid (29-30%% hit rate) | 808 | 9.3% | 7.9% | 8.0% | 56.6% | 18.2% |
| Volume accelerating | 656 | 11.7% | 7.6% | 6.7% | 48.2% | 25.8% |
| Gradual rise — organic | 593 | 14.8% | 11.0% | 6.2% | 44.0% | 23.9% |
| Good time window (04-08 UTC) — 32%% hit rate | 593 | 7.3% | 3.0% | 16.7% | 63.9% | 9.1% |
| Fresh: 31m old | 587 | 8.9% | 5.8% | 8.0% | 53.2% | 24.2% |
| Monday — best day (31%% hit, 35%% rug) | 459 | 6.3% | 3.5% | 12.6% | 58.8% | 18.7% |
| Recent pump.fun graduate (5-60m) — momentum window | 452 | 17.5% | 8.8% | 3.3% | 24.8% | 45.6% |
| Tuesday — strong day (29%% hit) | 400 | 8.0% | 4.0% | 13.5% | 57.0% | 17.5% |
| Prime time window (08-12 UTC) — 42.5%% hit rate | 397 | 8.6% | 2.8% | 9.3% | 61.5% | 17.9% |
| 🔥 HIGH CONVICTION — great hour + strong score (41%% hit rate in backtest) | 331 | 15.1% | 8.5% | 4.5% | 53.8% | 18.1% |
| Friday — strongest day (44%% hit, 16%% rug) | 326 | 11.0% | 7.4% | 9.2% | 58.0% | 14.4% |
| Strong time window (07 UTC) — 40%+ hit rate | 160 | 11.3% | 8.1% | 5.0% | 63.7% | 11.9% |
| Strong time window (10 UTC) — 40%+ hit rate | 151 | 10.6% | 6.6% | 10.6% | 57.6% | 14.6% |
| Good time window (09 UTC) — 28-38% hit rate | 150 | 6.0% | 8.7% | 8.0% | 62.7% | 14.7% |

---

## Analysis C: Pair Age Buckets

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| 0-15 min | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| 15-30 min | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| 30-60 min | 3280 | 9.1% | 5.8% | 7.6% | 55.7% | 21.9% |
| 60-180 min | 1258 | 6.2% | 6.4% | 15.5% | 62.5% | 9.5% |
| 180-720 min | 137 | 9.5% | 10.2% | 16.1% | 56.2% | 8.0% |
| 720-1440 min | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| 1440+ min | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |

---

## Analysis D: Market Cap Buckets

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| <$5k | 1209 | 3.6% | 1.9% | 14.4% | 80.0% | 0.2% |
| $5k-$15k | 1324 | 6.9% | 6.0% | 6.6% | 75.8% | 4.6% |
| $15k-$35k | 1048 | 10.8% | 8.1% | 10.2% | 42.0% | 28.9% |
| $35k-$60k | 500 | 13.4% | 7.6% | 14.8% | 28.4% | 35.8% |
| $60k-$70k | 147 | 15.0% | 10.2% | 4.1% | 28.6% | 42.2% |
| >$70k | 447 | 11.4% | 9.8% | 4.0% | 21.0% | 53.7% |

---

## Analysis E: Volume(5m) / Market Cap Ratio

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| 0-0.05 | 1198 | 4.3% | 4.3% | 24.5% | 62.8% | 4.3% |
| 0.05-0.15 | 1074 | 8.8% | 8.2% | 7.4% | 59.2% | 16.3% |
| 0.15-0.30 | 1154 | 11.6% | 6.5% | 4.3% | 54.2% | 23.4% |
| 0.30-0.60 | 903 | 9.5% | 6.3% | 3.2% | 52.2% | 28.8% |
| 0.60+ | 346 | 6.4% | 3.8% | 4.3% | 59.2% | 26.3% |

---

## Analysis F: Buy/Sell Ratio (buys_5m / (buys_5m + sells_5m))

*Only records with buys+sells > 0 (n=4321)*

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| 0-0.30 (sell heavy) | 407 | 3.7% | 2.5% | 17.0% | 74.2% | 2.7% |
| 0.30-0.45 | 347 | 3.2% | 1.7% | 9.8% | 79.8% | 5.5% |
| 0.45-0.55 (balanced) | 833 | 7.0% | 5.3% | 5.4% | 59.1% | 23.3% |
| 0.55-0.70 | 2023 | 11.6% | 7.8% | 4.6% | 51.7% | 24.3% |
| 0.70-1.00 (buy heavy) | 711 | 9.3% | 9.1% | 6.9% | 56.3% | 18.4% |

---

## Analysis G: Time of Day (UTC)

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| Asia (00-08 UTC) | 1869 | 7.8% | 6.3% | 12.3% | 62.0% | 11.7% |
| Europe (08-14 UTC) | 1372 | 9.0% | 4.8% | 8.9% | 58.6% | 18.7% |
| US (14-22 UTC) | 1206 | 8.0% | 6.7% | 8.2% | 49.8% | 27.3% |
| Late (22-24 UTC) | 228 | 9.2% | 8.3% | 7.5% | 55.7% | 19.3% |

---

## Analysis H: TrenchLens Score Buckets

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| 0-30 | 212 | 6.6% | 3.3% | 11.8% | 65.1% | 13.2% |
| 30-50 | 3736 | 7.6% | 5.8% | 10.4% | 59.5% | 16.8% |
| 50-70 | 670 | 11.8% | 8.5% | 7.9% | 44.8% | 27.0% |
| 70-85 | 46 | 15.2% | 8.7% | 4.3% | 52.2% | 19.6% |
| 85-100 | 11 | 36.4% | 0.0% | 0.0% | 36.4% | 27.3% |

---

## Analysis I: Combo Signals

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| Has BUNDLE in red_flags | 352 | 6.5% | 6.3% | 6.8% | 37.5% | 42.9% |
| No red flags at all | 208 | 19.2% | 16.8% | 4.8% | 49.0% | 10.1% |
| Score>70 AND no red flags | 2 | 50.0% | 50.0% | 0.0% | 0.0% | 0.0% |
| Score>70 AND has BUNDLE | 2 | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| Score<30 (any flags) | 212 | 6.6% | 3.3% | 11.8% | 65.1% | 13.2% |
| Graduated AND no red flags | 101 | 21.8% | 21.8% | 3.0% | 36.6% | 16.8% |

---

## Analysis J: Best Green Flags (no red flags present, min 5 records, by hit rate)

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| Prime time window (08-12 UTC) — 42.5%% hit rate | 6 | 50.0% | 0.0% | 0.0% | 50.0% | 0.0% |
| Good time window (20 UTC) — 28-38% hit rate | 6 | 50.0% | 50.0% | 0.0% | 0.0% | 0.0% |
| Fresh: 38m old | 5 | 40.0% | 0.0% | 0.0% | 40.0% | 20.0% |
| Strong time window (08 UTC) — 40%+ hit rate | 14 | 35.7% | 14.3% | 7.1% | 42.9% | 0.0% |
| Strong time window (21 UTC) — 40%+ hit rate | 6 | 33.3% | 33.3% | 0.0% | 33.3% | 0.0% |
| Fresh: 34m old | 6 | 33.3% | 16.7% | 0.0% | 33.3% | 16.7% |
| Recent pump.fun graduate (5-60m) — momentum window | 19 | 31.6% | 21.1% | 5.3% | 21.1% | 21.1% |
| Gradual rise — organic | 48 | 29.2% | 22.9% | 6.3% | 31.3% | 10.4% |
| Good liq depth: 34% | 7 | 28.6% | 14.3% | 0.0% | 57.1% | 0.0% |
| Strong time window (19 UTC) — 40%+ hit rate | 7 | 28.6% | 0.0% | 0.0% | 57.1% | 14.3% |

---

## Analysis K: Lethal Red Flags (highest loss+rug rate, min 10 records)

| Label | Count | Hit% | Good% | Neutral% | Loss% | Rug% |
|---|---|---|---|---|---|---|
| Price dropping -16.3% on volume | 10 | 0.0% | 0.0% | 0.0% | 30.0% | 70.0% |
| BUNDLE: 60% of early buys are bundled — fake demand from 0 wallets | 10 | 0.0% | 0.0% | 0.0% | 30.0% | 70.0% |
| Zero liquidity is critical red flag | 18 | 5.6% | 0.0% | 0.0% | 94.4% | 0.0% |
| Weak B/S ratio: 0.4x | 16 | 0.0% | 6.3% | 0.0% | 62.5% | 31.3% |
| Cold heat: 16% — dying momentum | 13 | 0.0% | 7.7% | 0.0% | 92.3% | 0.0% |
| Cold heat: 10% — dying momentum | 13 | 0.0% | 0.0% | 7.7% | 92.3% | 0.0% |
| Cold heat: 17% — dying momentum | 13 | 7.7% | 0.0% | 0.0% | 92.3% | 0.0% |
| Price dropping -22.6% on volume | 12 | 8.3% | 0.0% | 0.0% | 75.0% | 16.7% |
| Cold heat: 18% — dying momentum | 11 | 0.0% | 0.0% | 9.1% | 63.6% | 27.3% |
| Cold heat: 20% — dying momentum | 11 | 0.0% | 9.1% | 0.0% | 72.7% | 18.2% |

---

## Honest Read

1. **Red flag absence is the strongest single filter.** Records with zero red flags achieve 19% hit + 17% good (36% positive) versus the overall 8% hit rate. The "no red flags" filter triples positive outcome probability. This is the single biggest lever.

2. **Graduation + no red flags is the best combo.** Graduated tokens with zero red flags hit 22% hit + 22% good (44% positive), with only 17% rug rate. This is the highest-conviction subset in the dataset (n=101).

3. **Market cap matters more than score.** Sub-$5k tokens are 80% loss with near-zero rug (bonding curve tokens that just die). The $60k-$70k bucket peaks at 15% hit but carries 42% rug risk. The $35k-$60k sweet spot balances hit rate (13%) against rug rate (36%).

4. **BUNDLE flags correlate with extreme rug rates.** Any BUNDLE flag yields 43% rug rate (vs 18% baseline). Combined loss+rug is 80%. The "60% bundled" variant is 100% loss+rug across 10 records. Hard skip on any BUNDLE detection.

5. **Buy/sell ratio 0.55-0.70 is the sweet spot.** This bucket has the highest hit rate (12%) among buy/sell segments. Extreme buy dominance (>0.70) actually underperforms, suggesting organic two-sided flow beats one-sided pumps.