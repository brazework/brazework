#!/bin/sh
# Point the app at the local test stack (start it with: cd web && e2e/local-supabase.sh up).
set -e
cd "$(dirname "$0")/.."
key="$(cat ../web/e2e/.anon-key)"
printf 'FORGE_SUPABASE_URL = http:/$()/localhost:54321\nFORGE_SUPABASE_ANON_KEY = %s\n' "$key" > Config/Local.xcconfig
echo "Config/Local.xcconfig -> local stack"
