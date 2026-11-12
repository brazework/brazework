# Architecture (technical)

How Brazework is built, for engineers. The plain-language version is [overview.md](overview.md). Last checked against the code on 2026-11-10.

## The system at a glance

```mermaid
flowchart LR
  subgraph Members["People"]
    B["Browser (phone or desktop)"]
    AI["Claude / Cursor<br/>(MCP clients)"]
  end
  subgraph Vercel["Vercel"]
    P["proxy.ts<br/>session refresh + redirects"]
    N["Next.js 16 app (web/)<br/>server components + server actions"]
    API["Route handlers<br/>/api/copilot · /api/mcp · /api/export<br/>/api/billing/webhook · /api/cron/digest"]
  end
  subgraph Supabase["Supabase"]
    AUTH["Auth (GoTrue)"]
    REST["PostgREST API"]
    DB[("Postgres<br/>row-level security · RPCs · triggers")]
    ST["Storage (media bucket)"]
    RT["Realtime"]
  end
  subgraph Outside["Other services"]
    ANT["Anthropic (Ember)"]
    STR["Stripe Checkout"]
    RES["Resend (email)"]
    RSS["STEM news feeds"]
  end
  B --> P --> N
  AI --> API
  N --> AUTH & REST & ST
  REST --> DB
  B -. "live updates" .-> RT
  B -- "photos and video, direct upload" --> ST
  N --> ANT & STR & RES & RSS
  STR -- "signed webhook" --> API
```

**The rule that shapes everything: the database is the security boundary.** The app never holds an admin key for member requests. Every read and write goes through Supabase as the signed-in member, and Postgres row-level security (RLS), column grants and security-definer functions decide what's allowed. A bug in the web app can show the wrong thing; it can't let someone read or change what the database refuses.

## Tech stack

| Layer | What | Why |
|---|---|---|
| **Web app** | Next.js 16 (App Router, Cache Components / partial prerendering), React 19, TypeScript | Server components keep data reads on the server; partial prerendering makes pages fast without giving up personalization |
| **Styling and motion** | Tailwind CSS 4, `motion`, `lucide-react` icons | Design tokens on `:root` with six themes; light and dark |
| **Validation** | `zod` | Every server action parses its input before touching the database |
| **Database and auth** | Supabase: Postgres 17, Auth (GoTrue), PostgREST, Storage, Realtime | One service for accounts, data, files and live updates; RLS lets the database enforce the rules |
| **AI (Ember)** | Anthropic API (`@anthropic-ai/sdk`, model `COPILOT_MODEL`, default `claude-sonnet-5`) | Tool use with *approve-first* cards: Ember proposes, a member confirms |
| **Payments** | Stripe Checkout over its REST API, with a signed webhook | Off until keyed; challenge sponsorships fall back to free "pilot" requests |
| **Email** | Resend | The weekly digest (dry run until keyed); sign-up emails go through Supabase Auth's SMTP |
| **Hosting** | Vercel | Builds `web/` on every push to `main` |
| **iPhone** | SwiftUI (iOS 26), XcodeGen, `ForgeKit` package, same Supabase backend | In `ios/`; paused (Linear FIX-33) |
| **Tests** | Node's test runner (`tsx`), SQL rule tests, Playwright (Chrome), Lighthouse CI, OWASP ZAP, k6 | See "Quality gates" |

## Code map

