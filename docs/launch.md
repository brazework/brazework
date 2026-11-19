# Launch runbook: Product Hunt, Sunday, November 22

Brazework goes live on Product Hunt at **12:01 am PT on Sunday, November 22, 2026**. This page ties
everything for the launch together: what's live, what only a founder can do, the days before and
after, the checks, and how to undo a bad deploy. The listing itself (tagline, first comment, gallery,
answers) is in [product-hunt.md](product-hunt.md).

Use one link everywhere on launch day: **https://brazework.com/?ref=producthunt**. It shows the
"Welcome, Product Hunt" greeting.

## What's live

Everything ships by pull request. The PR merges itself once the checks pass, Vercel deploys `main`, and
database steps go to staging first and then production by themselves (`.github/workflows/db-migrate.yml`).
To see what production runs, check `version` at https://brazework.com/api/health: it's the commit on
`main`. A green CI run alone doesn't prove a deploy, so always check this.

What the launch shows:
- **The record:** milestones signed by the people who saw them (a club officer, a professor, a
  manager). The profile leads with a timeline of signed work over time.
- **The assistant connection (MCP):** connect Claude or another assistant and log work by saying
  what you did. Drafts wait for your OK, and signatures still come from people.
  [mcp-workflows.md](mcp-workflows.md) and the public guide at https://brazework.com/ai.
- **Goals:** "where you want to go", with the next step toward it on Home, Record and `/week`.
- **Money paths:**
  - Plus (`/plus`): every company that looked at your record in the last 90 days, and the review packet.
  - Company seats (Find builders).
  - Sponsored challenges.
  - Book a pilot (`/book`).
  
  Without Stripe keys, every paid button files a request in `/admin` → Review queue.

## Only a founder can do these

Keys, providers and production data never change from a Claude session. Steps 1 to 4 must be done
before Saturday night. Each points to the doc with the details.

1. **Email (signatures depend on it).** In Vercel → Production, set `RESEND_API_KEY` and
   `FORGE_EMAIL_FROM`, then redeploy. Set Supabase SMTP to Resend and paste in the email templates
   ([accounts.md](accounts.md), steps 6 and 7). To check, ask a founder's school address to sign a
   milestone and confirm the email arrives.
2. **One-click connect for assistants.** In Supabase → Authentication → OAuth Server: turn it on, set
   the path to `/oauth/consent`, and allow dynamic apps. Do staging first, then production. To check,
   run `curl -i -X POST https://brazework.com/api/mcp`; it should answer 401 with a `resource_metadata`
   link.
3. **Clean the shop window.**
   - Remove "TEST: MCP log_milestone check" from Josh's profile with
     `supabase/maintenance/remove-test-data.sql`: run the preview first, then the delete.
   - Make sure each founding club has a few signed milestones.
4. **Watching it.**
   - Set up an uptime monitor on `/` and `/api/health`, checking every minute and emailing both founders.
   - Optionally create a Sentry project and set `NEXT_PUBLIC_SENTRY_DSN`.
5. **Optional:**
   - Google, GitHub and LinkedIn sign-in ([accounts.md](accounts.md)).
   - Stripe keys and prices ([product-hunt.md](product-hunt.md), "Money"). Launch works without them.

## The days

