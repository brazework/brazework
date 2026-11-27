---
name: linear-issue-to-pr
description: Turn one Linear issue on team Forge (key FIX) into one pull request. Branches from main, runs verify, and auto-merges only a safe pull request with green CI. Use when asked to implement a FIX issue or open its pull request.
---

# Linear issue to pull request

One issue, one pull request. Read `AGENTS.md` and `docs/team-playbook.md` first. You are Rivet: you open the pull request. Temper reviews it. Kiln checks the preview.

## 1. Read the issue

- Team **Forge**, key `FIX`. Read the description, the comments, and the "Done when" line.
- A `Source: Feedback` issue still in Backlog waits for a founder. Use `bug-triage-from-feedback`. Don't build it yet.
- If Rivet already has two issues in progress or two open pull requests, don't start a third. A red check on an open pull request comes first (`fix-failing-ci`).

## 2. Branch

From the latest `main`:

```sh
git switch main && git pull --rebase origin main && git switch -c fix-<id>-short-topic
```

Never commit on `main`. Never push to `main`. Never force-push.

If the free-plan cap refuses a new issue, stop and say so. Don't invent an id, and don't archive issues to make room.

## 3. Change

Stay inside the issue. A database change is a new additive file in `supabase/`, appended to `supabase/order.txt`, with tests, a health-check row, and a line in `docs/next-migration.md`, as `CONTRIBUTING.md` describes. No SQL against production.

## 4. Verify

Run the `verify` skill. Stop if it fails.

## 5. Commit and open the pull request

- Subject: `FIX-<id>: what changed, in plain words`.
- Body: why, and `Fixes FIX-<id>` on its own line only when this commit finishes the issue.
- Push the branch: `git push -u origin HEAD`.
- Title: `FIX-<id>: …`
- Body, in this order: what changes for a member (or that members see no change); how it was done; what `verify` ran and what it did not run. Fill in `.github/pull_request_template.md`.

## 6. Merge

Leave auto-merge off when the diff touches any of these. Josh's yes is required first:

- `supabase/` or other database work
- auth or row-level security
- `.github/workflows/`
- the shipping rules (`AGENTS.md`, `docs/team-playbook.md`, `.cursor/`)
- payments or pricing (`web/src/lib/pricing.ts` and the payment code)

Otherwise, after `verify` passes, turn auto-merge on (squash) so the pull request merges itself when CI is green. Don't merge it yourself, and don't merge while a check is red.

Comment on the issue with the pull request link and the verify report. Move it to Done only when `docs/team-playbook.md` says the change is done.
