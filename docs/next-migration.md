# Moving Forge to Next.js

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

1. **Database:** Supabase → SQL Editor → run these files, in this order. Each should say "Success. No rows returned." They only add things: the live app keeps working before and after.
   1. `supabase/club-events.sql`: clubs host events
   2. `supabase/media.sql`: photos and video on posts (callouts, before/after, timeline markers), profile and club covers; it also creates the `media` Storage bucket
   3. `supabase/invites.sql`: club invite links
   4. `supabase/copilot.sql`: Forge Copilot's daily limit (25 requests per person)
2. **Vercel → Project → Settings → Environment Variables (Production):** these exact names must exist.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The old app also accepted `SUPABASE_URL` or a "publishable key", but the new app reads only these two names. If the project has them under other names, add these two with the same values, or the site loads but nobody can sign in.
   - `ANTHROPIC_API_KEY`: turns on Forge Copilot. Optional: without it (or without `copilot.sql`), Copilot stays hidden and everything else works. `COPILOT_MODEL` can override the model (default `claude-sonnet-5`).
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

**The app adapts to the database.** Until each SQL file has run, the new app hides that feature (club events, photos and video, invite links, Copilot) instead of failing (`web/src/lib/db-features.ts`). They switch on by themselves once the SQL runs; no redeploy needed. Copilot also needs `ANTHROPIC_API_KEY`, which does need a redeploy.

## Preview link (until production runs web/)

`.github/workflows/preview-deploy.yml` redeploys https://forge-preview-eight.vercel.app on every push to `main` that touches `web/`. It needs three repo secrets (a repo admin adds them under Settings → Secrets and variables → Actions): `VERCEL_TOKEN` (from the preview project owner's Vercel account), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both in `web/.vercel/project.json` on the owner's machine). Without them the workflow skips.