| When | What |
|---|---|
| **Thu Nov 19** | Founders run the [test script](https://claude.ai/artifact/Wv6sAKeuGdifG7cY2ZG2N4) (source: [explainer/brazework-test-script.html](explainer/brazework-test-script.html)) on the local demo and on production. Report anything off; fixes ship the same day. |
| **Fri Nov 20** | Film the demo videos in the test script's order, on the local demo (below). Take the five gallery images (1270×760). Founder steps 1 to 4. |
| **Sat Nov 21** | Set up the social accounts from the kit ([explainer/social/](explainer/social/): banners, profile picture, [bios](explainer/social/bios.md)). Schedule the launch posts from the [social plan](https://claude.ai/artifact/DNAiBQMeua5wbT3rmczU3c). Draft and schedule the Product Hunt listing. **6 pm PT: code freeze** (recommended): after this, only fixes for something broken merge. Run the go/no-go checks below. |
| **Sun Nov 22, 12:01 am PT** | The listing goes live. Post the maker's first comment ([product-hunt.md](product-hunt.md)). Post on X, LinkedIn, Instagram and YouTube from the social plan. One founder answers comments all day; the other watches sign-ups, email delivery and `/admin`. |
| **Mon Nov 23** | Turn "require branches to be up to date" back on (below). Review PR #84 (it closes database functions to signed-out visitors; check the assistant connection still works). Write the launch recap: sign-ups, signed milestones, sales requests. |

## Go/no-go checks (Saturday night, and again before 12:01 am)

- [ ] `https://brazework.com/api/health` says `"ok":true, "db":"ok"`, and `version` is the latest commit
  on `main`.
- [ ] The latest CI run on `main` is green: typecheck, unit tests and build; end-to-end; security.
- [ ] `/?ref=producthunt` shows the welcome. `/`, `/pricing`, `/plus`, `/ai`, `/signup`, `/login` and
  `/book` load with no console errors at desktop and phone width.
- [ ] A test sign-up reaches a milestone that's waiting for a signature in about 90 seconds, and the
  signature email arrives (needs founder step 1).
- [ ] An assistant connects and `/start` works (needs founder step 2, for one-click; a token from
  Settings → Tools works without it).
- [ ] No "TEST" milestones on any public profile.

## If something breaks on launch day

- **A bad deploy:** in Vercel → Deployments, open the last good production deployment and choose
  **Promote** (instant rollback, no rebuild). Then revert the PR on GitHub so `main` matches. Database
  steps are additive, so the previous app version still works against the newer database.
- **Sign-ups fail:** check Supabase → Authentication → Logs and the Resend dashboard. Email is the
  usual cause.
- **Assistants can't connect:** a token from Settings → Tools works even if OAuth is off. Say so in
  the comments.
- **Slow pages:** Vercel → Observability. The SLOs and what to do when one is spent are in
  [slo.md](slo.md).

## The demo, for filming

Everything runs on a private local database, so nothing touches production. From `web/`:

```sh
npm run dev -- --demo
```

Sign in as Priya, Leo or Ana (`priya@forge.test`, `leo@forge.test`, `ana@forge.test`), or as the
officer and company accounts in [demo.md](demo.md). The password is `forge-test-pass-1` (local only).
Emails that would go out (signature asks, invites) land in the local outbox at
http://localhost:3000/dev/outbox, so links can be clicked on camera.

## Everything for the launch, in one list

| What | Where |
|---|---|
| Product Hunt listing, first comment, answers | [product-hunt.md](product-hunt.md) |
| Launch plan: demo, revenue and Product Hunt | https://claude.ai/artifact/HZLQHvtnHGLQPureTzbwmV |
| Social plan for launch weekend | https://claude.ai/artifact/DNAiBQMeua5wbT3rmczU3c ([source](explainer/brazework-social-plan.html)) |
| Test script, nine tests in filming order | https://claude.ai/artifact/Wv6sAKeuGdifG7cY2ZG2N4 ([source](explainer/brazework-test-script.html)) |
| Social account kit: banners, profile picture, bios | [explainer/social/](explainer/social/) ([kit.html](explainer/social/kit.html)) |
| Explainer and launch pages for videos and posts | [explainer/](explainer/) |
| The assistant connection: setup, commands, fields | [mcp-workflows.md](mcp-workflows.md) |
| The 3-minute demo of the loop | [demo.md](demo.md) |
| Accounts and who owns them | [accounts.md](accounts.md) |

## Once, by a founder (already done for production)

These are kept for a new environment. Database steps run by themselves; never run SQL against
production from a Claude session.

- **Admin:** `insert into public.forge_admins (uid) select id from auth.users where email = '<your email>';`
  opens `/admin`.
- **Schools without a `.edu` or `.ac.uk` address:**
  `insert into public.school_domains (domain, school) values ('example.ca', 'Example College');`
  Or approve their "Request my school" on `/admin`.
- **After launch, Monday:**
  ```sh
  gh api -X PATCH repos/brazework/brazework/branches/main/protection/required_status_checks -F strict=true
  ```
