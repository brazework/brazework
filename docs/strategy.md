# Brazework: strategy to YC and to revenue (updated 2026-11-10)

Builds on [positioning.md](positioning.md) (market research, with sources). Numbers marked *assumption* are hypotheses to test, not facts.

## The one-pager

| | |
|---|---|
| **Problem** | AI made résumés and profiles free to fake: 91% of recruiters have caught candidate deception, and 1 in 4 candidate profiles may be fake by 2028. STEM students build real things in clubs, but the proof lives in group chats and lab notebooks, where no one hiring can see it. |
| **Product** | The verified work network for STEM. **Clubs run on it** (members, events, chat, announcements, with Ember, the AI agent, doing the busywork). **Members post projects** (photos, video with callouts, specs, the tools). **Club officers, who saw the work happen, verify each milestone** with its evidence, and their name stays on it. **Companies find people by that proof** and sponsor the clubs behind it. |
| **Why us, why it's defensible** | Verification is a social act only the club can perform, so the trust graph is ours: who vouched, when, with what evidence. Each verified milestone makes a profile more valuable to its owner and the whole network more useful to companies, and a club's history carries across officer turnover. Competitors either have the audience without the proof (LinkedIn, Handshake) or the admin without the careers outcome (Presence, Engage). |
| **The habit** | A weekly loop that pays off: post what you built, get it verified, see who looked (Your week, the digest, "viewed by 3 companies"). Officers come back every Monday for Ember's brief. Clubs live on it, so it's where the chapter actually happens. |
| **Business model** | Free forever for students and clubs (the supply side and the trust). Companies pay first: chapter sponsorships ($1–5k per chapter per semester) and verified-work search ($300–500 per seat per month). Then universities ($15–40k per campus per year) and national organizations (a per-chapter network license). |
| **Go-to-market** | Atomic network: one club of 30–100 people, useful on day one. Design partner: NSBE @ UHart, then the other engineering clubs, then nearby campuses through officer-to-officer intros, then national organizations (NSBE, SHPE, SWE) once 20+ chapters are live. First sponsors: Connecticut employers that already recruit at NSBE (Pratt & Whitney, Collins, Electric Boat, Sikorsky). |
| **What we'll show YC** | 40%+ of a pilot club's members active weekly for 8 weeks; 15+ verified milestones in the first month; organizations growing 5–10% a week; companies messaging members; one paid sponsor pilot or signed LOI. |
| **Where we are (Nov 2026)** | The full loop is built and tested (84 end-to-end checks): club, projects, verification with evidence and revocation, company search, sponsored challenges, Ember. Live in production on the new name; the pilot with the UHart chapter is next. |

## 1. What Brazework is, in one line

**Brazework is the verified work network for STEM.** Organizations run on it, members prove what they've built, and the companies and universities that hire find them there. Ember, the AI agent built in, does the organization's busywork.

- **YC "describe it in 50 characters":** *Verified work, not résumés, for STEM.*
- **Why it matters now:** AI made résumés and profiles free to generate. 91% of recruiters have caught candidate deception (Greenhouse, 2025), and Gartner expects 1 in 4 candidate profiles to be fake by 2028 (sources in positioning.md). Work that someone else saw happen is what still carries signal, and today it's buried in group chats and lab notebooks.

## 2. The product loop

1. **An organization runs on Brazework.** A chapter, club, lab or team: members, events, chat, announcements, roles. Ember plans meetings, drafts updates from real numbers and handles follow-ups.
2. **Members prove the work.** Projects with photos, video and write-ups; officers verify milestones they saw happen. Brazework records who vouched, when, and the evidence.
3. **The right people find it.** Companies, universities and alumni find people by verified work, sponsor the organizations behind it, and reach out through a request inbox.
4. **Members land opportunities and bring the next organization.**

The atomic network is **one organization of 30–100 people**: useful on day one with zero outside network.

## 3. Who pays (and who never does)

Free, always: **members and student organizations.** That's the supply side and the trust.

