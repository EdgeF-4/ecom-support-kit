import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("direct runs bind loopback unless a container host is explicit", () => {
  const priorConfig = process.env.SUPPORT_CONFIG;
  const priorHost = process.env.SUPPORT_HOST;
  try {
    process.env.SUPPORT_CONFIG = "/missing/ecom-support-kit-config.json";
    delete process.env.SUPPORT_HOST;
    assert.equal(loadConfig().service.host, "127.0.0.1");

    process.env.SUPPORT_HOST = "0.0.0.0";
    assert.equal(loadConfig().service.host, "0.0.0.0");
  } finally {
    if (priorConfig === undefined) delete process.env.SUPPORT_CONFIG;
    else process.env.SUPPORT_CONFIG = priorConfig;
    if (priorHost === undefined) delete process.env.SUPPORT_HOST;
    else process.env.SUPPORT_HOST = priorHost;
  }
});
