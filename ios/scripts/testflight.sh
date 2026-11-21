#!/bin/zsh
# Build Brazework for production and upload it to TestFlight, in one command.
#
#   TEAM=ABCDE12345 scripts/testflight.sh             # archive, sign for the App Store, upload
#   TEAM=ABCDE12345 scripts/testflight.sh --no-upload # archive and export the .ipa only (build/export)
#
# TEAM is the paid Apple Developer team (developer.apple.com → Membership). Xcode must be signed in
# to that account (Settings → Accounts), and App Store Connect needs an app record for
# com.brazework.app before the first upload. To upload without Xcode's account, set an App Store
# Connect API key instead: ASC_KEY_PATH (the .p8), ASC_KEY_ID and ASC_ISSUER_ID.
#
# The production URL and anon key come from FORGE_SUPABASE_URL / FORGE_SUPABASE_ANON_KEY, or else
# the public NEXT_PUBLIC_ values in web/.env.local (read only; the anon key ships in every app
# anyway). They are passed to this build only and never written to Config/, so development builds
# keep pointing at the local stack.
set -euo pipefail
cd "$(dirname "$0")/.."

upload=1
[[ "${1:-}" == "--no-upload" ]] && upload=0
: "${TEAM:?Set TEAM to the paid Apple Developer team ID (developer.apple.com → Membership)}"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"

# web/.env.local lives in the main checkout; a git worktree doesn't have its own copy.
envfile=../web/.env.local
[[ -f $envfile ]] || envfile="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/../web/.env.local"
envval() { { grep "^$1=" "$envfile" 2>/dev/null || true; } | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }
url="${FORGE_SUPABASE_URL:-$(envval NEXT_PUBLIC_SUPABASE_URL)}"
key="${FORGE_SUPABASE_ANON_KEY:-$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)}"
web="${FORGE_WEB_URL:-https://brazework.com}"
[[ "$url" == https://*.supabase.co ]] || { echo "Production Supabase URL not found (got '${url}')"; exit 1; }
[[ -n "$key" ]] || { echo "Production anon key not found"; exit 1; }

# Every upload needs a build number higher than the last; the time does that without bookkeeping.
build="$(date -u +%y%m%d.%H%M)"
version="$(awk '/MARKETING_VERSION:/ {print $2; exit}' project.yml)"
archive="build/Brazework-$version-$build.xcarchive"
auth=()
if [[ -n "${ASC_KEY_PATH:-}" ]]; then
  auth=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "${ASC_KEY_ID:?}" -authenticationKeyIssuerID "${ASC_ISSUER_ID:?}")
fi

# Runs xcodebuild with its full log in build/<name>.log, printing only errors and the result.
run() {
  local name=$1; shift
  mkdir -p build
  if ! xcodebuild "$@" > "build/$name.log" 2>&1; then
    grep -E 'error:|FAILED' "build/$name.log" | sort -u | tail -20
    echo "$name failed; full log in ios/build/$name.log"
    exit 1
  fi
  grep -E '(ARCHIVE|EXPORT) SUCCEEDED|Uploaded' "build/$name.log" | tail -2 || true
}

echo "Brazework $version ($build) → ${url%%.*}…, team $TEAM"
xcodegen generate --quiet

run archive archive -project Forge.xcodeproj -scheme Forge -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" -allowProvisioningUpdates "${auth[@]}" \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$build" \
  FORGE_SUPABASE_URL="$url" FORGE_SUPABASE_ANON_KEY="$key" FORGE_WEB_URL="$web"

exportplist="$(mktemp -t exportoptions).plist"
destination=upload
(( upload )) || destination=export
cat > "$exportplist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$destination</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST

run export -exportArchive -archivePath "$archive" -exportOptionsPlist "$exportplist" \
  -exportPath build/export -allowProvisioningUpdates "${auth[@]}"
rm -f "$exportplist"

if (( upload )); then
  echo "Uploaded $version ($build). It shows in App Store Connect → TestFlight once Apple finishes processing (5–15 minutes)."
else
  echo "Exported build/export/Forge.ipa ($version, $build)."
fi
