# Product Hunt launch: build-first onboarding, pricing, launch kit

Date: 2026-11-19. The user picked **B: build-first** for the first five minutes, and "Free core + a paid
individual tier" for pricing. Built on top of #97 (two-field sign-up, About you), which is still open.

## Intent
The launch audience is students and builders first. Success is a visitor from Product Hunt who signs up
and has a real milestone on their profile, waiting for a signature from someone who saw it, about 90
seconds after "Create account". That moment is the product: a record signed by people who saw the work.
LinkedIn is saturated with claims. Brazework's opening is trust.

## Goals
- After About you, onboarding *is* the first milestone. There are three screens:
  1. **What did you build?** It's prefilled from the landing page, and the field is guessed from it.
  2. **Proof:** a link, or a photo, or "Add it later".
  3. **Who saw it?** A professor or manager by email, a club, or "Not yet".

  You land on your profile with a welcome that says where the milestone stands.
- A pricing page (`/pricing`) and a pricing section that agree, from one config: Free and Plus for
  builders, seats and challenges for companies, portals for schools and organizations.
- A `?ref=producthunt` welcome on the landing page and sign-up.
- A launch kit in `docs/launch/product-hunt.md`: tagline, description, maker's comment, gallery shot list,
  demo script and FAQ answers.

Non-goals: selling Plus (no checkout; it shows as coming), the student-org subgroup portal, and the
recruiter flow. Those come after the launch, as their own work.

Anti-goals:
- Any change to sign-in or the account form (#94, #97).
- Anything asking for a signature without the member's tap.
- Calling a milestone verified before a person signs it.
- Showing a price for something that can't be bought as if it could.

## Approaches (picked in conversation)
- **A. Trim today's path.** Lowest risk, but it's still a form followed by a feed.
- **B. Build-first.** Onboarding is the first milestone. **Picked.** It's the moment people screenshot.
- **C. Leave onboarding alone** and make the Today box the hero. Least work, and the weakest result.

## Design
### Build-first onboarding (`/onboarding`, once a profile exists and isn't onboarded)
- One client wizard (`first-build-wizard.tsx`) holds all three screens. Nothing is saved until the end
  or until "skip", because a milestone's evidence can't be edited after it's saved (members may only
  update `private`).
- State is kept in `sessionStorage`, so a refresh doesn't lose it.
- The progress bar is one path for everyone:
  - Account → About you → Your build → Proof → Who saw it.
  - The professional's three-step variant goes. Professionals get the same signature step, with their
    manager by email.
- **Your build:**
  - The line (3–300 characters), prefilled from `BUILD_KEY`.
  - Field chips, preselected by `guessField(text)`, a pure keyword match in `lib/front-door.ts`. The
    fallback is the first field.
  - "When?" defaults to today.
- **Proof:**
  - An https link.
  - Or a photo, uploaded with `uploadMedia`. Its public URL becomes the evidence link, so the vouch page,
    the club inbox and the proof card show it with no new database step. The vouch page shows a
    Brazework-hosted photo inline.
  - Or "Add it later".
- **Who saw it:**
  - Email plus relationship, using the existing `requestVouch` guards: a school or verified-company
    address, 3 per milestone, 10 a week.
  - Or one of up to 6 public clubs in their field, or a club they already joined through an invite.
    Picking one joins it first.
  - Or "Not yet".
  - With no proof, the screen says a signature needs proof, and offers "Finish" only.
- **Finish** is one server action, `finishFirstBuild`, in `onboarding/actions.ts`:
  1. Update the profile:
     - headline: "<field> student" for students, or the field for professionals
     - `field`
     - `starterInterests(field)`
     - `onboarded = true`
  2. `startProject(text)`.
  3. Save the milestone, shown on the profile (`private = false`) once signed:
     - with proof and a signer, through `addMilestone` (all of its rules, backing and rollbacks)
     - otherwise as a `draft`
  4. Join a remembered invite.
  5. Redirect to `/u/<id>?welcome=1`.

  If the ask fails (for example, not a school or company address), the action returns the error and the
  project id. A retry passes the id back, so nothing is created twice.
- Haven't built anything yet? "Set up my profile instead" opens the current form
  (`/onboarding?path=profile`), unchanged.

### Welcome on the profile
`?welcome=1`, owner only, shows a banner:
- "Your first milestone is on your record", with its state: waiting for <email>'s signature, sent to
  <club>, or a draft that needs proof.
- **Copy profile link**, **Go to Today**, and "Your signed milestones get a share card".

### Pricing (one config, `lib/pricing.ts`)
- **Builders:** Free forever: the record, signatures, clubs, Ember, being found.
- **Plus:** coming. Its name and prices are config values (`PLUS.name = "Plus"`, $6/mo students, $12
  others), because they aren't confirmed. "Pro" is taken: it means pro verification.
- **Clubs and organizations:** free for clubs. A network or school portal, with chapters, subgroups by
  field and reporting, priced per active chapter: talk to us.
- **Companies:**
  - Find-builders seats from $300/seat/month.
  - Sponsored challenges from $1,000 per chapter per semester. These match `docs/strategy.md`.
- The landing section and `/pricing` read the same config. "Search signed work (coming with Pro)"
  becomes "(Find builders seats)".

### Product Hunt welcome
A client-only banner, so the landing page stays static: "Welcome, Product Hunt. Log your first build in
90 seconds." It shows on the landing page and sign-up when `ref=producthunt` is in the URL, and is
remembered in this browser for the session.

## Tests
- Unit:
  - `guessField`
  - the pricing config: every plan has a CTA, and Plus isn't called Pro
  - the signup steps
- e2e:
  - `a-signup-post`: sign-up → About you → Your build (prefilled) → Proof link → Who saw it (a
    professor at a school address) → profile welcome, with the milestone waiting.
  - A second run: "Add it later" → draft.
  - `v-professional`: step count 5.

## Calls made by the builder
- Wizard state lives in the client until finish (the evidence can't be edited later).
- Photo evidence is a link to the public media URL (no database step).
- One step path for students and professionals.
- Plus isn't sold at launch.
