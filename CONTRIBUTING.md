# Working on Brazework

How we ship today (two people, moving fast) and what changes when the team grows.

## Today: a pull request for every change, merged by CI

`main` is protected: every change goes in through a pull request, and it merges itself once the required checks pass. Nobody waits on anyone (two people; CI is the gate). Josh and Ian work the same way, and so does Claude Code.

1. Start from the latest main on a branch: `git switch main && git pull --rebase origin main && git switch -c fix-30-short-topic` (the Linear issue's ID and a few words).
2. Make the change. Run the checks locally before you push:
   ```sh
   cd web
   npx tsc --noEmit && npm run lint && npm test   # types, lint, unit tests (~30 s)
   npm run e2e                                    # the full suite: database rules + browser journeys (~8 min, needs Docker and Chrome)
   ```
3. Push the branch and open the pull request with auto-merge on:
   ```sh
   git push -u origin HEAD
   gh pr create --fill && gh pr merge --auto --squash --delete-branch
   ```
   GitHub Actions then runs, and `main` requires these to pass before it merges:
   - **checks**: typecheck, lint, unit tests, production build, smoke test
   - **e2e**: the same `npm run e2e` (a throwaway Supabase with every migration, then every journey)
   - **security**: production dependency audit and a secret scan of the history

   A pull request that touches no app or database file (docs, other workflows) skips checks and e2e, which counts as passing. Also on pull requests, every Monday, and on demand (Actions → Run workflow), but not on every push to `main`, so CI fits a free plan's 2,000 Actions minutes a month:
   - **quality**: Lighthouse budgets on public and logged-in pages (accessibility ≥ 90, best practices ≥ 90, no layout shift; speed is reported) and an OWASP ZAP scan of the running app that fails on any High-risk finding. Run it locally with `npm run quality` before a change to layout, scripts or headers.
   - **CodeQL**: code security analysis
4. Green: it squash-merges into `main`, Vercel deploys production, and any new database step is applied to production (below). Red: fixing it comes before anything else; push the fix to the same branch and it merges once green. Failure screenshots are attached to the run.
5. Want the other person's eyes on something risky? Request their review on the pull request. It isn't required.

Also on hand:
- `npm run load`: a k6 load test (200 members browsing at once, plus a sign-up burst) against the local stack. On GitHub: Actions → **Load test** → Run workflow.
- **Working with Claude Code:** `/next` works the next Linear issue end to end, `/ship` runs this path (branch, checks, pull request with auto-merge, CI, report), and `/standup` reports where things are (see `CLAUDE.md`). The Linear connection is in `.mcp.json`.

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
- Add a row for it in block 1 of `supabase/maintenance/health-check.sql` (it checks for one object the step creates, usually its `<name>_ready()` function), and a line in `docs/next-migration.md`.
- **Production applies it by itself.** After the merge, `.github/workflows/db-migrate.yml` asks production which steps it has (that same health-check block, read-only), applies the missing ones in order, and checks again. Nobody pastes SQL. If it fails, the run's log shows which step and why; fix it in a new pull request, and the next merge (or Actions → Database steps → Run workflow) picks up where it stopped. It needs the `SUPABASE_ACCESS_TOKEN` repository secret. The workflow refuses to run if the newest step in `order.txt` has no health-check row, so a step can't be forgotten.
- Never point a local dev server at production: `web/.env.local` is production. Tests use the local stack (`web/e2e/local-supabase.sh up`).

## Secrets

Never commit keys. Server keys live in Vercel's environment variables; local ones in untracked files. The CI secret scan fails the build if one slips into a commit.

## When a third person joins: add reviews

1. GitHub → Settings → Branches → `main`: require 1 approving review (pull requests and the required checks are already on).
2. Add `.github/CODEOWNERS` so changes to `supabase/` and billing code request the right reviewer.
3. Branch names stay `fix-30-short-topic`; Vercel posts a preview link on each pull request.

## Where things are

- Plan and status: `docs/plan.md`. Production setup: `docs/launch.md`. Migration steps: `docs/next-migration.md`.
- Work tracking: Linear, team Forge (see "Tracking work" above).
