# Automation

What runs by itself, what still needs a person, and what to add next. The goal: two founders ship fast without breaking things, and the board always matches reality. Status as of 2026-11-10; Linear IDs track what's open.

## Runs by itself today ✅

| What | When | Where it lives |
|---|---|---|
| **Typecheck, lint, 35 unit tests, production build, smoke test** | Every push to `main`, every PR, and weekly | `.github/workflows/web.yml` → checks |
| **End-to-end suite:** a throwaway Supabase with every database step, all SQL rule tests, 8 browser journeys (79 checks), failing on any blocked resource | Same | web.yml → e2e (`npm run e2e`) |
| **Speed and accessibility budgets** (Lighthouse, public and logged-in pages) | Every PR, weekly and on demand (not every push, to save Actions minutes); locally `npm run quality` | web.yml → quality |
| **Security scan of the running app** (OWASP ZAP, fails on High) | Same as above | web.yml → quality |
| **Dependency audit and secret scan** (npm audit, gitleaks over all history) | Same | web.yml → security |
| **Code security analysis** (CodeQL, fails on severity ≥ 7) | Every PR, weekly and on demand | `.github/workflows/codeql.yml` |
| **Dependency updates** as grouped PRs; risky major upgrades pinned on purpose | Weekly (Mondays) | `.github/dependabot.yml` |
| **Production deploy** of `main` | Every push to `main` | Vercel's GitHub app |
| **Preview deploy** to forge-preview-eight.vercel.app | Every push to `main`, **once its three Vercel secrets are set**. Until then it skips itself (and still shows green); see docs/github-org-move.md | `.github/workflows/preview-deploy.yml` |
| **Member feedback → Linear:** themes, grades, a weekly review issue | As feedback arrives | In the database (pg_cron), `supabase/feedback*.sql` |
| **The app adapts to the database:** features whose step hasn't run stay hidden instead of breaking | Every request | `web/src/lib/db-features.ts` |
| **Weekly digest email** ("Your week") to every member who hasn't turned it off; never twice in a week (`digest_sends`). Check a run: Vercel → forge-app → Cron Jobs → logs, and Resend → Emails | Mondays 14:00 UTC | `web/vercel.json` → `/api/cron/digest` (needs `CRON_SECRET`, Linear FIX-86) |
| **Email alerts** for new messages, connection requests and comments on your posts, batched: at most one email a run per member, only for what's still unread 10 minutes after it arrived; a switch per kind in Settings → Email. Check a run: Vercel → forge-app → Cron Jobs → logs, and Resend → Emails | Every hour at :07 | `web/vercel.json` → `/api/cron/alerts` (needs `CRON_SECRET`, Linear FIX-18) |
| **Database backups**, kept 7 days (Storage files aren't included). How to restore: [accounts.md](accounts.md#restoring-the-database-from-a-backup-supabase-pro) | Daily | Supabase Pro → Database → Backups |

## Runs by itself once a key or setting is in ⏳

| What | Needs | Linear |
|---|---|---|
| **Linear sync:** every commit on `main` linked to its issue, `Fixes FIX-n` closes it, untracked commits logged as Done issues | The `LINEAR_API_KEY` repo secret (an admin adds it) | FIX-5, FIX-54 |
| **Linear ↔ GitHub:** PRs and commits shown on issues; weekly cycles; auto-close stale Backlog; **auto-archive closed issues** (keeps us under the Free plan's 250-issue limit) | Linear settings, a workspace admin, ~10 minutes | FIX-5 |
| **Uptime alerts:** a text or email if the site or its database goes down | A free UptimeRobot monitor on `https://brazework.com/api/health` (200 = app and database up, 503 = not), every 5 minutes, alerting both founders | FIX-55 |
| **Error reports:** every server and browser error, with the commit it happened on, scrubbed of personal data (`web/src/lib/sentry-scrub.ts`). Built and off until the DSN is set | A free Sentry project (platform: Next.js). In Vercel, Production: `NEXT_PUBLIC_SENTRY_DSN` turns it on (and adds the privacy page's "When something breaks" section); `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` add readable stack traces (source maps, uploaded then deleted). Then redeploy | FIX-55 |

## Done by a person, on purpose 👤

| What | Why it isn't automatic (yet) | How |
|---|---|---|
| **Running database steps in production** | A migration on live data deserves a person watching; every step is additive and the health check confirms it | Supabase SQL Editor, in `supabase/order.txt` order (FIX-25) |
| **Merging Dependabot PRs** | A person confirms green checks before main changes | `gh pr merge <n> --squash` |
| **Approving or denying member feedback** | It's a product decision | The weekly Feedback review issue in Linear |
| **The load test** | It's heavy, and useful before a big launch, not on every push | Actions → Load test, or `npm run load` |

## Working with Claude Code

In this repo, Claude works from the Linear board (`.mcp.json` connects Linear; see `CLAUDE.md`):

- **`/next`:** picks the next open step (title order, blockers done), builds it, tests it, ships it with the issue ID, and closes it.
- **`/ship`:** the safe path to `main`: checks, a commit with the issue ID, rebase, push, watch CI, report.
- **`/standup`:** what shipped, what's in progress, what's next, what's blocked, and the state of CI. `/standup post` also writes each project's weekly update.

## What to add next

In order of value. Each is filed in Linear when started.

1. **Move the repo to a GitHub organization (FIX-54):** unblocks every admin-only setting below without waiting on one person.
2. **Error monitoring** (Sentry) and **uptime alerts** (Better Stack or UptimeRobot): today we'd learn about a production error from a member. Free tiers; needs the accounts ([accounts.md](accounts.md)).
3. **Auto-merge green Dependabot patch updates:** a small workflow plus the repo setting "Allow auto-merge" (admin, after FIX-54). Minor and major updates stay manual.
4. **A scheduled production health check:** run `supabase/maintenance/health-check.sql` against production weekly and post the result to Linear. Needs a read-only database connection as a secret.
5. **Migrations from CI:** apply new database steps with the Supabase CLI after CI passes, instead of by hand. Worth it once steps ship weekly; until then the manual step with the health check is safer.
6. **Branch protection and pull requests** when a third person joins (FIX-4; checklist in CONTRIBUTING.md).

## Tests on a laptop, same as CI

```sh
cd web
npx tsc --noEmit && npm run lint && npm test   # ~30 s
npm run e2e        # ~8 min: the full suite on a local Supabase (Docker + Chrome)
npm run quality    # ~6 min: Lighthouse budgets + the security scan
npm run load       # ~3 min: 200 members at once + a sign-up burst
```
