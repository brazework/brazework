# Product Hunt launch kit

Everything for the listing, in one place. What we want from launch day: a visitor signs up and has a
real milestone on their record, waiting for a signature, about 90 seconds after "Create account".

**Who we're talking to on Product Hunt: people who ship software.** The crowd there builds things and
already works in Claude, Cursor or VS Code, so the listing leads with an engineer: say what you shipped,
your AI drafts it with the proof, your tech lead signs. That's the pitch, not the product. Brazework
stays for anyone whose work a person can sign (students and their clubs, researchers, designers,
analysts, teachers), and the listing says so in one line. The landing page does the same: a visitor who
arrives with `?ref=producthunt` starts on the engineer's story in the hero (`web/src/lib/launch.ts`),
and the other five play after it.

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
  - "Your AI drafts the proof. A person who saw it signs." (52): the one line, and our pick
  - "Proof of what you shipped, signed by who saw it" (47)
  - "Your work, signed by the people who saw it" (42)
  - "Log what you shipped. Get it signed. Get found." (47)
- **Topics**, most important first: Artificial Intelligence, Developer Tools, Productivity, Hiring.
  Education is true too, but it isn't who's on Product Hunt that day.

## Description (260 characters max)
> AI made work cheap to produce and cheap to claim. Brazework is the record of what you shipped,
> signed by someone who saw it: a tech lead, a manager, a professor. Tell Claude or Cursor what you
> finished and it drafts the proof. Free for builders.

## Maker's first comment
> Hey Product Hunt 👋 We're Josh and Ian.
>
> AI made it cheap to produce work and even cheaper to claim it. A résumé line, a polished post, even
> a repo says less every month about who actually did what. What's hard now is proof.
>
> So Brazework keeps one thing: **what you shipped, signed by someone who saw it.**
>
> If you already work in Claude, Cursor or VS Code, it takes a minute: add Brazework as a connector,
> sign in, and say "put what I shipped today on my record". It reads the PR, the ticket, the dashboard,
> drafts the milestone with the proof, and shows you exactly what it will add before anything is
> saved. Then you ask the person who saw it (your tech lead, your manager, a client). They get one
> email with your proof and sign in a minute, with no account.
>
> No AI tools? Type what you built on the home page. Two fields and three screens later it's on your
> record, waiting for a signature. You can share it the same day: the card says it's waiting, and it
> turns into the signed card when they sign.
>
> We used it on ourselves: this launch is a milestone on our record, signed by someone who watched
> us build it. [link to the signed card]
>
> It isn't only for engineers. The same record works for students (their club's officers verify),
> researchers, designers, analysts and teachers: anyone whose work a person can sign. It's free for
> builders and clubs, forever. Companies pay to find people by signed work instead of keywords.
>
> We'd love your hardest questions, especially from anyone who hires or reviews other people's work.

Write the founders' names as they want them. Never use either founder's employer or their work there
as an example.

**Before posting, make the link real, or cut the paragraph.** A founder logs "Launched Brazework on
Product Hunt" as a milestone with the listing as its proof and asks someone to sign it. The signing
rules apply to us too (`supabase/vouches.sql`, `supabase/work-email-signers.sql`): the signer can't be
on the project's team, and signs from a work or university address, never Gmail. If that isn't signed in time,
delete the "We used it on ourselves" paragraph: never link a card that says "waiting".

## Gallery (1270×760, five images)
Capture each on the local stack, never production. `npm run dev -- --demo` loads three made-up builders
(priya@, leo@ and ana@forge.test, password `forge-test-pass-1`). They have signed milestones, shared
cards (`/p/demo-m1`, `/p/demo-m3`, `/p/demo-m4`) and one card still waiting for its signature
(`/p/demo-m2`). The first image is what most people see, so it's the moment this crowd cares about.
1. **The moment:** Claude with Brazework connected. "Put what I shipped today on my record", and the
   milestone card in the chat with its proof. (Or the 30-second clip below, in the first slot.)
