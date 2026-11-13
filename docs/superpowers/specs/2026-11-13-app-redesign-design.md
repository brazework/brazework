# App redesign: five places that answer five questions

Date: 2026-11-13 · Status: **approved by Josh 2026-11-13; stage 1 built in the working tree, not committed** · Linear issue: not created yet (the Linear connection needs a sign-in)

## Why

Josh asked for a cleaner app that people enjoy, where every feature has an obvious home, less is done by hand, a new member sees a result fast, and the product reads as a business that converts and sells.

The app already works end to end (see [plan.md](../../plan.md)). What gets in the way is its shape:

- **The menu lists features, not jobs.** The sidebar has five places (Home, Clubs, Projects, Messages, Profile), then a New post button, the Ember orb, Your clubs, and a More drawer with eight more pages (Notifications, Events, Challenges, Pro reviews, Saved, Connections, Analytics, Settings). A member sees 13+ destinations.
- **Home is a social feed.** It opens with five tabs (My chapter, For you, Latest, Following, Clubs), six kind filters, a sort, topics, a Spotlight strip, a People strip, a week strip, a checklist and a side rail. The product is about proof, but the first screen looks like a place to scroll.
- **The first result takes five manual steps:** join a club, add a project, post an update, ask to verify, wait for an officer.
- **A member can't show their proof to anyone outside.** `/u/…` and `/projects/…` need a login (`APP_PATHS` in `web/src/proxy.ts`). Clubs already have a public sponsor report (`/r/<token>`); members have nothing to share.

## The design: one question per place

| Place | The question it answers | What lives inside it |
|---|---|---|
| **Today** | What needs me right now? | Next step, things waiting on you, your builds, then the feed. Notifications and Saved. |
| **Build** | What am I making? | Your projects and their build logs, logging work, asking for verification. Explore other projects. |
| **Club** | What's my team doing? | Your clubs, events, challenges. For officers: the verify queue and the sponsor report. |
| **Proof** | What have I proven, and who looked? | Your profile, verified work, who viewed it, connections, pro reviews, the share link. |
| **Inbox** | Who's reaching out? | Messages, group chats, requests from companies. |

Around the five places:

- **Ember bar.** One bar at the top of every desktop screen to search, jump anywhere, or ask Ember. It replaces the plain search bar and the Ember orb in the sidebar.
- **One primary button in the sidebar: Log work.** It replaces New post. Logging work is the action that starts the loop.
- **Your clubs** stay as shortcuts under the five places.
- **Settings, appearance, what's new and log out** move into a menu on the avatar at the bottom.
- **The More drawer goes away.** Every page it listed gets a home inside one of the five places.

```
┌──────────────────┐  ┌───────────────────────────────────────────────┐
│ Brazework        │  │ Ask Ember, search, or jump anywhere      ⌘K   │
│                  │  ├───────────────────────────────────────────────┤
│ [ Log work ]     │  │ Today · Notifications · Saved                 │
│                  │  │                                               │
│ ● Today      3   │  │ NEXT STEP                                     │
│   Build          │  │ Ask NSBE UHart to verify "PCB v2 brought up"  │
│   Club           │  │ [ Get it verified ]                           │
│   Proof          │  │                                               │
│   Inbox      2   │  │ WAITING ON YOU                                │
│                  │  │ 2 milestones to verify · 1 message request    │
│ YOUR CLUBS       │  │                                               │
│   NSBE UHart     │  │ YOUR BUILDS                                   │
│   Agentic Eng.   │  │ Courtside · Referral Platform                 │
│                  │  │                                               │
│ (JM) Josh ▾      │  │ FROM YOUR CLUBS  |  Everyone        Filter ▾  │
└──────────────────┘  │ …posts…                                       │
                      └───────────────────────────────────────────────┘
```

Companies and schools get their own short menu later (Find builders, Sponsorships, Challenges). It is not part of this work.

## Goals

- A member can say what each of the five places is for after one look.
- No page is more than two clicks from the sidebar, with no drawer to open.
- Today tells a member the one most useful thing to do next, above anything to scroll.
- A new member reaches a first verified result in minutes, with Ember and GitHub doing the typing (stages 2 and 6).
- A member can share proof with someone who has no account (stage 4).

## Non-goals

- No new brand. Keep the black-and-white look, Geist, and Ember's orange (`web/src/app/globals.css`).
- No feature is deleted in stage 1. Pages move; they don't disappear.
- No iPhone app changes.
- No landing page changes.

## What would make this a failure

