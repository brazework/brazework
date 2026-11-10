# Brazework web (Next.js)

The redesign of Brazework on **Next.js 16 + Tailwind CSS 4 + Supabase**. It lives next to the original app in `public/` and uses **the same Supabase project, schema and row-level security**, so both apps can run at once while screens move over. See [`../docs/next-migration.md`](../docs/next-migration.md) for the plan.

## Run it

```sh
cd web
npm install
cp .env.example .env.local     # then fill in the two Supabase values
npm run dev                    # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm run build` / `npm start` | Production build and server |

CI (`.github/workflows/web.yml`) runs typecheck, lint, build and a smoke test on every PR that touches `web/`.

## Environment

Same names Vercel's Supabase integration already sets, so no new variables are needed on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project URL and public (anon) key. Safe in the browser; RLS protects the data.
- `NEXT_PUBLIC_SITE_URL`: where email links point back to (`/auth/callback`).

**Supabase → Authentication → URL Configuration** must allow `<site>/auth/callback` for every place this runs (localhost, previews, production), or confirmation links will fail.

## How it's built

```
src/
  proxy.ts                     Refreshes the Supabase session cookie; optimistic redirects (Next 16's "middleware")
  lib/supabase/server.ts       Server client + getViewer() (verifies the JWT with getClaims())
  lib/supabase/client.ts       Browser client (Realtime only)
  lib/forge.ts                 Topics, validation regexes, types: ported 1:1 from public/js/util.js
  lib/submit.ts                Submits forms without React 19's automatic reset (keeps typed values on errors)
  app/page.tsx                 Landing (fully static)
  app/(auth)/                  Log in, sign up, verify + their server actions
  app/auth/callback|signout    Email-link code exchange; sign out
  app/onboarding/              Step 3: field, headline, interests
  app/(app)/                   Signed-in shell; feed (composer, likes, realtime refresh)
  components/landing/          Hero (spark-network canvas), live demo, bento, disciplines, compare, partners
```

Conventions:

- **Cache Components is on.** Anything that reads cookies or `searchParams` sits inside `<Suspense>` with a skeleton, so the chrome prerenders and the per-user parts stream in.
- **Three layers of auth:** `proxy.ts` redirects, then server components call `getViewer()` again, and Postgres RLS is the real boundary.
- **Mutations are server actions** validated with Zod, using the same rules as the vanilla app.
- **Monochrome design, light and dark.** Colour tokens only (`globals.css` → `bg-surface`, `text-muted`, `bg-accent`…); every token is defined for both themes. The theme follows the system unless someone picks one (header toggle or Settings), saved in `localStorage` and applied before first paint.
- **Motion:** entrance and scroll reveals are pure CSS (`.rise-in`, `.reveal` with `animation-timeline: view()`), so content never waits on JavaScript. [Motion](https://motion.dev) is used only for interaction. Everything respects `prefers-reduced-motion`.

## Migration status

Every screen of the vanilla app is ported:

| Area | Routes |
|---|---|
| Landing, auth | `/`, `/signup`, `/verify`, `/login`, `/forgot`, `/reset`, `/onboarding` |
| Feed and posts | `/feed` (For you, Latest, Following, Communities, `?tag=`), `/post/[id]`, `/saved` |
| Profiles and projects | `/profile` → `/u/[id]`, `/analytics` |
| Network | `/network` (invitations, connections, sent, following, followers, suggestions), `/notifications` |
| Messages | `/messages`, `/messages/[id]`, `/messages/new?to=` |
| Communities | `/communities`, `/c/[id]`, `/c/[id]/manage` |
| Events | `/events`, `/events/[id]`, `/events/[id]/ics`, `/org` |
| Settings | `/settings` (profile, appearance, messaging, blocked, help, account), guided tour, What's new |

Verified with `tsc`, `eslint`, `next build` (31 routes), signed-out redirects for every app route, and Lighthouse 100/100/100/100 on the landing page. Signed-in screens still need a click-through with real accounts on a preview before the switch-over.