2. **The payoff:** a signed milestone's share card (`/p/<id>`, its preview image), with who signed it.
3. **The hook:** the landing hero on the engineer's story (open `/?ref=producthunt`), with the
   draft, the proof and "Signed" by a tech lead.
4. **Who saw it:** the signer step, with an email and "my manager".
5. **The record:** a profile with its timeline of signed work.

Optional extra images:
- The consent page: "Add it when I say yes in chat" (nothing is added without you).
- Ember's composer, with its one-tap actions.
- `/pricing`, showing that it's free for builders and who pays.
- A waiting card (`/p/demo-m2`).

**The MCP moment for the video:** in Claude with Brazework connected (Settings → Connectors → Add custom
connector → `https://brazework.com/api/mcp`, then sign in and keep "Add it when I say yes in chat"),
say what you shipped, or type `/start`. It drafts the milestone from your real work, shows you what it
will add, and adds it after your yes. In assistants that support MCP Apps, the result is a card in the chat.

## 30-second demo script
| Time | On screen | Voice-over |
| --- | --- | --- |
| 0–4s | Claude, with Brazework connected. Type "put the checkout latency fix on my record" | "AI made work cheap to claim. Here's how you prove it." |
| 4–10s | Claude reads the PR and the ticket, and shows the milestone with its proof | "Your AI drafts it, with the proof." |
| 10–14s | "Add it?" → yes. The link to the milestone | "Nothing is added until you say yes." |
| 14–20s | Brazework: ask who saw it, a tech lead's email → Ask for a signature | "Then whoever saw it. They get one email." |
| 20–26s | The signer's email, one tap, "Signed" | "They sign in a minute, with no account." |
| 26–30s | The signed share card | "Signed by people who saw it. Free, always. Brazework." |

No AI tools on camera? The fallback is the landing page: type a build, sign up with two fields, three
screens (your build, the proof, who saw it), and the waiting card.

## Answers to have ready
- **"How is this not LinkedIn?"** Nothing goes on your record as fact until someone who saw it signs it.
  There's no feed of claims to scroll past. A company searches signed work.
- **"Can't my friend just sign it?"** A signer signs from a work or university address, never Gmail or
  the like, through a one-time link that proves they control that inbox, and can't be on the project's
  team. Every signature names the person, their role and their email's domain. There are 3 asks per
  milestone and 10 a week, and one address can sign 8 times a month. A club's verification comes from
  its officers.
- **"Anyone can register a domain."** True, so we don't pretend otherwise. A signature from a company
  that isn't verified on Brazework says "(company not verified)" right in it, on the record, the share
  card and in company search. A university's or a verified company's doesn't carry those words. A
  reader decides how much weight to give it, with the name and the domain in front of them.
- **"What do you charge?"** Builders and clubs: nothing, forever. Plus is an optional upgrade ($6 a
  month for students, $12 for everyone else). Companies pay for search seats and sponsored challenges.
  Schools pay a flat yearly price for a portal and their advisors, never per club. A chapter
  sponsorship goes to the club in full. See `/pricing`.
- **"Isn't GitHub my proof?"** A repo shows code exists. It doesn't say what it changed (latency down
  from 820 to 310 ms) or that a person who was there stands behind it. And AI writes more of the code
  every month. What's signed here is the outcome, by someone who saw it. And where GitHub already
  has a witness, we use it: connect a repo and a merged pull request shows who approved it there
  ("approved by @sam"), with nobody asked to sign anything.
- **"Is it only for engineers?"** No. We lead with engineers here because you ship software and your
  tools already connect. The same record works for students and their clubs, researchers, designers,
  analysts and teachers: anyone whose work a person can sign.
- **"Does the AI post for me?"** Only after your yes. When you connect an assistant you choose: it adds
  things after you say yes in the chat, or it leaves drafts you approve in Brazework. It never signs
  or verifies anything.
- **"Professionals too?"** Yes. You get the same steps, and a manager, tech lead or client signs.
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
