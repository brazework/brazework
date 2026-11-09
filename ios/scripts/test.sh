#!/bin/sh
# Unit and UI tests on a simulator, against the local test stack.
# Needs Docker; starts the stack if it isn't running. Uses Xcode-beta (iOS 27 simulators).
set -e
cd "$(dirname "$0")/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"
curl -sf -o /dev/null http://localhost:54321/rest/v1/ -H "apikey: $(cat ../web/e2e/.anon-key 2>/dev/null)" || (cd ../web && e2e/local-supabase.sh up)
scripts/use-local.sh
docker exec -i forge-e2e-db psql -q -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 < scripts/seed-ui-tests.sql
scripts/test-kit.sh
xcodegen generate -q
SIM="${SIM:-iPhone 17 Pro Max}"
xcodebuild test -project Forge.xcodeproj -scheme Forge -destination "platform=iOS Simulator,name=$SIM" \
  -clonedSourcePackagesDirPath build/spm -derivedDataPath build/dd 2>&1 | grep -E "Test Case .*(passed|failed)|error:|TEST (SUCCEEDED|FAILED)|Executed" || true
