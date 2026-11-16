# The Build page, the sidebar, and one flow through the app

Date: 2026-11-16 · Status: **approved by Josh in conversation ("Build it")** · Linear FIX-118

## Why

Josh, looking at his own Build page: "don't like the project section, redesign with purpose and make it where people would love to use this all the time. It shows some weird 3D." He also asked how a member shows a 3D print, for the sidebar to make sense, and for the app to be tied together with purpose.

What was wrong:

- Each build's card was half picture, and the picture was a stock line drawing chosen from the project's tags (software projects got three stacked plates). It wasn't the member's work.
- Logging progress took a button, then a form. Nothing said a 3D model could be attached at all.
- The sidebar said "Build" and the page said "Projects". An officer had no sign that results were waiting on them. Your clubs were listed; your builds weren't.
- After logging an update, nothing pointed to the next step.

## What changes

**Build page**
- The page is titled "Build", like its place.
- A card shows only what's the member's own: the title and status, a small photo when the build has one, twelve weeks of their updates as a bar per week, and where the build stands (Logged, Asked, Signed).
- A one-line log box is always open on every card: type, press Log. Beside it: attach files, **add a 3D model** (its own button; STL, 3MF, OBJ, GLB), add a link.
- The stock drawing is gone from the page. A build with an uploaded model has "View in 3D", which opens it on the card.
- Above the cards: what you logged this week, how many results are signed, how many are waiting.

**Sidebar**
- "Your builds": the four you touched last, one click away, above "Your clubs".
- "Ask Ember" under "Log work".
- Club shows how many results are waiting on your signature, if you're an officer. The phone's tab bar shows the same.

**Flow**
- Right after logging from a card: "Logged. Ask someone who saw it to sign it", linking to the build's milestones.
- A build with a signed result links to "On your Proof".

## Approaches considered

- **Cards that are the member's own data, with logging on the card (picked).** The page's job is to be opened daily: see where each build stands, log, move on.
- **Keep a picture, but a better one** (generated art, a real 3D thumbnail for everyone). Still decoration for most builds, and a 3D thumbnail means downloading every model (FIX-75).
- **A table of builds.** Densest, but loses the log box and reads like a spreadsheet on a phone.

## Not in this change

- Renaming "verified" to "signed" across the app (the database, emails and many screens say verified).
- GitHub activity on the card, a streak across builds, drag-to-reorder.
- The project page's own cover drawing (a flat schematic when a project has no photo).

## What would make this a failure

- Logging from a card is slower than before, or loses an attachment.
- A model downloads without being asked for.
- The signing count costs every member a query (only officers pay for it).

## Calls made by Claude

- Twelve weeks of updates as the card's one visual.
- Three steps (Logged, Asked, Signed) in place of two (Built, Signed).
- Four builds in the sidebar.
- Deleting the stock 3D line drawings (`components/landing/model-3d.tsx`, `models.ts`), now unused.
