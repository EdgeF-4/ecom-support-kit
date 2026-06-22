import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../src/store/memory.js";
import { makeCache } from "../src/cache.js";
import { testConfig } from "./helpers.js";

test("cache key normalizes case and punctuation", async () => {
  const store = createMemoryStore();
  const cache = makeCache(store, testConfig());
  await cache.set("Where is my order?", "deterministic", { reply: "x" }, "deterministic");
  const hit = await cache.get("where is my order", "deterministic");
  assert.ok(hit);
  assert.equal((hit.response as { reply: string }).reply, "x");
});

test("different routes do not collide", async () => {
  const store = createMemoryStore();
  const cache = makeCache(store, testConfig());
  await cache.set("hello", "deterministic", { reply: "a" }, "deterministic");
  const miss = await cache.get("hello", "model");
  assert.equal(miss, null);
});

test("hit count increments on each read", async () => {
  const store = createMemoryStore();
  const cache = makeCache(store, testConfig());
  await cache.set("q", "model", { reply: "y" }, "llm");
  await cache.get("q", "model");
  const second = await cache.get("q", "model");
  assert.ok(second);
  assert.equal(second.hitCount, 2);
});

test("a disabled cache never returns a hit", async () => {
  const store = createMemoryStore();
  const cfg = testConfig();
  cfg.cache.enabled = false;
  const cache = makeCache(store, cfg);
  await cache.set("q", "model", { reply: "z" }, "llm");
  assert.equal(await cache.get("q", "model"), null);
});
