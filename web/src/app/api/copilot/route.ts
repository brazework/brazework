import Anthropic from "@anthropic-ai/sdk";
import { COPILOT_MODEL, copilotEnabled, copilotRequest, memberContext, taskPrompt } from "@/lib/copilot";

// POST /api/copilot: streams Copilot's reply as plain text, so it types out live in the UI.
// Errors come back as JSON { message } with a status: 400 bad input, 401 signed out,
// 429 daily limit reached, 503 Copilot not switched on.
const json = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(req: Request) {
  const parsed = copilotRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, parsed.error.issues[0]?.message ?? "Check your request.");
  const r = parsed.data;

  const ctx = await memberContext(r.task);
  if (!ctx) return json(401, "Log in again to use Copilot.");
  if (!(await copilotEnabled())) return json(503, "Copilot isn't switched on yet.");

  const { data: left, error } = await ctx.supabase.rpc("copilot_take");
  if (error) return json(503, "Copilot isn't available right now.");
  if (typeof left !== "number" || left < 0) return json(429, "You've used today's Copilot requests. They reset tomorrow.");

  const { instructions, maxTokens } = taskPrompt(r);
  const messages: Anthropic.MessageParam[] = [...(r.history ?? []), { role: "user", content: r.input }];
  const stream = new Anthropic().messages.stream({ model: COPILOT_MODEL, max_tokens: maxTokens, system: `${ctx.system}\n\n${instructions}`, messages });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") controller.enqueue(enc.encode(ev.delta.text));
        }
        controller.close();
      } catch {
        controller.enqueue(enc.encode("\n\n[Copilot stopped early. Try again.]"));
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Copilot-Remaining": String(left) } });
}
