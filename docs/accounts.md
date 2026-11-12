# Accounts and services

Every account Brazework runs on: who owns it, what it costs, and what's still missing. Keep this current when anything changes. **Never put a password or key in this file or anywhere in the repo**; keys live in Vercel, GitHub secrets or a shared password manager.

Status as of 2026-11-11. Linear issue IDs say what's open; the order to set everything up in is the company setup checklist, **FIX-57**. Every company account should be owned by a company email (`@brazework.com`), not a personal one.

## In use today

| Service | What it's for | Account / owner | Plan and cost | Open items |
|---|---|---|---|---|
| **GitHub** | The code, CI (GitHub Actions), Dependabot, CodeQL | Repo `forge-app` on **Ian's personal account**; Josh has write | Free | Personal repos allow **one admin only**, so move it to the organization **`brazework`** with both founders as owners. Create it now; transfer after the production switch-over (FIX-54) |
| **Vercel** | Hosting: builds and deploys `web/` from `main` | Team **FORGE DEV** (production project `forge-app`), owned by Ian; Josh is a Developer | **Pro** (checked 2026-11-10), paid by Ian | Josh → Member (FIX-6); add the company email (FIX-63); previews on staging data (FIX-2) |
| **Supabase** | Database, sign-in, file storage, live updates | Org **Forge DEV**: project **FORGE** (production, `uwiwkjoonculpxjmzsfj`) and **brazework-staging** (testing; **paused**, don't unpause or point anything at it). Ian is Owner; Josh and the company email are Administrators | **Pro**, $25/month; Josh and Ian pay alternate months. **Spend cap on**, so usage over the quota is never billed: 8 GB database, 100 GB storage, 250 GB cached + 250 GB uncached egress, 100 image transformations, daily backups kept 7 days. Global file size limit 250 MB (Storage → Settings) | Database steps (FIX-25); signing keys (FIX-53); real email (FIX-1); rotate the staging password (FIX-12) |
| **Linear** | What we're building, in order; member feedback lands here | Workspace **Josh-Products**, team **Forge** (key `FIX`); both founders and the company email are admins | Free. **Limit: 250 open issues** (archived ones don't count) | Auto-archive closed issues after a month so the Free plan lasts (FIX-5); the sync's API key (FIX-5) |
| **Anthropic** (via Claude Code) | Building Brazework: Claude Code sessions | Each founder's own Claude subscription | Per person | None |
| **Company Gmail** | `brazeworkhq@gmail.com`: the owner and contact email for company accounts until we have the domain | Both founders (password and backup codes in Bitwarden) | Free | 2-step verification on both founders' phones (FIX-59) |
| **Bitwarden** | Shared vault for every login and key | Free organization "Brazework" (2 seats), on the company Gmail | Free | Ian accepts the invite; 2FA (FIX-60) |
| **GitHub organization** | Where the repo moves so both founders are owners | `github.com/brazework`, created by Josh; contact email the company Gmail | Free | Ian accepts Owner; transfer per the runbook on FIX-54 |

## Needed to switch production on

| Service | What it's for | Who sets it up | Cost | Linear |
|---|---|---|---|---|
| **Anthropic API** | Ember, the AI helper in the app | Ian (Vercel env `ANTHROPIC_API_KEY`) | Pay per use. Ember is capped at 25 requests per member per day; **set a monthly spend limit** in the Anthropic console | FIX-15 |
| **Resend** | Email: sign-up and password emails (via Supabase SMTP) and the weekly digest | Either founder; needs the domain | Free up to 3,000 emails a month, then from $20/month | FIX-1, FIX-27 |
| **Domain** | Our own address instead of `*.vercel.app`, and the email sender | **brazework.com, bought at Vercel** in team FORGE DEV (Ian), so DNS lives next to the project. Setup with Resend, step by step: FIX-1 | About $25 a year for both | FIX-58 |
| **Stripe** | Companies paying for challenge sponsorships | When a company is ready to pay. Live mode needs a legal entity and a bank account (below) | 2.9% + 30¢ per card payment | FIX-28 |

## Recommended next (none exist yet)

