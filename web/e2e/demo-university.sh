#!/usr/bin/env bash
# Brazework Demo University: a whole school to show on a sales call (docs/demo-university.md).
# A dean (the school's admin), a professor, a teaching assistant and six students; a capstone course
# mid-semester with modules, graded assignments on an ABET rubric, a quiz, attendance, announcements
# and peer ratings; class projects with verified milestones; a verified club. Made-up people and work.
#
# Local (default): the private test stack (e2e/local-supabase.sh up), domain demo.brazework.test.
#   e2e/demo-university.sh
# A hosted demo project (never production): a separate Supabase project made for demos.
#   DEMO_URL=https://<ref>.supabase.co DEMO_ANON=<anon key> DEMO_DB_URL=postgresql://... \
#   DEMO_DOMAIN=demo.yourdomain.edu DEMO_PASSWORD=<a new password> e2e/demo-university.sh
# It refuses to run against the project in web/.env.local (production).
set -euo pipefail
cd "$(dirname "$0")/.."
STACK="${E2E_STACK:-forge-e2e}"; GW="${E2E_GATEWAY_PORT:-54321}"
URL="${DEMO_URL:-http://localhost:$GW}"
ANON="${DEMO_ANON:-$(cat e2e/.anon-key 2>/dev/null || true)}"
DOMAIN="${DEMO_DOMAIN:-demo.brazework.test}"
PASS="${DEMO_PASSWORD:-forge-test-pass-1}"

# Never production: refuse the project web/.env.local points at (this checkout's, or the main
# checkout's when this is a git worktree). A hosted run can't start without finding it.
PROD=""
MAIN="$(cd "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/.." 2>/dev/null && pwd || true)"
for f in .env.local "$MAIN/web/.env.local"; do
  [ -f "$f" ] && PROD="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$f" | cut -d= -f2- | tr -d '"' || true)" && [ -n "$PROD" ] && break
done
if [ -n "${DEMO_URL:-}" ] && [ -z "$PROD" ]; then echo "Refusing: couldn't find production's URL in web/.env.local to rule it out." >&2; exit 1; fi
if [ -n "$PROD" ] && [ "${URL%/}" = "${PROD%/}" ]; then echo "Refusing: that's the production project. Use a separate demo project." >&2; exit 1; fi
if [ -z "$ANON" ]; then echo "No anon key: start the local stack (e2e/local-supabase.sh up) or set DEMO_ANON." >&2; exit 1; fi
if [ -n "${DEMO_URL:-}" ] && [ -z "${DEMO_DB_URL:-}" ]; then echo "Set DEMO_DB_URL (the demo project's database connection string) too." >&2; exit 1; fi
if [ -n "${DEMO_URL:-}" ] && [ "$PASS" = "forge-test-pass-1" ]; then echo "Set DEMO_PASSWORD to a new password for a hosted demo." >&2; exit 1; fi

# psql for a hosted project: the local one, or Postgres's own image.
remote_psql() { if command -v psql >/dev/null; then psql "$@"; else docker run --rm -i postgres:17-alpine psql "$@"; fi; }
sql() { if [ -n "${DEMO_DB_URL:-}" ]; then remote_psql "$DEMO_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; else docker exec -i "$STACK-db" psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q "$@"; fi; }

# The school is listed before anyone signs up, so their emails place them there.
echo "insert into public.school_domains (domain, school) values ('$DOMAIN', 'Brazework Demo University') on conflict (domain) do update set school = excluded.school;" | sql

for u in dean:Dana:Alvarez prof:Elena:Ruiz ta:Sam:Okafor ava:Ava:Chen ben:Ben:Osei cleo:Cleo:Park dev:Dev:Shah eli:Eli:Moreno fay:Fay:Nguyen; do IFS=: read -r e f l <<< "$u"
  curl -s -o /dev/null -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$e@$DOMAIN\",\"password\":\"$PASS\",\"data\":{\"accountType\":\"student\",\"firstName\":\"$f\",\"lastName\":\"$l\",\"birthday\":\"2003-04-04\"}}"; done

sql -v domain="$DOMAIN" < e2e/demo-university.sql
echo "Brazework Demo University ($DOMAIN) is ready."
echo "  Dean (school admin): dean@$DOMAIN · Professor: prof@$DOMAIN · TA: ta@$DOMAIN"
echo "  Students: ava, ben, cleo, dev, eli, fay @$DOMAIN"
[ "$PASS" = "forge-test-pass-1" ] && echo "  Password: forge-test-pass-1 (local only)"
