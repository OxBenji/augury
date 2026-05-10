import { Hono } from "hono";
import { handleWebhook } from "./webhook.js";
import { addClient, removeClient, broadcast, startHeartbeat, getClientCount } from "./broadcast.js";

const app = new Hono();

// ── Routes ─────────────────────────────────────────────────────────

app.get("/healthz", (c) => {
  return c.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    clients: getClientCount(),
  });
});

app.post("/webhook", async (c) => {
  return handleWebhook(c.req.raw);
});

// ── Server with WebSocket ──────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "8787");

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Delegate to Hono for all other routes
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      addClient(ws);
      ws.send(JSON.stringify({
        type: "status",
        payload: { message: "connected to augury observatory" },
        timestamp: Date.now(),
      }));
    },
    close(ws) {
      removeClient(ws);
    },
    message(_ws, _msg) {
      // No client→server messages expected for now
    },
  },
});

// Start heartbeat
startHeartbeat();

console.log(`augury server listening on :${PORT}`);
console.log(`  healthz: http://localhost:${PORT}/healthz`);
console.log(`  webhook: http://localhost:${PORT}/webhook`);
console.log(`  ws:      ws://localhost:${PORT}/ws`);
