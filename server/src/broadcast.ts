import type { ServerWebSocket } from "bun";
import type { BroadcastMessage } from "./types.js";

const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
  console.log(`[ws] client connected (total: ${clients.size})`);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
  console.log(`[ws] client disconnected (total: ${clients.size})`);
}

export function broadcast(message: BroadcastMessage): void {
  const data = JSON.stringify(message);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      clients.delete(ws);
    }
  }
}

export function startHeartbeat(): void {
  setInterval(() => {
    broadcast({ type: "heartbeat", timestamp: Date.now() });
  }, 30_000);
}

export function getClientCount(): number {
  return clients.size;
}
