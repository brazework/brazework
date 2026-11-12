# Brazework: current state (2026-11-09)

A map of what exists today, for restructuring the product around one loop:
**Join a club → post what you're building → your club verifies it → it becomes proof on your profile → companies find you.**

Checked against the code on branch `josh/next-redesign` (HEAD `69be8fe`). SQL in `supabase/` is the source of truth for data rules. Anything marked *(unconfirmed)* was not checked in code. No live database was queried.

---

## 1. Stack and structure

| Area | Where | Notes |
|---|---|---|
| Web app (the product) | `web/` | Next.js 16.4 App Router, React 19.3, Tailwind 4, `motion`, `zod`, `@supabase/ssr`, `@anthropic-ai/sdk` (`web/package.json`). Cache Components; session refresh + optimistic redirects in `web/src/proxy.ts` |
| Signed-in routes | `web/src/app/(app)/` | Shared shell in `(app)/layout.tsx` (sidebar, mobile bar, global search, badges, presence, tours) |
| Auth routes | `web/src/app/(auth)/` | login, signup, verify, forgot, reset; `auth/callback/route.ts`, `auth/signout/route.ts` |
| Print | `web/src/app/(print)/u/[id]/resume/` | One-page "proof résumé" |
| API | `web/src/app/api/copilot/route.ts`, `web/src/app/api/mcp/route.ts` | Ember streaming; MCP server |
| Libraries | `web/src/lib/` | Server actions and data: `milestones.ts`, `projects.ts`, `posts.ts`, `communities.ts`, `messages.ts`, `chats.ts`, `network.ts`, `search.ts`, `feed-rank.ts`, `club-report.ts`, `guide.ts`, `copilot*.ts`, `mcp.ts`, `api-tokens.ts`, `connectors/*`, `db-features.ts`, `supabase/{client,server}.ts` |
| Components | `web/src/components/` | `app/` (shared UI), `copilot/` (proposal cards), `ember/`, `landing/` (marketing), `media/`, `mentions/`, `messages/dock.tsx`, `network/`, `search/global-search.tsx`, `tour/`, `ui.tsx` |
| Feature flags by schema | `web/src/lib/db-features.ts` | Probes for 14 optional SQL files (club events, media, invites, copilot, milestones, integrations, group chats, project stack, club profile, mentions, copilot chats, profile extras, MCP, chat extras) and hides features whose tables/columns are missing. Rechecked every 60 s |
| Legacy app | `public/` | Original vanilla JS app, kept until production is confirmed on `web/` (`README.md`) |
| iOS | `ios/` | SwiftUI app (`ios/Brazework/Features/{Feed,Clubs,Events,Messages,Alerts,Profile,Me,Search,Settings,Auth}`) on `ios/ForgeKit` (data layer: `API.swift`, `FeedRank.swift`, `SignUp.swift`…). Same Supabase + RLS. **No projects, milestones or verification on iOS**; Ember opens on the web |
| E2E | `web/e2e/` | Playwright-core journeys `a-…f-*.cjs` against a throwaway local Supabase in Docker (`local-supabase.sh`, `seed.sql`, `gateway.cjs`). Phase `c` covers "add project → ask club to verify → owner verifies → proof on profile and feed" |
| CI | `.github/workflows/web.yml` | Lint, typecheck, build, smoke test; and applies every SQL file in order to a fresh Supabase Postgres. (`web.yml` mentions a `ci.yml` for the vanilla app; that file no longer exists) |

**SQL apply order** (`web.yml`): `schema, messages, events, activity, projects, tours, club-events, media, invites, post-edits, copilot, milestones, feedback, feedback-review, integrations, group-chats, project-stack, club-profile, mentions, copilot-chats, profile-extras, mcp, chat-extras, reports`. `supabase/maintenance/remove-test-data.sql` is outside the order (manual).

---

## 2. Auth, sign-up, onboarding, roles

