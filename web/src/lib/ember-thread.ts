import { z } from "zod";
import type { Proposal } from "@/lib/copilot-agent";

// Torch hears what happened to its cards (docs/superpowers/specs/2026-11-26-ember-follow-through-design.md,
// part 1). The chat used to send back only the text of each turn, so Torch never knew which cards it
// had prepared or whether the member confirmed, dismissed or failed to send them, and could prepare
// the same one twice. Now each answer's cards travel with the history, and the server turns them into
// one line at the start of the member's next message. Pure, so the browser, the server and tests share
// it (tests/ember-thread.test.ts).
//
// The line is a hint from the member's own browser, about their own cards. What is true still comes
// from the database: lib/copilot.ts memberContext reloads their projects and waiting milestones on
// every question.

// What a card is called in the note and once a chat is saved (a saved chat keeps a label, never a
// live card that could be confirmed twice).
export const CARD_LABEL: Record<Proposal["kind"], string> = { goal: "a goal", memory: "something to remember", post: "a post", milestone: "a milestone to verify", signature: "an ask to sign", join: "joining a club", club: "a new club", follow: "a follow", event: "a club event", club_post: "a club post", project: "a project", review: "a milestone review", rsvp: "an RSVP", message: "a message", project_edit: "a project update", teammate: "a teammate", invite: "a club invite", assignment: "an assignment", announcement: "a class announcement", extension: "an extension" };
const KINDS = Object.keys(CARD_LABEL) as [Proposal["kind"], ...Proposal["kind"][]];

export const CARD_STATES = ["open", "confirmed", "dismissed", "failed"] as const;
export type CardState = (typeof CARD_STATES)[number];

/** The most cards one answer reports, and how long a card's title or the server's reason may be. */
export const MAX_CARDS = 6;
export const MAX_LABEL = 160;
/** The longest a turn may be when it goes back as history (lib/copilot-request.ts allows this much). */
export const MAX_TURN = 6000;
/** How long a card's next step (`then`) may be. */
export const MAX_THEN = 120;

export const cardOutcome = z.object({
  kind: z.enum(KINDS),
  label: z.string().max(MAX_LABEL),
  state: z.enum(CARD_STATES),
  // Why it didn't go through, in the server's words; or that a club post is held for review.
  note: z.string().max(MAX_LABEL).optional(),
  // What Torch said comes next once this card is confirmed (the spec's part 3).
  then: z.string().max(MAX_THEN).optional(),
});
export type CardOutcome = z.infer<typeof cardOutcome>;

// Torch asks with buttons (the spec's part 2): when it needs one answer to go on, it offers 2 to 4 short
// answers the member taps (offer_choices). What it offered, and which one was tapped, go back with the
// history like the cards do. `picked` is absent when the member typed something else.
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const MAX_OPTION = 60;
export const offeredChoice = z.object({
  options: z.array(z.string().min(1).max(MAX_OPTION)).min(MIN_OPTIONS).max(MAX_OPTIONS),
  picked: z.string().max(MAX_OPTION).optional(),
});
export type OfferedChoice = z.infer<typeof offeredChoice>;

// `follow` on a member's turn: Torch carried on by itself after a yes (no words of theirs when it came
// from a confirmed card; the tapped answer when it came from a button).
export type ThreadTurn = { role: "user" | "assistant"; content: string; cards?: CardOutcome[]; choice?: OfferedChoice; follow?: boolean };

