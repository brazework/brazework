# Torch follows a job through

The assistant is Torch. It was called Ember when this was written; the founders renamed it the same
day (`docs/naming.md`). Code identifiers and file names still say `ember` and `copilot`.

Date: 2026-11-26 · Status: **approved by Josh in conversation** ("Approve, start PR 1"), after he
asked how Torch could be "proactive and not just read but actually do things in an interactive way".
He decided the cost of a follow turn the same day ("Yes, free and capped", section 4). The first pull
request (sections 1, 5 and 6) is built; sections 2 to 4 are not. No Linear issue yet: Linear wasn't
signed in when this was written, so the issues in Delivery still need creating.

This is step 1 of four. Steps 2 to 4 (acting on small things without a tap, speaking first, more tools
for officers) are listed at the end and are not designed here.

## Intent

A member says what they did once, and Torch carries it to the end: the project, the milestone, the
proof, the person who signs. Each step is still a card the member approves. What changes is that Torch
knows what happened to each card, asks its questions as buttons, and goes on to the next step without
being asked again.

> "I got the PID loop stable at 2% overshoot" → project card → **Confirm** → Torch goes on: milestone
> card → "Who saw it?" **[Rocketry Club] [A person]** → signature card → **Ask them to sign** → done.

Today that is four typed messages, and Torch forgets its own cards between them.

## Why

Torch already prepares 13 kinds of card and knows the page it's on. Three things stop it from finishing
a job:

- **It never learns what happened to a card.** The chat sends back only the text of each turn
  (`copilot-client.tsx` maps history to `{ role, content }`). Which cards Torch prepared, and whether
  the member confirmed, edited or dismissed them, never reaches it. So it can prepare the same card
  twice, or re-offer one the member turned down.
- **Each step needs a typed message.** After "Confirm" on a project card, nothing happens until the
  member types "now the milestone". The prompt even has Torch say "the ask comes next" and then wait.
- **Questions are typed, answers are typed.** "Which club should verify it?" has two or three known
  answers. The member types one.

## Found while reading (these change the design)

1. **The Ask Torch bar has no memory at all.** `ask-bar.tsx` sends `{ task, input, page }` with no
   history. A follow-up chip tapped in the bar ("Draft the post") reaches Torch with no idea what the
   answer above it said. Torch's own page sends the last 10 messages; the bar sends none.
2. **A long card can't fit in an answer, and fails silently.** An `ask` gets 1,000 output tokens, and a
   card's fields count against that. `propose_project` allows a write-up of 5,000 characters (about
   1,250 tokens). When the model runs out, `runAgent` sees a stop that isn't `tool_use` and returns:
   the member reads "I've drafted the project" and no card appears. Not reproduced against the live
   model; read from `copilot-agent.ts` and `copilot.ts` (`taskPrompt`).
3. **The prompt names a tool Torch doesn't have.** `TASKS.ask` tells Torch that "propose_review drafts
   a verify-or-decline decision". The tool isn't in `TOOLS`, and `makeExec` refuses it by design
   (`ember-approve-first.test.ts`). The sentence should go, and Torch should point officers to the
   Verify tab.
4. **New signals must travel as frames, not as text.** The iPhone app's parser (`ForgeKit/Ember.swift`)
   reads `tool` and `proposal` frames and skips any other frame, so a new frame is safe on installed
   builds. It has no code for the `<<next: …>>` text marker, so that marker most likely shows as raw
   text in the iPhone app today (read from the code, not checked in the simulator). Nothing new in this
   spec uses a text marker.
5. **The browser tests never call Torch.** No e2e journey posts to `/api/copilot`; cards are tested
   through drafts a tool left. So this step is tested with unit tests against a mock model (as
   `ember-cache.test.ts` does) and checked by hand on the local stack with a key.

## The design

### 1. Torch hears what happened to its cards

