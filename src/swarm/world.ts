/**
 * Augury World — the swarm's container in elizaOS terms.
 *
 * This file documents the World/Room mapping for future migration to
 * the elizaOS runtime. It does NOT instantiate runtimes — that requires
 * @elizaos/plugin-sql and a database, which we'll add when going live.
 *
 * See /docs/ARCHITECTURE.md for the full swarm topology.
 */

import type { UUID } from "@elizaos/core";

export const AUGURY_WORLD_ID = "00000000-0000-0000-0000-augury00world" as UUID;
export const AUGURY_WORLD_NAME = "augury-swarm";

export const ROOM_IDS = {
  intake:      "00000000-0000-0000-0000-room0000intake" as UUID,
  workers:     "00000000-0000-0000-0000-room000workers" as UUID,
  adversarial: "00000000-0000-0000-0000-room0adversari" as UUID,
  consensus:   "00000000-0000-0000-0000-room0consensus" as UUID,
  delivery:    "00000000-0000-0000-0000-room00delivery" as UUID,
  archive:     "00000000-0000-0000-0000-room000archive" as UUID,
} as const;

export const ROOM_PARTICIPANTS = {
  [ROOM_IDS.intake]:      ["lituus", "vates"],
  [ROOM_IDS.workers]:     ["haruspex", "auspex", "chronos"],
  [ROOM_IDS.adversarial]: ["fas", "nefas"],
  [ROOM_IDS.consensus]:   [],  // gate logic, no agents
  [ROOM_IDS.delivery]:    [],
  [ROOM_IDS.archive]:     ["sibyl", "speculum"],
} as const;

/**
 * STUB — to be implemented when we add @elizaos/plugin-sql.
 * For now, throws to make accidental usage explicit.
 */
export async function initializeAuguryWorld(): Promise<void> {
  throw new Error(
    "initializeAuguryWorld is not implemented. Requires @elizaos/plugin-sql " +
    "and a configured database adapter. See docs/ARCHITECTURE.md."
  );
}
