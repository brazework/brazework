# Working on Brazework

How we ship today (two people, moving fast) and what changes when the team grows.

## Today: push to main, CI behind every push

1. Pull first: `git pull --rebase origin main`.
2. Make the change. Run the checks locally before you push:
   ```sh
   cd web
   npx tsc --noEmit && npm run lint && npm test   # types, lint, unit tests (~30 s)
   npm run e2e                                    # the full suite: database rules + browser journeys (~8 min, needs Docker and Chrome)
   ```
3. Push to `main`. GitHub Actions then runs, on every push:
   - **checks**: typecheck, lint, unit tests, production build, smoke test
   - **e2e**: the same `npm run e2e` (a throwaway Supabase with every migration, then every journey)
   - **security**: production dependency audit and a secret scan of the history

   And on pull requests, every Monday, and on demand (Actions → Run workflow), but not on every push, so CI fits a free plan's 2,000 Actions minutes a month:
   - **quality**: Lighthouse budgets on public and logged-in pages (accessibility ≥ 90, best practices ≥ 90, no layout shift; speed is reported) and an OWASP ZAP scan of the running app that fails on any High-risk finding. Run it locally with `npm run quality` before a change to layout, scripts or headers.
   - **CodeQL**: code security analysis
4. If a check goes red, fixing it comes before anything else. Failure screenshots are attached to the run.

Also on hand:
- `npm run load`: a k6 load test (200 members browsing at once, plus a sign-up burst) against the local stack. On GitHub: Actions → **Load test** → Run workflow.
- **Working with Claude Code:** `/next` works the next Linear issue end to end, `/ship` runs the safe push-to-main path, and `/standup` reports where things are (see `CLAUDE.md`). The Linear connection is in `.mcp.json`.

Small, focused commits with plain messages ("Events: week strip and host menu"), one feature each.

## Tracking work (Linear)

Everything lives in the Linear team **Forge**. Its key, `FIX` (it was `FOR`; old IDs still redirect), is the prefix on every issue: `FIX-30` is issue 30.

- **Projects** are the big goals: *Launch* (switching production on), *Brand & growth* (the rename and the landing page), *Quality* (speed and security in CI) and *Product* (features and member feedback). Each project has numbered milestones, so reading top to bottom gives the order of work.
- **Labels** come in groups:
  - **Type**: pick exactly one. Feature, Bug, Improvement or Chore.
  - **Area**: where a member would notice it. Clubs, Projects, Profiles, Feed & Events, Messages, Notifications, Companies, AI, iPhone.
  - **Focus**: cross-cutting work. Ops, Security, Performance, Docs, Growth.
  - **Source**: Feedback or Roadmap. The in-app feedback sync sets Feedback itself.
- **Commits mention the issue.** Write `FIX-30: Lighthouse budget in CI` to link the commit. Add `Fixes FIX-30` on its own line to close the issue when the commit lands on `main`.
- **Nothing ships untracked.** On every push to `main`, `.github/workflows/linear-sync.yml` updates Linear. A commit that names an issue gets a "shipped in" comment on it, and `Fixes` closes it. A commit that names no issue is logged as a **Done** issue (Source: Commit) in the project its files point to. That way Linear shows everything that shipped, including work done in Claude Code without an issue first. It needs the `LINEAR_API_KEY` repository secret (a Linear personal API key); until that's set, the job passes and does nothing. Add `[skip linear]` to a commit message to leave it out.
- **Statuses:** Backlog (not yet decided), Todo (decided, has an owner), In Progress, Done or Canceled. Canceled always gets a one-line reason in a comment.

## Changing the database

- Add a new file in `supabase/`, additive only (new tables, columns, functions; never drop what the live app uses).
- Append its name to [`supabase/order.txt`](supabase/order.txt). That one list drives CI, the local test stack and production setup.
- Add rule tests in `supabase/tests/<name>.test.sql` (run as real members inside a rolled-back transaction; see the existing ones).
- Add a line for it in `docs/next-migration.md`, then run it in production (Supabase → SQL Editor) after it's merged. `supabase/maintenance/health-check.sql` (read-only) shows which steps a database has.
- Never point a local dev server at production: `web/.env.local` is production. Tests use the local stack (`web/e2e/local-supabase.sh up`).

## Secrets

Never commit keys. Server keys live in Vercel's environment variables; local ones in untracked files. The CI secret scan fails the build if one slips into a commit.

## When a third person joins: switch to pull requests

1. GitHub → Settings → Branches → protect `main`: require a pull request, require the **checks**, **e2e** and **security** jobs to pass, no direct pushes.
2. Work on branches (`name/short-topic`); open a PR using the template; Vercel posts a preview link on it.
3. One approval from someone else before merging; squash-merge.
4. Add `.github/CODEOWNERS` so changes to `supabase/` and billing code request the right reviewer.

## Where things are

- Plan and status: `docs/plan.md`. Production setup: `docs/launch.md`. Migration steps: `docs/next-migration.md`.
- Work tracking: Linear, team Forge (see "Tracking work" above).
