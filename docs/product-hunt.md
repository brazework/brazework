# Product Hunt launch kit

Everything for the listing, in one place. The audience is students and builders first. What we want
from launch day: a visitor signs up and has a real milestone on their record, waiting for a signature,
about 90 seconds after "Create account".

The design is in [superpowers/specs/2026-11-19-product-hunt-launch-design.md](superpowers/specs/2026-11-19-product-hunt-launch-design.md).
Prices live in `web/src/lib/pricing.ts`. The paid tier's name and price ("Plus", $6/$12) aren't
confirmed yet; change them there.

## The link
Use `https://brazework.com/?ref=producthunt`. The landing page and sign-up greet anyone who arrives
this way ("Welcome, Product Hunt"). The greeting is kept for the browser tab's session only. Use the
same link everywhere on launch day, so the welcome shows.

## The one line
**Your AI drafts the proof. A person who saw it signs.** It's the hero's sub-line, the Product Hunt
welcome, and the first sentence of the first comment. Everything else on the listing explains it.

## Name and tagline
- **Name:** Brazework
- **Tagline** (60 characters max). Pick one:
  - "Your AI drafts the proof. A person who saw it signs." (51)
  - "Your work, signed by the people who saw it" (42)
  - "A record of what you built, not what you claim" (46)
  - "Log what you built. Get it signed. Get found." (45)
- **Topics:** Productivity, Education, Hiring, Developer Tools.

## Description (260 characters max)
> LinkedIn is full of claims. Brazework is a record of what you built, signed by the people who saw
> it: your club, a professor, a manager. Log a build, add proof, ask for a signature, in about 90
> seconds. Free for builders and clubs.

## Maker's first comment
> Hey Product Hunt 👋 We're Josh and Ian.
>
> We kept seeing the same thing: students and early-career builders do real work (robots that
> compete, models that ship, startups with customers), and the only place to show it is a feed where
> anyone can claim anything. Recruiters told us they skim past it. Students told us LinkedIn feels
> saturated.
>
> So Brazework keeps one thing: **what you built, signed by someone who saw it.** Your AI drafts the
> proof from the tools you already use: add Brazework to Claude, Cursor or VS Code, sign in, and type
> `/start`. It finds something you really finished and writes it up with its proof. A club's officers,
> a professor or a manager signs it. They get one email with your proof and sign in a minute, with no
> account.
>
> Try it: type what you built on the home page. After two quick fields and three screens (what you
> built, the proof, who saw it), it's on your record, waiting for their signature. You can share it
> the same day: the card says it's waiting, and it becomes the signed card when they sign.
>
> It's free for builders and clubs, forever. Companies pay to find people by signed work instead of
> keywords. Clubs get events, chat and officer handoff for free, and their officers verify members'
> work.
>
> We'd love your hardest questions, especially from anyone who hires or runs a student org.

Write the founders' names as they want them. Never use either founder's employer or their work there
as an example.

## Gallery (1270×760, five images)
Capture each on the local stack, never production. `npm run dev -- --demo` loads three made-up builders
(priya@, leo@ and ana@forge.test, password `forge-test-pass-1`). They have signed milestones, shared
cards (`/p/demo-m1`, `/p/demo-m3`, `/p/demo-m4`) and one card still waiting for its signature
(`/p/demo-m2`).
1. **The hook:** the landing hero with a build typed in, "Start with this build".
2. **Your build:** the first onboarding screen, with the typed line and the field guessed.
3. **Proof:** the photo option with a photo in place.
4. **Who saw it:** "A professor or mentor", with an email and "my professor".
5. **The payoff:** a signed milestone's share card (`/p/<id>`, its preview image), with "Vouched for
   by Dr. …".

Optional extra images:
- `/pricing`, showing that it's free for builders and who pays.
- Claude with Brazework connected: `/start`, and the milestone card in the chat.
- A waiting card (`/p/demo-m2`).

**The MCP moment for the video:** in Claude with Brazework connected (Settings → Connectors → Add custom
connector → `https://brazework.com/api/mcp`, then sign in), type `/start`. It drafts the first
milestone from your real work. In assistants that support MCP Apps, the result is a card in the chat.

## 30-second demo script
| Time | On screen | Voice-over |
| --- | --- | --- |
| 0–4s | Landing page; type "A line-following robot that won our fall expo" | "Built something? Put it on the record." |
| 4–9s | Sign-up with two fields, then About you | "Email, password, your name." |
| 9–15s | Your build (field guessed) → Proof (a photo) | "What you built, and the proof." |
| 15–21s | Who saw it: a professor's email → Ask for a signature | "Then whoever saw it. They get one email." |
| 21–26s | Profile: "waiting for … to sign it", confetti | "Ninety seconds, and it's on your record." |
| 26–30s | The signed share card | "Signed by people who saw it. Free, always. Brazework." |

## Answers to have ready
- **"How is this not LinkedIn?"** Nothing goes on your record as fact until someone who saw it signs it.
  There's no feed of claims to scroll past. A company searches signed work.
- **"Can't my friend just sign it?"** A signer has to use a school or a verified-company address, and
  can't be a teammate. There are 3 asks per milestone and 10 a week. A club's verification comes from
  its officers, and every signature names the person who gave it.