```
web/src/app/            Routes (App Router)
  (app)/                Signed-in app: feed, c/[id] clubs, projects, messages, events, network,
                        talent (Find builders), challenges, admin, settings, u/[id] profiles…
  (auth)/               Log in, sign up, reset
  api/                  Route handlers: copilot (Ember), mcp (AI tools), export (your data),
                        billing/webhook (Stripe), cron/digest (weekly email)
  onboarding/ request-school/ r/[token]/ privacy/   Public and onboarding pages
web/src/lib/            Server logic: one file per domain (posts.ts, milestones.ts, challenges.ts,
                        week.ts, digest.ts, billing.ts, copilot-*.ts…)
web/src/lib/supabase/   Clients (server, browser, admin), auth-errors.ts
web/src/components/     UI by area (feed, messages, media, report, landing, ui.tsx primitives)
web/src/proxy.ts        Runs before every request: refreshes the session, optimistic redirects
web/tests/              Unit tests (npm test)
web/e2e/                End-to-end, quality and load tests on a local Supabase (Docker)
supabase/*.sql          The database, one additive file per step; order in supabase/order.txt
supabase/tests/         SQL rule tests, run as real members inside rolled-back transactions
supabase/maintenance/   health-check.sql (read-only), remove-test-data.sql
ios/                    The iPhone app (SwiftUI)
public/                 The original vanilla app, kept until production is confirmed on web/
.github/workflows/      CI, CodeQL, preview deploy, Linear sync, load test
.claude/skills/         /next, /ship, /standup for working from the Linear board
```

## How a request flows

1. **`proxy.ts`** runs first. It refreshes the Supabase session cookie and checks the session with `getClaims()` (verified locally when the project uses asymmetric JWT keys, Linear FIX-53). Signed-out visitors on app pages go to `/login`; a *temporary* auth error never counts as signed out (`lib/supabase/auth-errors.ts`).
2. **A server component** renders the page. `getViewer()` (cached per render) returns the member and profile; data comes from Supabase **as that member**, so RLS applies. Data reads sit inside `<Suspense>` (required by Cache Components).
3. **A server action** handles a write (post, verify, RSVP…): `zod` validates the form, Supabase writes as the member, the database's RLS, triggers and rate limits have the final say, and `revalidatePath` refreshes what changed.
4. **Realtime** pushes changes (new posts, messages) to open pages, which refresh themselves.
5. **Files** upload straight from the browser to the `media` Storage bucket, into the member's own folder (enforced by Storage policies), then attach to a post.

## Data and security model

- **Schema:** 42 additive SQL files, run in `supabase/order.txt` order. Production still needs the newer ones: steps 5–36 in [next-migration.md](next-migration.md) (Linear FIX-25). Tables, who can do what, and known limits: [data-model.md](data-model.md).
- **Row-level security on every table.** The health check fails loudly if one is missing.
- **Column grants:** members can insert and update only the columns meant for them. For example, a post's author, counts and timestamps are set by the database, never by the client.
- **Security-definer functions** for actions that need checks across tables: verifying a milestone, publishing a challenge, reports, blocking. Each starts by checking who's calling.
- **Verification is the core rule set** (step 17): evidence required, verifiers can't be on the team, per-officer weekly limits, an append-only `verification_events` log, revocation and disputes. Every rule has a SQL test.
- **Abuse limits** in the database: rate limits per member (step 23, tunable in `app_config`), school-email and minimum-age rules at sign-up (step 25), blocking that hides content both ways (step 32), reports resolved by Brazework admins.
- **The app adapts to the database.** `lib/db-features.ts` probes which steps have run and hides features whose tables don't exist yet, so production never breaks between a deploy and a migration.
- **Secrets:** server keys live in Vercel environment variables, never in the repo. The service-role key is used only by the Stripe webhook and the digest cron (`lib/supabase/admin.ts`).
- **Headers:** a Content-Security-Policy plus HSTS, nosniff, no framing, a referrer policy and a permissions policy on every response (`next.config.ts`).

## How files load (keep Supabase bandwidth low)

Supabase charges for every byte its CDN serves ("cached egress"). In November 2026, 5 members used 9 GB in three days, almost all of it from a few large videos autoplaying in full for everyone who scrolled past them (Linear FIX-75). The rules, checked in CI by `web/tests/egress-guard.test.ts`:

