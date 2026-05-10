import { runPipelineOnEvent } from "./pipeline.js";

export async function handleWebhook(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    console.log("[webhook] received event type:", (body as Record<string, unknown>)?.type || "unknown");

    // Fire and forget — don't block the webhook response
    runPipelineOnEvent(body).catch(err =>
      console.error("[pipeline] background error:", err)
    );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[webhook] error:", err);
    return new Response("Error", { status: 500 });
  }
}
