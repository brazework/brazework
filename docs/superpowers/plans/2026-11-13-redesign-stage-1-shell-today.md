# Redesign stage 1 (shell and Today) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The signed-in app shows five places (Today, Build, Club, Proof, Inbox) with no More drawer, an Ember bar, place tabs, and a Today screen that leads with one next step.

**Architecture:** One shared list (`web/src/lib/places.ts`) says which place every path belongs to and which tabs each place shows; the sidebar, the phone tab bar and the new `PlaceTabs` row all read it. Today is the existing `/feed` page re-ordered, with the feed's five tabs reduced to two plus a More menu that links to the same feeds. No route, server action or database object changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, `motion`, `lucide-react`, node:test unit tests, Playwright-core journeys in `web/e2e`.

**Spec:** [docs/superpowers/specs/2026-11-13-app-redesign-design.md](../specs/2026-11-13-app-redesign-design.md)

## Global Constraints

- No URL changes, no deleted pages, no database step.
- Keep the look: tokens in `web/src/app/globals.css`, Geist, Ember's orange. No new colors or fonts.
- `web/.env.local` is production: run the app only against the local stack (`web/e2e/local-supabase.sh up`).
- Nothing is committed or pushed. Work stays in the working tree on `polish-app-2` until Josh says otherwise. No commit steps in this plan.
- Never stage `public/js/supabase-config.local.bak` or `scripts/check.mjs`.
- Place names, exactly: `Today`, `Build`, `Club`, `Proof`, `Inbox`. Sidebar button, exactly: `Log work`.

## Review Focus

1. **`/pro` versus `/projects`:** on `/projects/p1` only Build is lit, never Proof. Test in Task 1.
2. **Old feed links:** `/feed?tab=latest`, `?tab=following`, `?tab=communities` still load their feed; the More button shows that feed's name and neither tab is lit. Test in Task 4 (`feedTabs`).
3. **A member with no chapter and no clubs:** Today opens on Everyone; Your clubs shows the existing "You haven't joined any clubs" empty state. Test in Task 4 (`feedTabs`).
4. **Collapsed sidebar (64px):** Log work shows as an icon; the avatar menu still opens and is not clipped. Checked in Task 6's visual pass.
5. **Phone width (393px):** the place tabs scroll sideways, the page never does; `/feed#composer` and `/feed?project=<id>` open the folded composer. Checked in Task 6's visual pass and the `a` and `c` journeys.

---

### Task 1: The shared place list

**Files:**
- Create: `web/src/lib/places.ts`
- Test: `web/tests/places.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlaceId = "today" | "build" | "club" | "proof" | "inbox";
  export type BadgeKey = "notifications" | "messages" | "invites";
  export type PlaceTab = { id: string; label: string; href: string; badge?: BadgeKey; tour?: string };
  export type Place = { id: PlaceId; label: string; href: string; match: string[]; badge?: BadgeKey; tabs: PlaceTab[] };
  export const PLACES: Place[];                       // in sidebar order
  export function placeFor(path: string): Place | null;          // which place lights up
  export function placeTabsFor(path: string): { place: Place; active: string } | null; // null on pages that show no tab row
  export const MENU_PAGES: { href: string; label: string; badge?: BadgeKey }[];        // the eight former More pages, for the phone Menu sheet
  ```
- Values:
  - today: href `/feed`, match `/feed`, `/post`, `/notifications`, `/saved`, badge `notifications`; tabs Today `/feed`, Notifications `/notifications` (badge `notifications`, tour `bell`), Saved `/saved`.
  - build: href `/projects`, match `/projects`; no tabs.
  - club: href `/communities`, match `/communities`, `/c`, `/events`, `/org`, `/challenges`, `/chapters`; tabs Clubs `/communities`, Events `/events`, Challenges `/challenges`.
  - proof: href `/profile`, match `/profile`, `/u`, `/dashboard`, `/analytics`, `/network`, `/settings`, `/pro`, badge `invites`; tabs Profile `/profile`, Connections `/network` (badge `invites`), Analytics `/dashboard`, Pro reviews `/pro`.
  - inbox: href `/messages`, match `/messages`, badge `messages`; no tabs.
  - `placeFor` matches with `onPage` from `@/lib/nav-match`.
  - `placeTabsFor` returns a row only when `path` equals a tab's `href` exactly (query and hash ignored), so detail pages get none. `/profile` and `/u/<id>` are handled by the profile page itself (Task 3).

