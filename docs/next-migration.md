# Moving Brazework to Next.js

**Proposal by Josh, 2026-11-07. Needs both founders' agreement before cut-over.**

## Why

- **Speed of building:** components, TypeScript and server actions instead of hand-built HTML strings in 25 view files. Fewer bugs, faster features.
- **First impression:** a landing page and app that look like a funded startup to students, club leaders, sponsors and YC.
- **Performance and SEO:** the landing page is fully static, and app pages stream in. Public profiles and project pages (later) get real URLs that search engines and link previews can read. Hash routes (`#/u/…`) can't do that.
- **Same backend:** no data migration. The new app talks to the same Supabase tables, triggers and row-level security.

## How: side by side, no big bang

1. **`web/` lives next to `public/`.** The vanilla app keeps running in production. Nothing about `main`'s deploy changes.
2. **A second Vercel project** (root directory `web/`, same Supabase env vars) gives every PR a preview of the new app. Add its preview and production URLs to Supabase Auth's redirect allow-list.
3. **Move screens one PR at a time**, in this order (wedge-first):
   1. ✅ Landing, sign up, verify, log in, onboarding, feed
   2. ✅ Communities (browse, create, moderated feed, manage)
   3. ✅ Profiles + projects, analytics
   4. ✅ Messages, network, notifications
   5. ✅ Events/orgs, saved, settings, guided tour, What's new
   6. ✅ **Club events**: communities host events (needs `supabase/club-events.sql` applied first)
4. **Cut-over:** when the new app has parity, point the production domain at the `web/` project. Then delete `public/`.
5. **Until then,** any feature added to the vanilla app also goes on the migration checklist, so nothing is lost.

## Rules that carry over

- Same pipeline as CONTRIBUTING.md: branch → PR → preview → review → squash-merge.
- Same SQL files are the source of truth for the database. CI applies them on every PR.
- Colour tokens only. Respect reduced motion. Never fake data or traction on the site.

## Open decisions for both founders

- [ ] Agree to the migration and the screen order above
- [ ] Create the second Vercel project for `web/`
- [ ] Local development database: today local dev points at production. Switching to forge-staging is safer once it exists.
- [ ] Positioning: the club wedge (see [positioning.md](positioning.md))

## Switch-over checklist (production)

The Vercel project lives in Ian's account, so these are his steps. It's already connected to GitHub: every push to `main` deploys production, and step 3 makes it build `web/`. Rolling back is one click (step 6).

