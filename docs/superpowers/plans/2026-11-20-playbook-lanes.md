# Playbook Lanes (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every field's playbook gets a Working part beside the Studying one, and every prompt, resource and description an assistant reads knows which to use.

**Architecture:** The lane is data on the playbook (`study` and `work`), not a second set of playbooks. `promptText` takes an optional `lane` and, when none is given, tells the assistant how to choose one from `me`. The working rules are one exported list, repeated wherever an assistant can enter: prompts, the playbook resource, the server's instructions and the milestone tools' descriptions. One small database step lets `me` say whether the member is studying or working.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Supabase Postgres, `node:test` through `tsx`, browser journeys in `web/e2e/*.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-20-playbook-lanes-design.md` (Linear FIX-209). This plan covers the spec's PR 1 only. PR 2 (backing from chat) and PR 3 (private from chat) get their own plans.

## Global Constraints

- Lanes are `study` and `work` in code, **Studying** and **Working** in every word a person reads.
- The 20 working moments, examples, proofs and signers come from the spec's table "A working moment for each field", copied as written. Every one `becomes: "milestone"`.
- The working lane adds no tools. It reuses each field's existing `tools` list, which was checked in November 2026.
- The seven working rules keep the spec's meaning. Their wording may be polished; the phrases the tests pin may not change.
- A member whose account is `student` is never asked the employer question or the lane question.
- Nothing in the working lane tells the assistant to pick a club first, to save a post on a project that isn't private, or that anything logged from chat is backed by GitHub.
- `/ai` opens on Studying. Settings → Your tools opens on the member's own lane.
- The consent choice is untouched. No tool gains or loses a field in this PR.
- The database step is additive, appended to `supabase/order.txt`, with a row in block 1 of `supabase/maintenance/health-check.sql` and a test in `supabase/tests/`. Never run SQL against production; `web/.env.local` points there. Use the local stack (`web/e2e/local-supabase.sh up`).
- Work on a branch cut from the latest `origin/main`. Commit subjects start with `FIX-209:`.
- Words follow the repo's house style: plain, short, no jargon.
- **Spec correction, found while planning.** Finding 2 names two strings. Only the tool description reaches an assistant: `ok()` in `web/src/app/api/mcp/route.ts` spreads `nextStep()` over the database's result, so the database's `next` is replaced. Leave `mcp_log_milestone` alone; fix the description (Task 5) and correct the spec's finding 2 and PR 1 bullet in the same commit.

## Review Focus

1. **`lane` typed loosely** ("Working", " WORK ", "professional", "job"). The obvious ones mean work or study; anything else is ignored and the prompt falls back to the lane steps. Never half-applied rules. *Pinned in Task 2.*
2. **Production hasn't applied the database step yet**, so `me` has no `account_type`. The lane steps tell the assistant to ask; nothing assumes Studying. *Pinned in Task 3.*
3. **A professional who is in a club types `/shipped` with no arguments.** They're asked once whether it was work, and aren't sent to the club. *Pinned in Task 4.*
4. **A field with no playbook plus `lane: work`** ("basket weaving"). The working rules still apply, with no field example. *Pinned in Task 4.*
5. **A read-only token in the working lane.** It writes the text out, still under the working rules, and never names a tool it lacks. *Pinned in Task 4.*

---

### Task 1: `me` says studying or working

**Files:**
- Create: `supabase/playbook-lanes.sql`
- Create: `supabase/tests/playbook-lanes.test.sql`
- Modify: `supabase/order.txt` (append `playbook-lanes`)
- Modify: `supabase/maintenance/health-check.sql` (block 1: add a comma after the last row, then the new row)

**Interfaces:**
- Produces: `mcp_me(p_hash text)` returns everything it does today plus `'account_type'` (`'student'` or `'professional'`). `public.playbook_lanes_ready()` returns `true`.

- [ ] **Step 1: Write the failing test** in `supabase/tests/playbook-lanes.test.sql`. Copy the header, the `t.ok` helper and the token setup from `supabase/tests/mcp-milestones.test.sql` (one transaction, rolled back). Assert:

