import type { GoalKind } from "@/lib/goals";
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
  my_record: { doing: "Reading your signed work", done: "your record" },
  whats_new: { doing: "Checking what's new", done: "what's new" },
  propose_project_edit: { doing: "Drafting a project update", done: "a project update" },
  propose_goal: { doing: "Drafting a goal", done: "a goal" },
  propose_memory: { doing: "Noting that", done: "something to remember" },
  club_overview: { doing: "Looking at your club", done: "your club" },
  propose_post: { doing: "Drafting a post", done: "a post draft" },
  propose_milestone: { doing: "Drafting a milestone", done: "a milestone draft" },
  propose_signature: { doing: "Drafting an ask to sign", done: "an ask to sign" },
  propose_join_club: { doing: "Preparing to join", done: "a club" },
  propose_follow: { doing: "Preparing a follow", done: "a person" },
  propose_event: { doing: "Drafting an event", done: "an event draft" },
  club_report: { doing: "Reading this week's club report", done: "the club report" },
  verify_queue: { doing: "Checking the verification queue", done: "the verify queue" },
  propose_club_post: { doing: "Drafting a club post", done: "a club post draft" },
  github_repo: { doing: "Reading the GitHub repo", done: "GitHub" },
  github_user: { doing: "Looking at their GitHub", done: "GitHub" },
  propose_project: { doing: "Drafting a project", done: "a project draft" },
  propose_club: { doing: "Drafting a club", done: "a club draft" },
  propose_rsvp: { doing: "Saving you a spot", done: "an RSVP" },
  propose_message: { doing: "Drafting a message", done: "a message draft" },
  my_courses: { doing: "Reading your courses", done: "your courses" },
  course_roster: { doing: "Reading the class", done: "the class" },
  propose_assignment: { doing: "Drafting an assignment", done: "an assignment draft" },
  propose_announcement: { doing: "Drafting an announcement", done: "an announcement draft" },
  propose_extension: { doing: "Preparing an extension", done: "an extension" },
};

export type TorchRubricRow = { criterion: string; points: number; outcome?: string };

// Something Copilot prepared for the member to confirm. Copilot never saves anything itself:
// the card shows this, the member edits or confirms, and the app's normal server action runs.
// `then`: what Torch will do next once this card is confirmed, in the member's words ("log the milestone on
// it"), when the card is one step of a job they asked for (the spec's part 3).
export type Proposal = { id: string; then?: string } & (
  // What the member is working toward (supabase/goals.sql). visible starts false: the member chooses on the card.
  | { kind: "goal"; goal_kind: GoalKind; target: string; title: string; why: string }
  // Something to carry over to the next chat (supabase/ember-memory.sql). Saved only when confirmed.
  | { kind: "memory"; body: string }
  | { kind: "post"; body: string; postKind: "update" | "question" | "result" | "project"; tags: string[] }
  | { kind: "milestone"; project_id: string; project_title: string; club_id: string; club_name: string; title: string; evidence: string; detail: string; achieved_on: string }
  // A person who saw the work signs it (supabase/vouches.sql). milestone_id is "" for a new milestone,
  // or the member's own milestone that is still waiting. email may be "": the member types it on the card.
  | { kind: "signature"; milestone_id: string; project_id: string; project_title: string; title: string; evidence: string; detail: string; achieved_on: string; email: string; relationship: string }
  | { kind: "join"; club_id: string; club_name: string; privacy: "public" | "approval" }
  | { kind: "follow"; person_id: string; name: string; headline: string }
  | { kind: "event"; club_id: string; club_name: string; title: string; description: string; type: string; format: string; location: string; topic: string; starts_at: string; ends_at: string }
  | { kind: "club_post"; club_id: string; club_name: string; body: string; postKind: "update" | "question" | "result" | "project" }
  // A new club or study group (lib/torch-club.ts), made as the Start a community page makes it.
  | { kind: "club"; name: string; about: string; field: string; club_type: "field" | "study" | "project"; privacy: "public" | "approval"; topics: string[]; course: string; term: string; meets: string }
  | { kind: "project"; title: string; summary: string; details: string; link: string; tags: string[]; status: "in_progress" | "completed"; year: string; source: string }
  | { kind: "review"; milestone_id: string; club_name: string; member: string; title: string; detail: string; evidence: string; verify: boolean; note: string }
  | { kind: "rsvp"; event_id: string; title: string; starts_at: string; where: string; going: number; cancel?: boolean }
  | { kind: "message"; person_id: string; name: string; headline: string; body: string; accepts?: { conversation_id: string } }
  // From AI tools over MCP too (supabase/tool-actions.sql): the same kinds, so a tool's draft is a Torch card.
  | { kind: "project_edit"; project_id: string; project_title: string; summary?: string; details?: string; link?: string; specs?: Spec[]; before: { summary: string; details: string; link: string; specs: Spec[] } }
  | { kind: "invite"; code: string; club_id: string; club_name: string }
  | { kind: "teammate"; project_id: string; project_title: string; person_id: string; name: string; headline: string; role: "member" | "viewer" }
  // Brazework Courses, for a class's staff (supabase/courses.sql, courses-b.sql). Torch drafts; the
  // professor confirms on the card. It never grades or releases a grade.
  | { kind: "assignment"; class_id: string; class_name: string; title: string; instructions: string; due_at: string; points: number; rubric: TorchRubricRow[]; submit_as: string[]; group_work: boolean; peer_eval: boolean; publish: boolean }
  | { kind: "announcement"; class_id: string; class_name: string; title: string; body: string }
  | { kind: "extension"; class_id: string; assignment_id: string; assignment_title: string; person_id: string; name: string; due_at: string }
);
export type Spec = { label: string; value: string };

