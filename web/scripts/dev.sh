#!/usr/bin/env bash
# `npm run dev`: Brazework on your laptop against a private database, never production.
#
# Starts the local Supabase (e2e/local-supabase.sh: Postgres, sign-in and the API in Docker, every
# step in supabase/order.txt, the test members) unless it's already running, then the Next dev
# server pointed at it. The three Supabase values set here win over anything in .env.local, so a
# production .env.local can't leak in (and next.config.ts refuses `next dev` on production anyway).
#
#   npm run dev               reuse the local database if it's running (keeps what you made)
#   npm run dev -- --fresh    start it over: every step again, only the test members
#   PORT=3100 npm run dev     another port
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
LOCAL=http://localhost:54321

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start OrbStack or Docker Desktop, then run npm run dev again." >&2
  exit 1
fi

key() { cat "e2e/.$1-key" 2>/dev/null || true; }
if [ "${1:-}" = "--fresh" ] || ! curl -sf -o /dev/null "$LOCAL/rest/v1/" -H "apikey: $(key anon)"; then
  echo "Starting the local database (about a minute the first time)…"
  e2e/local-supabase.sh up
else
  echo "Using the local database that's already running (npm run dev -- --fresh to start it over)."
fi

cat <<EOF

  Brazework:  http://localhost:$PORT
  Sign in as: maya@forge.test, ben@forge.test, cara@forge.test or josh@forge.test
  Password:   forge-test-pass-1   (local test members only; nothing here is real)

EOF

export NEXT_PUBLIC_SUPABASE_URL="$LOCAL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(key anon)"
export SUPABASE_SERVICE_ROLE_KEY="$(key service)"
export NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"
# Ember (the copilot) calls a paid API: off locally unless you set the key on purpose.
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
exec npx next dev -p "$PORT"
