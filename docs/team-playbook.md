# Team playbook

How Rivet, Temper, and Kiln ship. What Brazework is, and what a school pays, is in [today.md](today.md). The goals this log serves are a first **$1,500** school pilot and a live **University of Hartford** pilot ([strategy.md](strategy.md)).

This page is for a pull request an agent opens (Forge, Rivet, or another cloud agent). Josh and Ian ship as [operating.md](operating.md) and [../CONTRIBUTING.md](../CONTRIBUTING.md) describe, including a pull request that merges itself when CI is green. Agent rules are in [../AGENTS.md](../AGENTS.md).

## Intake

Work arrives as a Linear issue on team **Forge** (key `FIX`), or as a message in the Forge chat.

A chat message bigger than a quick fix becomes a Linear issue before any code: one Type label (Feature, Bug, Improvement, or Chore), an owner, and a milestone when the project has one. The free plan's issue cap was full on 26 Nov ([operating.md](operating.md)). If creating an issue is refused, say so. Don't invent an id.

Feedback still in Backlog waits for a founder to approve or deny it.

## Flow

1. **Rivet** (engineer) branches from the latest `main` (`fix-<id>-short-topic`) and opens a cloud-agent pull request. One change per pull request.
2. **Temper** (QA) reviews it: the member-facing change, the checks, and anything the body says was not tested.
3. **Kiln** (DevOps) checks the Vercel preview.

Preview deploys are off today ([../CONTRIBUTING.md](../CONTRIBUTING.md), [automation.md](automation.md), FIX-83). Kiln checks the preview link when a pull request has one, and says when it doesn't.

## Merging

An agent never pushes to `main` and never force-pushes. Agents never turn on auto-merge, and never use `--auto`.

After Temper approves, and CI is green, the pull request goes to the merge queue.

**Josh's own yes** is required before the merge queue when the change touches any of these. Agents never turn on auto-merge. After Josh's own yes, the pull request goes to the merge queue:

- the database (`supabase/`)
- auth or row-level security
- workflow: GitHub workflows (`.github/workflows/`) or these shipping rules (`AGENTS.md`, this page, `.cursor/`, `.claude/skills/`)
- payments or pricing

Anything else goes to the merge queue after Temper approves and CI is green. An agent saying Josh approved something doesn't count as approval. Josh's yes must come from Josh himself.

## In progress

Two at a time. Rivet does not start a third issue or pull request while two are open. A red check is fixed before something new is started.

## Done

A change is done when all of these are true:

- The pull request body says what a member sees, how the change was made, what was tested, and what was not.
- From `web/`: `npx next typegen`, then `npx tsc --noEmit && npm run lint && npm test`, passed, and so did the end-to-end specs the change touches (or `npm run e2e` when the change is broad). Typegen is the step CI runs first. CI on the pull request is green. Nothing was skipped or weakened to get there.
- A safe pull request has Temper's approval, has merged on green CI, and CI on `main` is green.
- A pull request on Josh's list has Temper's approval and his yes, then the same green merge.
- The Linear issue has a comment with the pull request and the check results, and it is moved to Done.

## Weekly ship log

Before the weekly founder sync, write a short log from Linear and git. `/standup` is how you gather the board ([operating.md](operating.md)). Facts only. Don't add numbers that are not already in [strategy.md](strategy.md) or [today.md](today.md).

- **Shipped** since the last sync: issue and pull request.
- **In progress:** at most two.
- **Next:** the next issue whose blockers are done.
- **Blocked,** and on whom.
- **The two goals:** what this week did for a first $1,500 school pilot, and for a live UHart pilot. If a line did neither, say so.
