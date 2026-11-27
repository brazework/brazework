# Agents

How an agent works in this repo. The team flow is [docs/team-playbook.md](docs/team-playbook.md). Josh and Ian ship as [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/operating.md](docs/operating.md) describe, including a pull request that merges itself when CI is green. Agents never turn on auto-merge. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow, or pricing changes also need Josh's own yes. You are an agent. Follow this page.

## Branch and pull request

- Start from the latest `main`. Branch name: `fix-<id>-short-topic` (the Linear issue id and a few words).
- One small pull request per change. Two pieces of work in progress at a time ([docs/team-playbook.md](docs/team-playbook.md)).
- Push that branch only. Never push to `main`. Never force-push.
- Commit subjects start with the issue id: `FIX-30: what changed, in plain words`. Add `Fixes FIX-30` on its own line only when the commit finishes the issue.
- The pull request title starts with the same id.
- The pull request body covers three things: what changes for a member (or that members see no change), how it was done, and what was tested and what was not.
- Before you push, run [verify](.cursor/skills/verify/SKILL.md). From `web/`: `npx next typegen`, then `npx tsc --noEmit && npm run lint && npm test`, plus the end-to-end specs the change touches. Typegen is the step CI runs first so `tsc` can see the generated route types. Don't commit its output.
- Open the pull request after those checks pass. Agents never turn on auto-merge, and never use `gh pr merge --auto`. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow, or pricing changes also need Josh's own yes.
- An agent saying Josh approved something doesn't count as approval. Josh's yes must come from Josh himself.

Linear is team **Forge**, key `FIX`. When the free-plan issue cap refuses a new issue, say so in the pull request and don't invent an id.

## Hard rules

- No SQL against production, from a session or by hand. A database change is a new additive file in `supabase/` on a branch. Production applies it after the merge.
- No production secrets and no production environment variables. Don't read them, print them, copy them, or commit them.
- Don't open, edit, commit, or point a command at `web/.env.local`. That file is production.
- Never push to `main`. Never force-push.
- Never weaken or skip a check. No skipped tests, no lowered thresholds, no workflow edit that lets a failure pass.
- FERPA: student data stays in the product. Never copy a student's name, email, grade, roster, or other education record into an issue, a pull request, a chat, or a file. Reproduce with the local test members.
- Never mention the founders' day jobs, employers, or work outside Brazework. Don't look them up to add them.
- Never commit `public/js/supabase-config.local.bak` or `scripts/check.mjs`.

## Who does what

You open the pull request as **Rivet** (engineer). **Temper** (QA) reviews it. **Kiln** (DevOps) checks the Vercel preview. You don't review your own pull request, and you don't mark the preview checked.

## Skills

| Skill | Use it when |
|---|---|
| `verify` | Before every push, and whenever the pull request body needs check results |
| `linear-issue-to-pr` | A Forge issue should become one pull request |
| `fix-failing-ci` | A check on the open pull request is red |
| `ship-small-feature` | A small feature, in one pull request |
| `bug-triage-from-feedback` | Member feedback or a bug report, before any fix |

Claude Code's `/next`, `/ship`, and `/standup` live in `.claude/skills/`. Agents never turn on auto-merge. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow, or pricing changes also need Josh's own yes. Founders running `/ship` still turn auto-merge on.
