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
