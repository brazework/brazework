#!/usr/bin/env bash
# Start a private local Supabase, build Brazework pointed at it, and serve it on :3200. Sourced by run.sh
# (the e2e suite) and by CI's quality job (Lighthouse and the security scan), so every check runs
# against the same thing. The caller stops it: e2e/local-supabase.sh down, and the server on :3200.
# The stack starts in the background while the app builds: the build only needs the stack's URL and keys,
# which are fixed (local-supabase.sh keys), not the running stack. That saves the ~40 s the two took
# one after the other.
e2e/local-supabase.sh keys
e2e/local-supabase.sh up >/tmp/forge-e2e-up.log 2>&1 &
stack_pid=$!
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$(cat e2e/.anon-key)" ANTHROPIC_API_KEY= SUPABASE_SERVICE_ROLE_KEY="$(cat e2e/.service-key)" STRIPE_WEBHOOK_SECRET=whsec_forge_e2e CRON_SECRET=cron_forge_e2e GITHUB_APP_WEBHOOK_SECRET=whsec_github_e2e
# Brazework's GitHub App, for the tests: a stand-in GitHub on :3999 (e2e/n-github.cjs) and a throwaway
# key made for this run. Production's come from Vercel (infra/github-app.mjs push-to-vercel).
export GITHUB_APP_ID=1 GITHUB_APP_SLUG=brazework-e2e GITHUB_APP_CLIENT_ID=Iv1.e2e GITHUB_APP_CLIENT_SECRET=e2e-client-secret GITHUB_API_URL=http://localhost:3999 GITHUB_WEB_URL=http://localhost:3999
export GITHUB_APP_PRIVATE_KEY="$(openssl genrsa 2048 2>/dev/null | base64 | tr -d '\n')"
npx next build >/tmp/forge-e2e-build.log 2>&1 || { tail -20 /tmp/forge-e2e-build.log; wait "$stack_pid" || true; exit 1; }
wait "$stack_pid" || { tail -40 /tmp/forge-e2e-up.log; echo "local Supabase didn't start" >&2; exit 1; }
grep -v '^NOTICE:' /tmp/forge-e2e-up.log || true
npx next start -p 3200 >/tmp/forge-e2e-server.log 2>&1 &
until curl -sf http://localhost:3200/login >/dev/null; do sleep 1; done
# Warm the heaviest public pages once before any journey runs. In a shard, the first journey can be
# the landing page's 3D hero on a server nothing has loaded yet, and its first load then ran past
# Playwright's 30 s navigation limit (merge queue run 46040292530, s-landing.cjs on shard b1).
for p in / /schools /signup; do curl -s -o /dev/null --max-time 90 "http://localhost:3200$p" || true; done
