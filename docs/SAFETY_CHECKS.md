# Augury — Safety Architecture

The flock is hardened by Vates, the 9th agent — a deterministic safety
module that reads on-chain signals before the swarm even sees a candidate.

## The four checks

### 1. LP burned or locked (HARD VETO)
The single most important rug indicator on Solana memecoins. If LP is not
burned and not locked, the dev can pull liquidity at any moment.

Source: rugcheck.xyz API, fallback to direct Solana RPC query against
the burn address `1nc1nerator11111111111111111111111111111111`.

### 2. Honeypot detection (HARD VETO)
Tokens with active sells in the archive cannot be honeypots, but live
candidates need explicit verification — mint/freeze authority status,
simulated sell, transfer fee inspection.

Source: rugcheck.xyz returns honeypot risk + authority status in one call.

### 3. Smart wallet presence (POSITIVE SIGNAL — moat)
The defensive moat. Wallets with proven 30-day PnL on memecoins are
tracked in /data/smart-wallets.json. When 3+ smart wallets are early
buyers in a candidate, Auspex weights it strongly.

Bootstrap: Augury logs every early buyer of every candidate it sees
for 30 days. After cold-start, the DB has enough data to classify
wallets as smart / neutral / rugger.

### 4. Known rug wallet presence (NEGATIVE SIGNAL)
Wallets that consistently buy into rugs are tracked separately. Their
presence in a candidate's early buyer list is weighted negatively by
Haruspex.

## Why this lives in Vates and not Haruspex/Auspex/Chronos

Vates is deterministic. No LLM cost. Hard vetoes happen before any
expensive reasoning. This keeps the cost model intact and ensures the
most dangerous candidates never consume Sonnet tokens.

## Cold-start mode

Until rugcheck integration ships and the smart wallet DB is bootstrapped,
Vates returns all-null safety results and Lituus passes through. The
type system already accommodates the future-state — no breaking change
when the integrations land.
