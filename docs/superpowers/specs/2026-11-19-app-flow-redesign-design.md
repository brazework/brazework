# App flow redesign, stage 1: work first, Ember on every page

Approved 2026-11-19 ("Yes, build it"). Ships before the Product Hunt launch (merged into `main` by
Saturday 2026-11-21, 6 pm Eastern).

## Why

In the founder's words: "redesign for a more fluid approach ... better design and better user flow so
the users can enjoy using this application and fast and the side bar should be better i dont like when
i says build. I want it to flow with the agent ecosystem".

Three things get in the way today:

- The places are named for verbs and abstractions (Today, Build, Club, Proof). "Build" reads as a
  command, and "Proof" doesn't say what's in it.
- Ember lives on its own page (`/copilot`) and behind ⌘K. Telling it what you did means leaving the
  page you're on, and its approve cards appear somewhere else.
- The project page shows everything at once and doesn't say what to do next. Adding a milestone sends
  the owner to their profile.

## The design

### 1. Sidebar and names

The places become **Home · Projects · Clubs · Record · Inbox**:

| Before | After  | Route (unchanged) |
|--------|--------|-------------------|
| Today  | Home   | `/feed`           |
| Build  | Projects | `/projects`     |
| Club   | Clubs  | `/communities`    |
| Proof  | Record | `/profile`        |
| Inbox  | Inbox  | `/messages`       |

- The single source is `web/src/lib/places.ts` (tested by `tests/places.test.ts`). Place ids change
  with the labels (`home`, `projects`, `clubs`, `record`, `inbox`) so the code reads the same as the
  screen.
- Every user-visible "Build" or "Proof" that names one of these places is renamed:
  `projects/page.tsx` (title and header), `lib/goals.ts`, `lib/week.ts`, `lib/landing-demo.ts`,
  `components/landing/app-tour.tsx`, the phone tab bar, and the tour anchors. "Build" the verb in other
  copy ("what people are building") stays.
- Routes stay the same, so no link, bookmark or email breaks.
- Under the places, the sidebar keeps your recent projects and clubs as one-click shortcuts (the
  layout already loads them), now headed "Projects" and "Clubs" to match.
- The sidebar's two buttons on top ("Log work", "Ask Ember") give way to the Ask Ember bar (below):
  one place to tell Brazework what you did, on every page.

### 2. An "Ask Ember" bar on every signed-in page

- It sits at the top of the main column and replaces the current search row in
  `web/src/app/(app)/layout.tsx`.
- Placeholder: "Ask Ember, or tell it what you did…". `/` focuses it (when you're not typing in a
  field); ⌘K still opens the palette.
- It knows the page it's on: a project, club or event id from the path
  (`/projects/<id>`, `/c/<id>`, `/events/<id>`). That context goes to `/api/copilot` with the question,
  so "I got the PID loop stable" on a project page drafts into that project.
- When someone types what they did, Ember drafts it into the right project with evidence from connected
  tools, using its existing `propose_*` approve-first cards and the shared drafts and actions layer
  from #111. The approve card appears **in the page**, under the bar, not on a separate screen. A
  milestone card's buttons read **Log and send to club**, **Edit** and **Not now**.
- Search still works from the same bar: as you type, people and clubs matching the text show under
  it (the same results the search row gave), and Enter on a match opens it. Enter with no match
  selected asks Ember. Nothing the search row did is lost.
- Phones: the bar sits under the top bar on every page; the search icon in the top bar stays.

### 3. A project page with a Next strip and a timeline

- The top shows the project: title, club, a status line such as "3 signed · 1 waiting", and the cover
  or the 3D viewer as now.
- Under it, a **Next** strip shows the one most useful step for a builder, in this order:
  1. a milestone is waiting: ask the named person (or club) to sign it
  2. there are no milestones: log the first one
  3. Ember or a tool left a draft for this project: send it
  4. something is signed: share the signed card
- Below that, a timeline of milestones: signed ones carry the green seal (signer, role, evidence),
  waiting ones are dashed and say who they're waiting for, and Ember's drafts for this project appear
  inline as approve cards.
- Adding a milestone or evidence happens inline on the page (the owner no longer goes to their
  profile).
- Compatible with #115 (titles fit a phone) and #112 (a public line for private signed work): the
  hero and the milestone rows keep their markup; the strip and the drafts are new pieces.

### 4. Speed

- Optimistic updates for approve, RSVP and send: the card shows its done state at once and rolls back
  with a message if the server says no.
- Links prefetch (Next's `<Link>` defaults, kept on the sidebar and shortcuts).
- Skeletons match the final layout (the Ask bar and the Next strip have same-size placeholders).
- No spinner-only screens.

## Rules

- Existing design tokens in `web/src/app/globals.css` (Geist, ink, the verified green) and existing
  components where they fit (`ProposalCard`, `EmberAnswer`, `useCopilot`, `MilestoneTimeline`,
  `AddMilestone`, `VerifiedSeal`).
- Phone and desktop, light and dark, reduced motion respected, visible focus. `npm run quality`
  (Lighthouse and ZAP) stays within budget.
- The AI never verifies or signs, never posts without the member's yes, and never changes or deletes
  what they made.

## Not in this stage (the week after launch)

- Home as a single stream.
- The Record page redesign.
- App-wide motion polish.
- The iOS app's place names (#88 still says Today, Build, Club, Proof).

## Delivery

Three small pull requests, each with unit tests and e2e journeys updated for the new labels and flows,
green in CI with auto-merge on, with before and after screenshots in the body:

1. Sidebar and renames.
2. The Ask Ember bar.
3. The project page (Next strip, timeline, inline drafts and milestone).

If time runs short, 1 and 2 ship first. Production is confirmed by `https://brazework.com/api/health`
reporting the merge commit.
