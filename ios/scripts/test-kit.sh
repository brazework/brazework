#!/bin/sh
# ForgeKit (the app's data layer) on the Mac: unit tests, plus the app's real reads and writes
# against the local test stack. No simulator needed. Starts the stack if it isn't running.
set -e
cd "$(dirname "$0")/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"
key="$(cat ../web/e2e/.anon-key 2>/dev/null || true)"
curl -sf -o /dev/null http://localhost:54321/rest/v1/ -H "apikey: $key" || (cd ../web && e2e/local-supabase.sh up >/dev/null && key="$(cat e2e/.anon-key)")
key="$(cat ../web/e2e/.anon-key)"
docker exec -i forge-e2e-db psql -q -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 < scripts/seed-ui-tests.sql
cd ForgeKit
FORGE_SUPABASE_URL=http://localhost:54321 FORGE_SUPABASE_ANON_KEY="$key" swift test "$@"
