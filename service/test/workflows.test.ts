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
  nodes: {
    name: string;
    type: string;
    parameters?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  }[];
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

test("intake workflow delegates once to the tested service pipeline", () => {
  const workflow = readWorkflow("support-intake.json");
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const process = nodes.get("Process Support Request");
  assert.equal(process?.type, "n8n-nodes-base.httpRequest");
  assert.equal(process?.parameters?.url, "={{$env.SUPPORT_SERVICE_URL}}/support");
  assert.equal(process?.credentials, undefined);

  const targets = workflow.connections["Process Support Request"].main[0].map(
    (connection) => connection.node
  );
  assert.deepEqual(targets, ["Respond"]);
  assert.equal(workflow.nodes.length, 3);
  assert.ok(workflow.nodes.every((node) => node.credentials === undefined));
});