- **"What do you charge?"** Builders and clubs: nothing, forever. A paid tier for individuals is
  coming. Companies pay for seats and sponsored challenges. Networks and schools pay per active
  chapter. See `/pricing`.
- **"Professionals too?"** Yes. You get the same steps, and a manager or mentor signs.
- **"What about my data?"** Milestones are private until signed and you choose to show them. Proof
  links stay yours. See `/privacy`.

## Founder checklist (before launch day)
These need a founder: keys, providers and production data never change from a session.

**Email: signatures depend on it.**
- [ ] Resend: the domain is verified, and `RESEND_API_KEY` and `FORGE_EMAIL_FROM` are set in Vercel
  (Production). Check by asking a founder's school or work address to sign a milestone, and confirm
  the email arrives.
- [ ] Supabase SMTP uses Resend. Paste in the #97 email templates (`docs/accounts.md`, steps 6 and 7), so
  confirmation emails carry the 6-digit code.

**Sign-in.**
- [ ] Google, GitHub and LinkedIn are switched on in Supabase (`docs/accounts.md`, "Sign in with Google,
  GitHub and LinkedIn"). The buttons appear by themselves within five minutes.
- [ ] One-click connect for assistants: in Supabase → Authentication → OAuth Server, turn it on, set the
  Authorization Path to `/oauth/consent`, and allow dynamic OAuth apps (`docs/mcp-workflows.md`, "How
  signing in works"). Do it on staging first, then production. Check with
  `curl -i -X POST https://brazework.com/api/mcp`: it should answer 401 with a `resource_metadata` link.
- [ ] After that deploy, add Brazework to Claude, run `/start`, log a milestone, and check that the card
  shows in the chat. The text result is the fallback.

**Money: Stripe (optional for launch).** With no keys, every paid button takes a request that lands in
the admin queue (`/admin` → Review queue, "Sales request"), so launch works without Stripe. To take
payments, create these in Stripe (test mode first), then add them in Vercel (Production) and redeploy:
- [ ] Products and prices:
  - **Plus:** monthly, $12, → `STRIPE_PRICE_PLUS`. Optionally, a second monthly price of $6 for students
    → `STRIPE_PRICE_PLUS_STUDENT` (without it, students pay the one price). The name and prices live in
    `web/src/lib/pricing.ts`.
  - **Plus by the year (optional):** yearly, $96, → `STRIPE_PRICE_PLUS_ANNUAL`, and yearly, $48, for students
    → `STRIPE_PRICE_PLUS_STUDENT_ANNUAL`. With the first one set, `/plus` offers a year next to monthly. A
    student never pays $96: without the student yearly price, a student's yearly choice checks out at the
    student monthly price.
  - **Find builders:** yearly, $15,000, → `STRIPE_PRICE_TALENT`. One price for the whole plan (2 seats
    and 2 chapter sponsorships), not per seat: checkout always buys a quantity of 1.
  - **Sponsored challenge:** one-time, $5,000, → `STRIPE_PRICE_CHALLENGE`. That's the starting price;
    a bigger challenge is invoiced.
  - Chapter sponsorships ($2,500 a semester) and schools have no Stripe price: they come in as requests
    and are invoiced. Prices match `web/src/lib/pricing.ts`.
- [ ] `STRIPE_SECRET_KEY`: the secret key (`sk_live_…`, or `sk_test_…` while testing).
- [ ] A webhook endpoint at `https://brazework.com/api/billing/webhook` for the events
  `checkout.session.completed` and `customer.subscription.deleted`. Put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (the webhook records payments with it).
- [ ] Check: `/plus` shows **Get Plus** instead of **Join the waitlist**. A test-mode checkout gives the
  account Plus, and the dashboard's "Companies that looked" then covers 90 days.

**Watching it.**
- [ ] Uptime: a free monitor (Better Stack, UptimeRobot or similar) on `https://brazework.com/` and
  `https://brazework.com/api/health`, every minute, alerting both founders by email.
- [ ] Errors: create a Sentry project, and set `NEXT_PUBLIC_SENTRY_DSN` in Vercel (Production). The app
  already sends errors once it's set (`web/src/lib/sentry.ts`), with personal data scrubbed.

**Clean the shop window.**
- [ ] Remove "TEST: MCP log_milestone check" from Josh's public profile. Its owner can't delete a
  verified milestone, so a founder runs `supabase/maintenance/remove-test-data.sql` in the Supabase SQL
  editor: the preview first, then the delete. It now covers milestones titled "TEST: …".
- [ ] Make sure the founding clubs have a few signed milestones each before launch day. A visitor who
  opens a club page should see real, signed work.

## Launch-day checklist
- [ ] Production is green on `main`, and the database health check passes.
- [ ] Email works: a vouch ask arrives (send one from a founder's account to a founder's school or
  work address).
- [ ] The #97 email templates are pasted in Supabase, so the confirmation email has the code.
- [ ] `/?ref=producthunt` shows the welcome. `/pricing` loads.
- [ ] Gallery images and the demo video are uploaded. The first comment is posted at 12:01 am PT.
- [ ] One founder is on comments all day. The other watches sign-ups and email delivery.