- [ ] **Step 1: Write the failing tests** in `web/tests/places.test.ts` (node:test, same style as `tests/nav-match.test.ts`):
  - `placeFor("/projects/p1")?.id === "build"` and `placeFor("/pro")?.id === "proof"`.
  - `placeFor("/c/abc/manage")?.id === "club"`, `placeFor("/events/e1")?.id === "club"`, `placeFor("/challenges")?.id === "club"`.
  - `placeFor("/post/1")?.id === "today"`, `placeFor("/messages/g/1")?.id === "inbox"`, `placeFor("/copilot") === null`.
  - `placeTabsFor("/events")` gives place `club`, active `events`; `placeTabsFor("/events/e1") === null`; `placeTabsFor("/projects") === null`; `placeTabsFor("/network")` gives active `connections`.
  - Every `MENU_PAGES` href has a `placeFor` that is not null.
- [ ] **Step 2: Run** `cd web && npm test` — expect the new file to fail (module not found).
- [ ] **Step 3: Implement `places.ts`.**
- [ ] **Step 4: Run** `npm test` — expect all pass.

### Task 2: Sidebar and phone bars

**Files:**
- Modify: `web/src/app/(app)/sidebar.tsx`

**Interfaces:**
- Consumes: `PLACES`, `placeFor`, `MENU_PAGES`, `BadgeKey` from Task 1.
- Produces: `Sidebar`, `MobileBar`, `SidebarSkeleton`, `SIDEBAR_COOKIE`, `Badges` keep their current exports and props.

- [ ] **Step 1:** Replace the local `NAV` with rows built from `PLACES` (icons: Today `Sun`, Build `Hammer`, Club `Users`, Proof `BadgeCheck`, Inbox `Inbox`). A row is active when `placeFor(path)?.id` equals its id. Delete `MORE`, `MoreGroup`, `isActive` and the "only that row lights up" exception.
- [ ] **Step 2:** The top action row keeps one button, labelled `Log work` (aria-label `Log work`), with the same `/feed#composer` link and `forge:compose` behaviour. Remove the Ember orb button.
- [ ] **Step 3:** Replace the bottom block with an avatar menu: a button showing avatar, name and `MyStatus` that opens a small menu above it (`menuCls` from `@/components/ui`) with View profile (`/profile`), Settings (`/settings`), Appearance (`ThemeToggle`), What's new (`UpdatesButton`) and Log out (the existing `/auth/signout` form). Closes on Escape, outside click and route change. The header row keeps the collapse toggle and loses the `ThemeToggle`.
- [ ] **Step 4:** `MobileBar`: tabs come from `PLACES`; the Menu sheet grid lists `MENU_PAGES` with icons; the Create sheet's first item is labelled `Log work`.
- [ ] **Step 5: Run** `npx tsc --noEmit && npm run lint` — expect clean.

### Task 3: Place tabs and the Ember bar

**Files:**
- Create: `web/src/components/app/place-tabs.tsx`
- Modify: `web/src/app/(app)/layout.tsx`, `web/src/app/(app)/u/[id]/page.tsx`, `web/src/components/search/global-search.tsx`

**Interfaces:**
- Consumes: `placeTabsFor`, `PLACES` from Task 1; `Tabs` look from `@/components/app/page-ui`.
- Produces:
  ```tsx
  export function PlaceTabs({ badges }: { badges?: Partial<Record<BadgeKey, number>> }): JSX.Element | null; // client; reads usePathname()
  export function PlaceTabsRow({ place, active }: { place: PlaceId; active: string }): JSX.Element;          // server-safe; for pages that decide themselves
  ```