// One line, no brackets or separators of ours, so a title can't end the note early.
const tidy = (s: string, n = MAX_LABEL) => s.replace(/[[\]\u001E"]/g, " ").replace(/\s+/g, " ").trim().slice(0, n).trim();

/** The few words that tell one card from another: its title, or who or what it's for. */
export function cardTitle(p: Proposal): string {
  switch (p.kind) {
    case "post": case "club_post": case "message": case "memory": return tidy(p.body, 80);
    case "milestone": case "signature": case "event": case "project": case "review": case "rsvp": case "goal": return tidy(p.title);
    case "join": case "invite": return tidy(p.club_name);
    case "club": return tidy(p.name);
    case "follow": case "teammate": return tidy(p.name);
    case "project_edit": return tidy(p.project_title);
    case "assignment": case "announcement": return tidy(p.title || p.class_name);
    case "extension": return tidy(`${p.assignment_title} for ${p.name}`);
  }
}

/** A card's outcome as it goes back to Torch. `note` is the server's reason when it didn't go through. */
export function outcomeOf(p: Proposal, state: CardState, note = ""): CardOutcome {
  const why = tidy(note);
  const then = cleanThen(p.then);
  return { kind: p.kind, label: cardTitle(p), state, ...(why ? { note: why } : {}), ...(then ? { then } : {}) };
}

/** A card's next step, made safe to show and to quote. "" when there is none. */
export const cleanThen = (v: unknown) => (typeof v === "string" ? tidy(v, MAX_THEN) : "");

/** Every card of one answer with what happened to it; a card nobody has touched is still open. */
export function cardsOf(proposals: Proposal[] | undefined, done: Record<string, CardOutcome>): CardOutcome[] {
  return (proposals ?? []).slice(0, MAX_CARDS).map((p) => done[p.id] ?? outcomeOf(p, "open"));
}

const HAPPENED: Record<CardState, (note: string) => string> = {
  open: () => "not answered yet, still on their screen",
  confirmed: (note) => (note ? `confirmed (${note})` : "confirmed, it's done"),
  dismissed: () => "dismissed",
  failed: (note) => (note ? `didn't go through (${note})` : "didn't go through"),
};

const SAID: Record<CardState, string> = { open: "not answered", confirmed: "confirmed", dismissed: "dismissed", failed: "didn't go through" };
/** A saved chat's cards for the member to read: "a project (confirmed), a post (dismissed)". */
export const savedCards = (cards: CardOutcome[]) => cards.map((c) => `${CARD_LABEL[c.kind]} (${SAID[c.state]})`).join(", ");

/**
 * What Torch offered, made safe to show and to quote: each answer on one line, without our brackets or
 * quotes, at most MAX_OPTION characters, no repeats. An error when fewer than two are left or more than
 * four were given, so Torch asks in words instead.
 */
export function cleanOptions(raw: unknown): { options: string[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "options must be a list of 2 to 4 short answers." };
  const seen = new Set<string>();
  const options: string[] = [];
  for (const o of raw) {
    if (typeof o !== "string") continue;
    const t = tidy(o, MAX_OPTION);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    options.push(t);
  }
  if (options.length < MIN_OPTIONS || raw.length > MAX_OPTIONS) return { error: `Offer ${MIN_OPTIONS} to ${MAX_OPTIONS} different short answers, or just ask in words.` };
  return { options };
}

/** The line Torch reads. Empty when the answer had no cards. Starts with NOTE_START, which its instructions name. */
export const NOTE_START = "[Brazework:";
export function cardsNote(cards: CardOutcome[]): string {
  const each = cards.slice(0, MAX_CARDS).map((c) => {
    const label = tidy(c.label);
    return `${CARD_LABEL[c.kind]}${label ? ` "${label}"` : ""}: ${HAPPENED[c.state](tidy(c.note ?? ""))}`;
  });
  return each.length ? `${NOTE_START} what happened to the cards from your last message. ${each.join("; ")}.]` : "";
}

/** What the member did with the answers Torch offered, in a sentence. Empty when it offered none. */
export function choiceNote(c: OfferedChoice | undefined): string {
  if (!c?.options.length) return "";
  const offered = c.options.slice(0, MAX_OPTIONS).map((o) => `"${tidy(o, MAX_OPTION)}"`).join(", ");
  const picked = c.picked ? tidy(c.picked, MAX_OPTION) : "";
  return `You offered these answers: ${offered}. ${picked ? `They tapped "${picked}".` : "They typed their own answer instead."}`;
}

/** The one line about an answer: its cards, then its choices. Empty when it had neither. */
export function turnNote(cards: CardOutcome[], choice?: OfferedChoice): string {
  const about = cardsNote(cards);
  const chose = choiceNote(choice);
  if (!chose) return about;
  return about ? `${about.slice(0, -1)} ${chose}]` : `${NOTE_START} ${chose}]`;
}

/** What Torch said comes next on the cards the member just confirmed, as the sentence that sets it going. */
export function carryOnLine(cards: CardOutcome[]): string {
  const next = cards.filter((c) => c.state === "confirmed" && c.then).map((c) => cleanThen(c.then)).filter(Boolean);
  return next.length ? `They confirmed it, so carry on with what you said comes next: ${next.join("; then ")}.` : "";
}

/**
 * A free follow turn is only for carrying on after a yes: the last answer has a confirmed card with a
 * next step (and no words come with it), or it offered answers and the member tapped this one. The
 * reason it's refused, or "" when it's fine. The database caps how many there are (ember_take('follow')).
 */
export function followRefusal(history: ThreadTurn[], input: string): string {
  const last = history.at(-1);
  if (!last || last.role !== "assistant") return "There's nothing for Torch to carry on from.";
  const said = input.trim();
  if (said) return last.choice?.picked === said && last.choice.options.includes(said) ? "" : "That isn't one of the answers Torch offered.";
  return carryOnLine(last.cards ?? []) ? "" : "There's nothing for Torch to carry on with.";
}

/**
 * The conversation as the model gets it. An answer's cards are reported at the start of the member's
 * next message, not inside Torch's own, so Torch reads the note as something it was told and doesn't
 * start writing such lines itself. A follow turn after a confirmed card has no words of the member's:
 * the note itself says to carry on. `follow` is about `input`, the turn being asked now.
 */
export function threadMessages(history: ThreadTurn[], input: string, follow = false): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  let prev: ThreadTurn | null = null;
  const said = (text: string, carry: boolean) => {
    const note = prev ? turnNote(prev.cards ?? [], prev.choice) : "";
    const go = carry && !text.trim() && prev ? carryOnLine(prev.cards ?? []) : "";
    const line = note && go ? `${note.slice(0, -1)} ${go}]` : note || (go ? `${NOTE_START} ${go}]` : "");
    prev = null;
    return line && text ? `${line}\n\n${text}` : line || text;
  };
  for (const m of history) {
    if (m.role === "user") { out.push({ role: "user", content: said(m.content, !!m.follow) }); continue; }
    prev = m;
    // An answer that was only a card has no words; the API refuses an empty turn.
    out.push({ role: "assistant", content: m.content.trim() ? m.content : m.cards?.length ? "I prepared a card for you to check." : m.choice ? "I offered some answers to choose from." : m.content });
  }
  out.push({ role: "user", content: said(input, follow) });
  return out;
}

/** Torch's instructions for the note (lib/copilot.ts adds it to the ask task). */
export const CARDS_RULE = `A member's message may start with a line in square brackets that begins "${NOTE_START}". Brazework wrote that line, not the member: it says what happened to the cards from your last message, and which of the answers you offered they tapped. Go by it. A confirmed card is done: say so in a few words and never prepare it again. Don't offer a dismissed one again unless they ask. If one didn't go through, say why in plain words and prepare the fix. One not answered yet is still on their screen: point to it instead of preparing it twice. Never mention that line, and never write one like it.`;

/** Torch's instructions for offer_choices, added only where the page can show the buttons. */
export const CHOICES_RULE = `Asking with buttons: when you need one answer from the member to go on, and the possible answers are things you already have (their clubs, their projects, a milestone that's waiting, people a lookup returned, or yes and no for an optional step), write the question in one short sentence, then call offer_choices with 2 to 4 short answers in the member's words. It ends your message, so put everything else before it, and leave out the <<next: …>> line in that message. Never offer a name, club, address or link that didn't come from a tool or from the member. When the answer could be anything (what they measured, what they built, a link), just ask in words. They may tap one or type something else.`;

/** Torch's instructions for a card's next step, added only where the page can carry on (like CHOICES_RULE). */
export const THEN_RULE = `Carrying a job through: when the member asks for something that takes more than one card (add the project, then log the milestone on it, then ask someone to sign it), prepare the first card and set its then to the next step in a few of their words, like "log the milestone on it". When they confirm it, the note in square brackets tells you to carry on: prepare that next card the same way, and leave then out on the last step. Use then only for the job they asked for, never for new ideas (those go in the <<next: …>> line). When the note says to carry on, do just that step, with no greeting and no recap of what's done.`;
