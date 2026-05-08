# Augury — Phase 1 Smoke Test Results

**Date:** May 6, 2026
**Model:** openai/gpt-4o-mini (via OpenRouter)
**Candidates:** 20 stratified historical (4 hit, 4 good, 4 loss, 4 rug, 4 neutral)
**Coordinator:** Mock Fas/Nefas (real LLMs in Phase 2)

## Summary

- Total cost: $0.0038
- Successful API calls: 60/60
- Parse failures: 0
- Average latency: 1,324ms per worker call

## Outcome breakdown

Fired: 14/20
Skipped: 6/20

Fire bucket:
- 4/4 hits caught
- 3/4 rugs fired through (mock coordinator limitation)

Skip bucket:
- 0 hits missed
- 1/4 rugs caught

## Sample reasoning

### Fire — GOD

- **Haruspex:** "The deployer has a relatively mature history, and trading activity indicates high interest, but the liquidity level and holder concentration raise concerns."
- **Auspex:** "The trading activity indicates a positive sentiment with 24 buys compared to 11 sells, suggesting potential interest. However, the holder concentration is zero, which may imply risk or lack of commitment from investors."
- **Chronos:** "The liquidity is decent, and there is a healthy buy volume compared to sell volume in the past five minutes, suggesting potential interest. However, the holder concentration is low, which could indicate volatility."

### Skip — peepcat

- **Haruspex:** "The holder concentration is zero, indicating no significant commitment from a broader audience, while the recent trades show more selling than buying, suggesting potential bearish sentiment."
- **Auspex:** "The high number of sells relative to buys indicates potential negative sentiment, and the liquidity is moderate but not strong enough for a confident buy signal."
- **Chronos:** "The sell activity slightly outweighs the buy activity in the last 5 minutes, indicating potential instability."

## Honest read

Workers are reading data accurately and showing distinct perspectives.
Score clustering around 0.70 indicates workers are too generous.
3/4 rugs fired through the mock coordinator layer — the deterministic
Fas/Nefas mocks are not yet doing adversarial filtering. Phase 2 will
test whether real LLM Fas/Nefas improve rug filtering.