| Service | Why | Suggested | Cost |
|---|---|---|---|
| **Founder email on the domain** | `josh@` / `ian@` / `hello@`, forwarded into the company Gmail, once we buy the domain (FIX-58) | Cloudflare Email Routing; Google Workspace once there's revenue (FIX-59) | Free; Workspace ~$7 per person per month |
| **Team chat** | Founder chat, plus Linear, GitHub and alert notifications in one place | Slack, free plan (FIX-62) | Free (90 days of history) |
| **Error monitoring** | Know when something breaks for a member, with the exact error, before they tell us. Vercel only keeps raw logs | Sentry (Next.js SDK; creates Linear issues from errors) (FIX-55) | Free tier |
| **Uptime monitoring** | A text or email if the site or database goes down | UptimeRobot on `/api/health` (FIX-55) | Free tier |
| **Web analytics** | Landing-page visits and sign-up conversion (the admin dashboard covers in-app behavior) | Vercel Web Analytics, or PostHog | Free tier |
| **Social handles** | Reserve @brazework everywhere | Instagram, TikTok, LinkedIn, X (FIX-61) | Free |
| **Apple Developer Program** | Shipping the iPhone app (TestFlight, App Store) when it resumes | Apple, as the company | $99 a year |

## The company (not legal advice: talk to a lawyer or a service like Clerky or Stripe Atlas; Linear FIX-64)

Needed before taking real money or raising, and asked for by YC:

- **A legal entity:** usually a Delaware C corporation, with founder equity and IP assignment signed.
- **An EIN** (US tax ID) and a **business bank account** (for example Mercury). Stripe pays out there.
- **Terms of Service and a Privacy Policy** reviewed by a lawyer. The plain-language privacy page (`/privacy`) is a start, not a substitute.
- **Student data:** members are 18 or older and Brazework never pulls school records, but schools will ask how student data is handled. Keep [data-model.md](data-model.md) and `/privacy` current.

## Keys and where they live

| Key | Where | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env (and `web/.env.local`, which points at **production**) | The app |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env only | The Stripe webhook and the digest cron, never member requests |
| `ANTHROPIC_API_KEY`, `COPILOT_MODEL` | Vercel env | Ember |
| `RESEND_API_KEY`, `FORGE_EMAIL_FROM`, `CRON_SECRET` | Vercel env | The weekly digest |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CHALLENGE`, `STRIPE_PRICE_TALENT`, `STRIPE_WEBHOOK_SECRET` | Vercel env | Sponsorship payments |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Actions secrets | The preview deploy workflow |
| `LINEAR_API_KEY` | GitHub Actions secret (not set yet) | The Linear sync workflow |
| `linear_api_key` | Supabase Vault | The in-app feedback sync to Linear |

If a key ever leaks (pasted in a chat, committed, shown on screen): rotate it at the provider first, then update it where it lives. The CI secret scan catches keys committed to git, not keys pasted elsewhere.

## Restoring the database from a backup (Supabase Pro)

Pro keeps a **daily backup for 7 days**. A restore **replaces the whole production database** with that day's copy: everything since is lost, and the site is down while it runs (minutes to an hour). **Storage files (photos, videos, project files) are not in the backup**; they stay as they are. Only Ian (Owner) or an Administrator can restore. Agree on it together first; never restore to undo one bad row.

1. **Look first (read only).** Dashboard → project FORGE → **Database → Backups → Scheduled backups**: each day's backup and its time. From a terminal: `npx supabase backups list --remote=uwiwkjoonculpxjmzsfj` (lists them, changes nothing). The first one appears the day after the upgrade.
2. **Is a restore really needed?** A few wrong rows are usually better fixed with a database step through a pull request. Restore only for real loss (a bad step dropped data, mass deletion).
3. **Keep what's there now:** `npx supabase db dump --remote=uwiwkjoonculpxjmzsfj -f before-restore.sql` (schema) and `--data-only -f before-restore-data.sql` (rows). Keep both outside the repo; they hold member data.
4. **Restore:** Database → Backups → pick the day → **Restore** → confirm. The project is unavailable until it finishes.
5. **After:** open `/api/health` (the version and every database step should be OK), run `supabase/maintenance/health-check.sql` read-only, and re-apply any database steps added since that day (`db-migrate.yml` → Run workflow).