```sql
select t.ok((public.mcp_me(repeat('b', 64))->>'account_type') = (select account_type from public.profiles where id = :'ben'),
  'me says whether the member is studying or working');
update public.profiles set account_type = 'professional' where id = :'ben';
select t.ok((public.mcp_me(repeat('b', 64))->>'account_type') = 'professional', 'and follows a change');
select t.ok(public.mcp_me(repeat('b', 64)) ?& array['id', 'name', 'headline', 'field', 'interests', 'profile_url', 'projects', 'verified_milestones', 'clubs', 'unread_notifications'],
  'everything me returned before is still there');
-- The twin of the club case in mcp-milestones.test.sql: with no club it is a hidden draft.
select (public.mcp_log_milestone(repeat('b', 64), 'p1', null, 'Rail test passed', '', array['https://github.com/acme/rig/commit/abc1234'])->>'id') as mid \gset
select t.ok((select private and status = 'draft' from public.milestones where id = :'mid'), 'a milestone logged with no club is hidden');
```

- [ ] **Step 2: Run it and see it fail.** With the local stack up: `cd web && docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < ../supabase/tests/playbook-lanes.test.sql`. Expected: `FAILED: me says whether the member is studying or working`.

- [ ] **Step 3: Write `supabase/playbook-lanes.sql`.** Header comment in the style of `supabase/approved-by.sql`: the next free step number (85 as of `b03c199`), FIX-209, "Run after account-type.sql. Additive and safe to re-run." `create or replace function public.mcp_me(p_hash text)` with the body from `supabase/mcp.sql` plus `'account_type', p.account_type`. Add `playbook_lanes_ready()` exactly as `approved_by_ready()` is written, with its grant.

- [ ] **Step 4: Register it.** Append `playbook-lanes` to `supabase/order.txt`. In block 1 of the health check add `(85, 'playbook-lanes', to_regprocedure('public.playbook_lanes_ready()') is not null)`.

- [ ] **Step 5: Apply and re-run.** `docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < ../supabase/playbook-lanes.sql`, then the test command from step 2. Expected: four `ok:` lines, no `FAILED`.

- [ ] **Step 6: Commit.** `git add supabase/playbook-lanes.sql supabase/tests/playbook-lanes.test.sql supabase/order.txt supabase/maintenance/health-check.sql && git commit -m "FIX-209: me says whether the member is studying or working"`

---

### Task 2: Lanes in the playbook data

**Files:**
- Modify: `web/src/lib/mcp-playbooks.ts` (types, `PLAYBOOKS`, new helpers)
- Modify: `web/src/lib/ai-guide.ts`, `web/src/app/ai/page.tsx`, `web/src/app/(app)/settings/tools/recipes.tsx` (read `study` where they read `moments` and `signers` today; no lane UI yet)
- Test: `web/tests/mcp-playbooks.test.ts`, `web/tests/ai-guide.test.ts`

**Interfaces:**
- Produces:

```ts
export type Lane = "study" | "work";
export type LaneContent = { moments: Moment[]; signers: string };
export type Playbook = { id: string; field: string; tools: PlaybookTool[]; study: LaneContent; work: LaneContent };
export const LANES: Lane[];                                   // ["study", "work"]
export const LANE_LABEL: Record<Lane, string>;                // { study: "Studying", work: "Working" }
export function laneFrom(v?: string | null): Lane | undefined;
export function defaultLane(accountType: string | null | undefined, clubs: number): Lane | undefined;
```

- `fieldSection(p)` in `ai-guide.ts` returns `{ id, field, tools, lanes: Record<Lane, { moments: { when, example, evidence }[]; signers: string }> }`.

- [ ] **Step 1: Write the failing tests.** In `mcp-playbooks.test.ts`, change the first test's per-playbook assertions to read `p.study` and add the working ones, then add the helper test:

```ts
assert.ok(p.study.moments.length >= 2, `${p.field}: at least 2 studying moments`);
assert.ok(p.study.moments.some((m) => m.becomes === "milestone"), `${p.field}: a studying milestone`);
assert.ok(p.study.signers.length > 10, `${p.field}: who signs when studying`);
assert.ok(p.work.moments.length >= 1 && p.work.moments.every((m) => m.becomes === "milestone"), `${p.field}: a working milestone`);
assert.match(p.work.signers, /manager|lead|client|director|head|engineer of record|principal|conductor/, `${p.field}: someone at work signs`);
assert.doesNotMatch(p.work.signers, /club|officers|TA\b|professor/, `${p.field}: no campus signers at work`);

test("lanes: loose words mean the obvious lane, and the default follows Home's rule", () => {
  for (const v of ["work", "Working", " WORK ", "professional"]) assert.equal(laneFrom(v), "work");
  for (const v of ["study", "Studying", "student"]) assert.equal(laneFrom(v), "study");
  for (const v of ["job", "", undefined, null]) assert.equal(laneFrom(v), undefined);
  assert.equal(defaultLane("student", 0), "study");
  assert.equal(defaultLane("student", 3), "study");
  assert.equal(defaultLane("professional", 0), "work");
  assert.equal(defaultLane("professional", 2), undefined, "a professional in a club is asked");
  assert.equal(defaultLane(undefined, 0), undefined, "no account type yet: ask");
  assert.equal(playbookFor("Mechanical")!.work.moments[0].example, "Housing rev D released: 9 parts, down from 14, at the same load rating");
  assert.equal(playbookFor("Software")!.work.moments[0].example, "Checkout p95 latency down from 820 to 310 ms");
});
```

In `ai-guide.test.ts` replace the tools/moments/signers assertion with `assert.ok(f.tools.length && f.lanes.study.moments.length && f.lanes.work.moments.length && f.lanes.study.signers && f.lanes.work.signers, ...)`.

- [ ] **Step 2: Run and see them fail.** `cd web && npx tsx --test tests/mcp-playbooks.test.ts tests/ai-guide.test.ts`. Expected: type errors on `study`, `work`, `laneFrom`.

- [ ] **Step 3: Change the type and the data.** Move each playbook's `moments` and `signers` into `study`, unchanged. Fill `work` for all 20 from the spec's table: `when` is "The moment", `example` is "Example title", `evidence` is "Proof", `signers` is "Who signs", both lower-cased at the start the way the studying ones are written.

- [ ] **Step 4: Add `LANES`, `LANE_LABEL`, `laneFrom`, `defaultLane`.** `laneFrom` trims and lower-cases, then matches a prefix of `work`/`professional` or `stud`. `defaultLane` is the rule in `clubPath` (`web/src/lib/guide-steps.ts`), with the in-a-club professional returning `undefined`.

- [ ] **Step 5: Keep everything compiling.** `fieldSection` returns `lanes`. `/ai` and `recipes.tsx` read `lanes.study` and `p.study` for now. Inside `mcp-playbooks.ts`, `playbookMarkdown` and `promptText` read `p.study` (Tasks 3 and 4 change them).

- [ ] **Step 6: Run.** `npm run typecheck && npx tsx --test tests/mcp-playbooks.test.ts tests/ai-guide.test.ts`. Expected: clean, all pass.

- [ ] **Step 7: Commit.** `git commit -am "FIX-209: A studying and a working part in every playbook"`

---

### Task 3: The working rules, the lane steps and the resource

**Files:**
- Modify: `web/src/lib/mcp-playbooks.ts`
- Test: `web/tests/mcp-playbooks.test.ts`

**Interfaces:**
- Consumes: `Lane`, `Playbook` from Task 2.
- Produces:

```ts
export const WORK_RULES: readonly string[];   // the spec's seven rules, in order
export function laneSteps(): string;          // how to choose a lane when the prompt wasn't given one
export const LANES_NOTE: string;              // one sentence for the server's instructions and tool descriptions
```

- `playbookMarkdown(p)` gains two headed parts. The address and the first heading don't change.

- [ ] **Step 1: Write the failing tests.**