| Customer | What they buy | Budget it replaces | First price to test (*assumption*) |
|---|---|---|---|
| **Companies** (first revenue) | Chapter sponsorships with real ROI reporting; search by verified work; events beside the organizations they support | Diversity and campus recruiting spend that already flows to NSBE, SHPE and SWE (conference booths, chapter sponsorships) | $1,000–$5,000 per chapter per semester; talent search $300–$500 per seat per month |
| **Universities** | Every student organization on one platform, plus outcomes: verified projects, events, employer connections | Student-org management platforms. UHart already lists its organizations, including NSBE, on Presence ([hartford.presence.io](https://hartford.presence.io/organization/national-society-of-black-engineers)) | $15k–$40k per campus per year |
| **National organizations** (NSBE, SHPE, SWE, IEEE, ASME…) | Chapter health across the network, member engagement, sponsor reporting | Chapter management tools and spreadsheets | Network license, priced per active chapter |
| **Later: AI labs and the expert market** | Access to verified STEM experts (with consent) | The market Handshake and Mercor proved: Handshake's AI-training work is about $1B of its ~$1.15B run rate | Marketplace take rate |

**Why this can be very large (illustrative, not a forecast):** about 4,000 US degree-granting institutions; if 1,000 campuses pay $25k that's $25M ARR. 3,000 employers at $15k is $45M. National-organization licenses add to that, and the verified-expert marketplace is a separate, larger market. The asset under all of it is the **verified work graph**, which gets more valuable with every milestone and is hard to copy because it's attested by organizations, not self-reported.

## 4. The AI angle (core, not a feature)

1. **Ember runs the organization.** Officers are students with no time. If Ember plans the meeting, drafts the update, chases the RSVPs and writes the sponsor report, the organization runs on Brazework because it's less work, not more. That's the retention engine.
2. **Verified work is AI-readable trust.** As hiring moves to AI screening and AI agents, they need signal that can't be generated. Brazework's verified milestones are structured: who vouched, when, evidence. Expose them to recruiters' tools through an API and MCP (members' own MCP access already exists).
3. **Your Brazework in any AI.** Members connect Claude, Cursor or any MCP client today (read-only, revocable).

Rule for the brand: **AI does the busywork, never the talking.** Ember drafts; people approve. Brazework never posts on anyone's behalf without a tap.

## 5. Go-to-market: start at home

### Design partner: the NSBE chapter at UHart

The chapter (in CETA) is described as being in "a resurgence" ([UHart](https://www.hartford.edu/unotes/2023/02/uharts-national-society-of-black-engineers-nsbe-provides-opportunities-for-black-engineering-students.aspx)), and NSBE nationally has 24,000+ members across 600+ chapters ([nsbe.org](https://nsbe.org/)). Win this one chapter completely, then use it as the reference.

Don't say "NSBE partner" publicly until NSBE agrees; say "built with student chapters at UHart."

**First 6 weeks:**

| Week | Goal | Measure |
|---|---|---|
| 1 | Set up the chapter with the officers in person: roles, members imported, next 3 events on Brazework | Every officer active; 20+ members joined |
| 2 | Run the general body meeting through Brazework (event, RSVPs, attendee chat); Ember drafts the recap | 60%+ of members RSVP on Brazework |
| 3 | First verified milestones: each member posts one project; officers verify | 15+ verified milestones |
| 4 | First sponsor conversation with a Connecticut employer, using the chapter's Brazework record | One sponsor meeting booked |
| 5 | Bring the next 2 CETA organizations (e.g. ASME, IEEE, SWE, SHPE chapters) with the NSBE officers' intro | 2 more organizations live |
| 6 | Review: weekly-active rate, what Ember saved officers, what members want | 40%+ weekly-active for 4 straight weeks |

**Connecticut employers to approach first** (big engineering employers that recruit at NSBE events): Pratt & Whitney (East Hartford), Collins Aerospace, General Dynamics Electric Boat, Sikorsky. Ask for a **paid pilot sponsorship of one chapter**, not a platform sale.

### Then

1. **Campus:** every CETA organization, then all of UHart's STEM organizations. Pitch the university on outcomes once 5+ organizations are live.
2. **Region:** NSBE Region 1 (Northeast) chapters through officer-to-officer intros and the regional conference. Other identity-based STEM societies (SHPE, SWE, oSTEM) follow the same playbook.
3. **National organizations:** after 20+ chapters, offer a network license with chapter-health reporting.

## 6. Marketing

**Positioning line:** *Verified work, not résumés.* Everything else supports it.

**One message per audience:**
- **Student organizations:** "Run your chapter in one place. Ember does the busywork."
- **Members:** "Your work, on the record, vouched for by people who saw it."
- **Professionals:** "Mentor the chapters in your field and get found for what you've built."
- **Companies:** "Hire from proof, not keywords. Sponsor where the building happens."
- **Universities:** "See what your students build, and prove it to employers and accreditors."

**Channels that fit a two-founder budget:**
1. **Officer-to-officer.** Chapter presidents trust each other. Give every founding organization a referral path and a "founding organization" badge.
2. **Proof drops.** Short videos of real member builds, posted by the members, with "verified by [chapter]." This is the content engine: real work, not ads.
3. **Campus moments.** Run a "Proof Week" each semester: every member posts one project, officers verify, the best get shown to sponsors at a demo night.
4. **Sponsor reports as marketing.** A one-page "what our chapter did this semester" that Ember generates. Companies forward it; universities ask for it.
5. **Founders build in public.** Weekly numbers and lessons on LinkedIn and X; it's also YC evidence.
6. **Regional conferences.** A table and a live "verify your project" station.

**Brand rules:** plain language, real work over hype, no fake numbers, AI as the helper not the face. Every claim on the site has to be true today (the landing page labels example data as such).

## 7. What YC will want to see

- **Engagement:** share of a pilot organization's members active each week (target 40%+ for 8 weeks; 25% is good for consumer social, 45% great).
- **Growth:** organizations live, week over week (5–7%/week is good, 10% exceptional).
- **Proof of the loop:** verified milestones per week; messages from companies to members; organizations referred by other organizations.
- **Money:** one paid sponsor pilot or signed LOI before applying.
- **Founders:** a go-full-time trigger, e.g. 3 organizations above 40% weekly-active for 8 weeks plus one paid pilot.

### Draft application answers

- **What are you making?** A network where STEM student organizations run their chapters, members prove what they've built through verification by their organization, and employers and universities find them. An AI agent runs the organization's busywork.
- **Why now?** AI made résumés free to fake, so hiring needs proof. And AI agents are finally good enough to run the operations that student organizations drop.
- **How will you make money?** Free for members and organizations. Companies pay for sponsorships and search; universities and national organizations pay for campus- and network-wide tools.
- **Competition?** LinkedIn (noise, AI-written posts), Handshake (career-center led; most revenue now from AI training), Presence/Engage (student-org admin without careers or AI), Discord/GroupMe (where organizations live today, but chat disappears). Brazework is the only one where the organization's work becomes verified career proof.

## 8. Product priorities to support this

1. **Ember for officers:** meeting planning, recaps, RSVP follow-ups, member engagement check, sponsor report.
2. **Sponsor report:** a semester summary per organization, shareable.
3. **Company side:** search by verified work, sponsor pages, sponsorship checkout.
4. **University dashboard:** organizations, engagement, outcomes.
5. **Production:** finish the database steps (34–36 left, FIX-25), add `ANTHROPIC_API_KEY` (FIX-15), real email (FIX-1), then open the site publicly.
6. **iPhone app:** TestFlight and push notifications once the web loop is proven at UHart.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Officers are busy and turnover each year | Ember does the work; set up in person; the organization's history stays on Brazework across officer changes |
| Members don't come back weekly | Events, chat and announcements live on Brazework, so it's where the chapter actually happens |
| Implying an NSBE partnership too early | Say "built with student chapters at UHart" until NSBE agrees; then pursue a formal pilot |
| Universities already pay for Presence or Engage | Don't compete on admin; win on career outcomes and AI, and start with organizations, not IT procurement |
| Verification gamed | Only officers verify; Brazework records who verified; reports and blocking; later, evidence requirements per milestone |
