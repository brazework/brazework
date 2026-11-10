---
name: standup
description: Status of the Brazework Linear board, as a short stand-up. What shipped since the last update, what's in progress, what's next in step order, what's blocked and on whom, plus CI health. Optionally posts each project's weekly update. Use when asked for a "standup", "status", "where are we", "what's left", or "/standup" (add "post" to also write the project updates).
---

# /standup: where are we

Linear team **Forge** (ID `e9a4549f-0bad-4ef4-a105-e907d69ab2ca`, key `FIX`). Four projects:
- **Launch: switch production on**
- **Brand & growth: Brazework**
- **Quality: performance & security**
- **Product: features & member feedback**

## Gather (read-only)

1. For each project, list its issues with status, assignee, milestone and title.
2. Issues completed since the last project update (or the last 7 days), including ones auto-logged from commits (label `Source: Commit`).
3. `git log --oneline origin/main` since the same date, and the latest CI run on main (`gh run list --branch main --limit 5`).
4. Open member feedback awaiting a decision (label `Feedback`, status Backlog) and the latest "Feedback review" issue.

## Report (keep it short; one line per item)

- **Shipped:** issue ID and title, with the commit if there is one.
- **In progress:** who has it, and what's left (from its latest comment).
- **Next:** the next 3 steps in title order (`1.1 ·`, `1.2 ·`, … `N1 ·`) whose blockers are all Done.
- **Blocked or waiting:** each item, and the person it's waiting on (Ops items usually wait on whoever owns the account).
- **CI:** green or red on the latest main commit; if red, which job.
- **Decisions needed:** feedback to approve or deny, open questions in comments.

## "post": write the weekly project updates

For each project, post a status update in its Updates tab:
- **Health:** on track, at risk (a deadline or quota is in danger) or off track.
- **Done:** what finished since the last update.
- **Next:** the next steps in order.
- **Blocked on:** anything waiting, and on whom.

Use facts from the board and git only; never invent progress.
