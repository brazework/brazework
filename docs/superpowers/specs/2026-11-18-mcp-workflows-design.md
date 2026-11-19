# MCP workflows: a builder's own tools fill in their Brazework record

Date: 2026-11-18. The user picked pieces 1, 2 and 3 plus docs from a ranked plan of five.

## Intent

Builders in all 20 fields already keep their work in their own tools (GitHub, Onshape, KiCad, W&B, MATLAB,
Overleaf, Stripe, Figma, Qualtrics…). An MCP-capable assistant that has both Brazework and those tools should
turn that work into Brazework posts, milestones and signature requests in seconds. The member approves every
one before anything goes out. The wow: type one command after a good day and the record writes itself. Or
leave the record to an automation that drafts while you sleep, and approve it with one tap.

## Goals

- Every field has a playbook: which of its tools connect, and how (vendor MCP server, community server, or
  the files and CLI), the moments worth recording, and who signs them.
- Slash commands in every MCP client that supports prompts (Claude Code, Claude Desktop, VS Code, Cursor…)
  run the core workflows.
- A milestone can ask a named person (professor, PI, manager, mentor) to sign it, straight from chat.
- Unattended automations (a GitHub Action, a scheduled run) can only leave drafts. The member approves
  them in Brazework.
- `docs/mcp-workflows.md` shows a person in each field how to set it up in minutes. Settings → Your tools
  shows the same recipes in the app.

Non-goals: uploading files or images through MCP (later); officer digest (later); any change to auth or
the 3D viewer.

Anti-goals: anything that posts, emails or asks for a signature without the member's yes; a tool
verifying or signing anything; claiming an integration that doesn't exist.

## Approaches considered

The plan had 5 ranked pieces. The user picked 1, 2, 3 + docs. Approaches considered for drafts:
(a) every token may leave drafts, (b) a new `draft` scope that new tokens get by default and post tokens
include, (c) drafts only from a dedicated automation token. Picked (b). Existing read-only tokens keep
exactly what they could do. Every new token can leave drafts, which are private and need the member's tap.
A GitHub Actions token can only read and draft, never post.

## Design

### 1. Field playbooks: MCP prompts and resources (no database step)
- `web/src/lib/mcp-playbooks.ts`: the 20 fields (same names as `SAMPLES`). Each has its tools (name,
  `official | community | files`, what the assistant reads), 2–3 moments (what happened → post kind or
  milestone, an example title, the evidence), and who signs.
- The MCP route gains `prompts/list`, `prompts/get`, `resources/list` and `resources/read`, and advertises
  `prompts` and `resources`.
- Prompts:
  - `shipped`: turn finished work into a milestone with evidence.
  - `result`: a measured result.
  - `week`: sweep the week across connected tools into one to three drafts.
  - `ask_signature`: ask the person who saw it to sign.
  - `setup`: which of my tools connect, and how.
- Each prompt takes optional `field` and `what` and returns instructions built from the playbook and the
  token's scopes: show the draft and post on yes when it can post, otherwise leave a draft.
- Resources: `brazework://playbooks` (the index) and `brazework://playbooks/{field}` (markdown).

### 2. Signature asks from chat (`request_signature`)
- New tool, `post` scope (it emails someone on the member's behalf).
- Arguments: `milestone_id`, `email`, `relationship` (professor, ta, pi, manager, mentor, other).
- The route mints the link token and calls `mcp_request_vouch()`. That function acts as the member and
  calls the existing `request_vouch()`, so all the vouch guards apply: school or verified-company
  address, not a teammate, 3 per milestone, 10 a week.
- The route then sends the existing vouch email. If the email fails, it withdraws the ask, as the app
  does.
- `log_milestone`: `club_id` becomes optional. With no club, the milestone is a draft waiting for a
  signature.
- `my_projects` gains `open_milestones` (id, title, status, club) so the assistant can find the
  milestone to ask about.

### 3. Drafts inbox
- Scopes become `read ⊂ draft ⊂ post`.
- New table `tool_drafts`: the member's, readable only by them, written only through functions. Fields:
  - kind `post | milestone`, the payload, `via`
  - `source` (for example "GitHub Actions · PR #12 merged")
  - an optional `source_key` that dedupes re-runs
  - status `waiting | posted | dismissed`
- Limits: 30 waiting, 20 an hour.
- New tools `draft_post` and `draft_milestone` (scope `draft` or `post`). They take the same arguments as
  `post_update` and `log_milestone`, plus `source` and `source_key`.
- `/drafts` page: each waiting draft can be edited, then posted or dismissed. Approving runs as the
  signed-in member through the app's own rules (posting limits; a milestone goes to its club, or waits
  for a signature) and keeps `via`.
- A strip at the top of the feed says "N drafts from your tools" and links to `/drafts`.
- Settings → Your tools: new tokens can leave drafts, and the switch still adds posting. A GitHub
  Actions entry makes a draft-only token and gives a ready workflow file. On a merged PR it calls
  `draft_milestone` with the PR as evidence and `source_key` set to the PR.

### Docs
- `docs/mcp-workflows.md`: setup in 2 minutes, the commands, drafts and automations, signatures, then one
  section per field (tools with honest status, moments, who signs).
- In the app, Settings → Your tools gets a "Recipes for your field" section that reads the same
  playbooks.

## Database step
`supabase/mcp-workflows.sql` goes after `members-only`. It adds:
- the scope change
- `tool_drafts` and its functions
- `mcp_draft_post` and `mcp_draft_milestone`
- `mcp_request_vouch`
- the redefined `mcp_log_milestone` (club optional) and `mcp_my_projects`
- `mcp_workflows_ready()`

It also gets a health-check row (64), an entry in `db-features`, and SQL tests in
`supabase/tests/mcp-workflows.test.sql`.

## Tests
- Unit: playbooks cover all 20 sample fields, prompts render for each scope, and the docs mention every
  field.
- SQL: scopes, draft limits and dedupe, approve and dismiss as the member only, signature guards.
- e2e (`web/e2e/l-tools.cjs`):
  - prompts and resources over MCP
  - an Actions-style draft-only token leaves a milestone draft, and a re-run doesn't duplicate it
  - Ben sees the strip, edits and posts it, and Maya sees it to verify
  - the request_signature refusal paths

## Calls made by the builder (not by the user)
- Scope design (b) above.
- `request_signature` needs `post`.
- The drafts page lives at `/drafts`.
- The recipes go in Settings → Your tools rather than on the landing page, which the 3D/landing sessions
  own.
