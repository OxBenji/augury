/**
 * Augury custom source identifier for elizaOS message routing.
 * Used when the runtime is wired up — currently a no-op placeholder.
 */

import type { SendHandlerFunction } from "@elizaos/core";

export const AUGURY_SOURCE = "augury";

export const auguryRouter: SendHandlerFunction = async (_runtime, _target, _content) => {
  // No-op. When runtimes are bootstrapped, this routes inter-agent
  // messages within the Augury source. For now, the custom SwarmBus
  // handles all routing — see /src/swarm/bus.ts.
};
