import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

interface Connection {
  node: string;
  type: string;
  index: number;
}

interface Workflow {
  nodes: { name: string }[];
  connections: Record<string, Record<string, Connection[][]>>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

function readWorkflow(name: string): Workflow {
  return JSON.parse(
    readFileSync(path.join(repoRoot, "workflows", name), "utf8")
  ) as Workflow;
}

test("workflow connections only target nodes that exist", () => {
  for (const file of ["support-intake.json", "error-handler.json"]) {
    const workflow = readWorkflow(file);
    const names = new Set(workflow.nodes.map((node) => node.name));
    assert.equal(names.size, workflow.nodes.length);
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.has(source), `${file}: missing source ${source}`);
      for (const groups of Object.values(outputs)) {
        for (const group of groups) {
          for (const target of group) {
            assert.ok(names.has(target.node), `${file}: missing target ${target.node}`);
          }
        }
      }
    }
  }
});

test("n8n escalation persists exactly once before responding", () => {
  const workflow = readWorkflow("support-intake.json");
  const targets = workflow.connections["Build Response (escalate)"].main[0].map(
    (connection) => connection.node
  );
  assert.deepEqual(targets, ["Respond"]);
});
