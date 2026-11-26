# Running Brazework

How the company runs day to day: shipping, demos, testing the school side, marketing, and what to
watch. For what exists, see [today.md](today.md); for accounts and costs, [accounts.md](accounts.md).

## Shipping a change

1. Branch from the latest `main` (`fix-30-short-topic`), make the change, and run the checks from `web/`:
   `npx tsc --noEmit && npm run lint && npm test`, then the end-to-end specs your change touches (or
   `npm run e2e` for all of them; it needs Docker).
2. Open a pull request with auto-merge on. CI runs the same checks plus security and quality scans. It
   merges itself when green; Vercel deploys `main`; a new database step applies itself to staging, then
   production.
3. A database step is additive, appended to `supabase/order.txt`, with tests in `supabase/tests/`, a row
   in block 1 of `supabase/maintenance/health-check.sql`, and a line in
   [next-migration.md](next-migration.md). **Numbering follows what's already live:** if `main` gained a
   step while your branch was open, yours goes after it.
4. Never run SQL against production by hand, and never point tests at `web/.env.local` (that's
   production).

Done means merged and CI on `main` green, not just pushed. Details: [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Testing the school side

The school portal and Courses show you the school your account is confirmed with (your university
email). There are three ways to see them:

1. **Locally, with Demo University (best for testing everything):** needs Docker (OrbStack or Docker
   Desktop). From `web/`:
   ```sh
   e2e/local-supabase.sh up && e2e/demo-university.sh
   npm run dev
   ```
   Log in as `dean@demo.brazework.test` (the school's admin), `prof@…` (a professor), `ta@…` or a student
   (`ava`, `ben`, `cleo`, `dev`, `eli`, `fay`), all with the local test password. See
   [demo-university.md](demo-university.md).
2. **A hosted demo school (for sales calls):** a separate Supabase project and Vercel project on a demo
   domain, seeded with the same script. Never production. Steps in [demo-university.md](demo-university.md).
3. **On production, as yourself:** confirm a university email in Settings so your account belongs to
   that school; a Brazework admin can run any school's portal. Use this to check real data, not to demo.

## Showing it

- **The Reel** (vertical, about 36 seconds): Demo University's Dev builds a wheelchair stair-climber,
  logs the test, his professor signs it in one tap, it's on his record, anyone can check it. Real app
  screens on an iPhone, with a voice-over and sound effects; add music in Instagram or TikTok. It's
  rebuilt from the real app, so re-shoot it when the screens change.
- **Live demo:** Demo University (above), or the 3-minute loop in [demo.md](demo.md).
- **Launch kit:** [product-hunt.md](product-hunt.md) and [explainer/](explainer/).

## Every week

- **Monday:** `/standup` in Claude Code (shipped, in progress, next, blocked, CI). Review member
  feedback in Linear (the Feedback label) and pick the week's work.
- **Every day:** keep `main` green; merge or close pull requests, so none goes stale (several drafts
  from 17–22 November are still open).
- **Friday:** check Vercel Analytics and the weekly database watch; post a build update from your
  own Brazework record (the product is its own best demo).

## Watch out for

- **Linear's issue limit:** the free plan is full (26 Nov), so new issues are refused. Upgrade, or
  archive done issues, before the next round of work.
- **Production database steps** apply by themselves after a merge: read a step's pull request before
  turning on auto-merge.
- **Bot pull requests** (Dependabot updates, Vercel's analytics drafts) are open and unreviewed. Merge
  the dependency updates once CI is green; close the drafts that duplicate #237.
- **Demo University** isn't hosted yet: a sales demo needs the demo domain set up first.
- **Courses in the iPhone app** aren't built yet: schools will ask.
