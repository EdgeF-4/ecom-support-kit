#!/usr/bin/env bash
#
# Publish this repository to a public GitHub repo and push main.
#
# Idempotent: if the repo already exists, it skips creation and just pushes.
# The token is read from ~/.config/gh_push_token and is never written to disk
# or to the git config; it is used only for the single push, which goes through
# an ephemeral remote URL.
#
# Usage:
#   ./scripts/publish.sh
#
set -euo pipefail

OWNER="${GITHUB_OWNER:-}"
REPO="ecom-support-kit"
DESCRIPTION="Self hostable scoped support assistant for Shopify stores on self hosted n8n."
TOKEN_FILE="${HOME}/.config/gh_push_token"
API="https://api.github.com"

if [ -z "$OWNER" ]; then
  echo "error: set GITHUB_OWNER to the destination account" >&2
  exit 2
fi

# Run from the repository root regardless of where the script is called from.
cd "$(dirname "$0")/.."

if [ ! -f "$TOKEN_FILE" ]; then
  echo "error: token file not found at $TOKEN_FILE" >&2
  exit 1
fi
TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then
  echo "error: token file $TOKEN_FILE is empty" >&2
  exit 1
fi

auth_header="Authorization: token ${TOKEN}"

echo "checking for ${OWNER}/${REPO} ..."
status="$(curl -s -o /dev/null -w '%{http_code}' -H "$auth_header" \
  "${API}/repos/${OWNER}/${REPO}")"

case "$status" in
  200)
    echo "repo already exists, skipping creation"
    ;;
  404)
    echo "creating public repo ${OWNER}/${REPO} ..."
    curl -fsS -H "$auth_header" -H "Accept: application/vnd.github+json" \
      -X POST "${API}/user/repos" \
      -d "{\"name\":\"${REPO}\",\"description\":\"${DESCRIPTION}\",\"private\":false,\"has_issues\":true}" \
      >/dev/null
    echo "created"
    ;;
  *)
    echo "error: unexpected status ${status} from GitHub API" >&2
    exit 1
    ;;
esac

# Push main through an ephemeral authenticated URL so the token is not stored.
push_url="https://${OWNER}:${TOKEN}@github.com/${OWNER}/${REPO}.git"
echo "pushing main ..."
git push "$push_url" main

# Leave a clean, tokenless origin behind for convenience.
clean_url="https://github.com/${OWNER}/${REPO}.git"
if git remote | grep -qx origin; then
  git remote set-url origin "$clean_url"
else
  git remote add origin "$clean_url"
fi

echo "done: https://github.com/${OWNER}/${REPO}"
