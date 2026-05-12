/**
 * WebSocket client for connecting to the murmur production server.
 * Auto-reconnects with exponential backoff.
 */

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

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
  fas: { decision: string; argument: string; citedFlags: string[] };
  nefas: { decision: string; argument: string; citedFlags: string[] };
  verdict: {
    consensus: string;
    decision: string;
  };
  cost: number;
}

const WS_URL =
  process.env.NEXT_PUBLIC_MURMUR_WS_URL ||
  process.env.NEXT_PUBLIC_AUGURY_WS_URL ||
  "wss://augury-production-6543.up.railway.app/ws";

export class MurmurWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  public status: WsStatus = "disconnected";
  public onMessage: ((reading: MurmurReading) => void) | null = null;
  public onStatusChange: ((status: WsStatus) => void) | null = null;

  connect(): void {
    if (this.destroyed) return;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload?: unknown;
            timestamp: number;
          };

          if (msg.type === "reading" && msg.payload && this.onMessage) {
            this.onMessage(msg.payload as MurmurReading);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        if (!this.destroyed) {
          this.setStatus("disconnected");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setStatus("error");
      };
    } catch {
      this.setStatus("error");
      this.scheduleReconnect();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_MURMUR_API_URL ||
  process.env.NEXT_PUBLIC_AUGURY_API_URL ||
  "https://augury-production-6543.up.railway.app";

export async function fetchRecentReadings(limit = 5): Promise<MurmurReading[]> {
  try {
    const res = await fetch(`${API_URL}/readings?limit=${limit}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { readings: MurmurReading[] };
    return data.readings || [];
  } catch {
    return [];
  }
}
