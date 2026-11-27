#!/usr/bin/env bash
# End-to-end tests against a private local Supabase: start it, build Brazework pointed at it, run every
# phase as real test members, stop everything. Needs Docker and Google Chrome. Usage: npm run e2e
#
# CI sets E2E_SHARD (see e2e/shards.mjs). Each shard is one job on its own runner. This script brings
# up that runner's own local Supabase (e2e/local-supabase.sh): its own Docker database, its own Auth
# users (josh, maya, ben, cara @forge.test), and its own seed. Shards do not share accounts or rows.
# Unset E2E_SHARD runs the whole suite on one stack, which is what a laptop does.
set -euo pipefail
cd "$(dirname "$0")/.."
SHARD="${E2E_SHARD:-all}"
node e2e/shards.mjs check
if [ "$SHARD" != all ]; then
  node e2e/shards.mjs shard "$SHARD" >/dev/null
fi
trap 'kill $(lsof -ti:3200 -sTCP:LISTEN) 2>/dev/null || true; e2e/local-supabase.sh down >/dev/null' EXIT
# Every Supabase request the gateway answers, so k-feed-budget.cjs can count a feed session's (FIX-77).
export GW_LOG="${GW_LOG:-/tmp/forge-e2e-gateway-requests.log}"; : > "$GW_LOG"

run_sql() {
  local t
  for t in ../supabase/tests/*.test.sql; do
    echo "== $t"
    docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < "$t" 2>&1 | grep -E "FAILED|ERROR|passed"
    [ "${PIPESTATUS[0]}" = 0 ] || fail=1
  done
}

run_specs() {
  local spec
  for spec in "$@"; do
    echo "== $spec"
    node "$spec" | tee /tmp/forge-e2e-out.txt
    grep -q "^FAIL" /tmp/forge-e2e-out.txt && fail=1
  done
}

read_specs() {
  specs=()
  local out
  out=$(node e2e/shards.mjs "$@") || exit 1
  while IFS= read -r spec; do
    [ -n "$spec" ] && specs+=("$spec")
  done <<< "$out"
}

fail=0
echo "e2e shard: ${SHARD}"
if [ "$SHARD" = sql ]; then
  # Rule tests talk to Postgres only. Each file rolls back. Skip the Next.js build.
  e2e/local-supabase.sh up
  run_sql
elif [ "$SHARD" = all ]; then
  . e2e/serve.sh
  id() { docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -tAc "select id from auth.users where email='$1'"; }
  export BEN_ID="$(id ben@forge.test)" JOSH_ID="$(id josh@forge.test)"
  run_sql
  read_specs specs
  run_specs "${specs[@]}"
else
  . e2e/serve.sh
  id() { docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -tAc "select id from auth.users where email='$1'"; }
  export BEN_ID="$(id ben@forge.test)" JOSH_ID="$(id josh@forge.test)"
  read_specs shard "$SHARD"
  echo "shard ${SHARD}: ${#specs[@]} browser journeys"
  run_specs "${specs[@]}"
fi
echo
[ "$fail" = 0 ] && echo "All end-to-end checks passed." || { echo "Some checks failed: screenshots in e2e/.results/"; exit 1; }