**Sign-up** (`web/src/app/(auth)/actions.ts`, `signUpSchema`):
- Account type: `student` or `professional`.
- Age gate: 18+ from the birthday (`ageFrom()` in `web/src/lib/forge.ts`).
- Students must use an academic email: `ACADEMIC_RE = /@([a-z0-9-]+\.)*([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$/i` (`web/src/lib/forge.ts:9`). Domain pattern only; no school list.
- Email `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`; password ≥ 8 chars.
- iOS mirrors the same rules in `ios/ForgeKit/Sources/ForgeKit/SignUp.swift`.
- **These rules are app-side only.** `handle_new_user()` (`schema.sql`) creates the profile from any signup metadata; a direct `auth.signUp` call bypasses the age and .edu checks. Email confirmation is required to sign in (Supabase setting, per `schema.sql` header).
- `/signup?invite=<code>` remembers a club invite through sign-up (`lib/invites.ts`).

**Onboarding** (`web/src/app/onboarding/`): headline, field (from `FIELDS`), ≥ 3 interests; sets `profiles.onboarded`. Then joins a remembered invite's club or goes to `/feed`. `(app)/layout.tsx` redirects un-onboarded users here. A "guide" checklist of next steps lives in `lib/guide.ts`; first-run tour and "What's new" in `lib/tours.ts`.

