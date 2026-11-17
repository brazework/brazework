# Positioning: for anyone who builds, at any stage

Date: 2026-11-16 · Status: **Josh's call in conversation** ("I don't want it to be for STEM, position it better, like people who are professionals"; asked to pick the best, Claude picked this) · Linear FIX-120

## Why

The strategy docs said "the verified work network for STEM" and the site said "home base for university clubs". Josh wants neither label. The product had already moved: the field list includes business and design, sign-up offers Professional, and a manager or mentor can sign a milestone by email with no account. Only the words were narrow.

## The line

**Brazework is the record of your work, signed by the people who saw it.**

It describes what the product does instead of who it is for, so it holds for a student signed by a club officer, an employee signed by a manager and a freelancer signed by a client.

## Approaches considered

- **Builders, any stage (picked).** One record; studying or working is a detail. Removes both labels and keeps the one group we can reach today (the UHart chapter). Risk: a less pointed message.
- **Professionals first.** The front door speaks to working people. Larger buyers, but no group to start from, direct competition with LinkedIn, employees often can't show their work, and no weekly reason to return.
- **Stay with university clubs.** The sharpest wedge, but it is the label Josh asked to drop, and it undersells a record that follows people after they graduate.

## What changes

- **Landing page:** the hero names who signs (a club officer, a manager, a mentor); a new section, "One record, wherever you build", shows an example for someone studying, working and on their own; the companies and pricing copy says people, not students; a new question, "I already work. Is this for me?"; the example people in the company search include an engineer signed by a manager and a freelancer signed by a client.
- **Shared wording:** the site description, the share image, the app manifest, the club invite page, the MCP instructions, Ember's description of the app, and the vouch email.
- **After onboarding:** someone who chose Professional goes straight to Today instead of the "Find your club" step (`app/onboarding/actions.ts`). Clubs are still one tap away under Club.
- **First steps on Today:** someone who chose Professional and has no club starts with "Add what you're building" and is sent to "Ask someone who saw it", not "Join your club" (`lib/guide-steps.ts`). Students, and anyone in a club, see the same steps as before.
- **Docs:** `positioning.md`, `strategy.md`, `overview.md`, `README.md`.

## What does not change

- **Where we launch.** One club, one campus. A club is the smallest group that is useful with nobody else there; a professional who joins alone has a record but no weekly reason to come back yet.
- **The app's words inside:** the Club place, "verified", and the iPhone app.
- **The database.** No step.

## What would make this a failure

- The landing page reads as "for everyone" and so for no one. The hero still shows one concrete build being signed.
- A professional signs up and is told to join a club.
- We start chasing working professionals before one campus is active (the risk `strategy.md` already names).

## Calls made by Claude

- The positioning itself, and the wording of the line.
- "On your own" is described as signed by whoever you built it for, from their company's address, because free-mail addresses can't vouch.
- The example companies (Voltline, Northside Bikes, Eastside Tenants Union) are invented.

## Worth doing next (not in this change)

- "Client" and "teammate" as named signer types. Today they fall under "someone who saw the work"; adding them is a database step (`supabase/vouches.sql`).
- The ask form defaults to "a professor" for everyone; a professional should start on "a manager".