- [ ] **Step 1:** `PlaceTabsRow` renders `<nav aria-label="{Place label} pages">` with one text link per tab, smaller and quieter than the page's own tabs (12–13px, `text-muted`, current tab `text-text font-medium` with `aria-current="page"`), `overflow-x-auto no-scrollbar`. A tab with `tour` sets `data-tour`.
- [ ] **Step 2:** `PlaceTabs` calls `placeTabsFor(pathname)` and renders `PlaceTabsRow`, or nothing.
- [ ] **Step 3:** In `layout.tsx`, render `<PlaceTabs />` in `main`, after the search row and before `{children}`, in the same max-width wrapper as the search row but visible at every width.
- [ ] **Step 4:** In `u/[id]/page.tsx`, when the viewer is the profile's owner, render `<PlaceTabsRow place="proof" active="profile" />` at the top of the page.
- [ ] **Step 5:** Ember bar in `global-search.tsx`: placeholder `Ask Ember, search, or jump anywhere`; the idle `Search` icon becomes the Ember mark (`Ember` from `@/components/ember/ember`, about 18px); the `/` kbd is replaced by a button `Ask Ember` with a `⌘K` kbd that dispatches `forge:palette`. The sr-only label, `id`, `data-tour="search"`, inline results and the `/` shortcut are unchanged.
- [ ] **Step 6: Run** `npx tsc --noEmit && npm run lint` — expect clean.

### Task 4: Today

**Files:**
- Create: `web/src/lib/feed-tabs.ts`, `web/tests/feed-tabs.test.ts`, `web/src/app/(app)/feed/next-step.tsx`, `web/src/app/(app)/feed/waiting.tsx`, `web/src/app/(app)/feed/composer-fold.tsx`
- Modify: `web/src/app/(app)/feed/header.tsx`, `web/src/app/(app)/feed/page.tsx`, `web/src/app/(app)/feed/rail.tsx`, `web/src/app/(app)/feed/start-checklist.tsx`, `web/src/app/(app)/projects/page.tsx`, `web/src/app/(app)/network/page.tsx`

**Interfaces:**
- Produces (`feed-tabs.ts`, pure):
  ```ts
  export type FeedTabId = "chapter" | "for-you" | "latest" | "following" | "communities";
  export type FeedTabs = {
    shown: { id: FeedTabId; label: "Your clubs" | "Everyone" }[]; // always two
    more: { id: FeedTabId; label: string }[];                     // Latest, Following, and "All my clubs" for chapter members
    active: FeedTabId | "";                                       // "" when the current feed is in `more`
    moreLabel: string;                                            // "More", or the chosen feed's label
  };
  export function feedTabs(current: FeedTabId, hasChapter: boolean): FeedTabs;
  ```
  Your clubs is `chapter` when `hasChapter`, else `communities`. Everyone is `for-you`.
- `NextStep` (server component): `{ steps: GuideStep[] }`-driven `StartChecklist` while the loop has an unfinished step and it isn't dismissed; otherwise a card from `loadLoop(...).goal` (`WeekGoal`): its `text`, and a button with `action` linking to `href`; when `goal.done`, a quiet one-line "You've shown your work this week". Both carry the eyebrow `Next step`.
- `WaitingOnYou` (server component, no props): links with counts for milestones to verify (`loadLoop(...).toVerify`), connection invites (`/network`), and message requests (`/messages`). Renders nothing when all are zero. Join requests are included only if an existing loader already provides the count; otherwise they are left out and noted in the hand-back.
- `ComposerFold` (client): `{ children, startOpen?: boolean }`. Folded, it shows a one-line button "What did you build today?" in place of the composer; it opens (and stays open) on click, on `forge:compose`, when `location.hash === "#composer"`, or when `startOpen`. The composer stays mounted when folded is false only; `id="composer"` and `data-tour="composer"` stay on the outer wrapper.

- [ ] **Step 1: Write failing tests** in `web/tests/feed-tabs.test.ts`:
  - `feedTabs("chapter", true)`: shown ids `["chapter","for-you"]`, active `"chapter"`, more labels `["Latest","Following","All my clubs"]`, moreLabel `"More"`.
  - `feedTabs("for-you", false)`: shown ids `["communities","for-you"]`, active `"for-you"`, more labels `["Latest","Following"]`.
  - `feedTabs("latest", false)`: active `""`, moreLabel `"Latest"`.
  - `feedTabs("communities", true)`: active `""`, moreLabel `"All my clubs"`.
