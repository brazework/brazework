---
name: next
description: Work the next Linear issue end to end, like a product agent. Pick the next open step from the Brazework team's board (or the issue named in the arguments), plan it, build it, test it, ship it to main with the issue ID, and keep the issue updated the whole way. Use when asked "what's next", "do the next thing", "work FIX-30", or "/next".
---

# /next: work the board

The Linear team is **Forge** (team ID `e9a4549f-0bad-4ef4-a105-e907d69ab2ca`; key `FIX`, was `FOR`). How the board is organized is in the Linear doc "How we work in Linear (start here)" and in `CONTRIBUTING.md`. Read `CLAUDE.md` first.

## 1. Pick the issue

- If the arguments name an issue (`FIX-30`), use it.
- Otherwise list open issues **assigned to the person you're working with, or unassigned**, in projects other than Product's undecided backlog. Status Todo or In Progress first, then Backlog. Pick the lowest step in title order (`1.1 ·` before `1.2 ·` before `2.1 ·`; `N1 ·` before `N2 ·`) whose **blocked-by** issues are all Done.
- Skip issues that need a dashboard or account only a person can reach (label `Ops`: Supabase, Vercel, Stripe, GitHub or Linear settings). Instead, list them in your final message as "waiting on <owner>".
- Never pick a `Source: Feedback` issue still in Backlog: approving or denying member feedback is the founders' call.
- Say which issue you picked and why, in one line, then continue without waiting.

## 2. Start it

- Move it to **In Progress** and assign it if unassigned.
- Read the whole description and every comment. The "Done when" line is the acceptance test.
- If the plan in the issue is out of date with the code, update the description before building, then comment what changed and why.

## 3. Build and test

- Follow `CONTRIBUTING.md`: database changes are a new additive file, appended to `supabase/order.txt`, with tests in `supabase/tests/` and a line in `docs/next-migration.md`.
- Add or extend tests for the behavior: unit (`web/tests`), SQL rules, or an e2e step.
- Never run anything against production: `web/.env.local` is production. Use the local stack.
- Checks before shipping (all must pass; show the output):
  `cd web && npx tsc --noEmit && npm run lint && npm test`, then `npm run e2e` for anything that touches pages, data or auth, and `npm run quality` for anything that touches layout, headers or performance.

## 4. Ship

Use the `/ship` skill, with the issue ID. It commits with `FIX-n:` in the subject and `Fixes FIX-n` in the body, opens a pull request with auto-merge, watches CI until it merges into main, and reports.

## 5. Close the loop in Linear

- Comment on the issue: what shipped, the commit, how it was verified (the commands and results), and anything left over.
- When CI on main is green and the "Done when" line is met, move it to **Done**. If something is left, file it as a new issue in the same milestone with the next step number, and link it.
- If the work changes a project's picture, post a short project update (`/standup` can do it).

## Rules

- One issue at a time; small commits.
- If you're blocked (a key, a decision, an account), comment on the issue with exactly what's needed and from whom, move it back to Todo, and pick the next one.
- If you notice a new problem while working, file it (Type, Area, project, milestone, step number) instead of silently fixing unrelated code.
