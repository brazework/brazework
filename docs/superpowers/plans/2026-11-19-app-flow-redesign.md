# App flow redesign, stage 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the places to Home · Projects · Clubs · Record · Inbox, put an "Ask Ember" bar with in-page approve cards on every signed-in page, and give the project page a Next strip, an inline milestone timeline and inline drafts.

**Architecture:** Three pull requests on top of `main`. Pure decisions (place lookup, page context from a path, the Next step, card labels) live in small `web/src/lib/*.ts` modules with `node:test` unit tests; the React pieces only render what those return. Ember reuses `/api/copilot`, `useCopilot`, `EmberAnswer` and `ProposalCard`; the request grows one optional `page` field.

**Tech Stack:** Next.js 16 (App Router, Cache Components), React 19, Supabase (RLS), Tailwind 4 tokens in `globals.css`, `motion/react`, `node:test` (`npm test`), Playwright-style e2e journeys in `web/e2e/*.cjs` (`npm run e2e`).

**Spec:** `docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md`

## Global Constraints

- Labels, in order: `Home`, `Projects`, `Clubs`, `Record`, `Inbox`. Place ids: `home`, `projects`, `clubs`, `record`, `inbox`.
- Routes unchanged: `/feed`, `/projects`, `/communities`, `/profile`, `/messages`.
- Bar placeholder, verbatim: `Ask Ember, or tell it what you did…`. `/` focuses it; ⌘K still opens the palette.
- Milestone card buttons, verbatim: `Log and send to club`, `Edit`, `Not now`.
- Next strip steps, in priority order: ask a named person to sign a waiting milestone; log the first milestone; send a draft; share the signed card.
- Design tokens from `web/src/app/globals.css` only; phone and desktop, light and dark, `motion-reduce` respected, visible focus.
- The AI never verifies or signs, never posts without the member's yes, never changes or deletes what they made.
- Never run anything against `web/.env.local` (production). Local checks: `npx tsc --noEmit && npm run lint && npm test`, then `npm run e2e`.
- Stay compatible with open PRs: #115 and #112 edit `projects/[id]/page.tsx` (keep hero and milestone markup; add new pieces as separate components); #116–#118 edit `proposal-card.tsx` (touch only the button row and add one prop); #108 edits `sidebar.tsx`.

## Review Focus

1. **Typing `/` inside any field** (composer, chat, a card's textarea) must type a slash, not jump to the bar. Test: `askShortcut` unit test in Task 2.
2. **Ember is off** (no API key, 503) or the daily limit is reached (429): the bar must still search and show the server's message under it, not a dead spinner. Test: e2e step in Task 2 (the e2e stack has no Anthropic key, so this is the default there).
3. **A page id the member can't read** (private project, someone else's club): the bar sends it, the server must drop it rather than leak a title. Test: `pageContext` returns only the id; the server resolves the title with the member's own RLS client (Task 2, code review).
4. **A project with only declined or draft milestones**: the Next strip must not say "ask X to sign" for those. Test: `nextStep` unit test in Task 3.
5. **Visitor (not a builder) on a project page**: no Next strip, no drafts, no add-milestone form. Test: `nextStep` returns `null` for `builder: false` (Task 3) and the e2e journey checks a visitor sees none.

---

## PR 1: Sidebar and names

### Task 1: Places renamed everywhere

**Files:**
- Modify: `web/src/lib/places.ts`, `web/tests/places.test.ts`
- Modify: `web/src/app/(app)/sidebar.tsx` (icons map keyed by new ids; group labels "Projects" and "Clubs"; drop the "Log work" / "Ask Ember" buttons only in PR 2)
- Modify: `web/src/app/(app)/projects/page.tsx` (metadata title and `PageHeader` title `Projects`)
- Modify: `web/src/lib/goals.ts:36`, `web/src/lib/week.ts:77` (title `Projects`), plus any "your proof" copy that names the place → "your record"
- Modify: `web/src/lib/landing-demo.ts`, `web/src/components/landing/app-tour.tsx` (labels and the `Proof`/`Build` titles), keeping their internal ids stable only where e2e or #124 depend on them
- Modify: `web/e2e/u-build.cjs`, `web/e2e/s-landing.cjs`, any other journey matching the old labels (`grep -rnE '"(Today|Build|Club|Proof)"' web/e2e`)

