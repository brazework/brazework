# Launch checklist (production)

What has to happen, in order, before the first real club uses Forge. Everything below is done by someone with access to the production Supabase project and Vercel; nothing here is automated.

## 1. Database (Supabase → SQL Editor)

Run each file in [next-migration.md](next-migration.md)'s order, one at a time, and check it says "Success". Steps 5–29 are new since the last production update. Each one is additive: the app works before and after each step, so a pause halfway is safe.

## 2. Remove test data

Run `supabase/maintenance/remove-test-data.sql`: first the preview query (read what it would delete), then the delete inside its transaction.

## 3. You, as a Forge admin

In the SQL Editor, with your own account's email:

```sql
insert into public.forge_admins (uid) select id from auth.users where email = 'you@example.com';
```

Then `/admin` opens for you: metrics, sponsorship approvals, school requests, reports.

## 4. Schools

UHart (`hartford.edu`) is recognized automatically. For any school whose email doesn't end in `.edu` or `.ac.uk`, add it before its students sign up (or approve their "Request my school" on `/admin`):

```sql
insert into public.school_domains (domain, school) values ('example.ca', 'Example College');
```

## 5. Environment (Vercel → Settings → Environment Variables)

| Variable | For | Needed |
|---|---|---|
| `ANTHROPIC_API_KEY` | Ember | Now |
| `SUPABASE_SERVICE_ROLE_KEY` | The billing webhook (Vercel's Supabase integration usually sets it) | Before payments |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CHALLENGE` (and `STRIPE_PRICE_TALENT`) | Stripe Checkout for sponsorships | Before payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks: endpoint `https://<your domain>/api/billing/webhook`, event `checkout.session.completed` | Before payments |

Without the Stripe keys, sponsoring a challenge files a pilot request that you approve on `/admin`. Nothing is ever charged without them.

## 6. Check it

1. Sign up with a school email, join a club, add a project, ask the club to verify a milestone.
2. As the club's officer, verify it; check it shows on the profile and in `/admin`'s funnel.
3. Register a company with a work email on its domain; open Find builders; post a challenge, approve the pilot on `/admin`, publish, enter it from a member account.

## Tuning later

Limits live in `app_config` (no deploy needed): `limit_posts_per_hour`, `limit_messages_per_hour`, `limit_requests_per_day`, `limit_org_requests_per_week`, `limit_milestones_per_day`, `verify_weekly_limit`, `verified_club_min_members`, `min_age`.
