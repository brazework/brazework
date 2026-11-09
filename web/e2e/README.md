# End-to-end tests

Real members using the real app, against a private throwaway Supabase (never the live project).

```bash
npm run e2e        # from web/: start local Supabase, build, run every phase, stop everything
```

Needs Docker and Google Chrome. Takes a few minutes (most of it is `next build`).

| Phase | What it checks |
|---|---|
| `a-signup-post` | Sign up → confirm-email screen → onboarding → feed → post with an @mention → the mentioned member is notified → answering a question inline |
| `b-clubs-events` | Create a club → join → club chat both ways → officer announcement → host an event → RSVP → event chat |
| `c-messages-projects` | Message from a profile → reply → send a post → add a project → ask the club to verify → owner verifies → proof on the profile and in the feed |
| `d-search-settings` | Search → settings save and stick → log out → signed-out visitors are sent to log in |
| `e-chat` | Reactions, replies and unsend in a direct message and a club chat, checked from both sides |
| `f-dock` | The feed's message dock: unread count, requests stay read-only until accepted, replying in place, hidden on phones |

- `local-supabase.sh up|down`: Postgres + GoTrue + PostgREST in Docker, every `supabase/*.sql` file in CI order,
  four test members (`josh|maya|ben|cara@forge.test`, password `forge-test-pass-1`) and `seed.sql`.
- Failure screenshots land in `e2e/.results/`.
- `gateway.cjs` also stands in for Storage: uploads to the `media` bucket follow `media.sql`'s rules (a valid token, your own folder, the bucket's file types, up to 50 MB, no overwrites) and are served back from `e2e/.media/`.
- Not covered locally: live updates (no Realtime service), and Ember
  answers (no Anthropic key).
