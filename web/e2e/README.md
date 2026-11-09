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
| `e-chat` | Reactions, replies and unsend in a direct message and a club chat, checked from both sides |
| `d-search-settings` | Search → settings save and stick → log out → signed-out visitors are sent to log in |

- `local-supabase.sh up|down`: Postgres + GoTrue + PostgREST in Docker, every `supabase/*.sql` file in CI order,
  four test members (`josh|maya|ben|cara@forge.test`, password `forge-test-pass-1`) and `seed.sql`.
- Failure screenshots land in `e2e/.results/`.
- Not covered locally: photo/video uploads and live updates (no Storage or Realtime service), and Ember
  answers (no Anthropic key).
