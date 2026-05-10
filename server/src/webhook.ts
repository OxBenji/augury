export async function handleWebhook(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    console.log("[webhook] received event:", JSON.stringify(body).slice(0, 200));

    // TODO Prompt 2: enrichment + pipeline trigger

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[webhook] error:", err);
    return new Response("Error", { status: 500 });
  }
}
