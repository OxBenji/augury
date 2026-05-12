export interface HeliusWebhookEvent {
  type: string;
  timestamp: number;
  signature: string;
  accountData: unknown[];
  events: Record<string, unknown>;
  raw?: unknown;
}

export interface MurmurReading {
  id: string;
  timestamp: number;
  candidate: {
    symbol: string;
    mint: string;
    marketCap: number;
    buys5m: number;
    sells5m: number;
    liquidity: number;
    isGraduated: boolean;
    deployerAge: number;
    redFlags: string[];
    greenFlags: string[];
    trenchlensScore: number;
    priceChange5m: number;
    priceChange1h: number;
  };
  workers: {
    haruspex: { score: number; reasoning: string };
    auspex: { score: number; reasoning: string };
    chronos: { score: number; reasoning: string };
  };
  fas: { decision: "fire" | "skip"; argument: string; citedFlags: string[] };
  nefas: { decision: "fire" | "skip"; argument: string; citedFlags: string[] };
  verdict: {
    consensus: "fire" | "skip" | "split";
    decision: "FIRE" | "SKIP";
  };
  cost: number;
}

export interface BroadcastMessage {
  type: "reading" | "heartbeat" | "status" | "error";
  payload?: unknown;
  timestamp: number;
}
