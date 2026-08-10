#!/usr/bin/env bash
# Push one reviewed, non-default branch through the configured git credential
# helper. This script never creates a repository, changes visibility, or pushes
# a default branch.
set -euo pipefail

branch="${1:-}"
remote="${2:-origin}"

fail() {
  printf 'error: %s\nnext: %s\n' "$1" "$2" >&2
  exit 1
}

if [ -z "$branch" ]; then
  fail \
    "no branch was supplied" \
    "run ./scripts/publish.sh <review-branch> after the owner approves that branch"
fi

case "$branch" in
  main|master|trunk)
    fail \
      "refusing to push the protected branch '$branch'" \
      "create a review branch, commit there, and pass that branch name"
    ;;
esac

current="$(git branch --show-current)"
if [ "$current" != "$branch" ]; then
  fail \
    "current branch '$current' does not match requested branch '$branch'" \
    "run git switch '$branch', inspect the diff, and retry"
fi

if [ -n "$(git status --porcelain)" ]; then
  fail \
    "the working tree has uncommitted changes" \
    "review and commit the intended files, or restore them, then retry"
fi

if ! git remote get-url "$remote" >/dev/null 2>&1; then
  fail \
    "remote '$remote' is not configured" \
    "add the reviewed remote with git remote add '$remote' <repository-url>"
fi

remote_url="$(git remote get-url "$remote")"
case "$remote_url" in
  *://*@*)
    fail \
      "remote '$remote' appears to contain an inline credential" \
      "replace it with a credential-free URL and use a configured credential helper"
    ;;
esac

default_ref="$(git symbolic-ref "refs/remotes/$remote/HEAD" 2>/dev/null || true)"
default_branch="${default_ref##*/}"
if [ -n "$default_ref" ] && [ "$branch" = "$default_branch" ]; then
  fail \
    "refusing to push detected default branch '$branch'" \
    "create a review branch and pass its name instead"
fi

printf 'pushing review branch %s to %s\n' "$branch" "$remote"
git push --set-upstream "$remote" "$branch"
