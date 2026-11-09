#!/usr/bin/env bash
# End-to-end tests against a private local Supabase: start it, build Forge pointed at it, run every
# phase as real test members, stop everything. Needs Docker and Google Chrome. Usage: npm run e2e
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'kill $(lsof -ti:3200 -sTCP:LISTEN) 2>/dev/null || true; e2e/local-supabase.sh down >/dev/null' EXIT
e2e/local-supabase.sh up
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$(cat e2e/.anon-key)" ANTHROPIC_API_KEY=
npx next build >/tmp/forge-e2e-build.log 2>&1 || { tail -20 /tmp/forge-e2e-build.log; exit 1; }
npx next start -p 3200 >/tmp/forge-e2e-server.log 2>&1 &
until curl -sf http://localhost:3200/login >/dev/null; do sleep 1; done
id() { docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -tAc "select id from auth.users where email='$1'"; }
export BEN_ID="$(id ben@forge.test)" JOSH_ID="$(id josh@forge.test)"
fail=0
for spec in e2e/a-signup-post.cjs e2e/b-clubs-events.cjs e2e/c-messages-projects.cjs e2e/d-search-settings.cjs e2e/e-chat.cjs e2e/f-dock.cjs; do
  echo "== $spec"; node "$spec" | tee /tmp/forge-e2e-out.txt; grep -q "^FAIL" /tmp/forge-e2e-out.txt && fail=1
done
echo; [ $fail = 0 ] && echo "All end-to-end checks passed." || { echo "Some checks failed: screenshots in e2e/.results/"; exit 1; }
