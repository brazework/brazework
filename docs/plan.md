# Forge build plan: one loop

> Join a club → post what you're building → your club verifies it → it becomes proof on your profile → companies find you.

Based on [current-state.md](current-state.md) (the map of what exists). Work goes phase by phase in small commits, never pushed without asking. ✅ exists, 🟡 partly, ⬜ to build.

## Decisions (founders, 2026-11-09)

1. **Landing:** keep the majors out (no fields section).
2. **Universities:** later. Companies pay first; universities come off the landing's audiences and pricing for now (Phase 8).
3. **Production test data:** `supabase/maintenance/remove-test-data.sql` is ready; someone with SQL Editor access runs the preview, then the delete.

## Phase 1: clean up and simplify

- ✅ Test-data cleanup script (preview + transactional delete) and a local-only demo seed (`web/scripts/seed-demo.cjs`, refuses non-local targets).
- ✅ Five-item navigation: **Home, Clubs, Projects, Messages, Profile** (desktop sidebar and phone tab bar), commit 42f2005. No route was removed, so nothing needs a redirect; secondary pages sit in a "More" group.
  - Events → inside Clubs (tab) and a "Coming up" panel on Home.
  - Notifications → bell on Home; Saved → a Home tab.
  - Network → search (people and clubs) in the top bar (search bar already exists).
  - Dashboard → Profile's private analytics tab.
  - Copilot page → Ember button + command palette (`/` or ⌘K).
  - Redirects: `/dashboard`, `/analytics`, `/network`, `/saved`, `/copilot` (and keep `/events`, `/notifications` reachable).
- ✅ Project at the center (commit 9d3315d): composer asks "Which project?" first, then optionally a club; `supabase/project-posts.sql` (step 16) allows both on one post. Ember palette replacing the Copilot page moves to Phase 6.

## Phase 2: the student flow

- 🟡 Sign-up with school email + fields (exists; rules only in the app → add a database check).
- ⬜ Onboarding checklist on Home until done: club → project → first update → request verification.
- 🟡 "Find your club" before the feed (search exists; invite links exist).
- 🟡 Projects with photos/specs/team, GitHub import via Ember (exists; add hardware fields: specs, team list).
- ⬜ Weekly nudges (in-app + email digest, both can be turned off).
- 🟡 Profile = proof: verified count, clubs, featured project, per-project timeline; public/private per project ✅, per milestone ⬜.

## Phase 3: verification (the core)

Exists: officer-only `review_milestone()`, no self-verification, optional single https link, pending → verified/declined.

To build:
- ⬜ Statuses `draft | pending | verified | refused | revoked | disputed`; append-only `verification_events` log.
- ⬜ Evidence required (photo, video, file, commit link or a club event); no evidence, no badge.
- ⬜ Verifier can't be on the project team; 1–2 verifiers per club (config).
- ⬜ Badge shows verifier, role, club, date.
- ⬜ Per-officer weekly limit (config) and an outlier flag to an admin queue.
- ⬜ Revocation with a reason; disputes → club owner → Forge admin.
- ⬜ Verified milestones survive the author leaving the club; officers lose verifying power when the role ends.
- ⬜ Verified-club mark (school-email officer + N verified members); duplicate claims → manual review.
- ⬜ Tests for every rule.

## Phase 4: club leader flow

- 🟡 Create/claim club, roles (owner/admin/moderator/helper/member exist), invite links ✅.
- ⬜ Import members (CSV/email list), events from Google Calendar / `.ics`.
- ⬜ Club home as a to-do list (verify queue, join requests, held posts, upcoming events).
- 🟡 Discord bridge (announcements exist; add Discord → Forge post via bot/webhook, stubbed without credentials).
- 🟡 Weekly club report by Ember (exists, manual; add a shareable link).
- ⬜ Officer handoff at end of term.

## Phase 5: company flow

- 🟡 Organizations register by work email (exists; block free email domains ⬜).
- ⬜ Search builders by field, school, club, grad year, verified skills, verified count (public data only; needs public profile visibility).
- 🟡 Messages land in Requests ✅; per-company weekly cap and tier limits ⬜.
- ⬜ Sponsored challenges end to end; `billing` module with a provider interface and Stripe stub.
- 🟡 Company events beside club events (exists; label clearly).

## Phase 6: Ember

- ✅ Approve-first cards (`propose_*`), tool calls shown, facts from tools.
- ⬜ Ember as contextual buttons + command palette (replaces the page).
- ⬜ Tests proving Ember can't verify/message/join/post without an Approve tap; Ember can never verify at all.

## Phase 7: trust and safety

- 🟡 School email allow-list (pattern only) → configurable list + "Request my school".
- 🟡 Under-18 gate (app only) → database check + config for a future restricted mode.
- ⬜ Privacy page: no school records, plainly.
- ⬜ Data export (JSON + files) and account deletion.
- 🟡 Reports (`reports.sql` exists for posts/replies/people/messages) → add projects/milestones; ⬜ admin queue.
- ✅ Blocking (block_user); ⬜ blocked parties can't view private items.
- ⬜ Rate limits on sign-ups, posts, messages, verification requests.
- 🟡 Accessibility: alt text exists on photos; prompts and captions ⬜.

## Phase 8: landing (after decision 1)

- ⬜ Live traction strip from the database, zeros hidden.
- ⬜ Founders section with empty slots (no invented bio).
- ✅ Example data labelled "Example".
- ⬜ Re-check every "Why now" source opens and matches.
- ⬜ One primary CTA per audience: Students "Create your profile", Clubs "Bring your club", Companies "Sponsor a challenge".

## Phase 9: metrics

- 🟡 Club weekly reports exist → ⬜ admin dashboard: weekly active members, posts per club, milestones submitted vs verified and time to verify, onboarding completion, club retention incl. across handoff, company follows/messages/replies, challenges.

## Deliverables at the end

`docs/yc-readiness.md` (built / stubbed / needs the real world) and `docs/demo.md` (3-minute demo of the loop on seed data).
