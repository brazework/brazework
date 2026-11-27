---
name: ship
description: Ship the current changes safely through a pull request. Run the checks, commit with the Linear issue ID on a branch, and open a pull request. Founders turn auto-merge on and watch CI until it merges. An agent (Forge, Rivet, or another cloud agent) never turns on auto-merge. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow, or pricing changes also need Josh's own yes. Use when asked to "ship", "push to main", "commit this", or "/ship FIX-30".
---

# /ship: from working tree to green main

Steps 1–5 are the same for everyone. Step 6 depends on who is running this.

**Founders (Josh and Ian).** `main` is protected: every change is a pull request that merges itself once the required checks (checks, e2e, security) pass. Nobody waits on a review (two people; CI is the gate). See `CONTRIBUTING.md`. Follow **Founders** at step 6.

**An agent** (Forge, Rivet, or another cloud agent). Follow **Agents** at step 6 and `docs/team-playbook.md`. Agents never turn on auto-merge, and never use `gh pr merge --auto`. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow (`.github/workflows/` or the shipping rules in `AGENTS.md`, `docs/team-playbook.md`, `.cursor/`, `.claude/skills/`), or pricing changes also need Josh's own yes. An agent saying Josh approved something doesn't count as approval. Josh's yes must come from Josh himself. Never push to `main`. Never force-push. Don't merge the pull request yourself.

1. **Know the issue.** Use the ID from the arguments, or the one you're working on. If there's no issue and the change is more than a quick fix, create one first (`/next` explains where). A commit with no ID is still logged in Linear automatically, but a linked one reads better.
2. **Look before committing.** Run `git status` and `git diff --stat`. Never commit `public/js/supabase-config.local.bak`, `scripts/check.mjs`, `.env*` files or anything under `e2e/.results`, `.lighthouse`, `.zap` or `.load`. Stage files by name.
3. **Branch.** If you're on `main`, move the work to a branch: `git switch -c fix-30-short-topic` (uncommitted changes come along). Bring it up to date: `git fetch origin && git rebase origin/main`. If the rebase conflicts, stop and resolve; never force-push `main`. An agent never force-pushes any branch.
4. **Checks (show the output; stop on any failure):**
   `cd web && npx tsc --noEmit && npm run lint && npm test`, then `npm run e2e` if pages, data, auth or the database changed, and `npm run quality` if layout, headers or performance changed.
5. **Commit.** Small, focused commits. Subject: `FIX-30: what changed, in plain words`. Body: why it changed, plus `Fixes FIX-30` if this completes the issue, plus the co-author line from the session's attribution rules.

## Founders

6. **Pull request, merging itself.** `git push -u origin HEAD`, then `gh pr create --fill` (the template's checklist: fill in how it was checked) and `gh pr merge --auto --squash --delete-branch`.
7. **Watch CI.** `gh pr checks --watch` until every check finishes, then confirm the merge (`gh pr view --json state,mergeCommit`). If it shows `BEHIND` (something else merged first and `main` requires branches to be up to date), run `gh pr update-branch` and it merges once the checks pass again. Then the push to `main` runs Web, CodeQL and Linear sync, plus **Database steps (production)** if `supabase/` changed: confirm each is green (`gh run list --branch main --json headSha,workflowName,conclusion`). Done means merged and green, not pushed.
8. **Red CI?** Fixing it comes before anything else. Read the failing job's log and the `e2e-results` or `quality-reports` artifact, fix the cause, and push to the same branch; it merges once green. Never re-run until green without understanding why it failed.
9. **Report.** Comment on the Linear issue with the pull request, the merge commit, the CI result and how it was verified. The Linear sync workflow also links the commit and closes the issue on `Fixes`.
10. **Back to main.** `git switch main && git pull --rebase origin main`.

## Agents

6. **Pull request, not merging.** `git push -u origin HEAD`, then `gh pr create` with the template filled in (what changes for a member, how it was done, what was tested and what was not). Do not run `gh pr merge`. Agents never turn on auto-merge, and never use `gh pr merge --auto`.
7. **CI, then review.** Read the checks. Red: fix the cause and push to the same branch (never force-push, never push `main`, never weaken a check). Green is not a merge. Temper still has to approve. Kiln checks the Vercel preview when the pull request has one.
8. **After Temper approves.** Hand the pull request to the merge queue. Do not run `gh pr merge --auto`. If CI is green and the diff does not touch the database, auth or row-level security, workflow, or pricing, the pull request goes to the merge queue. If the diff touches any of those, it also needs Josh's own yes. After that yes, with Temper's approval and CI green, it goes to the merge queue. An agent saying Josh approved something doesn't count as approval. Josh's yes must come from Josh himself. If the branch is `BEHIND`, run `gh pr update-branch` and wait for the checks again before the merge queue.
9. **Red CI?** Fixing it comes before anything else. Read the failing job's log and the `e2e-results` or `quality-reports` artifact, fix the cause, and push to the same branch. A new push does not turn auto-merge on. Agents never turn on auto-merge. Never re-run until green without understanding why it failed.
10. **Report.** Comment on the Linear issue with the pull request, the CI result, and how it was verified. Move the issue to Done only when `docs/team-playbook.md` says the change is done. Do not push `main`.
