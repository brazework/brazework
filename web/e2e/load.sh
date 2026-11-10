#!/usr/bin/env bash
# Load test against the local production build (k6 in Docker): see e2e/load.js for what it does and
# the targets. Same command in CI (the "Load test" workflow, run on demand) and on a laptop:
#   npm run load        (needs Docker; ~3 min)
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'kill $(lsof -ti:3200 -sTCP:LISTEN) 2>/dev/null || true; e2e/local-supabase.sh down >/dev/null' EXIT
. e2e/serve.sh
node e2e/session-cookie.cjs
# Docker on Linux (CI) shares the host network; Docker Desktop on a Mac reaches it by name.
if [ "$(uname)" = Linux ]; then net="--network host"; host=localhost; else net=""; host=host.docker.internal; fi
mkdir -p .load
docker run --rm -i $net -v "$PWD/.load:/out" \
  -e BASE="http://$host:3200" -e SUPABASE="http://$host:54321" -e COOKIE="$(cat e2e/.results/lh-cookie.txt)" -e ANON="$(cat e2e/.anon-key)" \
  grafana/k6:latest run --quiet --summary-export=/out/summary.json - < e2e/load.js
