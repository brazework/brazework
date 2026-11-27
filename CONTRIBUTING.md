# Working on Brazework

How we ship today (two people, moving fast) and what changes when the team grows.

## Your first day

**What an owner gives you** (each is an invite to your email; nobody shares a password or a key):
- **GitHub:** a member of the `brazework` organization, so you can push branches and open pull requests.
- **Linear:** a member of team Forge, where the work is.
- **Supabase:** the free **Brazework Staging** organization with the **Developer** role, so you can look at staging's data and logs. Production stays with the founders; you don't need it to build or ship.
- **Vercel:** a member of the team, to read a preview's build log when one fails.

**What you install:** Node 22, Docker (OrbStack or Docker Desktop), the GitHub CLI (`gh auth login`), and optionally Claude Code.

**Then:**
```sh
git clone https://github.com/brazework/brazework && cd brazework/web
npm install
npm run dev        # http://localhost:3000, on a private database with test members
```
No keys and no `.env.local`. Sign in as `maya@forge.test` (or josh@, ben@, cara@), password `forge-test-pass-1`.

## Where your code runs

| Where | How it gets there | Which database | Who it can hurt |
|---|---|---|---|
| **Your laptop** | `npm run dev` | A private one in Docker, rebuilt from `supabase/order.txt` with test members (`npm run dev -- --fresh` starts it over) | Nobody |
| **A pull request** | CI tests it on a throwaway database (no preview site: they're off for speed, `web/vercel.json`) | A fresh one in Docker, built from `supabase/order.txt` | Nobody |
| **Production** | Merge: Vercel deploys `main`, and new database steps apply themselves | Production | Members, which is why everything above comes first |

Two guards keep untested code off production's database, whatever anyone's settings say: a **preview** build pointed at it stops (if previews are ever switched back on), and a **dev server** pointed at it refuses to start (`web/src/lib/preview-guard.ts`). You never need production's keys to work on Brazework.

## Today: a pull request for every change, merged by CI

`main` is protected: every change goes in through a pull request, and it merges itself once the required checks pass. Nobody waits on anyone (two people; CI is the gate). Josh and Ian work the same way.

Agent-authored pull requests (Forge, Rivet, and other cloud agents) follow [docs/team-playbook.md](docs/team-playbook.md). The steps below are how Josh and Ian ship.

1. Start from the latest main on a branch: `git switch main && git pull --rebase origin main && git switch -c fix-30-short-topic` (the Linear issue's ID and a few words).
2. Make the change. Run the checks locally before you push:
   ```sh
   cd web
   npx tsc --noEmit && npm run lint && npm test   # types, lint, unit tests (~30 s)
   npm run e2e                                    # the full suite: database rules + browser journeys (~8 min, needs Docker and Chrome)
   ```
3. Push the branch. **Ship Bot** opens the pull request with auto-merge on ([docs/ship-bot.md](docs/ship-bot.md)); name it `wip/…` to push without shipping, or add the `hold` label to stop one. Until the bot is set up, open it yourself:
   ```sh
   git push -u origin HEAD
   gh pr create --fill && gh pr merge --auto --squash
   ```
   GitHub Actions then runs, and `main` requires these to pass before it merges:
   - **checks**: typecheck, lint, unit tests, production build, smoke test
   - **Fast gate**: every SQL rule test plus the must-not-break journeys (sign up and post, clubs and events, messages and projects, verifying a milestone) on a throwaway Supabase, ~4 min. Locally: `npm run e2e:fast`
   - **e2e**: the full suite (`npm run e2e`), split across parallel jobs. On a pull request it runs only when the change touches `web/e2e/`, `package.json` or `.github/`, or has the `full-e2e` label; otherwise it skips (which counts as passing). It always runs after the merge on `main`, and if it fails there production is rolled back by itself ([docs/verify-after-deploy.md](docs/verify-after-deploy.md))
   - **security**: production dependency audit and a secret scan of the history

   A pull request that touches no app or database file (docs, other workflows) skips checks and e2e, which counts as passing. Also on pull requests, every Monday, and on demand (Actions → Run workflow), but not on every push to `main`, so CI fits a free plan's 2,000 Actions minutes a month:
   - **quality**: Lighthouse budgets on public and logged-in pages (accessibility ≥ 90, best practices ≥ 90, no layout shift; speed is reported) and an OWASP ZAP scan of the running app that fails on any High-risk finding. Run it locally with `npm run quality` before a change to layout, scripts or headers.
   - **CodeQL**: code security analysis
4. Green: it squash-merges into `main`, Vercel deploys production, and any new database step is applied to production (below). Red: fixing it comes before anything else; push the fix to the same branch and it merges once green. Failure screenshots are attached to the run.
5. Want the other person's eyes on something risky? Request their review on the pull request. It isn't required.

Also on hand:
- `npm run load`: a k6 load test (200 members browsing at once, plus a sign-up burst) against the local stack. On GitHub: Actions → **Load test** → Run workflow.
- **Working with Claude Code:** `/next` works the next Linear issue end to end, `/ship` runs the checks and opens a pull request (an agent leaves auto-merge off until Temper approves; see `.claude/skills/ship/SKILL.md` and [docs/team-playbook.md](docs/team-playbook.md)), and `/standup` reports where things are (see `CLAUDE.md`). The Linear connection is in `.mcp.json`. The numbered steps above stay how Josh and Ian ship.

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
- **Staging, then production, apply it by themselves.** After the merge, `.github/workflows/db-migrate.yml` gives it to staging first and to production only if staging took it cleanly. Each one is asked which steps it has (that same health-check block, read-only), applies the missing ones in order, and checks again. Nobody pastes SQL. If it fails, the run's log shows which step and why; fix it in a new pull request, and the next merge (or Actions → Database steps → Run workflow) picks up where it stopped. It needs the `SUPABASE_ACCESS_TOKEN` repository secret. The workflow refuses to run if the newest step in `order.txt` has no health-check row, so a step can't be forgotten.
- Your laptop and the tests use the local stack: `npm run dev` and `npm run e2e` build it from `order.txt`, so a new step shows up locally as soon as you add it (`npm run dev -- --fresh`).

## Secrets

Never commit keys. Server keys live in Vercel's environment variables; local ones in untracked files. The CI secret scan fails the build if one slips into a commit.

## When a third person joins: add reviews

1. GitHub → Settings → Branches → `main`: require 1 approving review (pull requests and the required checks are already on).
2. Add `.github/CODEOWNERS` so changes to `supabase/` and billing code request the right reviewer.
3. Branch names stay `fix-30-short-topic`; Vercel posts a preview link on each pull request.

## Where things are

- Plan and status: `docs/plan.md`. Production setup: `docs/launch.md`. Migration steps: `docs/next-migration.md`.
- Work tracking: Linear, team Forge (see "Tracking work" above).
