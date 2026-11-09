import type Anthropic from "@anthropic-ai/sdk";

// Copilot's tool loop, kept free of Next.js and Supabase so it can be tested against a mock API.
// Each round streams Claude's text out as it arrives. If Claude asks for tools, they run (as the
// member, through the caller's exec), their results go back, and the next round continues.

// What the UI says while a tool runs, and in the "Checked:" line after.
export const TOOL_LABEL: Record<string, { doing: string; done: string }> = {
  search_clubs: { doing: "Searching clubs", done: "clubs" },
  upcoming_events: { doing: "Checking upcoming events", done: "events" },
  find_people: { doing: "Finding people", done: "people" },
  my_profile: { doing: "Reading your profile", done: "your profile" },
  club_overview: { doing: "Looking at your club", done: "your club" },
};

export type AgentEvent = { type: "text"; text: string } | { type: "tool"; name: string };

export async function runAgent(opts: {
  client: Anthropic;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  exec: (name: string, input: unknown) => Promise<unknown>;
  emit: (e: AgentEvent) => void;
  maxRounds?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}) {
  const { client, model, system, tools, exec, emit, maxRounds = 4, maxTokens = 1000, signal } = opts;
  const messages = [...opts.messages];
  for (let round = 0; round < maxRounds; round++) {
    const stream = client.messages.stream({ model, max_tokens: maxTokens, system, messages, tools }, { signal });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") emit({ type: "text", text: ev.delta.text });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason !== "tool_use") return;
    const uses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      emit({ type: "tool", name: u.name });
      let out: unknown;
      try {
        out = await exec(u.name, u.input);
      } catch {
        out = { error: "That lookup failed. Answer without it, and say so." };
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 8000) });
    }
    messages.push({ role: "user", content: results });
  }
  emit({ type: "text", text: "\n\n[Copilot reached its lookup limit for one answer. Try a narrower question.]" });
}

// The text stream carries status events between record separators (\u001E), which never appear in
// normal text: "\u001E{"tool":"search_clubs"}\u001E". parseStream splits them back out.
export const RS = "\u001E";
export const frame = (e: { tool: string }) => `${RS}${JSON.stringify(e)}${RS}`;
export function parseStream(raw: string): { text: string; tools: string[] } {
  const parts = raw.split(RS);
  let text = "";
  const tools: string[] = [];
  parts.forEach((p, i) => {
    if (i % 2 === 0) { text += p; return; }
    try { const e = JSON.parse(p) as { tool?: string }; if (e.tool) tools.push(e.tool); } catch { /* a frame still arriving */ }
  });
  return { text, tools };
}