- **Photos go through `next/image`**, never a raw `<img>`, so Vercel serves a resized copy and Supabase is only asked once per size. Uploads are already shrunk to WebP in the browser (`lib/upload.ts`).
- **Videos never autoplay or preload.** Every feed, project and file `<video>` has `preload="none"` and a **poster**: a WebP frame the browser captures at upload (`videoInfo()` in `lib/upload.ts`, saved as `poster` on the post), served resized through `next/image`. Nothing streams until someone taps play; the size is on the play button. Only the reel autoplays, because opening a reel is asking to watch. Older videos with no poster show a placeholder.
- **Big uploads are resumable.** Files over 6 MB go up in 6 MB pieces over Supabase's resumable (TUS) upload (`lib/storage-upload.ts`), with a progress bar and Retry, and pick up where they stopped after a dropped connection. Videos can be up to **250 MB** (posts, project updates, project files); everything else 50 MB (`supabase/pro-storage.sql`; the dashboard's Storage → Settings → Global file size limit must be 250 MB).
- **Thumbnails are ours, not Supabase's.** Photos are shrunk in the browser and resized by Vercel's image optimizer. Supabase image transformations include only 100 origin images a month on Pro, then $5 per 1,000, which the spend cap would cut off; they'd add a dependency for nothing we don't already have.
- **Uploads never change.** Each one gets a new random path and `cacheControl: "31536000"` (a year), so browsers and the CDN keep their copy.
- **Signed links stay the same between renders.** Private files (the `project-files` bucket) get their links from `signedUrls()` in `lib/signed-urls.ts`, which reuses a link while it has 30+ minutes left. A link minted on every render is a new URL each time, and the whole file downloads again. Files opened on click get a short link in `lib/project-files.ts`. Privacy is unchanged: the bucket stays private and RLS decides who gets a link.
- **3D models load only when opened**, once, not again when scrolled back into view (`components/projects/model-viewer.tsx`).
- **Budget:** Pro includes 250 GB cached egress a month. Photos and posters cost almost nothing (resized once, then cached by Vercel). Videos are the cost: a member who taps about 15 videos a month and watches 40% of a 30 MB clip uses about 180 MB, so 1,000 active members is about 180 GB. That fits, but not by a wide margin, so watch **Usage → Cached egress** monthly; the next lever is compressing videos at upload. The spend cap means going over slows things down rather than costing money.

## How the feed loads (Linear FIX-77)

Home scrolls without end, shows posts at once, and costs one small database call per dozen posts.