1. **Database:** these files, in this order. They only add things: the live app keeps working before and after. **Since FIX-74 production applies them by itself**: after each merge to `main`, `.github/workflows/db-migrate.yml` applies whichever of these production is missing (it needs the `SUPABASE_ACCESS_TOKEN` repository secret). For a brand-new database, or by hand: Supabase → SQL Editor → run each file; each should say "Success. No rows returned."
   1. `supabase/club-events.sql`: clubs host events
   2. `supabase/media.sql`: photos and video on posts (callouts, before/after, timeline markers), profile and club covers; it also creates the `media` Storage bucket
   3. `supabase/invites.sql`: club invite links
   4. `supabase/copilot.sql`: Brazework Copilot's daily limit (25 requests per person)
   5. `supabase/milestones.sql`: club-verified milestones (members ask a club to vouch; moderators and up verify)
   6. `supabase/integrations.sql`: club integrations (Discord announcements; unused since FIX-92, kept until a cleanup step drops it)
   7. `supabase/group-chats.sql`: group chats inside Brazework (a chat for every club with officer announcements, a chat for every event's attendees, and team chats)
   8. `supabase/project-stack.sql`: what each project is built with (its tools), shown as a "Built with" stack and searchable in Explore
   9. `supabase/club-profile.sql`: a club's logo, tagline, website and accent colour
   10. `supabase/mentions.sql`: @mentions in posts (the people you tag get a notification)
   11. `supabase/copilot-chats.sql`: Ember chats members can come back to (private to each member, deleted after 180 days untouched) and answer ratings
   12. `supabase/profile-extras.sql`: what members are open to (internships, research, co-founding…), their links and location
   13. `supabase/mcp.sql`: AI tools: members create personal tokens to use their Brazework from Claude, Cursor and other MCP clients (read-only)
   14. `supabase/chat-extras.sql`: reactions, replies and unsend in messages and group chats
   15. `supabase/reports.sql`: report a post, reply, person or message, and block someone from anywhere (the iPhone app needs both for App Store review)
   16. `supabase/project-posts.sql`: project updates can also go to one of your clubs, and keep their kind (update, result, question)
   17. `supabase/verification.sql`: verification made airtight: evidence required, no verifying your own team's work, 1–2 verifiers per club, revocation with a reason, disputes (club owner, then Brazework admins), weekly limits per officer, an append-only log, and milestones private until the member shows them
   18. `supabase/club-handoff.sql`: officer handoff at the end of term (pass your role to a successor; the club and its history carry over)
   19. `supabase/public-stats.sql`: the landing page's live traction numbers (counts only, no names)
   20. `supabase/account.sql`: members delete their own account (everything they authored goes; the verification log keeps anonymized records)
   21. `supabase/challenges.sql`: sponsored build challenges (draft → sponsored → open → judging → winners) and billing requests
   22. `supabase/admin-metrics.sql`: the Brazework admin dashboard's numbers (aggregates only, Brazework admins only)
   23. `supabase/rate-limits.sql`: per-member limits on posts, replies, messages, message requests (plus a weekly cap for company admins) and milestone submissions; tune them in `app_config`
   24. `supabase/reports-more.sql`: report projects, milestones and challenges; Brazework admins see and resolve every report on `/admin`
   25. `supabase/signup-rules.sql`: sign-up rules in the database (students need a school email; minimum age from `app_config`); add schools without an academic domain to `school_domains`
   26. `supabase/school-requests.sql`: "Request my school" from sign-up; Brazework admins add or dismiss requests on `/admin`
   27. `supabase/club-duplicates.sql`: a new club whose name closely matches an existing one is flagged in `/admin`'s review queue
   28. `supabase/club-reports.sql`: a shareable club report link for sponsors (public information only; owners and admins make or turn off the link)
   29. `supabase/project-specs.sql`: a specs table on projects (label/value pairs like "Peak thrust: 2 kN")
   30. `supabase/email-digest.sql`: the weekly email digest (members turn it off in Settings; one send per member per week)
   31. `supabase/indexes.sql`: an index for every foreign key (faster joins, deletes and rate-limit checks as data grows)
   32. `supabase/blocking-content.sql`: blocking hides posts and replies both ways, even in a club you share (club moderators still see everything in their club)
   33. `supabase/admin-retention.sql`: retention by weekly sign-up cohort and the company reply rate, on `/admin` (Brazework admins only)
   34. `supabase/grad-year.sql`: an optional graduation year on profiles; a class-year filter on Find builders
   35. `supabase/club-claims.sql`: an officer claims a club someone else started; a Brazework admin decides on /admin
   36. `supabase/video-captions.sql`: captions (.vtt or .srt) and a transcript on videos
   37. `supabase/weekly-loop.sql`: "who looked" for the weekly build loop: you see which companies viewed your profile, by name, and how many people did in all (members who look are only counted)
   38. `supabase/project-files.sql`: a files folder on every project: documents, photos, videos, CAD and 3D models, code and links, in a private bucket that follows the project's privacy; 3D models open in an interactive viewer
   39. `supabase/project-update-files.sql`: files ride along with project updates: the update box takes text plus files, 3D models and links, posted together as one update
   40. `supabase/project-files-access.sql`: **urgent fix**: after step 38, every upload (photos, video, club logos) failed with "permission denied for function on_project_team"; this points the policies at a helper members may call
   41. `supabase/chapters.sql`: chapters: a national network (NSBE National) with chapters at schools ("NSBE - University of Hartford"); a lead starts one from their school email, the network page ranks chapters (totals only), and officers get a weekly roster
   42. `supabase/pro-verification.sql`: Pro verification: engineers at a verified company sign off club-verified public milestones with a written note (40+ characters), recorded with their name, title and employer and never edited; a review queue in their areas
   43. `supabase/media-keys.sql`: **fix**: post media may carry the file's size and a video's poster frame; since FIX-75 saved the size, photo and video posts had been failing the database's media check
   44. `supabase/pro-storage.sql`: Supabase Pro storage: videos up to 250 MB on posts, project updates and project files (both buckets 250 MB; a project file's size is checked by extension, so everything but video stays at 50 MB). Needs the dashboard's Storage → Settings → Global file size limit at 250 MB.
   45. `supabase/feed-pages.sql`: the feed in pages: `feed_page()` returns about 12 complete post cards per call (keyset on created_at and id, runs as the caller so RLS is unchanged), keyset indexes, and a tiny blurred placeholder (`lq`) allowed on post media.
   46. `supabase/mcp-writes.sql`: your AI tools can post for you: a token can be allowed to post (existing ones stay read-only), `mcp_post_update()` posts as the member under the app's own rules (own projects, clubs they're in, posting limits, plus 10 an hour from tools), and posts record which tool made them (`posts.via`, which members can't set); `feed_page()` returns `via`.
   47. `supabase/mcp-milestones.sql`: your AI tools can log a milestone with https evidence and ask your club to verify it (`mcp_log_milestone()`: needs a token allowed to post, acts as the member so every verification rule and limit applies; a tool never verifies), officers get `mcp_review_requests()`, and milestones record which tool logged them (`milestones.via`, which members can't set).
   48. `supabase/email-alerts.sql`: email alerts for new messages, connection requests and comments on your posts (Linear FIX-18): a switch per kind in `email_prefs` (on by default, `save_email_alerts()`), `alert_sends` records how far each member's alerts have gone, `email_alert_recipients()` lists what's unread since then (service role only), and `claim_email_alert()` / `release_email_alert()` make sure overlapping runs never email anyone twice.
   71. `supabase/oauth-signup.sql`: sign-up with Google, GitHub or LinkedIn. An OAuth newcomer has no profile until `finish_signup()` (in onboarding) takes their account type, name and birthday and applies the same rules as the email form (`signup_check()`: minimum age, school email for students, verified email). The profile trigger uses `signup_check()` too; email sign-ups behave as before.
   72. `supabase/members-only.sql`: member data only for members (Linear FIX-138). `is_member()` (a profile exists for the signed-in account) is required by a restrictive "members only" read policy on every table members can read, and on the `project-files` bucket. A signed-in account with no profile yet (before onboarding's About you) reads nothing; finishing sign-up (`finish_signup`, `is_school_email`, `invite_preview`, `request_school`) and every signed-out page work as before.
   73. `supabase/mcp-workflows.sql`: your tools fill in your record ([mcp-workflows.md](mcp-workflows.md)). Token scopes become read ⊂ draft ⊂ post (new tokens draft by default; old read-only tokens keep what they had; a GitHub Actions token never posts). `tool_drafts`: posts and milestones a tool leaves for the member to approve at `/drafts` (`approve_tool_draft` makes them as the member, under the app's rules; `source_key` dedupes re-runs; 30 waiting, 20 an hour). `mcp_request_vouch` asks for a signature from chat through every vouch guard. `log_milestone` works without a club (a draft waiting for a signature), and `my_projects` lists `open_milestones`.
   74. `supabase/tool-actions.sql`: one set of actions behind AI tools and Ember ([mcp-workflows.md](mcp-workflows.md)). `tool_drafts` takes every Ember card kind; each kind has `tool_check_<kind>` (checks it as the member, under the app's rules) and, when a token allowed to post may do it at once, `tool_do_<kind>`. `mcp_act` drafts or does; `settle_tool_draft` marks a draft done once its card ran the app's action. First kinds: `project` (new), `project_edit` (summary, write-up, link, specs; owner only) and `teammate` (someone from your clubs, member or viewer, never admin).
   75. `supabase/tool-rsvp.sql`: RSVP from AI tools: the `rsvp` action kind (`tool_check_rsvp`, `tool_do_rsvp`). going: true saves a spot at an event the member can see that isn't over; going: false takes their own spot back.
   76. `supabase/tool-clubs-messages.sql`: clubs and messages from AI tools. Action kinds `join` (a public club, or a request to one that approves members), `invite` (accept an invite link, through `accept_invite`) and `message` (always a draft: there's no `tool_do_message`, and its check mirrors the app's message rules). `mcp_inbox` lists conversations and requests, or one conversation's last 20 messages.
   77. `supabase/plus-teaser.sql`: Plus, shown honestly. On Free, `my_company_viewers()` adds `hidden`: how many more verified companies looked in the 90 days before the last 7. A count only, never which companies.
   78. `supabase/daily-triage.sql`: daily triage of drafts on Today. `triage_tool_draft(id, 'keep'|'club', club)` sets where a draft goes and hands it to `approve_tool_draft`, so every check runs as the member (keep: a post goes as drafted, a milestone waits on the project for a signature; club: to a club you're in). An optional once-a-day reminder email (`email_prefs.daily_drafts`, off by default; `draft_reminder_recipients` for the service role, claimed per UTC day in `draft_reminder_sends`), sent only when a draft arrived since the last one, with counts and tool names but never a draft's text.
   79. `supabase/verify-links.sql`: résumé verify links (`/v/<id>`). `public_verify(id)` (signed out too) returns a milestone only when it and its project are public and it is signed, or was signed and since revoked (shown as revoked, with the date but not the reason). Evidence links, commits and photos show; files, videos and club events are counted, never linked.
   80. `supabase/signer-tools.sql`: signing is worthwhile for signers. One reminder 3 days after an ask, never again (`vouch_reminders_due`, claimed with a second link's hash in `milestone_vouches.reminder_hash`; either link opens the same single-use ask). One live link shows and answers the other asks to the same address (`vouch_inbox`, `answer_vouches`), each through `answer_vouch_row` (answer_vouch's body, unchanged). `my_signatures()`: what a signed-in account signed (vouches from its confirmed email, club verifications, Pro sign-offs), for `/signed`.
   81. `supabase/redacted-proof.sql`: proof without revealing confidential work. `milestones.public_line` (≤140 characters, in no column grant): only the owner writes it, with `set_public_line`, and only on a private milestone or one on a private project, never the private title. `redacted_proof(member)` (members only) returns, for signed ones, just the line, who stood behind it in general terms (a club's officers, or a professor or manager at a university or verified company) and the month.
   82. `supabase/tool-officers.sql`: club officers from AI tools. Action kinds `event` (club admins and owner, who host events in the app) and `club_post` (an announcement, moderators and up), both drafts only. `mcp_club_brief`: Ember's weekly club report for moderators and up. Verifying stays in the app.
   83. `supabase/tool-talent.sql`: `mcp_talent_rows` gives verified company and school admins exactly what `/talent` reads (ranked on the server by `/talent`'s own code); `mcp_resume` lists a member's signed work with a link for each; and the `follow` action kind, the last Ember card a tool couldn't reach.
   84. `supabase/tool-goals.sql`: the member's goal from AI tools. `mcp_goal` reads the active goal and the real record its path is built from (plus their signed and open work, to rank); `mcp_set_goal` (visibility is never assumed: the member chooses), `mcp_reach_goal` and `mcp_drop_goal` go through `goals.sql`'s own functions, for a token that may post.
   85. `supabase/tool-signer.sql`: who signed it, when a person signed. The résumé (`mcp_resume`) and company search (`mcp_talent_rows`) name a vouched signer from `milestones.vouched_by` ("Dr. Elena Ruiz, Assistant Professor · stateu.edu"), as the review packet does, before the officer or the club.
   86. `supabase/brazework-messages.sql`: errors say Brazework, not Forge (the posting pace, claiming a club, feedback, blocking, disputes, "Brazework admins only." on the admin tools). Twelve functions redefined whole with only their message text changed, and the organization that hosts the team's events renamed to Brazework.
   87. `supabase/linkedin-required.sql`: a working account adds its LinkedIn profile link before asking a person to sign (Linear FIX-214). One private column, `profiles.linkedin_url`, granted to nobody: the member reads and sets their own through `my_linkedin()` and `set_linkedin()`, `finish_signup()` gains a five-argument form that takes the link (optional at sign-up), `needs_linkedin()` tells the app when to offer the field, and a trigger on `milestone_vouches` refuses an ask from a professional with no link, whichever route it came by. Steps after 86 that aren't listed here are in `supabase/order.txt`, which is the list that counts.
   88. `supabase/personal-email-signers.sql`: a personal address (Gmail and the like) can sign "someone who saw it", and the signature says so (Linear FIX-215). `vouch_email_kind()` gains a fourth kind, `personal`, labelled "(personal email)" in the signature and on a private milestone's public line; throwaway inboxes get their own list (`throwaway_mail_domains`) and still can't sign. `request_vouch()`, `answer_vouch_row()` and `redacted_proof()` are redefined whole with only those lines changed, so the limits on asks and signatures hold as before.
   89. `supabase/linkedin-optional.sql`: the LinkedIn link is optional (founders, 21 Nov). Drops the `vouch_needs_linkedin` trigger, so an ask is never refused for a missing link; `needs_linkedin()` returns false; `set_linkedin()` lets anyone remove their link. The column and its privacy are unchanged.
   90. `supabase/ember-memory.sql`: what Ember remembers (Linear FIX-233). `ember_memories` (≤200 characters each, at most 50 a member): only the member reads, saves or deletes their own; no edits in place; deleted with the account. Ember proposes one as a card; Settings lists them with Forget.
2. **Vercel → Project → Settings → Environment Variables (Production):** these exact names must exist.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The old app also accepted `SUPABASE_URL` or a "publishable key", but the new app reads only these two names. If the project has them under other names, add these two with the same values, or the site loads but nobody can sign in.
   - `GITHUB_TOKEN` (optional): a GitHub token with no scopes. GitHub import works without it, but it raises GitHub's rate limit from 60 to 5,000 requests an hour.
   - `ANTHROPIC_API_KEY`: turns on Brazework Copilot. Optional: without it (or without `copilot.sql`), Copilot stays hidden and everything else works. `COPILOT_MODEL` can override the model (default `claude-sonnet-5`).
   - Email links use Vercel's production domain automatically; `NEXT_PUBLIC_SITE_URL` is only needed for a custom domain that isn't the project's production domain.
3. **Settings → Build and Deployment:**
   - **Root Directory:** `web`
   - **Framework Preset:** Next.js (it detects this once the root is `web`)
   - Leave the build and output settings on their defaults. The old app's root `vercel.json` was removed at the switch-over (2026-11-08): Vercel kept applying its build command even with the root set to `web`, which broke the build.
4. **Deployments → Redeploy** the latest `main`. New environment variables only apply to deployments made after they're added.
5. **Check on the live URL:**
   - [ ] The home page loads; logging in lands on your feed
   - [ ] Post, like, comment; open a profile; send a message
   - [ ] A club page → Events tab; as a club admin, host a test event, then cancel it
   - [ ] Post a photo; add a callout to it
   - [ ] Copilot (sidebar) answers a question (only if `ANTHROPIC_API_KEY` is set)
   - [ ] Sign up with a new email: the confirmation link comes back signed in
6. **If anything's wrong:** Deployments → the last deployment from before the switch → **Instant Rollback**. That's enough on its own. To build the old app again later, you'd also need to clear Root Directory and restore the root `vercel.json` (`git show 27e53f4^:vercel.json`). The database changes are safe to leave in place.

**From then on,** every push to `main` deploys the Next.js app to production by itself.

**Supabase redirect URLs:** if Authentication → URL Configuration already allows `https://<production domain>/**` (SETUP.md step 4), the new `/auth/callback` is covered. For local development, also add `http://localhost:3000/**`.

**Old links keep working:** bookmarks like `/#/feed` and `/#/u/<id>` redirect to their new pages, and confirmation or reset emails sent by the old app are routed through the new sign-in callback.

**The app adapts to the database.** Until each SQL file has run, the new app hides that feature (club events, photos and video, invite links, Copilot, verified milestones) instead of failing (`web/src/lib/db-features.ts`). They switch on by themselves once the SQL runs; no redeploy needed. Copilot also needs `ANTHROPIC_API_KEY`, which does need a redeploy.

## Preview link (retired 2026-11-12)

Until the switch-over, `.github/workflows/preview-deploy.yml` redeployed https://forge-preview-eight.vercel.app from `main`, so there was somewhere to see `web/` running. Production runs `web/` now, so the workflow is gone. Its repo secrets were never set, and it had skipped itself since at least Nov 9. Each pull request still gets its own Vercel preview link.