```ts
test("the working rules, the lane steps and the note say what the spec fixes", () => {
  assert.equal(WORK_RULES.length, 7);
  const rules = WORK_RULES.join("\n");
  for (const re of [/employer allows/, /general terms/, /stays hidden/, /unless the project is private/, /never anyone on the Brazework project's team/, /Your last 90 days/, /don't claim anything logged from here is backed/, /Don't suggest a club/]) assert.match(rules, re);
  assert.doesNotMatch(rules, /post_update|draft_post|log_milestone|draft_milestone|request_signature/, "rules name no tool a token might lack");
  const steps = laneSteps();
  assert.match(steps, /account_type/);
  assert.match(steps, /Was this at work, or for school or a club\?/);
  assert.match(steps, /doesn't say/, "an older server with no account_type: ask");
  assert.match(steps, /student[\s\S]*don't ask/i, "a student account is never asked");
  assert.match(LANES_NOTE, /Working part/);
});

test("resources: each playbook has a studying part and a working part", () => {
  assert.match(playbooksIndexMarkdown(), /studying[\s\S]*working/i);
  for (const p of PLAYBOOKS) {
    const md = playbookMarkdown(p);
    const [study, work] = [md.indexOf("## If you're studying"), md.indexOf("## If you're working")];
    assert.ok(study > 0 && work > study, `${p.field}: both parts, studying first`);
    for (const m of p.study.moments) assert.ok(md.slice(study, work).includes(m.example));
    for (const m of p.work.moments) assert.ok(md.slice(work).includes(m.example));
    assert.match(md.slice(work), /employer allows/, "the working part opens with the rules");
    assert.doesNotMatch(md.slice(study, work), /employer allows/);
  }
});
```

- [ ] **Step 2: Run and see them fail.** `npx tsx --test tests/mcp-playbooks.test.ts`. Expected: `WORK_RULES` is not exported.

- [ ] **Step 3: Write `WORK_RULES`** from the spec's "The working rules, written once", first person, one string each, in order. No tool names except `my_projects` and `my_clubs`.

- [ ] **Step 4: Write `laneSteps()`.** The spec's five lane steps as one paragraph the assistant follows: call `me`; a `student` account is Studying, don't ask; a `professional` account with `clubs` 0 is Working; a `professional` account in a club, or a `me` that doesn't say, gets the one question, quoted exactly; once I say it was for an employer or a client, the working rules apply.

- [ ] **Step 5: Write `LANES_NOTE`:** "Each playbook has a Studying part and a Working part. Before recording work the member did for an employer or a client, read the Working part: ask whether their employer allows reading the tool, keep details general, and don't suggest a club."

- [ ] **Step 6: Change `playbookMarkdown` and `playbooksIndexMarkdown`.** Order: title, tools, `## If you're studying` (moments, who signs, as today), `## If you're working` (the rules numbered, moments, who signs), the closing line. The index's second line says each playbook has both parts.

- [ ] **Step 7: Run.** Expected: pass, including the older "resources" test.

- [ ] **Step 8: Commit.** `git commit -am "FIX-209: The working rules, and both parts in the playbook resource"`

---

### Task 4: Prompts take `lane`

**Files:**
- Modify: `web/src/lib/mcp-playbooks.ts` (`PROMPTS`, `promptText` and its helpers)
- Test: `web/tests/mcp-playbooks.test.ts`

**Interfaces:**
- Consumes: `laneFrom`, `WORK_RULES`, `laneSteps` from Tasks 2 and 3.
- Produces: `promptText(name, args, s)` reads `args.lane`. `start`, `shipped`, `result`, `standup`, `week`, `setup` and `ask_signature` list an optional `lane` argument; `ask_signature` also gains `field`.

