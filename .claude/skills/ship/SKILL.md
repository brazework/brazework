---
name: ship
description: Ship the current changes to main safely. Run the checks, commit with the Linear issue ID, rebase on the latest main, push, watch CI until it finishes, and report the result on the issue. Use when asked to "ship", "push to main", "commit this", or "/ship FIX-30".
---

# /ship: from working tree to green main

We push straight to `main` (two people; CI is the gate). See `CONTRIBUTING.md`.

1. **Know the issue.** Use the ID from the arguments, or the one you're working on. If there's no issue and the change is more than a quick fix, create one first (`/next` explains where). A commit with no ID is still logged in Linear automatically, but a linked one reads better.
2. **Look before committing.** Run `git status` and `git diff --stat`. Never commit `public/js/supabase-config.local.bak`, `scripts/check.mjs`, `.env*` files or anything under `e2e/.results`, `.lighthouse`, `.zap` or `.load`. Check the branch with `git status -sb`: it must be `main` tracking `origin/main`.
3. **Checks (show the output; stop on any failure):**
   `cd web && npx tsc --noEmit && npm run lint && npm test`, then `npm run e2e` if pages, data, auth or the database changed, and `npm run quality` if layout, headers or performance changed.
4. **Commit.** Use small, focused commits. Subject: `FIX-30: what changed, in plain words`. Body: why it changed, plus `Fixes FIX-30` if this completes the issue, plus the co-author line from the session's attribution rules.
5. **Integrate.** `git fetch && git pull --rebase origin main`. If the rebase conflicts, stop and resolve; never force-push.
6. **Push.** `git push origin main`.
7. **Watch CI.** Find the runs for the pushed SHA (`gh run list --branch main --json databaseId,headSha,workflowName`), wait for them, and report each job. Workflows: Web (checks, e2e, quality, security), CodeQL, Linear sync, Deploy preview. Done means green, not pushed.
8. **Red CI?** Fixing it comes before anything else. Read the failing job's log and the `e2e-results` or `quality-reports` artifact, fix the cause, and ship again. Never re-run until green without understanding why it failed.
9. **Report.** Comment on the Linear issue with the commit, the CI result and how it was verified. The Linear sync workflow also links the commit and closes the issue on `Fixes`.
