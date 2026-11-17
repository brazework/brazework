# Backed by GitHub: the second level of proof

Date: 2026-11-17 · Status: **approved by Josh ("build this", 2026-11-17)**; reviewed by a fresh builder check, whose questions are settled below as Claude's calls · Follows the three-levels plan in the doc "Brazework: the whole picture"

## Why

A milestone counts for nothing today until a busy person signs it. Josh agreed to three levels of proof: **logged** (you posted it with evidence), **backed by data** (something checkable agrees with you), **signed** (a person who saw it confirms it). This change builds the middle level, for GitHub only, so code work counts from the minute it's added and the member can't fake the check.

## What Josh decided

- **Backed work is shown to companies, clearly labelled** "Backed by GitHub", never "Signed" or "Verified". The member can hide any item, as today.
- **Each milestone's own evidence is checked** (not a project-wide activity count): a commit, a merged pull request or a release.
- AI never decides whether something is backed; the check is a fact from GitHub.

## How it works

1. A member adds a milestone (the existing form on their profile) and pastes a GitHub link as evidence.
2. If the link is a commit, pull request or release **in a repo linked to that project** (`project_repos`), the server asks GitHub through Brazework's read-only App, using that repo's installation token:
   - commit: `GET /repos/{owner}/{repo}/commits/{sha}` → `author.id`, and it must have landed on the repo's default branch (`GET /repos/{owner}/{repo}/compare/{default}...{sha}` says `identical` or `behind`), so a throwaway branch or a fork doesn't count
   - pull request: `GET /repos/{owner}/{repo}/pulls/{number}` → `user.id`, and it must be merged
   - release: `GET /repos/{owner}/{repo}/releases/tags/{tag}` → `author.id`, and it must be published (not a draft). When a bot published it (CI release tools), the tagged commit's author counts instead (`GET /repos/{owner}/{repo}/commits/{tag}`)
3. It is **backed** when that id equals the GitHub user id the member proved at GitHub sign-in (`github_installations.github_user_id` for an installation they connected). Compare ids, never usernames: usernames can change.
4. The server records the check with the service key. Members can never write it.
5. The milestone shows a "Backed by GitHub" badge on the profile, the project page and in company search, beside or below "Signed" when both apply.

The ask form gets a third choice beside "Your club" and "Someone who saw it": **"No one yet: back it with GitHub"**. It only succeeds if the check passes; otherwise nothing is saved and the form says why.

## Data (one database step, additive)

- New table `milestone_backings`: `milestone_id` (unique, cascade delete), `source` ('github'), `kind` ('commit' | 'pull_request' | 'release'), `url`, `repo_full_name`, `ref` (sha, PR number or tag), `github_user_id`, `checked_at`. Written only by the service role; readable when the milestone is readable.
- `milestones.status` gains **'logged'**: added with no one asked to sign. It doesn't count toward the 20-waiting cap and never enters a club's queue. The insert trigger allows 'logged' only together with a backing written in the same server action (the action inserts the milestone, checks GitHub, writes the backing, and deletes the milestone if the check fails).
- Read rule for milestones adds: readable by anyone signed in when it is **logged**, backed, not private, and its project can be seen. A milestone sent for signing keeps today's rule, so its refusal note, dispute or "waiting for" never becomes public through a backing.
- One commit, pull request or release backs one milestone (a unique index on repo, kind and ref).
- The server checks GitHub first, then inserts the milestone as the member (their own row-level security applies) and the backing with the service key; if the backing can't be written, it removes the milestone. A logged milestone without a backing is invisible to everyone but its owner, so a gap between the two writes can't show anything false.
- New database tests in `supabase/tests/`, a row in the health check, a line in `docs/next-migration.md`, appended to `supabase/order.txt`.

## What the member sees when it doesn't back

Plain sentences, no error codes:
- Not a GitHub commit, pull request or release link → "This link isn't a GitHub commit, pull request or release, so it can't be backed. Ask someone who saw it instead."
- Repo not linked to this project → "Link this repo to the project first (Build → the project → Connect GitHub)."
- Authored by someone else → "GitHub says someone else made this. Only your own work can be backed."
- Pull request not merged / release still a draft → says so.
- GitHub App not set up, or GitHub didn't answer → "Couldn't reach GitHub right now. Try again, or ask someone who saw it."

With a club or a person chosen, the milestone is still sent for signing as today; the GitHub check runs too, and a failed check only means no "Backed" badge.

## Company search

`/talent` includes backed milestones beside signed ones, with a filter: **Signed only** (default, today's behaviour) or **Signed or backed**. Ranking keeps signed work above backed work.

## Not in this change

- Other data sources (competition results, Kaggle, published papers).
- Re-checking later (a backing records what was true when it was checked; force-pushed history doesn't undo it).
- Asking for a signature on a milestone that was only logged. Today the member adds it again with a signer; a proper "Ask someone to sign this" button is a follow-up.
- A project-wide activity summary (option 2 from the conversation): a possible later addition.
- The iPhone app.

## Approaches considered

- **Check each milestone's evidence (picked by Josh).** Backs the exact claim; catches a teammate's commit in a shared repo. Costs one GitHub request per milestone added and needs the App switched on in production.
- **Project-wide activity summary from webhook events.** Cheapest; but backs activity, not a result.
- **Ember judges the evidence.** Ruled out: fakeable and breaks "AI never vouches".

## What would make it a failure

- A member can mark their own work backed (anything but the server with the service key writing a backing).
- Backed work reads as signed anywhere: badge, search, Ember's answers, the MCP tools.
- Someone's commit in a shared org repo backs a teammate's milestone.
- A GitHub outage stops members adding milestones that go to a club or a person.

## Open outside the code

- **Is the GitHub App switched on in production?** Josh's Vercel role can't list environment variables. Ian checks for `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`. Without them the feature ships switched off: the third choice is hidden and nothing breaks.

## Calls made by Claude

- GitHub only, and only commits, merged pull requests and published releases.
- A new 'logged' status rather than reusing 'pending' or 'draft' (pending implies someone was asked; drafts are hidden from everyone).
- Company search defaults to signed only, so recruiters see no change unless they choose it.
- Only logged milestones show because of a backing. One sent to a club or a person shows when signed, as today, and then carries both badges.
- **Owners only, for now** (builder check Q1): a member's GitHub account is the one recorded when they connected the App, and today only a project's owner can connect it. Teammates see "Connect your GitHub account on this project first". A per-member "prove your GitHub" sign-in is a follow-up. If the App is uninstalled, existing backings stay (they record the GitHub id that was checked) but new ones can't be made.
- Commits must be on the default branch; bot-published releases fall back to the tagged commit's author (builder check Q4, Q5).