// Answers Torch offers the member to tap (offer_choices; lib/ember-thread.ts). Shown as buttons under the
// answer, never saved as anything.
export type Choice = { id: string; options: string[] };

// Tools that hand the turn to the member: they aren't announced as a lookup ("Checking…"), and once one
// has worked the answer ends there instead of spending another round on a closing sentence.
export const ASKS_MEMBER = ["offer_choices"];

export type AgentEvent = { type: "text"; text: string } | { type: "tool"; name: string };

// Prompt caching. A request renders tools, then system, then messages, and a cache entry covers
// everything up to its marker. So the fixed part goes first and carries the marker: Torch's rules,
// and before them the tool list. Every member's question reads that from the cache at a tenth of the
// price. The member's details, the task and the page they asked from come after it. Nothing that
// changes per request (a date, an id) may go into `rules`, or every request misses. The marker only
// takes effect once the prefix reaches the model's minimum (1,024 tokens on Claude Sonnet 5: the
// rules plus the tools do; the rules alone don't), and below it the request is simply uncached.
// Tested in tests/ember-cache.test.ts.
export function emberSystem(rules: string, rest: string): Anthropic.TextBlockParam[] {
  const fixed: Anthropic.TextBlockParam = { type: "text", text: rules, cache_control: { type: "ephemeral" } };
  return rest.trim() ? [fixed, { type: "text", text: rest }] : [fixed];
}

// Rounds of tools in one answer: enough to read GitHub, read the record and prepare a card or two.
export const MAX_ROUNDS = 6;
// What the member reads when an answer is cut off. Said out loud: the loop used to return without a
// word, so an answer cut off mid-card would read as a card that never came.
export const OUT_OF_ROOM = "[Torch ran out of room on that one. Ask for it in smaller pieces.]";
export const OUT_OF_ROUNDS = "[Torch reached its lookup limit for one answer. Try a narrower question.]";

