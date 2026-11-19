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

## Name and tagline
- **Name:** Brazework
- **Tagline** (60 characters max). Pick one:
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
> So Brazework keeps one thing: **what you built, signed by someone who saw it.** A club's officers, a
> professor, a manager. They get one email with your proof and sign in a minute, with no account.
>
> Try it: type what you built on the home page. After two quick fields and three screens (what you
> built, the proof, who saw it), it's on your record, waiting for their signature. Once it's signed,
> you get a share card you can post anywhere.
>
> It's free for builders and clubs, forever. Companies pay to find people by signed work instead of
> keywords. Clubs get events, chat and officer handoff for free, and their officers verify members'
> work.
>
> We'd love your hardest questions, especially from anyone who hires or runs a student org.

Write the founders' names as they want them. Never use either founder's employer or their work there
as an example.

## Gallery (1270×760, five images)
Capture each on the local stack (`npm run dev`, test members), never production.
1. **The hook:** the landing hero with a build typed in, "Start with this build".
2. **Your build:** the first onboarding screen, with the typed line and the field guessed.
3. **Proof:** the photo option with a photo in place.
4. **Who saw it:** "A professor or mentor", with an email and "my professor".
5. **The payoff:** a signed milestone's share card (`/p/<id>`, its preview image), with "Vouched for
   by Dr. …".

A sixth, optional image: `/pricing`, showing that it's free for builders and who pays.

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

## Launch-day checklist
- [ ] Production is green on `main`, and the database health check passes.
- [ ] Email works: a vouch ask arrives (send one from a founder's account to a founder's school or
  work address).
- [ ] The #97 email templates are pasted in Supabase, so the confirmation email has the code.
- [ ] `/?ref=producthunt` shows the welcome. `/pricing` loads.
- [ ] Gallery images and the demo video are uploaded. The first comment is posted at 12:01 am PT.
- [ ] One founder is on comments all day. The other watches sign-ups and email delivery.
