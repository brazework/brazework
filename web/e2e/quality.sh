#!/usr/bin/env bash
# Speed, accessibility and security checks against the local production build: Lighthouse budgets on
# public and logged-in pages (e2e/lighthouserc.cjs), then an OWASP ZAP baseline scan of the running app
# (passive and safe), failing on any High-risk finding. Same command in CI and on a laptop:
#   npm run quality        (needs Docker and Google Chrome; ~6 min)
# Reports: .lighthouse/ (open the .html files) and .zap/zap-report.html
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'kill $(lsof -ti:3200 -sTCP:LISTEN) 2>/dev/null || true; e2e/local-supabase.sh down >/dev/null' EXIT
. e2e/serve.sh
LHCI="npx -y @lhci/cli@0.15.1"
fail=0
rm -rf .lighthouse .zap; mkdir -p .zap; chmod 777 .zap

echo "== Lighthouse: public pages"
LH_PAGES=public $LHCI autorun --config=e2e/lighthouserc.cjs || fail=1
echo "== Lighthouse: logged-in pages"
node e2e/session-cookie.cjs && LH_PAGES=app $LHCI autorun --config=e2e/lighthouserc.cjs || fail=1
node -e '
const fs = require("fs");
for (const set of ["public", "app"]) for (const f of fs.readdirSync(`.lighthouse/${set}`).filter((f) => f.endsWith(".report.json"))) {
  const r = JSON.parse(fs.readFileSync(`.lighthouse/${set}/${f}`, "utf8")); const c = r.categories; const pct = (k) => Math.round(c[k].score * 100);
  console.log((r.finalDisplayedUrl || "").replace(/^https?:\/\/[^/]+/, "").padEnd(12), `speed ${pct("performance")}  accessibility ${pct("accessibility")}  best practices ${pct("best-practices")}  LCP ${Math.round(r.audits["largest-contentful-paint"].numericValue)} ms  CLS ${r.audits["cumulative-layout-shift"].numericValue.toFixed(3)}`);
}' || true

echo "== Security scan (OWASP ZAP baseline)"
# Docker on Linux (CI) shares the host network; Docker Desktop on a Mac reaches it by name.
if [ "$(uname)" = Linux ]; then net="--network host"; target=http://localhost:3200; else net=""; target=http://host.docker.internal:3200; fi
docker run --rm $net -v "$PWD/.zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$target" -m 2 -r zap-report.html -J zap.json -I >/dev/null || true
node e2e/zap-check.cjs || fail=1

echo; [ $fail = 0 ] && echo "All quality checks passed." || { echo "Some quality checks failed: reports in .lighthouse/ and .zap/"; exit 1; }
