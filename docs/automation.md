# Automation

What runs by itself, what still needs a person, and what to add next. The goal: two founders ship fast without breaking things, and the board always matches reality. Status as of 2026-11-18; Linear IDs track what's open. Reliability targets and error budgets are in [slo.md](slo.md).

## Runs by itself today ✅

| What | When | Where it lives |
|---|---|---|
| **Typecheck, lint, unit tests (`web/tests`), production build, smoke test.** Required to merge | Every push to `main`, every PR, and weekly | `.github/workflows/web.yml` → checks |
| **End-to-end suite:** a throwaway Supabase with every database step, all SQL rule tests (`supabase/tests`), every browser journey in `web/e2e`, failing on any blocked resource. Required to merge | Same | web.yml → e2e (`npm run e2e`) |
| **Speed and accessibility budgets** (Lighthouse, public and logged-in pages) | Every PR, weekly and on demand (not every push, to save Actions minutes); locally `npm run quality` | web.yml → quality |
| **Security scan of the running app** (OWASP ZAP, fails on High) | Same as above | web.yml → quality |
| **Dependency audit and secret scan** (npm audit, gitleaks over all history). Required to merge | Same | web.yml → security |
| **Code security analysis** (CodeQL, fails on severity ≥ 7) | Every PR, weekly and on demand | `.github/workflows/codeql.yml` |
| **No preview deployments** (for speed): Vercel builds `main` only (`web/vercel.json` → `ignoreCommand`). Every pull request is tested by CI on a throwaway database instead | Every pull request | `web/vercel.json` |
| **Pull requests merge themselves** once the required checks pass. `main` is protected (branches must be up to date), and merged branches are deleted | Every PR with auto-merge on | GitHub branch protection; how we ship: [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Dependency updates** as grouped PRs; risky major upgrades pinned on purpose | Weekly (Mondays) | `.github/dependabot.yml` |
| **Production deploy** of `main` | Every push to `main` | Vercel's GitHub app |
| **Preview guard:** a preview build whose Supabase URL is production's stops with an explanation, so untested code never touches members' records. Until previews get their own database (FIX-83), every preview stops here on purpose; the "Vercel" check on a PR is red but not required | Every Vercel build | `web/src/lib/preview-guard.ts`, called from `web/next.config.ts` |
| **Database steps, staging first:** after a merge that touches `supabase/`, applies the missing steps to staging, then to production only if staging took them cleanly. Each asks the project which steps it has, applies the missing ones in `supabase/order.txt` order, stops at the first error, then checks again. One run at a time. Never paste SQL into production by hand. Nightly, staging alone is woken if paused (only in a free organization: waking it in a paid one costs money) and brought up to date | Every merge to `main` touching `supabase/`, nightly at 07:20 UTC (staging only), and Actions → Database steps (production) → Run workflow | `.github/workflows/db-migrate.yml` → `db-steps.yml`, `.github/scripts/supabase-wake.mjs` |
| **Linear sync:** every commit on `main` linked to its issue, `Fixes FIX-n` closes it, untracked commits logged as Done issues | Every push to `main` | `.github/workflows/linear-sync.yml` |
| **Member feedback → Linear:** themes, grades, a weekly review issue | As feedback arrives | In the database (pg_cron), `supabase/feedback*.sql` |
| **The app adapts to the database:** features whose step hasn't run stay hidden instead of breaking | Every request | `web/src/lib/db-features.ts` |
| **Weekly digest email** ("Your week") to every member who hasn't turned it off; never twice in a week (`digest_sends`). Check a run: Vercel → forge-app → Cron Jobs → logs, and Resend → Emails | Mondays 14:00 UTC | `web/vercel.json` → `/api/cron/digest` (needs `CRON_SECRET`, Linear FIX-86) |
| **Email alerts** for new messages, connection requests and comments on your posts, batched: at most one email a run per member, only for what's still unread 10 minutes after it arrived; a switch per kind in Settings → Email. Check a run: Vercel → forge-app → Cron Jobs → logs, and Resend → Emails | Every hour at :07 | `web/vercel.json` → `/api/cron/alerts` (needs `CRON_SECRET`, Linear FIX-18) |
| **Database watch** (read-only): Supabase's Security and Performance advisors plus the health check (missing steps, tables without row-level security, biggest tables). Anything not on the accepted list (`supabase/maintenance/advisor-baseline.json`) fails the run and opens or updates one "Database watch" issue in Linear. Fixes go in as a new step by PR; accept a warning with `node .github/scripts/db-watch.mjs --write-baseline` and say why | Mondays 13:30 UTC, and Actions → Database watch → Run workflow | `.github/workflows/db-watch.yml`, `.github/scripts/db-watch.mjs` |
| **Database backups**, kept 7 days (Storage files aren't included). How to restore: [accounts.md](accounts.md#restoring-the-database-from-a-backup-supabase-pro) | Daily | Supabase Pro → Database → Backups |

## Runs by itself once a key or setting is in ⏳

| What | Needs | Linear |
|---|---|---|
| **Infra drift, nightly** (read-only): `infra/check.mjs` compares production's Supabase, Vercel and DNS settings with `infra/desired.json`. Drift fails the run and opens or updates one "Infra drift" issue in Linear; a change made on purpose is blessed with `node infra/check.mjs --capture` and a PR. Every night at 07:40 UTC, and Actions → Infra drift → Run workflow (`.github/workflows/infra-drift.yml`) | The `VERCEL_TOKEN` repo secret (a Vercel token for the team; `SUPABASE_ACCESS_TOKEN` is already set). Until then the run says so and passes | FIX-131 |
| **Linear ↔ GitHub:** PRs and commits shown on issues; weekly cycles; auto-close stale Backlog; **auto-archive closed issues** (keeps us under the Free plan's 250-issue limit) | Linear settings, a workspace admin, ~10 minutes | FIX-5 |
| **Uptime alerts:** a text or email if the site or its database goes down | A free UptimeRobot monitor on `https://brazework.com/api/health` (200 = app and database up, 503 = not), every 5 minutes, alerting both founders | FIX-55 |
| **Error reports:** every server and browser error, with the commit it happened on, scrubbed of personal data (`web/src/lib/sentry-scrub.ts`). Built and off until the DSN is set | A free Sentry project (platform: Next.js). In Vercel, Production: `NEXT_PUBLIC_SENTRY_DSN` turns it on (and adds the privacy page's "When something breaks" section); `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` add readable stack traces (source maps, uploaded then deleted). Then redeploy | FIX-55 |

## Done by a person, on purpose 👤

| What | Why it isn't automatic (yet) | How |
|---|---|---|
| **Merging Dependabot PRs** | A person confirms green checks before main changes | `gh pr merge <n> --squash --auto` |
| **Approving or denying member feedback** | It's a product decision | The weekly Feedback review issue in Linear |
| **The load test** | It's heavy, and useful before a big launch, not on every push | Actions → Load test, or `npm run load` |

## Working with Claude Code

In this repo, Claude works from the Linear board (`.mcp.json` connects Linear; see `CLAUDE.md`):

- **`/next`:** picks the next open step (title order, blockers done), builds it, tests it, ships it with the issue ID, and closes it.
- **`/ship`:** the safe path to `main`: checks, a commit with the issue ID on a branch, a pull request with auto-merge, watch CI until it merges, report.
- **`/standup`:** what shipped, what's in progress, what's next, what's blocked, and the state of CI. `/standup post` also writes each project's weekly update.

## What to add next

In order of value. Each is filed in Linear when started.

1. **Previews on staging (FIX-83):** see the ⏳ table. Turns every PR's red "Vercel" check green and lets us click through a change before it merges.
2. **Uptime alerts and error reports (FIX-55):** built; they need the accounts above. Today we'd learn about a production error from a member.
3. **`VERCEL_TOKEN` for the nightly drift check (FIX-131):** one repo secret.
4. **Auto-merge green Dependabot patch updates:** the repo already allows auto-merge; this needs a small workflow that turns it on for patch updates. Minor and major updates stay manual.
5. **Apply infra settings from the repo (FIX-82):** a reviewed change to `infra/desired.json` applied after merge, as `db-migrate.yml` does for SQL.

## Tests on a laptop, same as CI

```sh
cd web
npx tsc --noEmit && npm run lint && npm test   # ~30 s
npm run e2e        # ~8 min: the full suite on a local Supabase (Docker + Chrome)
npm run quality    # ~6 min: Lighthouse budgets + the security scan
npm run load       # ~3 min: 200 members at once + a sign-up burst
```
