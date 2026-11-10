#!/usr/bin/env bash
# A private, throwaway Supabase for end-to-end tests: Postgres + GoTrue (sign-in) + PostgREST (API)
# in Docker, behind a tiny gateway on :54321 that looks like a Supabase URL. Nothing touches the
# real project. Usage: e2e/local-supabase.sh up | down
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET=forge-local-test-secret-forge-local-test-secret
PG=public.ecr.aws/supabase/postgres:17.11.0.004
AUTH=public.ecr.aws/supabase/gotrue:v2.197.0
REST=postgrest/postgrest:v12.2.3

down() { docker rm -f forge-e2e-db forge-e2e-auth forge-e2e-rest >/dev/null 2>&1 || true; pkill -f "e2e/gateway.cjs" 2>/dev/null || true; }
if [ "${1:-up}" = "down" ]; then down; echo "stopped"; exit 0; fi
down
docker network create forge-e2e >/dev/null 2>&1 || true
docker run -d --name forge-e2e-db --network forge-e2e -e POSTGRES_PASSWORD=postgres "$PG" >/dev/null
until docker exec forge-e2e-db pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 1; done; sleep 4
docker exec forge-e2e-db psql -U supabase_admin -h localhost -d postgres -qc "alter role authenticator with password 'postgres'; alter role supabase_auth_admin with password 'postgres';"
docker run -d --name forge-e2e-auth --network forge-e2e -p 59999:9999 \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@forge-e2e-db:5432/postgres \
  -e GOTRUE_SITE_URL=http://localhost:3200 -e 'GOTRUE_URI_ALLOW_LIST=http://localhost:3200/**' \
  -e GOTRUE_JWT_SECRET=$SECRET -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_DISABLE_SIGNUP=false "$AUTH" >/dev/null
until curl -sf http://localhost:59999/health >/dev/null; do sleep 1; done
# Every SQL file, in the same order as CI (read from the workflow, so there's one list).
FILES=$(grep -o 'for f in [^;]*' ../.github/workflows/web.yml | head -1 | sed 's/for f in //')
for f in $FILES; do docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < "../supabase/$f.sql" >/dev/null; done
docker run -d --name forge-e2e-rest --network forge-e2e -p 53000:3000 -e PGRST_DB_URI=postgres://authenticator:postgres@forge-e2e-db:5432/postgres \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=$SECRET "$REST" >/dev/null
GW_JWT_SECRET=$SECRET nohup node e2e/gateway.cjs > /tmp/forge-e2e-gateway.log 2>&1 &
until curl -sf http://localhost:54321/rest/v1/ >/dev/null; do sleep 1; done
ANON=$(node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"supabase",exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET")
echo "$ANON" > e2e/.anon-key
# A service-role key for trusted server code (the billing webhook).
node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"service_role",iss:"supabase",exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET" > e2e/.service-key
# The test members' school: listed like a real school without an academic domain (signup-rules.sql).
docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -qc "insert into public.school_domains (domain, school) values ('forge.test', 'Forge test school') on conflict do nothing" >/dev/null
# Test members sign up through the real sign-up API (their profiles come from the same trigger).
for u in josh:Josh:Menzies maya:Maya:Patel ben:Ben:Cho cara:Cara:Diaz; do IFS=: read -r e f l <<< "$u"
  curl -sf -X POST http://localhost:54321/auth/v1/signup -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$e@forge.test\",\"password\":\"forge-test-pass-1\",\"data\":{\"accountType\":\"student\",\"firstName\":\"$f\",\"lastName\":\"$l\",\"birthday\":\"2004-01-01\"}}" >/dev/null; done
docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q < e2e/seed.sql
docker kill -s SIGUSR1 forge-e2e-rest >/dev/null
echo "local Supabase ready on http://localhost:54321"
