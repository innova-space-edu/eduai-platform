import test from "node:test";
import assert from "node:assert/strict";
import { nextPlaybackId } from "../lib/music/playback-order.mjs";
const order = ["a","b","c","d"];
const all = new Set(order);
test("shuffle plays every favorite before repeating", () => {
  const visited = new Set();
  let current = "a";
  const result = [current];
  for (let i = 0; i < 3; i++) {
    current = nextPlaybackId(order, all, current, true, true, visited, () => 0);
    result.push(current);
  }
  assert.equal(new Set(result).size, 4);
  assert.notEqual(nextPlaybackId(order, all, current, true, true, visited, () => 0), current);
});
test("sequential mode respects original order and skips failures", () => {
  assert.equal(nextPlaybackId(order, new Set(["a","d"]), "b", false, false, new Set()), "d");
  assert.equal(nextPlaybackId(order, all, "d", false, false, new Set()), undefined);
  assert.equal(nextPlaybackId(order, all, "d", false, true, new Set()), "a");
});
test("empty, single-track and exhausted shuffle lists", () => {
  assert.equal(nextPlaybackId(order, new Set(), "b", true, true, new Set()), undefined);
  assert.equal(nextPlaybackId(["a"], new Set(["a"]), "a", true, true, new Set()), "a");
  assert.equal(nextPlaybackId(order, all, "d", true, false, new Set(order)), undefined);
});
test("a failed song is not returned by the selector", () => {
  assert.equal(nextPlaybackId(order, new Set(["c","d"]), "b", true, true, new Set(), () => 0), "c");
});
