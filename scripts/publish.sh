#!/usr/bin/env bash
# Push one reviewed, non-default branch through the configured git credential
# helper. This script never creates a repository, changes visibility, or pushes
# a default branch.
set -uo pipefail

branch="${1:-}"
remote="${2:-origin}"
git_command="${PUBLISH_GIT:-git}"

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

if ! current=$("$git_command" branch --show-current 2>/dev/null); then
  fail \
    "the current Git branch could not be read" \
    "install Git, run git status in this checkout, fix that error, and retry"
fi
if [ "$current" != "$branch" ]; then
  fail \
    "current branch '$current' does not match requested branch '$branch'" \
    "run git switch '$branch', inspect the diff, and retry"
fi

if ! status_output=$("$git_command" status --porcelain 2>/dev/null); then
  fail \
    "the working-tree status could not be read" \
    "run git status, repair the reported repository error, and retry"
fi
if [ -n "$status_output" ]; then
  fail \
    "the working tree has uncommitted changes" \
    "review and commit the intended files, or restore them, then retry"
fi

if ! remote_url=$("$git_command" remote get-url "$remote" 2>/dev/null); then
  fail \
    "remote '$remote' is not configured" \
    "add the reviewed remote with git remote add '$remote' <repository-url>"
fi

case "$remote_url" in
  *://*@*)
    fail \
      "remote '$remote' appears to contain an inline credential" \
      "replace it with a credential-free URL and use a configured credential helper"
    ;;
esac

default_ref="$("$git_command" symbolic-ref "refs/remotes/$remote/HEAD" 2>/dev/null || true)"
default_branch="${default_ref##*/}"
if [ -n "$default_ref" ] && [ "$branch" = "$default_branch" ]; then
  fail \
    "refusing to push detected default branch '$branch'" \
    "create a review branch and pass its name instead"
fi

printf 'pushing review branch %s to %s\n' "$branch" "$remote"
if ! "$git_command" push --set-upstream "$remote" "$branch" >/dev/null 2>&1; then
  fail \
    "Git could not push review branch '$branch' to remote '$remote'" \
    "run git ls-remote '$remote', repair access or the remote URL, then rerun this command"
fi
printf 'pushed review branch %s to %s\n' "$branch" "$remote"