export async function runAgent(opts: {
  client: Anthropic;
  model: string;
  system: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  exec: (name: string, input: unknown) => Promise<unknown>;
  emit: (e: AgentEvent) => void;
  maxRounds?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  endsTurn?: string[];
}) {
  const { client, model, system, tools, exec, emit, maxRounds = MAX_ROUNDS, maxTokens = 1000, signal, endsTurn = ASKS_MEMBER } = opts;
  const messages = [...opts.messages];
  // What Claude writes before a tool and after it are separate thoughts, but they arrive as one run
  // of text ("…on the card.I've put together…"). The first text after a tool starts a new paragraph,
  // unless the line breaks are already there. `tail` is the end of the text sent so far.
  let tail = "";
  let afterTool = false;
  const say = (text: string) => {
    if (!text) return;
    if (afterTool && tail) {
      const have = (/\n*$/.exec(tail)?.[0].length ?? 0) + (/^\n*/.exec(text)?.[0].length ?? 0);
      if (have < 2) text = "\n".repeat(2 - have) + text;
    }
    afterTool = false;
    tail = (tail + text).slice(-2);
    emit({ type: "text", text });
  };
  for (let round = 0; round < maxRounds; round++) {
    // Top-level cache_control: each round also caches the conversation so far, so the next tool
    // round reads it back instead of paying for it again (on top of the rules' own marker).
    const stream = client.messages.stream({ model, max_tokens: maxTokens, system, messages, tools, cache_control: { type: "ephemeral" } }, { signal });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") say(ev.delta.text);
    }
    const final = await stream.finalMessage();
    // Out of tokens mid-answer or mid-card: a half-written card can't be shown, so say what happened.
    if (final.stop_reason === "max_tokens") { emit({ type: "text", text: `\n\n${OUT_OF_ROOM}` }); return; }
    if (final.stop_reason !== "tool_use") return;
    afterTool = true;
    const uses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    let handedOver = false;
    for (const u of uses) {
      const asks = endsTurn.includes(u.name);
      if (!asks) emit({ type: "tool", name: u.name });
      let out: unknown;
      try {
        out = await exec(u.name, u.input);
      } catch {
        out = { error: "That lookup failed. Answer without it, and say so." };
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 8000) });
      // A refused offer (bad answers) goes back to Torch like any error, and it carries on.
      if (asks && !(out && typeof out === "object" && "error" in out)) handedOver = true;
    }
    if (handedOver) return;
    messages.push({ role: "user", content: results });
  }
  emit({ type: "text", text: `\n\n${OUT_OF_ROUNDS}` });
}

// The text stream carries status events between record separators (\u001E), which never appear in
// normal text: "\u001E{"tool":"search_clubs"}\u001E". parseStream splits them back out.
export const RS = "\u001E";
export const frame = (e: { tool: string } | { proposal: Proposal } | { choice: Choice }) => `${RS}${JSON.stringify(e)}${RS}`;
// What an answer is made of, in the order it arrived: text, then the card Torch prepared, then the
// text after it. Rendering in this order means a card never gets pushed down by words arriving above it.
export type Segment = { type: "text"; text: string } | { type: "proposal"; proposal: Proposal };

export function parseStream(raw: string): { text: string; tools: string[]; proposals: Proposal[]; segments: Segment[]; choice: Choice | null } {
  const parts = raw.split(RS);
  let text = "";
  const tools: string[] = [];
  const proposals: Proposal[] = [];
  const segments: Segment[] = [];
  let choice: Choice | null = null;
  const addText = (t: string) => {
    if (!t) return;
    const last = segments[segments.length - 1];
    if (last?.type === "text") last.text += t;
    else segments.push({ type: "text", text: t });
  };
  parts.forEach((p, i) => {
    if (i % 2 === 0) { text += p; addText(p); return; }
    try {
      const e = JSON.parse(p) as { tool?: string; proposal?: Proposal; choice?: Choice };
      if (e.tool) tools.push(e.tool);
      // One set of answers per message: if Torch offered twice, the last stands.
      if (e.choice && Array.isArray(e.choice.options)) choice = e.choice;
      if (e.proposal) { proposals.push(e.proposal); segments.push({ type: "proposal", proposal: e.proposal }); }
    } catch { /* a frame still arriving */ }
  });
  return { text, tools, proposals, segments, choice };
}
