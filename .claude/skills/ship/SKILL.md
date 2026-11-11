---
name: ship
description: Ship the current changes safely through a pull request. Run the checks, commit with the Linear issue ID on a branch, open a pull request with auto-merge, watch CI until it merges into main, and report the result on the issue. Use when asked to "ship", "push to main", "commit this", or "/ship FIX-30".
---

# /ship: from working tree to green main

`main` is protected: every change is a pull request that merges itself once the required checks (checks, e2e, security) pass. Nobody waits on a review (two people; CI is the gate). See `CONTRIBUTING.md`.

1. **Know the issue.** Use the ID from the arguments, or the one you're working on. If there's no issue and the change is more than a quick fix, create one first (`/next` explains where). A commit with no ID is still logged in Linear automatically, but a linked one reads better.
2. **Look before committing.** Run `git status` and `git diff --stat`. Never commit `public/js/supabase-config.local.bak`, `scripts/check.mjs`, `.env*` files or anything under `e2e/.results`, `.lighthouse`, `.zap` or `.load`. Stage files by name.
3. **Branch.** If you're on `main`, move the work to a branch: `git switch -c fix-30-short-topic` (uncommitted changes come along). Bring it up to date: `git fetch origin && git rebase origin/main`. If the rebase conflicts, stop and resolve; never force-push `main`.
4. **Checks (show the output; stop on any failure):**
   `cd web && npx tsc --noEmit && npm run lint && npm test`, then `npm run e2e` if pages, data, auth or the database changed, and `npm run quality` if layout, headers or performance changed.
5. **Commit.** Small, focused commits. Subject: `FIX-30: what changed, in plain words`. Body: why it changed, plus `Fixes FIX-30` if this completes the issue, plus the co-author line from the session's attribution rules.
6. **Pull request, merging itself.** `git push -u origin HEAD`, then `gh pr create --fill` (the template's checklist: fill in how it was checked) and `gh pr merge --auto --squash --delete-branch`.
7. **Watch CI.** `gh pr checks --watch` until every check finishes, then confirm the merge (`gh pr view --json state,mergeCommit`). Then the push to `main` runs Web, CodeQL, Linear sync and Deploy preview, plus **Database steps (production)** if `supabase/` changed: confirm each is green (`gh run list --branch main --json headSha,workflowName,conclusion`). Done means merged and green, not pushed.
8. **Red CI?** Fixing it comes before anything else. Read the failing job's log and the `e2e-results` or `quality-reports` artifact, fix the cause, and push to the same branch; it merges once green. Never re-run until green without understanding why it failed.
9. **Report.** Comment on the Linear issue with the pull request, the merge commit, the CI result and how it was verified. The Linear sync workflow also links the commit and closes the issue on `Fixes`.
10. **Back to main.** `git switch main && git pull --rebase origin main`.
