#!/usr/bin/env bash
# End-to-end tests against a private local Supabase: start it, build Brazework pointed at it, run every
# phase as real test members, stop everything. Needs Docker and Google Chrome. Usage: npm run e2e
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'kill $(lsof -ti:3200 -sTCP:LISTEN) 2>/dev/null || true; e2e/local-supabase.sh down >/dev/null' EXIT
# Every Supabase request the gateway answers, so k-feed-budget.cjs can count a feed session's (FIX-77).
export GW_LOG="${GW_LOG:-/tmp/forge-e2e-gateway-requests.log}"; : > "$GW_LOG"
. e2e/serve.sh
id() { docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -tAc "select id from auth.users where email='$1'"; }
export BEN_ID="$(id ben@forge.test)" JOSH_ID="$(id josh@forge.test)"
fail=0
# Database rules first (verification: who can verify, evidence, revoke, disputes, the log).
for t in ../supabase/tests/*.test.sql; do
  echo "== $t"; docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < "$t" 2>&1 | grep -E "FAILED|ERROR|passed" ; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
done
for spec in e2e/a-signup-post.cjs e2e/b-clubs-events.cjs e2e/c-messages-projects.cjs e2e/d-search-settings.cjs e2e/e-chat.cjs e2e/f-dock.cjs e2e/h-challenges.cjs e2e/i-chapters.cjs e2e/j-pro.cjs e2e/k-feed-budget.cjs e2e/l-tools.cjs e2e/m-layout.cjs e2e/n-github.cjs e2e/g-account.cjs; do
  echo "== $spec"; node "$spec" | tee /tmp/forge-e2e-out.txt; grep -q "^FAIL" /tmp/forge-e2e-out.txt && fail=1
done
echo; [ $fail = 0 ] && echo "All end-to-end checks passed." || { echo "Some checks failed: screenshots in e2e/.results/"; exit 1; }
