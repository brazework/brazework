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
- ✅ Onboarding checklist on Home until done: club → project → first update → request verification → verified (c6abefa).
- 🟡 "Find your club" before the feed (search exists; invite links exist).
- 🟡 Projects with photos/specs/team, GitHub import via Ember (exists; add hardware fields: specs, team list).
- ⬜ Weekly nudges (in-app + email digest, both can be turned off).
- 🟡 Profile = proof: verified count, clubs, featured project, per-project timeline; public/private per project ✅, per milestone ⬜.

## Phase 3: verification (the core)

Exists: officer-only `review_milestone()`, no self-verification, optional single https link, pending → verified/declined.

To build:
- ✅ Statuses `draft | pending | verified | refused | revoked | disputed`; append-only `verification_events` log.
- ✅ Evidence required (photo, video, file, commit link or a club event); no evidence, no badge.
- ✅ Verifier can't be on the project team; 1–2 verifiers per club (config).
- ✅ Badge shows verifier, role, club, date.
- ✅ Per-officer weekly limit (config) and an outlier flag to an admin queue.
- ✅ Revocation with a reason; disputes → club owner → Forge admin.
- ✅ Verified milestones survive the author leaving the club; officers lose verifying power when the role ends.
- 🟡 Verified-club check `club_is_verified()` exists; badge in the UI and duplicate-claim review ⬜.
- ✅ Tests for every rule.

## Phase 4: club leader flow

- 🟡 Create/claim club, roles (owner/admin/moderator/helper/member exist), invite links ✅.
- ✅ Import events from Google Calendar, Outlook or Apple Calendar (`.ics` file, parsed in the browser with time zones and all-day events; pick which to bring; same checks as a hand-made event). Tests: `web/tests/ics.test.ts`, e2e step in `b-clubs-events.cjs`.
- ⬜ Import members (CSV/email list): needs an email sender for invitations.
- ✅ Club home as a to-do list for officers (verify queue incl. disputes, join requests, held posts, next event).
- 🟡 Discord bridge (announcements exist; add Discord → Forge post via bot/webhook, stubbed without credentials).
- 🟡 Weekly club report by Ember (exists, manual; add a shareable link).
- ✅ Officer handoff at end of term: `club-handoff.sql` (step 18), "Hand off" tab, SQL and e2e tests.

## Phase 5: company flow

- ✅ Organizations register by work email; free email domains are refused and the email domain must match the website (`create_organization()` in events.sql).
- ✅ Find builders (`/talent`, verified companies and schools): search by skills and verified work, club, open-to and verified count; public verified milestones only, ranking tested (`web/tests/talent.test.ts`). Grad year ⬜ (not collected yet).
- ✅ Messages land in Requests; company and school admins have a weekly request cap (`limit_org_requests_per_week`). Tier limits ⬜.
- ✅ Sponsored challenges end to end (`challenges.sql`, step 21): draft → sponsored (paid or Forge-approved pilot) → open → judging → winners; SQL tests and e2e `h-challenges.cjs`.
- ✅ `web/src/lib/billing.ts`: provider interface, Stripe Checkout over REST (on only with `STRIPE_SECRET_KEY` + `STRIPE_PRICE_CHALLENGE`/`STRIPE_PRICE_TALENT`), otherwise a pilot request; tests in `web/tests/billing.test.ts`. Stripe webhook `/api/billing/webhook` (signature-checked, idempotent) marks sponsorships paid; needs `STRIPE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.
- 🟡 Company events beside club events (exists; label clearly).

## Phase 6: Ember

- ✅ Approve-first cards (`propose_*`), tool calls shown, facts from tools.
- ⬜ Ember as contextual buttons + command palette (replaces the page).
- ✅ Tests proving Ember can't write without an Approve tap and can never verify (web/tests, `npm test`).

## Phase 7: trust and safety

- 🟡 School email allow-list (pattern only) → configurable list + "Request my school".
- 🟡 Under-18 gate (app only) → database check + config for a future restricted mode.
- ✅ "Forge never pulls records from your school" stated next to Download my data and on the privacy page.
- ✅ Data export (JSON with links to your files) and account deletion (`account.sql`, step 20; SQL and e2e tests).
- 🟡 Reports (`reports.sql` exists for posts/replies/people/messages) → add projects/milestones; ⬜ admin queue.
- ✅ Blocking (block_user); ⬜ blocked parties can't view private items.
- ✅ Rate limits (`rate-limits.sql`, step 23) on posts, replies, messages, message requests and milestone submissions, tunable in `app_config`; SQL tests. Sign-ups are limited by Supabase Auth's own settings.
- ✅ Plain-language privacy page (`/privacy`).
- 🟡 Accessibility: alt text exists on photos; prompts and captions ⬜.

## Phase 8: landing (after decision 1)

- ✅ Live traction strip from the database, zeros hidden.
- ✅ Founders section: fill `FOUNDERS` in `web/src/components/landing/founders.tsx`; hidden until then.
- ✅ Example data labelled "Example".
- ✅ Re-check every "Why now" source opens and matches (the "3x applications" claim wasn't in its source: replaced with Greenhouse's 91% finding).
- ✅ One primary CTA per audience: Students "Create your profile", Clubs "Bring your club", Companies "Sponsor a challenge".

## Phase 9: metrics

- ✅ `/admin` (Forge admins, `admin-metrics.sql`, step 22): weekly active, the loop as a funnel, submitted vs verified and median time to verify, active clubs and handoffs, companies, challenges and sponsorships, plus the sponsorship approvals and review queue. ⬜ Retention cohorts and company message/reply rates.

## Deliverables at the end

`docs/yc-readiness.md` (built / stubbed / needs the real world) and `docs/demo.md` (3-minute demo of the loop on seed data).
