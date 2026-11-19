# How the app looks and moves

The signed-in app's design direction (the flow redesign, November 2026,
`docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md`). Every section uses the same pieces
from `web/src/components/app/*` and the tokens in `web/src/app/globals.css`, so it reads as one
product.

## The idea

Brazework is a record of work, signed by the people who saw it. Its visual language comes from the
engineering drawing: a calm sheet with a faint grid, the work drawn in ink, and in the corner the
**title block**, the box where a drawing says who drew it and who checked it. Here it says who built
it, who signed it and what's still waiting.

- **Work first.** The thing someone made is the biggest thing on its page. Chrome stays quiet.
- **Ember on every page.** The Ask Ember bar sits at the top of the main column. Its answers and
  approve cards open in the page, never on another screen.
- **One obvious next action per page.** A page shows at most one `NextStrip` and one primary
  button. Everything else is a plain link or a quiet button.
- **Calm surfaces.** White or near-black sheets, hairline borders, no gradient washes, no glow. Ink
  (`--text`) for emphasis; the verified green (`--ok`) only for signed work. No other accent colors
  (no orange flames, no purple).
- **Motion only for state changes.** Something opens, is confirmed, moves. No entrance animations on
  page load, no hover bounces. Everything respects `prefers-reduced-motion`.
- **Phone first.** Every piece works at 375px wide: rows wrap, buttons stay at least 32px tall, no
  sideways scroll.

## Type and color

- Geist for everything, Geist Mono only for code and ids. Sentence case everywhere; no all-caps
  labels and no tracked-out eyebrows above headings.
- Page titles: `PageHeader` (28–32px, semibold, tight tracking). Section titles: 18px semibold.
  Body 15px. Small print 12–13px in `text-muted`; never smaller than 12px.
- Color tokens: `--bg`, `--surface`, `--surface-2`, `--border` (`border-line`), `--border-strong`
  (`border-line-strong`), `--text`, `--text-2`, `--muted`, `--faint`, `--ok`. Each has a dark value.

## The pieces (`web/src/components/app`)

| Piece | File | Use it for |
|---|---|---|
| `PageHeader` | `page-ui.tsx` | The top of every page: title, a one-line subtitle, optional `back` link and `meta` line, actions on the right. |
| `NextStrip` | `next-strip.tsx` | The one next step on a page: an icon, one sentence, one button. `toward` prefixes it with the member's goal. Each page decides its own step (the project page's logic is `lib/next-step.ts`). |
| `TitleBlock` | `title-block.tsx` | Where something stands, as a drawing's title block: a few labelled cells (Club, Signed, Waiting, Started). Replaces rows of "big number, small label" tiles. |
| `Timeline`, `TimelineRow` | `timeline.tsx` | Anything that happened in order: milestones, a build log, a club's term. Each row's `state` sets its marker: signed (green seal), waiting (dashed), logged, draft, declined. |
| `VerifiedStamp`, `VouchStamp`, `ProStamp`, `WaitingStamp` | `verified-seal.tsx` | Who signed it, and their role; or who it's waiting for (dashed, never green). |
| `ApproveCard` | `approve-card.tsx` | Something Ember or a member's tool drafted, waiting for their OK, in the page: a short summary, then **Confirm-style button that says what happens** ("Log and send to club"), **Edit**, **Not now**. Shows done at once (optimistic) and rolls back with the reason. |
| `EmptyState` | `page-ui.tsx` | An empty list. Says what goes here and offers the first action; never just "Nothing here". |
| `List`, `ListRow` | `list.tsx` | Dense lists (people, clubs, events, requests): one row each, leading picture, title, one meta line, one trailing action. |
| `Panel`, `Tabs`, `Skeleton` | `page-ui.tsx` | A bordered section; link tabs that live in the URL; placeholders the same size as what they stand for. |
| `.sheet-grid` | `globals.css` | The drawing-sheet grid behind a cover or an empty state. Once per page at most. |

## Writing

Plain verbs, sentence case, no filler. A button says what happens ("Log and send to club", not
"Submit"), and the done state uses the same words ("Sent to Rocketry Club"). Errors say what went wrong
and what to do. Empty states invite the first action.

## Rules that don't bend

- The AI never verifies or signs, never posts without the member's yes, and never changes or deletes
  what they made.
- Visible focus on everything you can tab to. Contrast at WCAG AA in light and dark.
- `npm run quality` (Lighthouse and ZAP) stays within budget.
