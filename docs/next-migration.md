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
   6. `supabase/integrations.sql`: club integrations (Discord announcements for events, verified milestones and weekly updates)
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

## Preview link (until production runs web/)

`.github/workflows/preview-deploy.yml` redeploys https://forge-preview-eight.vercel.app on every push to `main` that touches `web/`. It needs three repo secrets (a repo admin adds them under Settings → Secrets and variables → Actions): `VERCEL_TOKEN` (from the preview project owner's Vercel account), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both in `web/.vercel/project.json` on the owner's machine). Without them the workflow skips.