- [ ] **Step 2: Run** `npm test` — expect fail, then implement `feed-tabs.ts`, then pass.
- [ ] **Step 3:** `header.tsx`: keep `TABS`/`TabId` exports; `FeedHeader` takes `tabs: FeedTabs` instead of `chapter`, renders the two tabs with `Tabs`, then a `<details>` More menu (same pattern as the Topics menu in `page.tsx`) linking each `more` feed through `hrefFor`. The `sort` slot is removed.
- [ ] **Step 4:** `page.tsx`:
  - hero order: `FirstBuild` (when no projects) or `NextStep`; `ComposerFold` around `Composer` (`startOpen` when `sp.project` is set); `WaitingOnYou`; `BuildsRow`. The phone `WeekLoop` fold stays above the composer.
  - The kind row, sort and topics become one **Filter** `<details>` menu with `data-tour="interests"` on its wrapper: Sort (segmented), Kind (list), Topics (chips). Its button reads `Filter`, or the active kind/tag. The "Showing …" banner with Clear stays.
  - Remove the `spotlight` and `peopleStrip` slots from `FeedList`; keep `WeekStrip`.
  - `FeedEnd` and the empty states keep their links.
- [ ] **Step 5:** `rail.tsx`: remove the Your clubs `RailCard`. Nothing else moves.
- [ ] **Step 6:** `projects/page.tsx`: render `SpotlightStrip` at the top of the explore section. `network/page.tsx`: render `PeopleStrip` on the Suggested tab if that tab does not already show the same people.
- [ ] **Step 7: Run** `npx tsc --noEmit && npm run lint && npm test` — expect clean.

### Task 5: Tours and journeys

**Files:**
- Modify: `web/src/lib/tours.ts`, `web/src/components/palette/command-palette.tsx`, `web/e2e/a-signup-post.cjs`, `web/e2e/i-chapters.cjs`, and any other journey that fails on a renamed label.

- [ ] **Step 1:** `tours.ts` text only: the feed-tabs step describes Your clubs, Everyone and More; the menu step lists Today, Build, Club, Proof, Inbox; the search steps say "Ask Ember, search, or jump anywhere"; the interests step says Filter. No step ids or targets change.
- [ ] **Step 2:** `command-palette.tsx`: the `post` action is labelled `Log work`.
- [ ] **Step 3:** `i-chapters.cjs`: the current-tab check looks for `Your clubs` instead of `My chapter`; step names updated. `a-signup-post.cjs`: step name says Everyone. Any journey that types in the composer first opens it (click `What did you build today?`) through one helper in `web/e2e/lib.cjs`.

### Task 6: Checks and a look

- [ ] **Step 1:** `cd web && npx tsc --noEmit && npm run lint && npm test` — expect clean.
- [ ] **Step 2:** `e2e/local-supabase.sh up`, then `npm run e2e` — expect every journey to pass. Fix what the label changes broke; anything else is reported, not patched around.
- [ ] **Step 3:** Run the dev server against the local stack (the README's command, never plain `npm run dev`) and look at Today, Build, Club, Proof, Inbox, and one page with place tabs above its own tabs, at desktop width and 393px, light and dark, sidebar open and collapsed. Check the five Review Focus items.
- [ ] **Step 4:** `npm run quality` if time allows; otherwise say it was not run.
- [ ] **Step 5:** Report to Josh with what passed, what did not, and screenshots. No commit.

## Rulings made while building (2026-11-13)

- **No `ComposerFold`.** The composer already rests at one line and opens on focus, so only its idle placeholder changed ("What did you build today, <name>?"). Cost if wrong: the box looks a little taller at rest than the spec's sketch.
- **Waiting on you leaves out club join requests.** There is no per-member loader for them; it shows milestones to verify, message requests and connection invites. Cost if wrong: an officer learns about join requests from the club page, as before.
- **People strip not added to Connections.** `/network` already has a "People you may know" tab. Cost if wrong: none; the strip is gone from Today only.
- **The place-tab row lines up with the Ember bar,** not each page's own width (pages use different widths).
- **The Clubs / Events pill switch was removed** from `/communities` and `/events`: the Club place tabs now do that job, and two rows saying the same thing looked wrong in the preview.
- **Counts on place tabs** come from one shared loader (`web/src/lib/badges.ts`) that the sidebar also uses.
- **The avatar menu is a plain disclosure,** not an ARIA menu (review finding): `aria-expanded` on the button, the list after it in the page.
- **The Projects page keeps its "Projects" heading** under the Build place.
- **Plan's commit-free rule kept:** nothing committed; the per-task ledger scripts (which key off commits) were not used.

## Deferred minors from the review

- Old "what's new" tour entries still name "For you" (they describe past releases).
- The `projects-new` tour anchor has no element (already missing before this change).
- The avatar menu's name button is not keyboard-focusable on its own (the photo button is).
