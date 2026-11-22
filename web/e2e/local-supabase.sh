#!/usr/bin/env bash
# A private, throwaway Supabase for end-to-end tests: Postgres + GoTrue (sign-in) + PostgREST (API)
# in Docker, behind a tiny gateway on :54321 that looks like a Supabase URL. Nothing touches the
# real project. Usage: e2e/local-supabase.sh up | down
#
# One stack per name, so two can run side by side without stopping each other (a demo while tests run):
#   E2E_STACK=brazework-demo E2E_GATEWAY_PORT=54331 E2E_AUTH_PORT=19989 E2E_REST_PORT=13010 e2e/local-supabase.sh up
# The defaults are the stack CI and npm run e2e use (forge-e2e on :54321).
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET=forge-local-test-secret-forge-local-test-secret
# Images are pinned by digest, so every mirror serves the same bytes. Supabase publishes the same
# images on GHCR, ECR Public and Docker Hub; anonymous ECR pulls share a data quota per IP, and a
# CI runner whose shared IP had used it up died at the pull ("Data limit exceeded", exit 125).
# GHCR is tried first, then the others, a few rounds with a pause. To upgrade, change tag and digest
# together (docker buildx imagetools inspect public.ecr.aws/supabase/postgres:<tag> | grep Digest).
PG_IMG="supabase/postgres@sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706"  # 17.11.0.004
AUTH_IMG="supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b"  # v2.197.0
REST_IMG="postgrest/postgrest@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401"  # v12.2.3, Docker Hub only
# image <repo@digest> <registry>...: prints a local reference, pulling it from the first registry that works.
image() {
  local ref=$1 reg round; shift
  for reg in "$@"; do docker image inspect "$reg/$ref" >/dev/null 2>&1 && { echo "$reg/$ref"; return; }; done
  for round in 1 2 3; do
    for reg in "$@"; do
      docker pull -q "$reg/$ref" >&2 && { echo "$reg/$ref"; return; }
      echo "::warning::Couldn't pull $reg/$ref (round $round); trying the next mirror" >&2
    done
    sleep $((round * 15))
  done
  echo "::error::Couldn't pull $ref from any of: $*" >&2; return 1
}
STACK="${E2E_STACK:-forge-e2e}"; GW="${E2E_GATEWAY_PORT:-54321}"; AP="${E2E_AUTH_PORT:-19999}"; RP="${E2E_REST_PORT:-13000}"
# The default stack runs e2e/gateway.cjs; any other runs its own copy, so stopping one gateway never
# stops another stack's (down used to stop every gateway on the machine).
GWJS=e2e/gateway.cjs; [ "$STACK" = forge-e2e ] || { GWJS="e2e/.gateway-$STACK.cjs"; cp e2e/gateway.cjs "$GWJS"; }

down() { docker rm -f "$STACK-db" "$STACK-auth" "$STACK-rest" >/dev/null 2>&1 || true; pkill -f "$GWJS" 2>/dev/null || true; }
if [ "${1:-up}" = "down" ]; then down; echo "stopped"; exit 0; fi
down
PG=$(image "$PG_IMG" ghcr.io public.ecr.aws docker.io)
AUTH=$(image "$AUTH_IMG" ghcr.io public.ecr.aws docker.io)
REST=$(image "$REST_IMG" docker.io)
docker network create "$STACK" >/dev/null 2>&1 || true
docker run -d --name $STACK-db --network "$STACK" -e POSTGRES_PASSWORD=postgres "$PG" >/dev/null
until docker exec $STACK-db pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 1; done; sleep 4
docker exec $STACK-db psql -U supabase_admin -h localhost -d postgres -qc "alter role authenticator with password 'postgres'; alter role supabase_auth_admin with password 'postgres';"
# "Continue with GitHub" is switched on with a stand-in app (not a real client or secret), so the button
# shows and its redirect can be checked (e2e/y-oauth.cjs). The browser never reaches GitHub.
docker run -d --name $STACK-auth --network "$STACK" -p 127.0.0.1:$AP:9999 \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost:$GW/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@$STACK-db:5432/postgres \
  -e GOTRUE_DB_MAX_POOL_SIZE=20 -e GOTRUE_DB_MAX_IDLE_POOL_SIZE=20 -e GOTRUE_DB_CONN_MAX_IDLE_TIME=60s \
  -e GOTRUE_SITE_URL=http://localhost:3200 -e "GOTRUE_URI_ALLOW_LIST=http://localhost:3200/**,http://localhost:3000/**,http://localhost:${PORT:-3000}/**" \
  -e GOTRUE_JWT_SECRET=$SECRET -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_EXTERNAL_GITHUB_ENABLED=true -e GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=brazework-e2e -e GOTRUE_EXTERNAL_GITHUB_SECRET=e2e-placeholder \
  -e GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=http://localhost:$GW/auth/v1/callback \
  -e GOTRUE_OAUTH_SERVER_ENABLED=true -e GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH=/oauth/consent -e GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=true "$AUTH" >/dev/null
until curl -sf http://localhost:$AP/health >/dev/null; do sleep 1; done
# Every SQL file, in order (supabase/order.txt is the one list; CI and production follow it too).
FILES=$(grep -v '^#' ../supabase/order.txt | grep -v '^$')
for f in $FILES; do docker exec -i $STACK-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < "../supabase/$f.sql" >/dev/null; done
docker run -d --name $STACK-rest --network "$STACK" -p 127.0.0.1:$RP:3000 -e PGRST_DB_URI=postgres://authenticator:postgres@$STACK-db:5432/postgres \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=$SECRET "$REST" >/dev/null
GW_JWT_SECRET=$SECRET GW_PORT=$GW GW_AUTH_PORT=$AP GW_REST_PORT=$RP nohup node "$GWJS" > "/tmp/$STACK-gateway.log" 2>&1 &
until curl -sf http://localhost:$GW/rest/v1/ >/dev/null; do sleep 1; done
ANON=$(node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"supabase",exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET")
echo "$ANON" > e2e/.anon-key
# A service-role key for trusted server code (the billing webhook).
node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"service_role",iss:"supabase",exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET" > e2e/.service-key
# The test members' school: listed like a real school without an academic domain (signup-rules.sql).
docker exec $STACK-db psql -U postgres -h localhost -d postgres -qc "insert into public.school_domains (domain, school) values ('forge.test', 'Brazework test school') on conflict do nothing" >/dev/null
# Test members sign up through the real sign-up API (their profiles come from the same trigger).
for u in josh:Josh:Menzies maya:Maya:Patel ben:Ben:Cho cara:Cara:Diaz; do IFS=: read -r e f l <<< "$u"
  curl -sf -X POST http://localhost:$GW/auth/v1/signup -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$e@forge.test\",\"password\":\"forge-test-pass-1\",\"data\":{\"accountType\":\"student\",\"firstName\":\"$f\",\"lastName\":\"$l\",\"birthday\":\"2004-01-01\"}}" >/dev/null; done
docker exec -i $STACK-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < e2e/seed.sql
docker kill -s SIGUSR1 $STACK-rest >/dev/null
echo "local Supabase ($STACK) ready on http://localhost:$GW"
