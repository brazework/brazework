#!/usr/bin/env bash
# Start a private local Supabase, build Forge pointed at it, and serve it on :3200. Sourced by run.sh
# (the e2e suite) and by CI's quality job (Lighthouse and the security scan), so every check runs
# against the same thing. The caller stops it: e2e/local-supabase.sh down, and the server on :3200.
e2e/local-supabase.sh up
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$(cat e2e/.anon-key)" ANTHROPIC_API_KEY= SUPABASE_SERVICE_ROLE_KEY="$(cat e2e/.service-key)" STRIPE_WEBHOOK_SECRET=whsec_forge_e2e CRON_SECRET=cron_forge_e2e
npx next build >/tmp/forge-e2e-build.log 2>&1 || { tail -20 /tmp/forge-e2e-build.log; exit 1; }
npx next start -p 3200 >/tmp/forge-e2e-server.log 2>&1 &
until curl -sf http://localhost:3200/login >/dev/null; do sleep 1; done
