# Accounts and services

Every account Brazework runs on: who owns it, what it costs, and what's still missing. Keep this current when anything changes. **Never put a password or key in this file or anywhere in the repo**; keys live in Vercel, GitHub secrets or a shared password manager.

Status as of 2026-11-11. Linear issue IDs say what's open; the order to set everything up in is the company setup checklist, **FIX-57**. Every company account should be owned by a company email (`@brazework.com`), not a personal one.

## In use today

| Service | What it's for | Account / owner | Plan and cost | Open items |
|---|---|---|---|---|
| **GitHub** | The code, CI (GitHub Actions), Dependabot, CodeQL | Repo `forge-app` on **Ian's personal account**; Josh has write | Free | Personal repos allow **one admin only**, so move it to the organization **`brazework`** with both founders as owners. Create it now; transfer after the production switch-over (FIX-54) |
| **Vercel** | Hosting: builds and deploys `web/` from `main` | Team **FORGE DEV** (production project `forge-app`), owned by Ian; Josh is a **Member** (checked 2026-11-12) | **Pro** (checked 2026-11-10), paid by Ian | Add the company email (FIX-63); previews on staging data (FIX-2) |
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
| **Domain** | Our own address instead of `*.vercel.app`, and the email sender | **brazework.com, bought at Vercel** in team FORGE DEV (Ian), so DNS lives next to the project. Setup with Resend, step by step: FIX-1 | $12.03 a year (Vercel's price, checked 2026-11-12) | FIX-58 |
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
| **Sign in with Microsoft** | Many universities run student email on Microsoft 365, as others do on Google: one click with a school account would pass the student rule. Needs care: Microsoft's `email` claim isn't verified for every tenant, so follow Supabase's Azure guide on getting a verified email (Microsoft's `xms_edov` claim) and test with a personal Outlook account before turning it on | Azure (Entra ID) app, Supabase provider `azure` | Free |
| **Sign in with Apple** | Required by the App Store (guideline 4.8) once the iPhone app offers Google or GitHub sign-in. Hide-my-email addresses can't pass the student rule, so they'd join as professionals | Apple Developer Program (above), Supabase provider `apple` | Included |

## The company (not legal advice: talk to a lawyer or a service like Clerky or Stripe Atlas; Linear FIX-64)

Needed before taking real money or raising, and asked for by YC:

- **A legal entity:** usually a Delaware C corporation, with founder equity and IP assignment signed.
- **An EIN** (US tax ID) and a **business bank account** (for example Mercury). Stripe pays out there.
- **Terms of Service and a Privacy Policy** reviewed by a lawyer. The plain-language privacy page (`/privacy`) is a start, not a substitute.
- **Student data:** members are 18 or older and Brazework never pulls school records, but schools will ask how student data is handled. Keep [data-model.md](data-model.md) and `/privacy` current.

## Sign in with Google, GitHub and LinkedIn (founders only)

The code is in place: **Continue with Google / GitHub / LinkedIn** appears on `/login` and `/signup` for each provider that is switched on in Supabase (within 5 minutes, no deploy), and the button for a provider that's off never shows. Someone new through a provider lands on **About you** in onboarding: account type, name (filled in from the provider) and birthday, held to the same rules as the email form by the database (`supabase/oauth-signup.sql`: 18 or older, a school email for a student account). Then onboarding as usual. A returning member goes straight in.