Three cases for every prompt: `lane` is `study` (today's text, nothing added), `work` (rules in full, the working example and signers), or absent (today's text plus `laneSteps()` and the rules, pointing to the playbook's working part).

- [ ] **Step 1: Write the failing tests.**

```ts
const post = scopeFlags(["read", "draft", "post"]), draft = scopeFlags(["read", "draft"]), read = scopeFlags(["read"]);
const RECORDS = ["start", "shipped", "result", "standup", "week", "setup"];
const at = (lane: string | undefined, name: string, s = post, field = "Mechanical") => promptText(name, { field, ...(lane ? { lane } : {}) }, s)!;

test("working lane: the rules, the working example and signers, never a club first", () => {
  for (const n of RECORDS) for (const s of [post, draft, read]) {
    assert.match(at("work", n, s), /employer allows/, `${n}: the employer question`);
    assert.doesNotMatch(at("work", n, s), /pick the club that saw it/);
    assert.doesNotMatch(at("work", n, s), /Was this at work/, "the lane was given, so it isn't asked");
  }
  assert.match(at("work", "shipped"), /Housing rev D released/);
  assert.match(at("work", "shipped"), /manufacturing engineer/);
  assert.match(at("work", "result"), /log_milestone/, "a number at work is a hidden milestone");
  assert.doesNotMatch(at("work", "result"), /post_update|draft_post/);
  assert.match(at("work", "result", draft), /draft_milestone/);
  assert.match(at("work", "week", draft), /only on a private project/);
  assert.match(at("work", "standup"), /only on a private project/);
  assert.match(at("work", "setup"), /week/);
  assert.match(at("work", "week"), /\/review\?private=1/, "it leads to the review packet, hidden work ticked");
  assert.match(promptText("ask_signature", { field: "Mechanical", lane: "work" }, post)!, /manufacturing engineer/);
  assert.match(at("work", "shipped", read), /can only read/, "a read-only token still writes it out");
  assert.match(at("work", "shipped", post, "basket weaving"), /employer allows/, "no playbook: the rules still apply");
});

test("studying lane: no employer question and no lane question", () => {
  for (const def of PROMPTS) for (const s of [post, draft, read])
    assert.doesNotMatch(promptText(def.name, { field: "Mechanical", lane: "study" }, s)!, /employer allows|Was this at work/, def.name);
  assert.match(at("study", "shipped"), /pick the club that saw it/, "as today");
});

test("no lane (the normal case): the lane steps and the rules, in every prompt that records work", () => {
  for (const n of RECORDS) for (const s of [post, draft, read]) {
    assert.match(at(undefined, n, s), /Was this at work, or for school or a club\?/, n);
    assert.match(at(undefined, n, s), /employer allows/, n);
  }
  for (const n of [...RECORDS, "ask_signature"]) assert.ok(PROMPTS.find((p) => p.name === n)!.arguments.some((a) => a.name === "lane" && !a.required), `${n} takes lane`);
});
```

Extend the existing matrix test ("every field × every prompt × every token") with an outer loop over `[undefined, "study", "work"]` passed as `lane`.

- [ ] **Step 2: Run and see them fail.** Expected: the working assertions fail on "employer allows".

- [ ] **Step 3: Add `LANE_ARG`** ("Studying or Working. Leave it out and your assistant works it out from your profile.") to the seven prompts, and `FIELD_ARG` to `ask_signature`. The matrix test then requires every `ask_signature` text to include the playbook's address, the can't-send branch included: add `fieldLine` there too.

- [ ] **Step 4: Thread the lane through `promptText`.** `const lane = laneFrom(args.lane)`. The example and signers come from `p[lane ?? "study"]`. With no lane, append `laneSteps()` and the rules. With `work`, per prompt:
  - `start`, `shipped`: step 2 picks the project and leaves the club out unless I name one; `signLine` names the working signers.
  - `result`: uses `writeLine(s, "milestone")`, not `"post"`.
  - `week`: milestones only; a post only on a private project.
  - `standup`: saves its draft only on a private project; otherwise writes it out and says how to make the project private.
  - `setup`: opens with the employer question; suggests `week`; keeps the GitHub Actions line only "for a repo that's mine or that my employer allows".
  - `ask_signature`: relationships are manager, mentor or other; a tech lead or a client counts as `manager` or `other` until PR 3 adds `client`.
  - `start` and `week` end by pointing to `/u/<my id from me>/review?private=1`.

- [ ] **Step 5: Run.** `npx tsx --test tests/mcp-playbooks.test.ts`. Expected: pass, including the older prompt, `start` and `standup` tests unchanged.

- [ ] **Step 6: Commit.** `git commit -am "FIX-209: Prompts take a lane, and work it out when none is given"`

---

### Task 5: What the server says about itself

**Files:**
- Modify: `web/src/app/api/mcp/route.ts` (`instructions`)
- Modify: `web/src/lib/mcp.ts` (`me`, `log_milestone`, `draft_milestone` descriptions)
- Modify: `docs/superpowers/specs/2026-11-20-playbook-lanes-design.md` (the spec correction in Global Constraints)
- Test: `web/tests/mcp-playbooks.test.ts`

**Interfaces:**
- Consumes: `LANES_NOTE` from Task 3. `route.ts` may only export route handlers, so `instructions` stays private and reads the exported note.

- [ ] **Step 1: Write the failing test.**

```ts
test("the tools say where work stays, and which part of the playbook to read", () => {
  const d = (n: string) => MCP_TOOLS.find((t) => t.name === n)!.description;
  assert.match(d("me"), /account_type/);
  assert.match(d("me"), /Studying or Working/);
  for (const n of ["log_milestone", "draft_milestone"]) {
    assert.doesNotMatch(d(n), /shows on the member's profile only once/, `${n}: no longer claims it shows`);
    assert.match(d(n), /stays hidden/);
    assert.match(d(n), /Working part/);
  }
});
```

- [ ] **Step 2: Run and see it fail.**

- [ ] **Step 3: Change the three descriptions.** `me`: the field picks the playbook; `account_type` and the clubs count pick its part, Studying or Working. `log_milestone` and `draft_milestone`: replace the sentence about showing with "It stays hidden on the member's profile until they show or share it in Brazework." and add `LANES_NOTE`'s second sentence.

- [ ] **Step 4: Add `LANES_NOTE` to `instructions`**, after the playbooks sentence, for all three kinds of token.

- [ ] **Step 5: Correct the spec.** Finding 2 and the PR 1 bullet "The same step corrects…": the database's `next` never reaches an assistant, so only the description changes and the step replaces `mcp_me` alone.

- [ ] **Step 6: Run** `npm run typecheck && npm test`. Expected: clean; every test passes.

- [ ] **Step 7: Commit.** `git commit -am "FIX-209: The server says work stays hidden, and points to the working part"`

---

### Task 6: The switch on /ai and in Settings

**Files:**
- Create: `web/src/components/playbooks/lane-moments.tsx` (client)
- Modify: `web/src/app/ai/page.tsx`
- Modify: `web/src/app/(app)/settings/tools/recipes.tsx`, `tools-client.tsx`, `page.tsx`

**Interfaces:**
- Consumes: `Lane`, `LANES`, `LANE_LABEL`, `defaultLane` from Task 2; `fieldSection`'s `lanes`.
- Produces:

```tsx
export function LaneSwitch({ value, onChange, label }: { value: Lane; onChange: (l: Lane) => void; label: string }): JSX.Element;
// A group of two buttons, aria-pressed on the chosen one, aria-label = label.
export function LaneMoments({ lanes, initial }: { lanes: Record<Lane, { moments: { when: string; example: string; evidence: string }[]; signers: string }>; initial: Lane }): JSX.Element;
// The switch, then that lane's moments and "Signed by …", in /ai's existing markup.
```

- `FieldRecipes` gains `initialLane: Lane`; `ToolsHub` gains `lane: Lane` and passes it down.

- [ ] **Step 1: Write the failing journey steps.** In the journey that opens `/ai` (find it with `grep -ln '"/ai"\|/ai`' web/e2e/*.cjs`), in its own style: the Mechanical section shows "Ran two hours under load without slipping"; press Working inside that section; it shows "Housing rev D released" and no longer shows the studying example. In `web/e2e/l-tools.cjs`: signed in as a professional in no club (flip a seeded member with `set_account_type` in the journey's setup if the seed has none), Settings → Your tools shows the recipes on Working.

- [ ] **Step 2: Build `LaneSwitch` and `LaneMoments`.** Buttons at least 36px tall, the pressed one in ink like the hero's chips (`web/src/components/landing/proof-stage.tsx`), no layout shift between lanes.

- [ ] **Step 3: Use them.** `/ai` renders `<LaneMoments lanes={f.lanes} initial="study" />` where it lists moments and signers today; the page stays a server component. `recipes.tsx` holds `lane` in state beside `id`, starts from `initialLane`, reads `p[lane]`, and shows `/result` as "a number → a hidden milestone" when the lane is work. `page.tsx` selects `account_type` with the field and passes `defaultLane(account_type, clubList.length) ?? (account_type === "professional" ? "work" : "study")`.

- [ ] **Step 4: Look at it.** Start the dev server (`npm run dev`, local database), open `/ai` and Settings → Your tools at desktop and phone width, both lanes, light and dark.

- [ ] **Step 5: Run** `npm run typecheck && npm run lint && npm run e2e`. Expected: "All end-to-end checks passed."

- [ ] **Step 6: Commit.** `git add -A web/src web/e2e && git commit -m "FIX-209: A Studying / Working switch on /ai and in Your tools"`

---

### Task 7: The docs and the journey through the server

**Files:**
- Modify: `docs/mcp-workflows.md`
- Modify: `web/tests/mcp-playbooks.test.ts` (the docs test)
- Modify: `web/e2e/zd-review.cjs`

- [ ] **Step 1: Write the failing docs test.** In "docs/mcp-workflows.md covers every field…" add:

```ts
for (const p of PLAYBOOKS) assert.ok(doc.includes(p.work.moments[0].example), `docs: ${p.field}'s working moment`);
assert.match(doc, /\| `lane` \|/, "docs: the lane argument");
assert.match(doc, /Was this at work, or for school or a club\?/, "docs: how the lane is chosen");
```

- [ ] **Step 2: Run and see it fail**, then write the docs: a short section "Studying or working" (the lane steps, the seven rules, what each command does in the working lane), a `lane` row beside `field` in the commands text, and under every `### Field` a "Working:" line with the moment, example, proof and who signs. Correct the sentence that says a logged milestone shows once verified.

- [ ] **Step 3: Extend `web/e2e/zd-review.cjs`**, beside its existing `prompts/get` call and in its style:
  - `initialize`: `instructions` includes "Working part".
  - `tools/call` `me`: `account_type` is `student` or `professional`.
  - `prompts/get` `shipped` with `{ field: "Software", lane: "work" }`: the text includes "employer allows" and "Checkout p95 latency".
  - `resources/read` `brazework://playbooks/software`: the text includes "## If you're working".

- [ ] **Step 4: Run** `npm test && npm run e2e`. Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -am "FIX-209: Docs and the journey cover the working lane"`

---

### Task 8: Two reads, then ship

- [ ] **Step 1: Run everything once more:** `cd web && npm run typecheck && npm run lint && npm test && npm run e2e`.
- [ ] **Step 1b: Walk one field from each family** on the local server, in an assistant connected to it, as a professional in no club typing `/shipped` with no arguments: Software, then Mechanical, Physics and Design. Each time the assistant should ask about the employer before reading a tool, use that field's working example, name its working signers, and not mention a club.
- [ ] **Step 2: Open the pull request without auto-merge.** Title `FIX-209: Playbook lanes: every field works for people who work`. Fill the template; under Database tick the new step and name `supabase/playbook-lanes.sql`.
- [ ] **Step 3: Hold for the two reads the spec decided.** Josh reads the Software working moment and Ian reads the Mechanical one, on `/ai`. Change what they change. The other 18 ship as written.
- [ ] **Step 4: Turn auto-merge on** (`gh pr merge --auto --squash --delete-branch`) and follow `/ship` from its step 7: merged, `main` green, and **Database steps (production)** green for the new step.
- [ ] **Step 5: Check production once.** From an assistant connected to Brazework, `me` returns `account_type`, and `brazework://playbooks/software` has a working part.
- [ ] **Step 6: Comment on FIX-209** with the pull request, the merge commit, the CI result and what was checked. Don't close it: PR 2 and PR 3 remain.
