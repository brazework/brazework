# The front door: landing page, sign-up and first run

Date: 2026-11-13 · Status: **approved by Josh in conversation ("keep going and push to production")** · Follows [the app redesign](2026-11-13-app-redesign-design.md) (stage 1 shipped in #56)

## Why

Josh asked for a much better landing page (more interactive, plainer language) and a clearer flow for new members. Today:

- The landing page has 17 sections. It has interactive pieces, but nothing a visitor can try for themselves, and its headlines are abstract ("One club starts the loop", "One network, four ways in").
- Sign-up says "Step 1 of 3", "Step 2 of 3", "Step 3 of 3", then shows a fourth screen labelled "Step 2 of 2". Its first line is "Join the STEM network", the old pitch.
- What a visitor does on the landing page is lost at sign-up: they start from an empty box again on Today.

## What changes

### Landing page

- **Headline (Josh picked option A):** "Prove what you built." Under it: "Log your work, get it signed by someone who saw it, and get found by the teams hiring for it."
- **One thing to try:** the hero asks "What are you building?" Typing a line puts it into the path card as the Build step, live, with the goal chips still choosing the rest of the path. The button becomes "Start with this build" and carries the line into sign-up.
- **Three ways in, in the hero:** the main button is for people who build; "For clubs" and "For companies" jump to their sections.
- **Shorter:** the page keeps the hero, Why now, How it works, the project proof page, clubs, companies, pricing, the founding-clubs form, FAQ and the closing call. It drops Disciplines, No club, the Connect section, the globe, "four ways in" and the features grid. Their components stay in the repo, unused, so any of them can come back with one line.
- **Plainer headings:** "Build it. Get it signed. Get found." for How it works; "Search the work, not the résumé." for companies; "Built something? Put it on the record." to close.
- **Nav:** How it works, Projects, Clubs, Companies, Pricing, FAQ.

### Sign-up and first run

- **Four honest steps:** Create your account (1 of 4), Check your inbox (2 of 4), What do you build? (3 of 4), Find your club (4 of 4).
- **First line:** "Create your account".
- **The build carries over:** `/signup?build=<line>` is kept in the browser (the same way the goal is), and the first-build box on Today opens with it already typed. One tap starts the project. Nothing is sent anywhere until that tap.
- **Fewer taps:** choosing a field pre-selects its first three interests until the member changes one themselves.

## Not in this change

- The places inside the app (Build, Club, Proof, Inbox): next, one at a time.
- Any database step, any URL change.
- Deleting the unused landing components.

## What would make this a failure

- The goal picker stops carrying the goal into sign-up.
- The landing page loses its Lighthouse budgets (accessibility ≥ 90, no layout shift).
- A new member can't finish sign-up, or loses the line they typed.

## Calls made by Claude

- Which sections to drop (the 8-section cut was Claude's recommendation; Josh said to keep going).
- Pre-selecting three interests per field.
- Pre-filling the first-build box instead of creating the project automatically, so nothing is created without a tap.