- `ProposalCard` takes an `onOutcome` callback and calls it when a card is **confirmed** (after the
  server says yes, with the title as the member left it), **failed** (with the server's message) or
  **dismissed**. A card not yet touched is **open**.
- The conversation (Torch's page and the bar) keeps these per answer and sends them with the history.
  A history item gains an optional `cards` list:
  `{ kind, label, state: "open" | "confirmed" | "dismissed" | "failed", note?, then? }`, at most 6 per
  message, `label` and `note` at most 160 characters, checked by `copilotRequest`.
- The server turns each list into one bracketed line at the start of the member's next message
  (`lib/ember-thread.ts`, pure and tested), for example:
  `[Brazework: what happened to the cards from your last message. a project "Rover": confirmed, it's done; a post "Static fire went clean": dismissed.]`
  It goes with the member's turn, not inside Torch's own, so Torch reads it as something it was told
  and doesn't start writing such lines itself.
- A card reports "confirmed" the moment it's tapped, as the card on screen does, and corrects itself to
  "didn't go through" with the server's reason if the server says no.
- Torch's instructions gain three rules: never prepare a card again once it's confirmed; don't offer a
  dismissed one again unless the member asks; for a failed one, say why in the member's words and
  prepare the fix.
- These notes are hints from the member's own browser. What is true still comes from the database:
  `memberContext` reloads the member's projects and waiting milestones (with ids) on every turn, which
  is also how Torch gets the id of a project confirmed a moment ago.
- Saved chats keep the outcome beside each card's label (`SavedMsg` gains `outcomes`; the `messages`
  column is JSON, so no database step). A reopened chat still shows labels, never a live card.

### 2. Torch asks with buttons

- A new tool, `offer_choices`: `{ options: 2 to 4 strings of at most 60 characters, hint?: string }`.
  Torch writes its question as text, then calls the tool. `makeExec` sends a `{ choice: { id, options,
  hint } }` frame and saves nothing.
- `runAgent` ends the turn after `offer_choices` (a new `endsTurn` list) instead of spending another
  round on a closing sentence.
- When to use it, in the instructions: Torch needs one answer to go on, and the answers are things it
  already has, such as the member's clubs, their projects, their waiting milestones, people a lookup
  returned, or yes and no for an optional step. Options are never invented names or addresses. An open
  question ("what did you measure?") stays a plain question.
- The browser shows the options as buttons under the answer, more prominent than the quiet follow-up
  chips, with the composer still open ("or type your answer"). When a turn has choices, its follow-up
  chips are hidden, and the instructions tell Torch not to give both.
- Tapping one shows it as the member's message and sends a follow turn (below). The pick rides in the
  history as `choice: { options, picked }`, and the server writes it into the note:
  `[You offered: Rocketry Club | A person who saw it. They picked: Rocketry Club]`.
- An installed iPhone build skips the frame and shows the question as text; the member types the
  answer, as now.

### 3. Torch carries on after a yes

- Every `propose_*` tool gains an optional `then`, at most 120 characters: what Torch will do next once
  this card is confirmed, in the member's words ("log the milestone on it"). It is set only when the
  card is one step of a job the member asked for. `Proposal` carries it.
- The card shows it as a quiet line above the buttons: **Then:** log the milestone on it.
- When a card with `then` is confirmed and the server says yes, the conversation sends a **follow
  turn** by itself: `{ task: "ask", follow: true, history }` with no typed input. The server writes the
  user turn from the last answer's outcomes:
  `[The member confirmed your card: a project "Rover". Carry on with: log the milestone on it.]`
  A follow turn with no confirmed `then` card and no picked choice is refused (400).
- On screen it reads as Torch continuing: a line "Confirmed. Carrying on…" under the card, then the
  next text and card in the same thread, with Stop available as on any answer.
- No follow turn when a card fails, is dismissed or has no `then`. One follow turn runs at a time; a
  card confirmed meanwhile rides along as an outcome in the next request.
- A follow turn uses the same tools and rules as any ask: it can look things up, prepare cards and
  offer choices. It cannot save anything.

### 4. What a follow turn costs

Decided by Josh, 2026-11-26, and the one database step: **an ask includes up to 3 follow turns, free.**

- `copilot_usage` gains `follows_left integer not null default 0`. `ember_take('ask')` sets it to 3.
  `ember_take('follow')` costs nothing, takes one from `follows_left`, and returns -1 at zero
  (`follow` joins `EMBER_CREDIT_COST` in `lib/ember-credits.ts` at 0). New file
  `supabase/ember-follow.sql`, added to `supabase/order.txt` and `docs/next-migration.md`, with a rule
  test beside `ember-credits.test.sql`.
- When a follow is refused (none left, the day rolled over, or the step hasn't run yet), nothing runs
  by itself. The card's **Then** line becomes a button, "Carry on · 1 credit", which asks as a normal
  paid ask. Choice buttons fall back the same way.
- The most a member can get for one credit is four model calls, and a follow turn takes no typed text.

Turned down: every follow turn costing 1 credit and waiting for a tap. It needs no database step, but
each step is then two taps and a three-step job costs 4 of a free member's 15 daily credits.

### 5. The bar keeps its thread

- The bar holds the turns of the exchange it's showing and sends them as history, with their cards and
  choices, until it's closed or the member moves to another page. At most 6 turns.
- The panel stacks the exchange: each earlier question as a quiet line with its answer and cards, the
  newest at the bottom, scrolling inside the panel past 60% of the window height.
- Where chats are saved (`dbFeatures().copilotChats`), the bar saves its thread with `saveChat` from
  the second turn on, and "Keep going on Torch's page" opens that chat (`/copilot?chat=<id>`). A single
  question and answer in the bar is not saved, as now.

### 6. Room to finish

- `ask` output goes from 1,000 to 2,500 tokens; the "under 250 words" rule for the answer text stays.
- `runAgent` treats a `max_tokens` stop as an error it reports: "[Torch ran out of room on that one.
  Ask for it in smaller pieces.]", never a silent return.
- Rounds per turn go from 4 to 6, for turns that read GitHub, read the record, prepare a card and
  offer a choice.
- The `propose_review` sentence leaves the prompt, and its entry leaves `TOOL_LABEL`. A test now fails
  if the instructions name a tool Torch isn't given.

Found while building the first pull request: under `npm run dev` a live answer stayed blank. React
mounts a component twice in development, and the reveal loop in `components/copilot/reply.tsx` kept
its cancelled frame handle, so it never asked for another frame. Production wasn't affected. Fixed in
the same pull request.

## Rules

- **Approve-first is unchanged.** Torch still saves nothing. A follow turn produces text, lookups,
  cards and choices, and every card still needs its own tap. `ember-approve-first.test.ts` keeps
  passing and gains cases for `offer_choices` and for a follow turn against the database that refuses
  writes.
- Torch still never verifies or signs, and never prepares a card the member didn't ask for. `then` is
  for the next step of the job they gave it, not for new ideas; those stay follow-up chips.
- Nothing typed by anyone else enters a follow turn: the server writes its user message from a fixed
  sentence plus labels the member's own cards already showed.
- No new stored data except card outcomes inside the member's own saved chats, which they can delete
  and which clear after 180 days as now.
- Group chats are untouched: Torch there keeps its read-only tools and prepares no cards.
- Phone and desktop, light and dark, reduced motion respected, buttons reachable by keyboard, the
  answer region announced politely as now.

## Not in this step

- A visible checklist of the whole job ("step 2 of 3"). `then` shows only the next step. Worth doing
  if members ask where a job is going.
- Torch acting without a tap on small, private, undoable things (step 2). It changes the rule above,
  so it is Josh and Ian's decision and gets its own spec.
- Torch speaking first: cards left by events such as a signature arriving or a pull request merging
  (step 3).
- New tools for officers: chasing RSVPs, sponsor reports, event recaps (step 4).
- The iPhone app: choice buttons, follow turns, and stripping the `<<next: …>>` marker. Installed
  builds keep working as they do today.
- A set of real asks to grade Torch's answers before and after prompt changes. There are unit tests
  and thumbs ratings, and no quality evals. Recommended before step 2.

## Testing

- `tests/ember-thread.test.ts` (new): outcome notes for each state, the limits on labels and counts,
  the follow turn's user message, and a follow turn with nothing to follow being refused.
- `tests/ember-agent.test.ts` (new, mock model): the turn ends after `offer_choices`; a `max_tokens`
  stop writes the notice; six rounds are allowed and a seventh isn't.
- `tests/ember-approve-first.test.ts`: `offer_choices` and `then` never write; `propose_review` is
  still refused.
- `tests/ember-bar.test.ts`: the bar's history (order, the 6-turn cap, cleared on a new page).
- `supabase/tests/ember-follow.test.sql`: 3 follows after an ask, none without one, none carried to
  the next day, and the daily total unchanged by a follow.
- By hand on the local stack with a key, on a phone width and a desktop width: the PID loop job above,
  starting with no project; a dismissed card that Torch doesn't offer again; a failed signature card
  (personal address) that Torch explains.

## Delivery

Three pull requests, each behind the local checks, each with its Linear issue (to create in team
Forge, project and milestone to pick):

1. **Torch hears its cards, and the bar keeps its thread** (sections 1, 5 and 6). No database step.
   Useful by itself: it ends repeated cards and fixes the bar's follow-ups.
2. **Choice buttons** (section 2). No database step.
3. **Carrying on after a yes** (sections 3 and 4). One database step, `ember-follow`.

## Calls made by the builder

- New signals are frames, because the iPhone app skips frames it doesn't know and would print a text
  marker.
- Outcomes travel in the request and are rendered by the server, with no new table: the record itself
  is reloaded each turn, so a wrong note can't change what Torch can do.
- `then` on each card, not a separate plan Torch declares up front: nothing to keep in step when the
  member edits a card or the job changes.
- A choice is a tool that ends the turn, so it costs no extra round.

## Open decision (Josh and Ian)

**How do we know it worked?** Nothing counts Torch's own cards today, only thumbs ratings. A daily
count of cards confirmed and dismissed per member (numbers only, no content) could ride in the same
database step. Recommended, but it's new data about members, so it's your call. It doesn't hold up the
first two pull requests.