**Interfaces:**
- Produces: `PlaceId = "home" | "projects" | "clubs" | "record" | "inbox"`; `PLACES`, `placeFor(path)`, `placeTabsFor(path)`, `MENU_PAGES` unchanged in shape.

- [ ] **Step 1: Update `tests/places.test.ts` first**: labels `["Home", "Projects", "Clubs", "Record", "Inbox"]`; every `placeFor(...)?.id` expectation uses the new ids (`/projects/p1` → `projects`, `/pro` → `record`, `/c/abc/manage` → `clubs`, `/post/1` → `home`, `/messages/g/1` → `inbox`); `tabs(...)` expectations use the new place ids; add `assert.equal(placeFor("/feed")?.href, "/feed")` and the same for the other four routes (routes unchanged).
- [ ] **Step 2: Run `npm test -- tests/places.test.ts`**: expect failures on the labels and ids.
- [ ] **Step 3: Rename in `places.ts`** (ids, labels, comment block), then fix every TypeScript error `npx tsc --noEmit` reports (the sidebar's `PLACE_ICON`, any `placeFor(...)?.id === "build"` comparison).
- [ ] **Step 4: Rename the copy** in the files listed above. Keep the verb "build" where it isn't the place.
- [ ] **Step 5: Update e2e journeys** for the new labels (`name: "Projects", level: 1`; sidebar link `Clubs, 1 to sign`; landing tour tabs `Record`, `Clubs`; the "Open Club" button → "Open Clubs" only if the tour's button text changed).
- [ ] **Step 6: Run `npx tsc --noEmit && npm run lint && npm test`**: all pass.
- [ ] **Step 7: Run `npm run e2e`** (private stack, see the notes folder): all pass.
- [ ] **Step 8: Commit** `Places: Home, Projects, Clubs, Record, Inbox` and open PR 1 with before/after screenshots (desktop sidebar, phone tab bar).

---

## PR 2: The Ask Ember bar

### Task 2: Page context, the bar, in-page cards

**Files:**
- Create: `web/src/lib/ember-bar.ts`, `web/tests/ember-bar.test.ts`
- Modify: `web/src/lib/copilot-request.ts` (optional `page`), `web/src/lib/copilot.ts` (`pageLine`), `web/src/app/api/copilot/route.ts` (append it to the system prompt)
- Create: `web/src/components/ember/ask-bar.tsx`
- Modify: `web/src/components/search/global-search.tsx` (placeholder; `onAsk` prop: Enter and the "Ask Ember" row ask inline instead of navigating; "See all results" still opens `/search`)
- Modify: `web/src/app/(app)/layout.tsx` (render `AskBar` in the search row, on phones too; skeleton the same height)
- Modify: `web/src/components/copilot/proposal-card.tsx` (button row only, plus `inline?: boolean`), `web/src/app/(app)/sidebar.tsx` (remove the "Log work" / "Ask Ember" pair; the bar replaces them)
- Modify: `web/e2e/m-layout.cjs` or a new `web/e2e/ae-ask-bar.cjs` registered in `web/e2e/run.sh`

**Interfaces:**
- Produces (`lib/ember-bar.ts`, pure):
  - `type PageRef = { kind: "project" | "club" | "event"; id: string }`
  - `pageContext(path: string): PageRef | null`: `/projects/<id>` (not `/projects`), `/c/<id>` and `/c/<id>/…`, `/events/<id>`; ids must match `/^[A-Za-z0-9_-]{1,64}$/`, else `null`.
  - `askShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; target: { tagName: string; isContentEditable: boolean } | null }): boolean`: true only for `/` with no modifiers and a target that isn't INPUT, TEXTAREA, SELECT or contenteditable.
  - `cardLabels(kind: string, inline: boolean): { confirm: string; edit: string | null; dismiss: string }`: milestone inline → `Log and send to club` / `Edit` / `Not now`; any kind inline → `Confirm` / `Edit` / `Not now`; not inline → `Confirm` / `null` / `Dismiss` (today's card unchanged).
  - `ASK_PLACEHOLDER = "Ask Ember, or tell it what you did…"`
- Produces (`copilot-request.ts`): `page: z.object({ kind: z.enum(["project","club","event"]), id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).optional()`.
- Produces (`copilot.ts`): `pageLine(db, page: PageRef | undefined): Promise<string>`: reads the title with the member's own client (RLS decides; unreadable → `""`). For a project, also the club names the member can send to and the linked repo (`project_repos.full_name`), and the instruction: when the member says what they did, prepare `propose_milestone` on this project, with evidence from the linked repo if `github_repo` finds a matching commit, release or pull request; never say it's done.
- Consumes: `useCopilot()`, `EmberAnswer`, `ProposalCard` (unchanged API plus `inline`).

- [ ] **Step 1: Write `tests/ember-bar.test.ts`**: `pageContext("/projects/abc")` → `{kind:"project",id:"abc"}`; `pageContext("/projects")` → `null`; `pageContext("/c/rkt/manage")` → `{kind:"club",id:"rkt"}`; `pageContext("/events/e1?x=1")` → `{kind:"event",id:"e1"}`; `pageContext("/projects/a%20b")` → `null`; `pageContext("/feed")` → `null`; `askShortcut` true for `/` on BODY, false on INPUT/TEXTAREA/contenteditable, false with metaKey; `cardLabels("milestone", true)` → `{confirm:"Log and send to club", edit:"Edit", dismiss:"Not now"}`; `cardLabels("post", false)` → `{confirm:"Confirm", edit:null, dismiss:"Dismiss"}`; `copilotRequest.safeParse({task:"ask", input:"x", page:{kind:"project", id:"bad id"}}).success === false`.
- [ ] **Step 2: Run `npm test -- tests/ember-bar.test.ts`**: fails (module missing).
- [ ] **Step 3: Implement `lib/ember-bar.ts`** and the `page` field; run the test: passes.
- [ ] **Step 4: Server**: `pageLine` in `copilot.ts`; the route appends it after the task instructions when `r.page` is set.
- [ ] **Step 5: `AskBar`** (`"use client"`): owns `useCopilot()` and an `EmberAnswerState`; renders `<GlobalSearch onAsk={ask} />` and, under it, `<EmberAnswer … inline />` with cards in `inline` mode. `ask(text)` runs `{ task: "ask", input: text, page: pageContext(path) ?? undefined }`. The answer closes on Clear and on a path change. The `/` shortcut moves to `askShortcut`.
- [ ] **Step 6: `ProposalCard` inline mode**: when `inline` and not editing, the field block shows a read-only summary (title, project, club, evidence link) and the buttons from `cardLabels`; `Edit` reveals today's fields. Confirm shows the done state at once and rolls back with the server's message if `r.ok` is false (optimistic).
- [ ] **Step 7: Layout**: the search row renders `AskBar` on every width (`md:block` → always), with a fallback of the same height; the sidebar drops its two top buttons.
- [ ] **Step 8: e2e journey**: on `/projects/<id>` press `/`, type "Got the PID loop stable", Enter; Ember is off on the e2e stack, so expect the bar to stay usable and an alert with the server's message under it; type "Rocket" and see a club result in the panel; ⌘K still opens the palette; typing `/` in the feed composer types a slash.
- [ ] **Step 9: Checks** (`tsc`, lint, `npm test`, `npm run e2e`), then **commit** `Ask Ember bar on every page, cards in the page` and open PR 2 with screenshots (bar on a project page, an inline milestone card from a dev run with a key if available, phone).

---

## PR 3: The project page

### Task 3: Next strip, inline drafts, inline milestone

**Files:**
- Create: `web/src/lib/next-step.ts`, `web/tests/next-step.test.ts`
- Create: `web/src/app/(app)/projects/[id]/next-strip.tsx`, `web/src/app/(app)/projects/[id]/project-drafts.tsx`
- Modify: `web/src/app/(app)/projects/[id]/page.tsx`: insert the strip after the hero section and the drafts at the top of the `#proof` panel; a "3 signed · 1 waiting" line in the hero; the owner gets `AddMilestone` inline (replace the link to the profile); heading "Proof" → "Milestones". No other markup changes (#115, #112).
- Modify: e2e `web/e2e/c-messages-projects.cjs` or `u-build.cjs` (whichever opens a project page)

**Interfaces:**
- Produces (`lib/next-step.ts`, pure):
  - `type NextStep = { kind: "ask_sign"; milestoneId: string; title: string; who: string } | { kind: "first_milestone" } | { kind: "send_draft"; draftId: string; title: string } | { kind: "share_signed"; milestoneId: string; title: string }`
  - `nextStep(i: { builder: boolean; milestones: { id: string; title: string; status: string; community_name?: string; vouch_name?: string }[]; drafts: { id: string; title: string }[] }): NextStep | null`: `null` when not a builder; first `pending` milestone → `ask_sign` with `who` = vouch name, else the club name; no milestones (ignoring `declined`/`refused`/`revoked`) → `first_milestone`; a draft → `send_draft`; a `verified` milestone → `share_signed`; else `null`.
  - `statusLine(ms: { status: string }[]): string`: `"3 signed · 1 waiting"`; omits a zero part; `""` when both are zero.
- Consumes: `ProposalCard`, `DraftCard`, `draftToProposal`, `isCardKind` (#111), `AddMilestone`, `MilestoneTimeline`.

- [ ] **Step 1: Write `tests/next-step.test.ts`**: visitor → `null`; one pending (club "Rocketry Club") + one verified → `ask_sign` with `who: "Rocketry Club"`; pending with `vouch_name: "Dr. Lee"` → `who: "Dr. Lee"`; only a declined milestone → `first_milestone`; no milestones and a draft → `first_milestone` (logging comes before sending); one verified and a draft → `send_draft`; one verified, no drafts → `share_signed`; `statusLine([{status:"verified"}×3, {status:"pending"}])` → `"3 signed · 1 waiting"`; only pending → `"1 waiting"`.
- [ ] **Step 2: Run it**: fails.
- [ ] **Step 3: Implement `next-step.ts`**: passes.
- [ ] **Step 4: Page data**: when the viewer is a builder and `dbFeatures().mcpWorkflows`, read `tool_drafts` (`status = 'waiting'`, `payload->>project_id = id`, own rows only by RLS), limit 10.
- [ ] **Step 5: `NextStrip`** (server component): one row, icon + sentence + one action. `ask_sign` → a link to the milestone's share/remind control (`#m-<id>`), `first_milestone` → opens `AddMilestone` (a client island with `defaultOpen`), `send_draft` → anchors to the draft card, `share_signed` → `CopyLink` of `/p/<milestoneId>` (the existing proof card route). Same height skeleton.
- [ ] **Step 6: `ProjectDrafts`**: maps drafts through `draftToProposal` (card kinds) or `DraftCard` (post/milestone), rendered inline in the milestones panel.
- [ ] **Step 7: e2e**: Ben's project with no milestones shows "Log your first milestone"; after logging one for his club it shows the waiting line and "Ask Rocketry Club to sign"; a visitor sees no strip.
- [ ] **Step 8: Checks, commit** `Project page: a Next strip, drafts and milestones inline`, open PR 3 with screenshots.

---

## Finish

- [ ] Each PR: `gh pr create`, `gh pr merge --auto --squash --delete-branch`, rebase on `main` when it moves, green CI.
- [ ] After the last merge: `curl -s https://brazework.com/api/health` reports the merge commit.
