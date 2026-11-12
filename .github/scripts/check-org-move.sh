#!/usr/bin/env bash
# After moving forge-app into github.com/brazework (docs/github-org-move.md, Linear FIX-54): checks
# that the move landed and nothing went quiet. Read-only. Needs gh, signed in as an org Owner.
# Usage: bash .github/scripts/check-org-move.sh
set -uo pipefail
REPO=${REPO:-brazework/forge-app}  # override only to test the script against another repo
fail=0
ok() { echo "✅ $*"; }
bad() { echo "❌ $*"; fail=1; }
wait_() { echo "⏳ $*"; }

if [ "$(gh api "repos/$REPO" -q .full_name 2>/dev/null)" = "$REPO" ]; then ok "the repo is at $REPO"
else bad "the repo isn't at $REPO yet (the Transfer step in docs/github-org-move.md)"; exit 1; fi

admin=$(gh api "repos/$REPO" -q .permissions.admin 2>/dev/null)
[ "$admin" = "true" ] && ok "you're an admin on $REPO" || bad "you're not an admin on $REPO: accept the org's Owner invite"
owners=$(gh api "orgs/brazework/members?role=admin" -q '[.[].login] | join(", ")' 2>/dev/null)
echo "   org Owners: ${owners:-unknown}"

# Only admins can read secret names; for anyone else the list just comes back empty.
if [ "$admin" = "true" ]; then
  secrets=$(gh secret list -R "$REPO" --json name -q '.[].name' 2>/dev/null)
  echo "$secrets" | grep -qx LINEAR_API_KEY && ok "secret LINEAR_API_KEY" || wait_ "LINEAR_API_KEY isn't set yet (FIX-5)"
else
  wait_ "can't read secret names without admin access"
fi

remote=$(git remote get-url origin 2>/dev/null)
case "$remote" in *brazework/forge-app*) ok "origin is $remote" ;; *) wait_ "origin is $remote: run git remote set-url origin https://github.com/$REPO.git" ;; esac

sha=$(gh api "repos/$REPO/commits/main" -q .sha 2>/dev/null); short=${sha:0:7}
echo "   main is at $short"
runs=$(gh run list -R "$REPO" --branch main --limit 20 --json headSha,workflowName,conclusion,status -q ".[] | select(.headSha == \"$sha\") | \"\\(.workflowName)|\\(.status)|\\(.conclusion)\"" 2>/dev/null)
[ -z "$runs" ] && wait_ "no workflow runs on $short yet: push a change to main or run Actions → Web → Run workflow"
while IFS='|' read -r name status concl; do
  [ -z "$name" ] && continue
  if [ "$status" != "completed" ]; then wait_ "$name: $status"
  elif [ "$concl" = "success" ]; then ok "$name passed on $short"
  else bad "$name: $concl on $short"; fi
done <<< "$runs"

vercel=$(gh api "repos/$REPO/commits/$sha/status" -q '.statuses[] | select(.context | test("Vercel")) | .state' 2>/dev/null | head -1)
case "$vercel" in
  success) ok "Vercel deployed $short" ;;
  pending) wait_ "Vercel is still deploying $short" ;;
  "") wait_ "no Vercel status on $short: if a push after the move shows none, reconnect Vercel (step 2.2)" ;;
  *) bad "Vercel: $vercel on $short" ;;
esac

echo; [ $fail = 0 ] && echo "Move looks good." || { echo "Fix the ❌ lines above (docs/github-org-move.md)."; exit 1; }
