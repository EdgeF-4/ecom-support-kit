import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";

test("publisher turns a raw push failure into a next action", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "ecom-publish-test-"));
  const fakeGit = resolve(directory, "git");
  writeFileSync(
    fakeGit,
    `#!/usr/bin/env sh
case "$1 $2" in
  "branch --show-current") printf '%s\\n' 'agent/senior-gate5-20260813' ;;
  "status --porcelain") ;;
  "remote get-url") printf '%s\\n' 'https://github.com/example/repo.git' ;;
  "symbolic-ref refs/remotes/origin/HEAD") printf '%s\\n' 'refs/remotes/origin/main' ;;
  "push --set-upstream") printf '%s\\n' 'raw transport failure' >&2; exit 7 ;;
  *) exit 99 ;;
esac
`,
    { mode: 0o700 }
  );
  chmodSync(fakeGit, 0o700);

  const root = resolve(process.cwd(), "..");
  const result = spawnSync(
    "bash",
    ["scripts/publish.sh", "agent/senior-gate5-20260813"],
    {
      cwd: root,
      env: { ...process.env, PUBLISH_GIT: fakeGit },
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /could not push review branch/);
  assert.match(result.stderr, /next: run git ls-remote/);
  assert.doesNotMatch(result.stderr, /raw transport failure/);
});
