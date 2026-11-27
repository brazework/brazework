import type Anthropic from "@anthropic-ai/sdk";
import { claudeClient } from "@/lib/claude";
import { COPILOT_MODEL, copilotEnabled, copilotRequest, memberContext, taskPrompt } from "@/lib/copilot";
import { emberSystem, frame, runAgent } from "@/lib/copilot-agent";
import { pageLine } from "@/lib/copilot-page";
import { presetInstruction } from "@/lib/copilot-presets";
import { OFFER_CHOICES, TOOLS, makeExec } from "@/lib/copilot-tools";
import { takeEmberCredits } from "@/lib/ember-quota";
import { followRefusal, threadMessages } from "@/lib/ember-thread";
import { viewerFromToken } from "@/lib/supabase/server";

// POST /api/copilot: streams Copilot's reply as plain text, so it types out live in the UI.
// Signed in with the session cookie (the web) or "Authorization: Bearer <Supabase access token>" (the iPhone app).
// Questions ("ask") can use read-only tools; each lookup is announced in the stream as a frame
// (see copilot-agent.ts) so the UI can show "Searching clubs…".
// Errors come back as JSON { message } with a status: 400 bad input, 401 signed out,
// 429 daily limit reached, 503 Copilot not switched on.
const json = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(req: Request) {
  const parsed = copilotRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, parsed.error.issues[0]?.message ?? "Check your request.");
  const r = parsed.data;
  // A free follow turn only carries on after a yes (lib/ember-thread.ts); checked before anything is spent.
  const notFollow = r.follow ? followRefusal(r.history ?? [], r.input) : "";
  if (notFollow) return json(400, notFollow);

  // The web sends its session cookie; the iPhone app sends its Supabase access token instead.
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  const viewer = token ? await viewerFromToken(token) : undefined;
  if (token && !viewer) return json(401, "Log in again to ask Torch.");
  const ctx = await memberContext(viewer ?? undefined);
  if (!ctx) return json(401, "Log in again to ask Torch.");
  if (!(await copilotEnabled())) return json(503, "Torch isn't switched on here yet.");

  const credits = await takeEmberCredits(ctx.supabase, r.follow ? "follow" : r.task);
  // No free follow left (or the database step hasn't run): the page offers to carry on for a credit.
  if (!credits.ok && r.follow) return Response.json({ message: "Torch's free follow-ups for that question are used up.", follow: "refused" }, { status: 429 });
  if (!credits.ok) return json(credits.status, credits.message);

  const { instructions, maxTokens } = taskPrompt(r);
  // What happened to the cards of each earlier answer goes in with the turn after it (lib/ember-thread.ts).
  const messages: Anthropic.MessageParam[] = threadMessages(r.history ?? [], r.input, !!r.follow);
  const client = await claudeClient();
  // Asked from the bar on a project, club or event page: what that page is, read as the member.
  const here = r.task === "ask" ? await pageLine(ctx.supabase, ctx.userId, r.page) : "";
  // The rules first, cached; then what's particular to this member and this request.
  const system = emberSystem(ctx.rules, `${ctx.about}\n\n${instructions}${r.preset ? `\n\n${presetInstruction(r.preset)}` : ""}${here ? `\n\n${here}` : ""}`);
  const abort = new AbortController();
  // Torch's numbers (supabase/ember-card-counts.sql): how many cards and sets of answer buttons this answer
  // prepared, counted once it ends. Numbers only; best-effort.
  let prepared = 0, offered = 0;
  const count = async () => {
    try {
      if (prepared) await ctx.supabase.rpc("ember_note", { p_what: "prepared", p_n: prepared });
      if (offered) await ctx.supabase.rpc("ember_note", { p_what: "choices", p_n: offered });
    } catch { /* counting never gets in the way */ }
  };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const out = (s: string) => controller.enqueue(enc.encode(s));
      try {
        if (r.task === "ask") {
          await runAgent({ client, model: COPILOT_MODEL, system, messages, tools: r.choices ? [...TOOLS, OFFER_CHOICES] : TOOLS, exec: makeExec(ctx.supabase, ctx.userId, (proposal) => { prepared++; out(frame({ proposal })); }, (choice) => { offered++; out(frame({ choice })); }, { carryOn: !!r.choices }), maxTokens, signal: abort.signal, emit: (e) => out(e.type === "text" ? e.text : frame({ tool: e.name })) });
        } else {
          const stream = client.messages.stream({ model: COPILOT_MODEL, max_tokens: maxTokens, system, messages }, { signal: abort.signal });
          for await (const ev of stream) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") out(ev.delta.text);
        }
        controller.close();
      } catch {
        if (!abort.signal.aborted) { out("\n\n[Torch stopped early. Try again.]"); controller.close(); }
      } finally {
        // Cards shown before a stop still count as prepared.
        await count();
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Copilot-Remaining": String(credits.remaining) } });
}
