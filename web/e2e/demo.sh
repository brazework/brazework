#!/usr/bin/env bash
# Demo members for the launch video and screenshots (docs/product-hunt.md), on the private local
# database only: npm run dev -- --demo. Three made-up builders in different fields, with projects,
# milestones signed by a club or a professor, shared cards, and one card still waiting for its
# signature. Nothing here is real, and it never runs against production.
set -euo pipefail
cd "$(dirname "$0")/.."
ANON="$(cat e2e/.anon-key)"; STACK="${E2E_STACK:-forge-e2e}"; GW="${E2E_GATEWAY_PORT:-54321}"
for u in priya:Priya:Raman:student leo:Leo:Park:student ana:Ana:Silva:professional; do IFS=: read -r e f l t <<< "$u"
  curl -s -o /dev/null -X POST http://localhost:$GW/auth/v1/signup -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$e@forge.test\",\"password\":\"forge-test-pass-1\",\"data\":{\"accountType\":\"$t\",\"firstName\":\"$f\",\"lastName\":\"$l\",\"birthday\":\"2002-03-03\"}}"; done
docker exec -i "$STACK-db" psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < e2e/demo-seed.sql
echo "Demo members: priya@forge.test, leo@forge.test, ana@forge.test (password forge-test-pass-1)"
