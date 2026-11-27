# How Brazework got here

The build in order, from the git history of `main` (about 425 commits from 7 to 26 November 2026). Each
line is what a member could do after it, not every commit. The details of each step are in its pull
request and in [plan.md](plan.md).

## Week 1 (7–13 November): from a prototype to the product

- **7 Nov:** messages with a requests inbox, events and organizations, notifications and personal
  analytics, projects on profiles, a guided tour. (The original app, in plain JavaScript under `public/`.)
- **8 Nov:** the whole app ported to Next.js: profiles, projects, network, posts and comments, messages,
  communities, events.
- **9–10 Nov:** Ember, the AI teammate (now Torch), first as a character, then an orb. A glass redesign.
  The sidebar and ⌘K palette. Projects as a workbench. **Find builders**: verified companies search
  people by club-verified work. **Sponsored challenges**, with Stripe.
- **11 Nov:** a Home that shows progress; chapters (national clubs with local chapters); the project
  reel as a timeline of the build.
- **12 Nov:** production's settings written into the repo with a drift check. **Redesign** to calm,
  premium foundations, with a design guard and layout checks in CI. Email alerts.
- **13 Nov:** five places (Today, Build, Club, Proof, Inbox); a landing page you can try; comments with
  replies and likes.

## Week 2 (14–20 November): proof you can trust, and the launch

- **14–15 Nov:** private projects with viewers and teams; clubs verified by their school; database
  hardening and a weekly database watch; study groups with proof for whoever leads them.
- **16–17 Nov:** a landing redesign with one 3D viewer for every field; Brazework opens to **anyone who
  builds**, not only students; **Backed by GitHub** (the second kind of proof); **proof cards** (a
  public link for any result); witness invitations.
- **18 Nov:** reliability targets with error budgets; previews can't touch production's database; a
  nightly drift check; database steps go to staging first.
- **19 Nov:** a shorter sign-up and a better log-in; **MCP**: your AI assistant drafts your first
  milestone; the Product Hunt launch kit and pricing page; Plus checkout or waitlist; "Book a pilot".
- **20 Nov:** "Signed by" everywhere a person signed, with the date; safe at work (signers sign as
  themselves, work stays off your profile until you show it).

## Week 3 (21–26 November): Torch, schools and courses

- **21 Nov:** personal-email signers, labelled; Torch asks a person to sign, knows your record and opens
  with your next step; the record by year; iOS with the web's colors and the signed record.
- **22 Nov:** add files and evidence after posting; the **founding member** badge; one Add-proof picker
  for every field's tools; sign-up asks where you're headed; milestone logs fold on a profile; Torch's
  page centred.
- **23–25 Nov:** club projects run by a club's officers; a shorter mobile landing; Vercel Analytics;
  one theme, smooth streaming, a CAD lab, new Home and Clubs.
- **26 Nov:** **schools first**: the site sells the school portal, students and clubs stay free.
  - The **student portal**: classes, rosters, faculty verification, the school's view.
  - **Founding-school pricing**.
  - **Brazework Courses**: phase A (modules, assignments, rubrics, gradebook), then phase B (quizzes,
    attendance, extensions, peer evaluation, ABET outcomes, Torch acting in courses, Demo University).
  - **Ember became Torch**, with a new mark.
  - Torch asks with buttons and carries on after a yes.
  - Glass cards across Projects, the progress dashboard and cleaner banners.
  - The goal card hands its next step to Torch (#265).

## Decisions that shaped it

- **Signed, not claimed** (from the start): nothing on a record reads as fact until someone who saw it
  signs it. Signers use a one-time email link and their name stays on the signature.
- **Anyone who builds** (17 Nov): students first, but working builders too, with their own way to get
  signed and Plus as the paid plan.
- **Schools pay, students never do** (26 Nov): revenue comes from schools (the portal and Courses) and
  companies (search, sponsorships, challenges). Students and clubs are free for good.
- **The AI drafts, the member decides**: Torch prepares cards and never adds, signs, grades or sends
  anything without a yes.