**An email that already has a Brazework account.** Supabase links the provider to the existing account when the emails match (the provider's email is verified), so a member who signed up with `dana@hartford.edu` and a password, then clicks Continue with Google on that same school account, lands in their own account with their profile. Both ways of signing in work from then on. If that email/password account was never confirmed, Supabase removes the unconfirmed email sign-in when it links (its docs: it "will remove any other unconfirmed identities"): whoever controls the verified provider account owns the address, so nobody can pre-register someone else's email and wait for them. Going the other way, signing up with the email form for an address that's already used through Google says "An account with that email already exists"; the member logs in with Google, or uses **Forgot password?** to add a password.

Each provider needs an app made by a founder, signed in as the company (`brazeworkhq@gmail.com`, or the `brazework` GitHub organization). **Paste client secrets only into Supabase (and Bitwarden), never into a file, chat, issue or pull request.** Every provider gets the same return address, Supabase's:

```
https://uwiwkjoonculpxjmzsfj.supabase.co/auth/v1/callback
```

**1. Google** (Google Cloud console, as the company Gmail)
1. https://console.cloud.google.com → project picker → **New project** → name `Brazework` → Create, and select it.
2. **Google Auth Platform → Branding** → Get started: App name `Brazework`, support email the company Gmail. Audience: **External**. Contact email: the company Gmail. Create.
3. **Branding** again: app logo, home page `https://brazework.com`, privacy policy `https://brazework.com/privacy`. Authorized domains: `brazework.com` and `uwiwkjoonculpxjmzsfj.supabase.co`. Save.
4. **Data Access → Add or remove scopes**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (nothing else, so Google doesn't need to review the app). Save.
5. **Audience → Publish app** (to "In production"). While it's in Testing, only listed test users can sign in.
6. **Clients → Create client** → Web application, name `Brazework sign-in`. Authorized JavaScript origins: `https://brazework.com`. Authorized redirect URIs: the Supabase address above. Create.
7. Copy the **Client ID**. Copy the **Client secret** straight into Supabase (step 4 below) and Bitwarden.

**2. GitHub** (a new OAuth App in the `brazework` organization, not the Brazework GitHub App)
1. https://github.com/organizations/brazework/settings/applications → **OAuth Apps → New OAuth App**.
2. Application name `Brazework`, Homepage URL `https://brazework.com`, Authorization callback URL: the Supabase address above. Leave Device Flow off. Register application.
3. Add the logo. **Generate a new client secret**, and copy it straight into Supabase and Bitwarden (GitHub shows it once). Copy the **Client ID**.

Why not reuse the Brazework GitHub App (`infra/github-app.json`): Supabase's GitHub sign-in asks GitHub for the member's email addresses, which a GitHub App can only read with an extra "Email addresses" permission. Adding a permission makes every club that installed the App re-approve it. The App's one client secret is also what the repo integration uses (`GITHUB_APP_CLIENT_SECRET`), so sharing it means rotating one breaks the other, and the sign-in screen would show the App's repository-access wording to people who only want to log in. A plain OAuth App costs nothing and keeps sign-in separate.

**3. LinkedIn** (needs a LinkedIn Company Page for Brazework, FIX-61, with a founder as its admin)
1. https://www.linkedin.com/developers/apps → **Create app**: name `Brazework`, LinkedIn Page: Brazework, privacy policy URL `https://brazework.com/privacy`, logo. Agree and create.
2. **Settings → Verify**: send the verification link to the Page admin and approve it.
3. **Products → Sign In with LinkedIn using OpenID Connect → Request access** (granted at once). It brings the scopes `openid`, `profile` and `email`.
4. **Auth → Authorized redirect URLs for your app → Add**: the Supabase address above. Update.
5. Copy the **Client ID**, and the **Primary Client Secret** straight into Supabase and Bitwarden.

**4. Switch them on in Supabase** (project FORGE)
1. Dashboard → **Authentication → Sign In / Providers**.
2. **Google**: enable, paste the Client ID (into "Client IDs") and the Client Secret, Save. **GitHub**: enable, Client ID, Client Secret, Save. **LinkedIn (OIDC)**: enable, Client ID, Client Secret, Save.
3. Leave **Confirm email** on and the URL configuration as it is (`https://brazework.com/**` is already allowed).
4. Within 5 minutes, open `https://brazework.com/signup` in a private window: the buttons are there. Try one with a personal account: you should land on **About you**. Then delete that test account in Supabase (Authentication → Users) if you don't want it.

**5. Write it down in the repo**, so a provider switched off or changed by mistake shows up as drift (`infra/check.mjs` reads each provider's on/off and client ID, never its secret):
1. `SUPABASE_ACCESS_TOKEN=… node infra/check.mjs` lists the new values as drift.
2. `SUPABASE_ACCESS_TOKEN=… node infra/check.mjs --capture`, then `git diff infra/desired.json`: only the six `external_*` lines should change. Commit it through a pull request.

**6. The confirmation email** (once, in Supabase, so confirming works on any device and by code)
1. Dashboard → **Authentication → Emails → Confirm signup**.
2. Subject: `Confirm your Brazework account`.
3. Message body: paste the whole of [`supabase/templates/confirm-signup.html`](../supabase/templates/confirm-signup.html). Save.
4. Check: sign up at `https://brazework.com/signup` with a spare address, open the email on your phone, and tap **Confirm my email**: the phone opens **About you**. Or type the email's 6-digit code on the laptop's "Check your inbox" page.

Until this is done, the email's old link still works, but only in the browser that signed up, and the email has no code to type.

Pull-request previews: a provider sends people back to the preview's own address only if it's in Supabase's redirect list; otherwise they land on brazework.com and the sign-in says it expired. Test providers on brazework.com.

## Keys and where they live

| Key | Where | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env (and `web/.env.local`, which points at **production**) | The app |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env only | The Stripe webhook and the digest cron, never member requests |
| `ANTHROPIC_API_KEY`, `COPILOT_MODEL` | Vercel env | Ember |
| `RESEND_API_KEY`, `FORGE_EMAIL_FROM`, `CRON_SECRET` | Vercel env | The weekly digest |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CHALLENGE`, `STRIPE_PRICE_TALENT`, `STRIPE_WEBHOOK_SECRET` | Vercel env | Sponsorship payments |
| `LINEAR_API_KEY` | GitHub Actions secret (not set yet) | The Linear sync workflow |
| `linear_api_key` | Supabase Vault | The in-app feedback sync to Linear |
| Google, GitHub and LinkedIn sign-in client secrets | Supabase → Authentication → Sign In / Providers (and Bitwarden), never Vercel or the repo | Supabase Auth, for "Continue with ..." |

If a key ever leaks (pasted in a chat, committed, shown on screen): rotate it at the provider first, then update it where it lives. The CI secret scan catches keys committed to git, not keys pasted elsewhere.

## Restoring the database from a backup (Supabase Pro)

Pro keeps a **daily backup for 7 days**. A restore **replaces the whole production database** with that day's copy: everything since is lost, and the site is down while it runs (minutes to an hour). **Storage files (photos, videos, project files) are not in the backup**; they stay as they are. Only Ian (Owner) or an Administrator can restore. Agree on it together first; never restore to undo one bad row.

1. **Look first (read only).** Dashboard → project FORGE → **Database → Backups → Scheduled backups**: each day's backup and its time. From a terminal: `npx supabase backups list --remote=uwiwkjoonculpxjmzsfj` (lists them, changes nothing). The first one appears the day after the upgrade.
2. **Is a restore really needed?** A few wrong rows are usually better fixed with a database step through a pull request. Restore only for real loss (a bad step dropped data, mass deletion).
3. **Keep what's there now:** `npx supabase db dump --remote=uwiwkjoonculpxjmzsfj -f before-restore.sql` (schema) and `--data-only -f before-restore-data.sql` (rows). Keep both outside the repo; they hold member data.
4. **Restore:** Database → Backups → pick the day → **Restore** → confirm. The project is unavailable until it finishes.
5. **After:** open `/api/health` (the version and every database step should be OK), run `supabase/maintenance/health-check.sql` read-only, and re-apply any database steps added since that day (`db-migrate.yml` → Run workflow).