**Roles**
- Account: `profiles.account_type` = student | professional (can't be changed by the user).
- Club: owner 5, admin 4, moderator 3, helper 2, member 1 (`role_rank()`, `my_rank()` in `schema.sql`; UI matrix `PERMS` in `lib/communities.ts`):

| Action | Min rank |
|---|---|
| Approve join requests, create/revoke invite links | helper (2) |
| Remove posts/comments, review held posts, **verify milestones**, remove/ban members below them, see "This week" report, post chat announcements | moderator (3) |
| Assign roles below own, edit club info/look/automod, **host club events**, manage integrations | admin (4) |
| Can't leave the club | owner (5) |

- Organization admin: `organization_admins` (company/school/forge), only via `create_organization()`.
- No platform-admin role exists anywhere in SQL or app; moderation of reports/orgs is done in the Supabase dashboard.

---

## 3. Data model (46 tables)

### Tables

| Table | File | Purpose / key columns |
|---|---|---|
| `profiles` | schema (+media, profile-extras) | One per user: names, `birthday` (not readable), `account_type`, headline, bio, field, `interests[]`, `onboarded`, `avatar_path`, `cover_path`, `open_to[]`, `links` jsonb (≤5), `location` |
| `org_interest` | schema | Landing-page company/school interest form; insert-only from site |
| `communities` | schema (+media, club-profile) | Clubs: name (unique, case-insensitive), about, field, `type` (field/study/project/school, label only), `privacy` (public/approval), `topics[]`≤3, rules, owner, `member_count`, `automod` jsonb, cover/logo/tagline/website/accent |
| `community_members` | schema | (community, uid) + `role`; names copied in |
| `community_requests` | schema | Join requests for approval-only clubs |
| `community_bans` | schema | Bans with `banned_by` |
| `posts` | schema (+projects, media, post-edits, mentions) | `author_id`, `community_id` (null = main feed), `body` ≤3000, `kind` (update/question/result/project), `tags[]`≤3, `status` (visible/held), counts, `project_id`, `media` jsonb (≤4 images or 1 video), `edited_at`, `mentions` jsonb |
| `likes`, `comments`, `saved` | schema | One like per user/post; comments ≤1000; saved posts private |
| `connections` | schema | Two-way, pending→accepted; one per pair; `note` |
| `follows` | schema | One-way |
| `conversations`, `messages` | messages (+chat-extras) | 1:1 DMs; `status` active/request; `reply_to`; unsend within 15 min |
| `conversation_reads` | messages | Private read markers |
| `message_settings` | messages | `requests_on`, `who_can_message` (everyone/communities/connections) |
| `message_blocks` | messages | Blocks (also used by `notify()` and `block_user()`) |
| `message_reports` | messages | From "Block & report" in DMs; copy of messages; dashboard-only |
| `organizations`, `organization_admins` | events | Companies/schools/`forge`; `domain` unique; `verification_status` verified (default)/suspended |
| `events` | events (+club-events) | Hosted by exactly one of `org_id` or `community_id`; type (Career fair, Networking, Workshop, Talk, Hackathon, Conference), format, times, `status` published/cancelled, `rsvp_count` |
| `event_rsvps`, `event_saves` | events | RSVPs (visible to you and your connections); private saves |
| `notifications` | activity (+milestones, mentions) | DB-written only. Kinds: like, comment, follow, connect_request, connect_accepted, community_request, community_approved, milestone_request, milestone_verified, milestone_declined, mention |
| `profile_views` | activity | One row/viewer/profile/day; unreadable; totals via `my_analytics()` |
| `projects` | projects (+project-stack) | Owner, title, summary, `status` in_progress/completed, year, `tags[]`≤3, `private`, `tools[]`≤12. Cards readable by all members even when private |
| `project_details` | projects | Write-up ≤5000 + `link`; readable only if project public or yours |
| `seen_tours` | tours | Tour/what's-new completion |
| `community_invites` | invites | `/join/<code>`: expiry, `max_uses`, `uses`, `revoked` |
| `copilot_usage` | copilot | (user, day, uses); no policies |
| `milestones` | milestones | See §7 |
| `feedback_settings`, `feedback_themes`, `feedback`, `feedback_sync_requests` | feedback (+feedback-review) | Member feedback → grouped ideas → Linear sync + weekly review (pg_cron) |
| `club_integrations` | integrations | **Unused since FIX-92** (Discord removed). Per-club Discord webhook + toggles; kept until a cleanup step drops it |
| `chats`, `chat_members`, `chat_messages`, `chat_reads` | group-chats (+chat-extras) | Group chats: `kind` club (one per club, all members) / event (one per event, RSVPs + hosts) / team (≤50 picked club members). Messages have `announcement`, `ember`, `reply_to` |
| `copilot_chats`, `copilot_ratings` | copilot-chats | Private saved Ember chats (expire after 180 days); thumbs up/down |
| `api_tokens` | mcp | Personal MCP tokens: SHA-256 `token_hash`, `prefix`, `revoked_at`; ≤5 active |
| `message_reactions`, `chat_message_reactions` | chat-extras | 8 allowed emoji, one per person per message |
| `content_reports` | reports | Reports on post/comment/person/message/chat_message; reasons spam…other; `status` open/reviewed/actioned/dismissed; reporter sees own only |

Storage: one public bucket `media`, paths must be under `<uid>/` (`media_path_ok()`, `post_media_ok()` in `media.sql`).

### Important RLS rules and security-definer functions

- **Posts**: read if visible and (main feed or `can_view(club)`), or yours, or you're a club mod+. Insert: yours; club posts need membership; **`project_id` posts only by the project owner and only to the main feed** (`community_id is null`, `projects.sql`). A post with `project_id` is forced to `kind='project'`. Only the author edits text; only mods can change `held → visible` (`posts_before_update()`).
- **Automod** (word filter, hold links from new members) runs in the app (`postInCommunity()` in `communities/actions.ts`), not the DB.
- **Communities**: created only via `create_community()` (caller becomes owner; no limits or legitimacy check). No delete or ownership transfer exists. Join public clubs directly; approval clubs via request → `approve_request()` (helper+); `accept_invite()` skips approval but not bans.
- **Projects**: owner-only writes; owner can't be changed (`projects_before_write()`).
- **Events**: read published events until 24 h after end (org must be verified, or club must be visible); hosts always see their own (the past-events log). Insert: verified-org admin or club admin+ (`can_host_community_events()`). Ended events can't be edited.
- **Organizations**: `create_organization()` requires a confirmed email whose domain matches the website (free-mail rejected; schools need `.edu`/`.ac.xx`). Auto-`verified`; suspension is manual.
- **Messages**: `start_conversation()`, `can_request_message()`, `accept_conversation()`, `block_and_report()`; connections open a conversation automatically.
- **Group chats**: one rule `can_read_chat()`; `open_club_chat()`, `open_event_chat()`, `create_team_chat()`, `add_chat_member()`, `leave_chat()`, `my_chats()`, `announcement_seen()` (officers), `post_ember_reply()` (callable by any chat member; message is flagged `ember` and shows the asker's name).
- **Notifications**: only via `notify()` (skips self and blockers); triggers on likes, comments, follows, connections, requests, joins, mentions, milestones.
- **Analytics**: `record_profile_view()`, `my_analytics(range, tz)`; viewer breakdown only with ≥ 3 unique viewers.
- **Reports/blocks**: `content_reports_before_insert()` derives the reported user; `block_user()` blocks DMs and removes follows both ways.
- **MCP**: `create_api_token()`, `revoke_api_token()`, `mcp_user()` + read-only `mcp_me / mcp_my_clubs / mcp_events / mcp_my_projects / mcp_search / mcp_notifications`, each checking the token hash.
- **Copilot**: `copilot_take()` (25/day), `copilot_chats_expire()`.

---

## 4. Routes and navigation

### Pages (`web/src/app`)

| Route | What it does |
|---|---|
| `/` | Marketing landing (`components/landing/*`); signed-in users redirect to `/feed` |
| `/signup`, `/login`, `/verify`, `/forgot`, `/reset` | Auth (see §2) |
| `/auth/callback`, `/auth/signout` | PKCE code exchange; sign-out (POST) |
| `/onboarding` | Profile setup |
| `/join/[code]` | Club invite preview (works signed out) and join |
| `/feed` | Tabs For you (ranked, `lib/feed-rank.ts`) / Latest / Following / Clubs; composer posts to **main feed only**; verified milestones injected as "proof" cards (`feed/proof-card.tsx`) except in Latest; rail, discover, trending news, message dock |
| `/post/[id]` | One post + comments |
| `/communities` | Browse/search/create clubs |
| `/c/[id]` | Club page: Posts, Events, About & rules, Held (mods) |
| `/c/[id]/manage` | Tabs: This week (mod+), Integrations (admin+), **Verify** (mod+), Invite, Requests (helper+), Members, Bans (mod+), Settings (admin+), Roles |
| `/projects` | Explore projects across Brazework; filter topic/status/**verified only** (`?verified=1`), search |
| `/projects/[id]` | Project home: write-up, milestone timeline, updates (owner posts updates to the main feed), "Built with" |
| `/events`, `/events/[id]`, `/events/[id]/ics` | Event list (going/saved), detail (RSVP, connections going, event chat), calendar file |
| `/org` | Register a company/school; manage its events |
| `/messages`, `/messages/[id]`, `/messages/g/[id]`, `/messages/new?to=` | DMs + requests; group chats (club/event/team); start a DM |
| `/notifications` | Grouped notifications |
| `/saved` | Saved posts (saved events live under `/events`) |
| `/network` | Tabs Invitations / Connections / Sent / Suggested |
| `/dashboard` | Personal analytics (`my_analytics`) + top posts + club week for leaders |
| `/analytics` | Redirects to `/dashboard` |
| `/copilot` | Ember chat with saved chats rail |
| `/search` | Full results: people, clubs, projects, events, main-feed posts (`lib/search.ts`, ilike + topic overlap) |
| `/settings` | Profile, Appearance, Messaging and privacy, Blocked people, Ember and your data, AI tools (MCP), Help, Account (password change only) |
| `/settings/tools` | Your tools (FIX-78): connect Claude Code, Cursor, VS Code, Codex, Windsurf or Zed to Brazework's MCP server. Pick a tool, make its token, follow its steps (one-tap install links for Cursor and VS Code, a command for Claude Code and Codex, a config snippet for Windsurf and Zed), and the page shows it connected after its first call. Tokens are listed with last use and Revoke. Formats are unit-tested in `tests/tool-setup.test.ts` |
| `/profile` | Redirects to `/u/<me>` |
| `/u/[id]` | Profile: projects, verified milestones ("proof"), posts, activity, clubs; add project / import from GitHub / add milestone |
| `/u/[id]/resume` | Printable proof résumé (verified milestones first) |
| `/api/copilot`, `/api/mcp`, `/app-icon/[size]`, `manifest.ts`, `opengraph-image.tsx` | API and assets |

**Everything except `/`, auth pages and `/join/[code]` requires sign-in** (`APP_PATHS` in `proxy.ts`, plus `to authenticated` RLS). There are no public profile, project or club URLs.

### Navigation (`web/src/app/(app)/sidebar.tsx`)

- **Desktop sidebar (`NAV`, in order)**: Feed, Dashboard, Communities, Projects, Copilot, Network (badge: pending invites), Messages (badge: unread DMs + chats), Events (also lights for `/org`), Notifications (badge), Saved, Settings. Profile is the avatar block at the bottom; log out beside it. Search is not a nav item: `GlobalSearch` sits above every page (`(app)/layout.tsx`).
- **Mobile tab bar (`TABS`)**: Feed, Clubs (`/communities`), **[+ Create]**, Messages, Alerts (`/notifications`). Create sheet: Post (`/feed#composer`), Ask Ember (`/copilot`), Add a project (`/profile#projects`), Events. Avatar opens a "More" sheet with the remaining NAV items (Dashboard, Projects, Copilot, Network, Events, Saved, Settings), What's new, Log out.

---

## 5. Ember / Copilot

- **Endpoint**: `POST /api/copilot` (`app/api/copilot/route.ts`). Tasks: `post` (rewrite notes into a post), `writeup` (project write-up), `ask` (agent with tools). Only `ask` gets tools. Model `COPILOT_MODEL` env, default `claude-sonnet-5` (`lib/copilot.ts`). On only when `ANTHROPIC_API_KEY` is set and `copilot.sql` ran.
- **Agent loop** (`lib/copilot-agent.ts`): up to 4 tool rounds, 1000 max tokens for ask; tool results capped at 8000 chars; tool/proposal events framed in the text stream with `\u001E`.
- **Tools** (`lib/copilot-tools.ts`, 19):
  - Read: `search_clubs`, `upcoming_events`, `find_people`, `my_profile`, `club_overview`, `club_report` (mod+), `verify_queue` (mod+), `github_repo`, `github_user`.
  - Propose: `propose_post`, `propose_milestone`, `propose_join_club`, `propose_rsvp`, `propose_message`, `propose_follow`, `propose_event` (admin+), `propose_club_post`, `propose_review` (mod+, not own), `propose_project`.
- **Approval cards**: `propose_*` tools never write. They validate (ownership, membership, rank) and emit a `Proposal`; `components/copilot/proposal-card.tsx` renders an editable card and, on confirm, calls the same server action the UI uses (`createPost`, `addMilestone`, `joinCommunity`, `toggleFollow`, `saveProject`, `postInCommunity`, `reviewMilestone`, `toggleRsvp`, `messagePerson`, `saveEvent`). Saved chats keep drafts only as labels, never re-confirmable cards (`copilot-chats.sql`).
- `propose_milestone` has **no evidence field**; milestones drafted by Ember are sent without evidence.
- **Limits**: 25 requests per user per day (`copilot_take()`, `copilot.sql`), shared with `@Ember` in group chats (`lib/chat-ember.ts`, posts via `post_ember_reply()`). 429 when used up.
- **MCP** (`/api/mcp`, `lib/mcp.ts`): read tools `me`, `my_clubs`, `upcoming_events`, `my_projects`, `search`, `notifications`, `my_review_requests` (step 47, for club officers), and for tokens allowed to post: `post_update` (step 46: posts as the member, shown "via <tool>") and `log_milestone` (step 47: asks the member's club to verify a milestone with its evidence; the club's officers still decide), via Bearer `forge_…` tokens from Settings → Your tools (`/settings/tools`). Tools are annotated (`readOnlyHint` / `destructiveHint`) so clients ask before posting.

---

## 6. Integrations

- **Discord: removed (FIX-92).** Announcements happen on Brazework, where verified work lives. The connector code is gone; `club_integrations` stays unused until a cleanup step drops it. Manage → Integrations now shows how members' work comes in: GitHub import and their AI tools (MCP).
- **GitHub** (`lib/connectors/github.ts`, `actions.ts`): public REST API (optional `GITHUB_TOKEN`). "Import from GitHub" on the profile fills a project draft (title, summary, README write-up, link, topics, tools) and suggests up to 4 releases as milestones (with release URL as evidence). **No check that the member owns or contributed to the repo.**
- **Club report** (`lib/club-report.ts`): computed on demand for mod+: members/new joiners, posts this week vs last, top post/posters, upcoming events + RSVPs, milestones verified this week / waiting / oldest wait, join requests. Shown in Manage → This week and Ember's `club_report`; can draft a weekly post.
- **Linear** (feedback only, DB-side via pg_cron; needs `linear_api_key` in Vault).

---

## 7. Verification: today vs target

Implementation: `supabase/milestones.sql`, `web/src/lib/milestones.ts`, queue UI `web/src/app/(app)/c/[id]/manage/verify.tsx`, display `u/[id]/milestones.tsx`, `u/[id]/profile-parts.tsx`, `feed/proof-card.tsx`, résumé.

**`milestones` columns**: `project_id`, `owner_id`, `community_id`, `community_name`, `title` ≤120, `detail` ≤600, `evidence` (optional single `https?://` URL ≤300), `achieved_on` (2000-01-01..tomorrow), `status` pending/verified/declined, `reviewer_id`, `reviewer_name` ("First L."), `review_note` ≤300, `reviewed_at`, `created_at`.

| Question | Today |
|---|---|
| What gets verified? | A **milestone on a project**, not a post. Posts (incl. `kind='result'`/`'project'`) have no verification state and no link to milestones |
| Who can request? | Project owner, for a club they're currently a member of (`my_rank > 0` at insert). Any club, joinable instantly if public; no tenure requirement; club need not relate to the project |
| Who can verify? | Officer-only: moderator, admin or owner of that club (`review_milestone()`, rank ≥ 3). Helpers/members cannot |
| Can an officer verify their own? | **No.** `review_milestone()` rejects `owner_id = auth.uid()`, including club owners. Officers can verify each other's milestones; nothing prevents reciprocal or alt-account verification, and anyone can create a club and appoint officers |
| Statuses | `pending → verified` or `pending → declined`. Only via `review_milestone()`; clients can't update the row (insert grants exclude status/review columns; no update grant) |
| Evidence required? | **No.** Optional URL, format-checked only (not fetched); no file uploads on milestones. Ember's `propose_milestone` can't even set it |
| Decline reason | Optional everywhere: DB allows empty, the queue UI shows a note box but Decline works without it; only Ember's `propose_review` description says a note is required |
| Revocation | **None.** Reviewed milestones can't be re-reviewed or revoked by officers. The **owner can delete any of their milestones, including verified ones** (`remove your milestones` policy) |
| Disputes / reporting | **None.** `content_reports.kind` excludes milestones and projects |
| Log | Only the reviewer fields on the row. No separate audit table; deleting the milestone erases the record. No history of edits (milestones aren't editable) |
| Limits | 20 pending per owner (`milestones_before_insert`). **No per-officer, per-club or rate limits on verifying** |
| Notifications | Request → up to 25 officers (`milestone_request`); result → owner (`milestone_verified`/`milestone_declined`). |
| Visibility | Verified: readable by every signed-in member via RLS (even on private projects; the app filters private projects out of feed/profile/résumé). Pending/declined: owner + club mod+ |
| After leaving the club / reviewer demoted | Status unchanged |

---

## 8. Gaps against the target loop (each verified in code)

- **No "post → verify" path.** Verification attaches to project milestones; feed posts are never verifiable. Project update posts can't go to a club (`write posts` policy forces `community_id is null` when `project_id` is set), and the main composer (`feed/actions.ts`) has no club or project picker.
- **No evidence requirement** (optional URL only; Ember drafts omit it).
- **No revocation, dispute, appeal or report path** for verified work; owner can silently delete.
- **No verification audit log** beyond reviewer columns on the row.
- **No per-officer/club verification limits** and no club legitimacy check (any member can create a club; `communities.type='school'` is just a label; no link between clubs and verified organizations).
- **Age and .edu rules are client/server-action only**, not enforced in the database.
- **No company search or recruiter product.** Organizations can only register and host events (`/org`). Search (`lib/search.ts`) matches name/headline/field/interests, not verified work; only `/projects?verified=1` filters by verification. Landing copy ("Search people by verified work and skills", `components/landing/marketing.tsx`) is ahead of the product.
- **No public profiles/projects**: all `/u/`, `/projects`, `/c/` routes and RLS require a signed-in member, so companies must create a member account.
- **No challenges** (only mentioned in landing copy).
- **No billing** (no Stripe or plans in code).
- **No data export and no account deletion** (Settings → Account is password change only; Ember chats can be deleted).
- **No admin queue or staff role**: `content_reports`, `message_reports`, `org_interest`, org suspension are dashboard-only. Web has no report UI for posts/people (only DM "Block & report"); iOS has full reporting via `content_reports`.
- **No email or push notifications** (none found in `web/src`, `ios/`, `supabase/`).
- **No club deletion or ownership transfer.**
- **iOS lacks projects, milestones, verification and Ember.**
- Landing hero preview uses hard-coded stats ("24 organizations active", "312 milestones verified this term", "41 employer connections", `components/landing/hero.tsx`); the preview is captioned "Example data" (L101).

---

## 9. Test data

Known production test content (from `supabase/maintenance/remove-test-data.sql`, a manual preview-then-delete script, commit `69be8fe`):
- Exact names: **"Dummy Group"**, **"TEST EVENT"**, **"test"**, **"TEST TESTllll"**, **"HELLO FREE WORLD"**.
- Patterns: club names `^(test|dummy)\b` or `\btest(ing)? (club|group)\b`; event titles `^(test|dummy)\b`; posts whose whole body is test/testing/hello free world/dummy.

Local-only seeds (never production):
- `web/e2e/seed.sql`: members `josh|maya|ben|cara@forge.test` (password `forge-test-pass-1`, created by `local-supabase.sh`), clubs "Rocketry Club" (`rkt`) and "Robotics Society" (`rob`), projects "Liquid engine test stand", "Recovery avionics", "Stealth side project" (private), milestones "Static fire at 1.2 kN" (inserted directly as verified), "Private milestone", posts "Hello Brazework!", "Static fire #3 done…", "Launch day is Saturday. Who is driving?".
- `web/scripts/seed-demo.cjs`: demo posts (truss bridge, flight computer, casing concentricity, Kalman filters, Rocketry recruiting); refuses non-localhost targets unless `FORGE_DEMO_SEED=1`.
- `ios/scripts/seed-ui-tests.sql`: "Saturday static fire" event (Bayside Park), "Are you coming to launch day?".
- Untracked in the working tree: `public/js/supabase-config.local.bak`, `scripts/check.mjs` (not inspected).