- A page that exists today can't be reached after the change.
- The live site changes before a pull request passes the pipeline.
- A database change rides along with a visual change. (Stage 1 has none.)
- It looks cleaner but a new member still doesn't know what to do first.

## Constraints

- `web/.env.local` points at production. Preview only on the local stack (`web/e2e/local-supabase.sh up`), which needs Docker (OrbStack is not running on this machine right now).
- `main` is protected. Changes merge through a pull request once checks, e2e and security pass. Nothing is committed or pushed without Josh saying so.
- Database steps reach production by themselves after a merge, so any stage with a database step gets its own pull request and rule tests.
- Never commit `public/js/supabase-config.local.bak` or `scripts/check.mjs`.
- Josh chose to work on the checked-out branch, `polish-app-2`. Its pull request (#55) was already squash-merged and the remote branch is gone, so before shipping, this work needs to sit on top of the latest `main`. That is a step for ship time, with Josh's OK.

## Approaches considered

1. **Change the app in place, keep every URL, one stage at a time. (Picked by Josh.)** Labels, grouping and screens change; routes like `/feed` and `/communities` stay. Each stage is a small pull request that the pipeline tests and Vercel previews. Trade-off: the address bar still says `/feed` under a place called Today.
2. **New URLs (`/today`, `/build`, …) with redirects from the old ones.** Cleaner addresses, but it touches `proxy.ts`, every internal link, the tours and all the browser tests at once, for no gain a member would notice. Can be done later as its own stage.
3. **A second shell behind a switch, next to the old one.** Lets both be compared live, but doubles the upkeep of the layout. Vercel's preview link on the pull request already gives a side-by-side with production.

Before these, a clickable mockup was offered and Josh chose to go straight to the real app.

## Stages

Each stage gets its own short design and plan when it starts. Only stage 1 is specified here.

| Stage | What changes | Database step? |
|---|---|---|
| **1. Shell and Today** | New sidebar, Ember bar, place tabs, Today screen | No |
| 2. Build | Build log that fills itself from GitHub and AI tools; one Get it verified button; the composer folds in | Maybe |
| 3. Club | One room per club; one-tap and batch verify for officers; sponsor report promoted | Maybe |
| 4. Proof | A public proof page a member chooses to share, with a share card | Yes |
| 5. Inbox | Messages, notifications and company requests in one list | Maybe |
| 6. First run | Invite link to first verified result in about two minutes | Maybe |
| 7. Company menu | Find builders, Sponsorships, Challenges | No |

## Stage 1 in detail

### Sidebar (`web/src/app/(app)/sidebar.tsx`)

- `NAV` becomes Today (`/feed`), Build (`/projects`), Club (`/communities`), Proof (`/profile`), Inbox (`/messages`). Each place keeps the paths it lights up for today, plus `/challenges` and `/chapters` for Club and `/pro` for Proof.
- Which place a path belongs to moves into one shared list in `web/src/lib/`, matched with `onPage` (`web/src/lib/nav-match.ts`), not a raw `startsWith`. Otherwise `/pro` would light up Proof on `/projects`.
- Badges: Today shows unread notifications, Inbox shows unread messages and chats, Proof shows pending connection invites. Same counts as today.
- The New post button becomes **Log work** and still opens the composer.
- The Ember orb leaves the sidebar (the Ember bar replaces it; ⌘K still works).
- `MoreGroup` and the `MORE` list are removed from the sidebar. The phone "Menu" sheet keeps a grid of the same pages so nothing is lost on small screens.
- The bottom block becomes an avatar menu: View profile, Settings, Appearance, What's new, Log out.
- Phone tab bar: the same five places with the new names.

### Place tabs (new, small)

A row of text tabs under the Ember bar, shown on the pages that belong to a place, so the old More pages are one click away:

| Place | Tabs |
|---|---|
| Today | Today · Notifications · Saved |
| Build | none in stage 1 (`/projects` is one page; it is split in stage 2) |
| Club | Clubs · Events · Challenges |
| Proof | Profile · Connections · Analytics · Pro reviews |
| Inbox | none in stage 1 |

- Each tab is a link to the existing page. The tabs and the sidebar read the same shared place list, so they can't disagree.
- The row shows only on the pages named in the table (`/feed`, `/notifications`, `/saved`, `/communities`, `/events`, `/challenges`, your own profile, `/network`, `/dashboard`, `/pro`). It does not show on detail pages such as `/c/<id>`, `/events/<id>` or someone else's `/u/<id>`.
- It shows on phones too, scrolling sideways if it doesn't fit.
- Some of these pages already have their own tab row (Clubs, Events, Challenges, Connections). In stage 1 the place row sits above it, smaller and quieter. If two rows look heavy in the preview, the page's own row becomes a menu.

### Ember bar (`web/src/components/search/global-search.tsx`, `web/src/components/palette/command-palette.tsx`)

A restyle in stage 1, not a merge of the two components.

- On desktop, the search bar above every page (`GlobalSearch`, hidden below the `md` width) becomes the Ember bar: same position, placeholder "Ask Ember, search, or jump anywhere", the Ember mark at its left, and an **Ask Ember ⌘K** button at its right.
- Typing in the bar searches with inline results, as today, and the `/` shortcut still focuses it.
- The button and ⌘K open the existing command palette (`CommandPalette`), unchanged. It stays the jump list and the way into Ember.
- On phones nothing changes: the top bar keeps its Search icon, which opens `/search`.
- No new server code.

### Today (`web/src/app/(app)/feed/`)

Top to bottom in the main column:

1. **Next step.** One card with one button.
   - Source: the first unfinished item of the loop checklist Home already uses (`guide.loop` in `web/src/lib/guide.ts`). Once the checklist is done, the member's goal from Your week (`goal` in `web/src/lib/week.ts`), not `week[0]`, which is often a news line with no button.
   - The card shows that item's existing label, reason and link. The club and milestone names in the sketch above are an illustration; stage 1 does not write new per-milestone text.
   - A member with no project sees the existing first-build card (`FirstBuild`) in this slot, as today.
   - The full checklist opens from the card.
2. **Log work.** The composer stays on the page, right under Next step, folded to one line ("What did you build today?") until it is clicked or Log work is pressed. `forge:compose` and every `/feed#composer` link keep working, and the composer keeps its `composer` tour anchor.
3. **Waiting on you.** Counts with links: milestones to verify (officers), join requests, message requests, connection invites. Hidden when all are zero.
4. **Your builds.** The existing builds row.
5. **The feed**, with two tabs showing instead of five.
   - **Your clubs**: today's My chapter feed for chapter members, and today's Clubs feed for everyone else.
   - **Everyone**: today's For you feed.
   - A **More** menu at the end of the tab row holds the other feeds, which stay separate feeds as they are in the database (`supabase/feed-pages.sql`): Latest, Following, and All my clubs for chapter members. When one is chosen, the menu button shows its name and neither tab is lit.
   - The default stays as today: chapter members open on Your clubs, everyone else on Everyone.
   - Kind, sort and topics fold into one **Filter** menu. It carries the `interests` tour anchor.

On phones, the Your week fold and the This week strip stay where they are.

The side rail keeps Your week, Coming up and Open challenges. The Your clubs rail card goes (the sidebar already lists them).

Moved off Today, not deleted: the Spotlight strip goes to the top of the explore grid on `/projects`, and the People strip goes to Connections (`/network`, which already has Suggested).

### Tours, tests and checks

- Tours (`web/src/lib/tours.ts`) keep working. `menu`, `search`, `feed-tabs`, `composer` and `sidebar-toggle` stay on the elements that replace them. `bell` is set only inside the More drawer today, so it moves to the Notifications place tab. `interests` moves to the Filter button. Tour text that names old menu items is updated.
- `web/tests/nav-match.test.ts` is extended for the shared place list, including the `/pro` versus `/projects` case.
- Browser journeys that assert the old labels are updated: `web/e2e/a-signup-post.cjs` ("For you") and `web/e2e/i-chapters.cjs` ("Home opens on My chapter"), plus any other that clicks a renamed item.
- Before any pull request: `npx tsc --noEmit && npm run lint && npm test`, `npm run e2e`, and `npm run quality` because the layout changes. A look at each of the five places on the local stack, on desktop and phone widths, light and dark.

## How we'll know it worked

- Stage 1: every page reachable in two clicks; the pipeline is green; Josh and Ian can each name the five places' jobs without help.
- Across stages, on `/admin`: the share of new members who reach a verified result, and the median time from joining to that result.

## Calls made by Claude (correct any of these)

- The five names: Today, Build, Club, Proof, Inbox.
- URLs stay as they are in stage 1.
- "Log work" as the one sidebar button.
- Feed tabs cut to two showing, with the other feeds under More and the filters under Filter. No database step.
- The composer stays on Today, folded to one line under Next step.
- The Ember bar is a restyle of the search bar; ⌘K still opens the existing palette.
- Build has no place tabs until stage 2.
- Place tabs sit above a page's own tabs in stage 1.
- Next step reuses the existing checklist text.
- Spotlight and People strips move off Today.
- The trending-news block on Home stays where it is in stage 1; whether it earns its place is a later question for the founders.