- **Pages, not the whole feed.** `feed_page()` (`supabase/feed-pages.sql`) returns about 12 complete cards per call: the post, the author's photo, whether you liked or saved it, its latest two replies, why it's in your feed, and the project box. One call per page, never a query per post. Pages continue from a cursor on `(created_at, id)` (keyset, never OFFSET), so page 40 costs what page 1 does (about 1 ms; For you about 10 ms, at 5,000 posts).
- **Row-level security is unchanged.** `feed_page()` runs as the caller (SECURITY INVOKER), so every table it reads applies the same policies the app's own queries did. Its tests check that paging through everything returns exactly what a direct read would, with blocked, held and private-club posts left out.
- **For you** ranks a bounded pool (the newest 200 posts from the last 30 days, plus the newest from your clubs, people you follow and your topics) with the same scoring as `lib/feed-rank.ts`, then carries on newest first. Each source is read through its own index, newest first, so nothing scans the whole table.
- **Page 1 comes with the page** (server-rendered, so posts show before any script runs); the browser asks `feed_page()` for the next one while you're still two screens from the end, so there's no spinner. One client cache (`components/app/query-provider.tsx`, TanStack Query): nothing refetches on focus, and coming back to Home reuses the pages you scrolled.
- **Only the cards near the screen are in the page** (`feed-list.tsx`, TanStack Virtual), so memory stays flat however far you scroll. What you did to a card (liked, saved, replied, edited) is kept in `lib/card-marks.ts`, so it comes back as you left it; liking or saving never re-renders the feed on the server (that cost ~100 requests per heart).
- **New posts** come as the "N new posts" pill (one Realtime channel); the feed never refetches itself. The app-wide live refresh stays quiet on Home for the same reason.
- **Photos** are drawn at the card's width, about 2x on 3x phone screens (`SIZES_ONE` in `media-grid.tsx`), lazy-loaded, with a 16 px blurred placeholder saved with the post (`lq`, made in the browser at upload), so nothing jumps.
- **Links in cards don't prefetch:** each one scrolling past was a server render and a sign-in check.
- **Budget, enforced in CI** (`e2e/k-feed-budget.cjs`): the first page plus the photos above the fold under 300 KB; no video bytes before a tap, and a tapped video streams in ranges; at most 2 Supabase requests per page while scrolling and none per post; the page holds no more than 16 cards; coming back doesn't refetch.
- **Egress per active member per month (estimate):** the feed's data, about 3 MB (30 visits at roughly 100 KB each, uncached egress); photos close to nothing per viewer (Vercel serves resized copies; Supabase sends each original once per size); videos about 180 MB (above). So about 190 MB, or 190 GB at 1,000 active members, nearly all of it video.
- **Sign-in checks are local.** Production signs sessions with an asymmetric key (ES256, since 2026-10-18), so `getClaims()` verifies them in the app with no call to Supabase Auth, even for the links Next prefetches. The local test stack still uses a shared secret, so there each check does call Auth (the ~25 per page view seen in `k-feed-budget.cjs`'s logs); that cost is local only.

## Environments

| | Web | Database | Who it's for |
|---|---|---|---|
| **Production** | Vercel project `forge-app` (Ian's team), from `main` | Supabase project **FORGE** | Members |
| **Preview** | `forge-preview-eight.vercel.app`, deployed from `main` by `.github/workflows/preview-deploy.yml` | Production today; moving to **forge-staging** (Linear FIX-2) | Testing a build before production picks it up |
| **Local** | `npm run dev`, or the production build on `:3200` in tests | `web/e2e/local-supabase.sh`: a private Supabase in Docker, with seed data | Development and every automated test |

`web/.env.local` points at **production**: never run tests or scripts that write against it.

## Delivery: from a commit to production

1. Push to `main` (two founders; see [CONTRIBUTING.md](../CONTRIBUTING.md)).
2. GitHub Actions runs the quality gates below. A red run stops everything until it's fixed.
3. Vercel builds and deploys `main` to production. The preview workflow deploys the same commit to the preview URL.
4. Database changes ship separately: a new step file in `supabase/` runs in the Supabase SQL Editor after it lands, in `order.txt` order; the health check confirms it.
5. The Linear sync links, closes or logs the commit on the board.

## Quality gates

Every push to main runs checks, end-to-end, and the audit and secret scan (about 12 Actions minutes). The speed, accessibility and security scan and CodeQL run on pull requests, every Monday and on demand, which keeps CI inside a free plan's 2,000 minutes a month.

| Job | What it proves |
|---|---|
| **Typecheck, lint, unit tests, build** | Types, lint rules and 35 unit tests pass; the production build succeeds and the smoke test serves the key pages |
| **End-to-end** | A throwaway Supabase with every database step, all SQL rule tests, then 8 browser journeys (79 checks) as real members, failing on any Content-Security-Policy violation |
| **Speed, accessibility and security scan** | Lighthouse budgets on public and logged-in pages (accessibility and best practices ≥ 90, no layout shift) and an OWASP ZAP scan of the running app that fails on any High-risk finding |
| **Dependency audit and secret scan** | `npm audit` (high and critical) and gitleaks over the whole git history |
| **CodeQL** | Static security analysis (also weekly); fails on severity 7 or higher |

On demand: `npm run load` (k6: 200 members browsing at once plus a sign-up burst). Weekly: Dependabot dependency updates.

## Decisions worth knowing

- **Push to main, CI as the gate** while there are two founders. The switch to pull requests and branch protection is a checklist in CONTRIBUTING.md (Linear FIX-4).
- **No nonce-based CSP:** nonces would force every page to render per request and disable partial prerendering. The no-nonce policy blocks other sites' scripts and frames; hash-based SRI is the next step (FIX-46).
- **Additive migrations only.** A step never drops what the live app uses, so a deploy and a migration can land in either order.
- **Ember is approve-first:** it can read and propose, never write or verify without a member's tap (tested in `web/tests/ember-approve-first.test.ts`).
