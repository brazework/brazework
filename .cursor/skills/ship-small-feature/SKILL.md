---
name: ship-small-feature
description: Ship one small Brazework feature as a single pull request from main, with local checks and auto-merge only when the change is safe. Use for a small member-facing feature that fits in one issue and one pull request.
---

# Ship a small feature

One feature, one pull request. If the request needs more than one feature, split it and do the first piece only. Don't invent behavior the issue doesn't ask for.

## 1. Where the work came from

- A Linear issue on team **Forge** (key `FIX`): use `linear-issue-to-pr` from here on.
- A message in the Forge chat: if it is bigger than a quick fix, open a Linear issue first (Type, owner, and a milestone when the project has one). If the free-plan cap refuses the issue, stop and say so. Don't invent an id.
- Member feedback still in Backlog: use `bug-triage-from-feedback`. Don't build it until a founder approves it.

Two in progress at a time. A red check comes first (`fix-failing-ci`).

## 2. Build

Branch from the latest `main` as `fix-<id>-short-topic`. Keep the diff to that feature.

From `web/`, the local app is `npm run dev` on the private database. Sign in as a local test member. Don't open `web/.env.local`.

A database change follows `CONTRIBUTING.md`: additive file, `supabase/order.txt`, SQL tests, health-check row, `docs/next-migration.md`. That kind of change is not a safe auto-merge. Josh's yes is required.

## 3. Check and open the pull request

Run `verify`. Then commit and open the pull request the way `linear-issue-to-pr` describes.

The body states:

- what the member can do that they could not do before
- how it was done
- what `verify` ran and what it did not run

Auto-merge only when the diff is safe and the local checks passed: no database, auth, row-level security, workflows, shipping rules, payments, or pricing. Otherwise leave auto-merge off and ask Josh.

Don't merge by hand. Don't push to `main`. Don't force-push.

## 4. Hand off

Temper reviews. Kiln checks the Vercel preview and says when the pull request has no preview link (previews are off until that changes; see the playbook). Comment the pull request link and the verify report on the issue.
