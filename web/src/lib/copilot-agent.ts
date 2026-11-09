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
  propose_post: { doing: "Drafting a post", done: "a post draft" },
  propose_milestone: { doing: "Drafting a milestone", done: "a milestone draft" },
  propose_join_club: { doing: "Preparing to join", done: "a club" },
  propose_follow: { doing: "Preparing a follow", done: "a person" },
  propose_event: { doing: "Drafting an event", done: "an event draft" },
  club_report: { doing: "Reading this week's club report", done: "the club report" },
  verify_queue: { doing: "Checking the verification queue", done: "the verify queue" },
  propose_club_post: { doing: "Drafting a club post", done: "a club post draft" },
  propose_review: { doing: "Preparing a review", done: "a review draft" },
};

// Something Copilot prepared for the member to confirm. Copilot never saves anything itself:
// the card shows this, the member edits or confirms, and the app's normal server action runs.
export type Proposal = { id: string } & (
  | { kind: "post"; body: string; postKind: "update" | "question" | "result" | "project"; tags: string[] }
  | { kind: "milestone"; project_id: string; project_title: string; club_id: string; club_name: string; title: string; detail: string; achieved_on: string }
  | { kind: "join"; club_id: string; club_name: string; privacy: "public" | "approval" }
  | { kind: "follow"; person_id: string; name: string; headline: string }
  | { kind: "event"; club_id: string; club_name: string; title: string; description: string; type: string; format: string; location: string; topic: string; starts_at: string; ends_at: string }
  | { kind: "club_post"; club_id: string; club_name: string; body: string; postKind: "update" | "question" | "result" | "project" }
  | { kind: "review"; milestone_id: string; club_name: string; member: string; title: string; detail: string; evidence: string; verify: boolean; note: string }
);

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
export const frame = (e: { tool: string } | { proposal: Proposal }) => `${RS}${JSON.stringify(e)}${RS}`;
export function parseStream(raw: string): { text: string; tools: string[]; proposals: Proposal[] } {
  const parts = raw.split(RS);
  let text = "";
  const tools: string[] = [];
  const proposals: Proposal[] = [];
  parts.forEach((p, i) => {
    if (i % 2 === 0) { text += p; return; }
    try {
      const e = JSON.parse(p) as { tool?: string; proposal?: Proposal };
      if (e.tool) tools.push(e.tool);
      if (e.proposal) proposals.push(e.proposal);
    } catch { /* a frame still arriving */ }
  });
  return { text, tools, proposals };
}
