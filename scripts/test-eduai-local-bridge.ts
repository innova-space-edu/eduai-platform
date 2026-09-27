import assert from "node:assert/strict";
import { evaluateEduAILocalBridgeModel, normalizeEduAILocalBridgeBaseUrl, recommendEduAILocalBridgeCapacity } from "../lib/ai/local/eduai-local-bridge";

const allowed = [
  ["http://localhost:1234/v1/", "http://localhost:1234/v1"],
  ["http://127.0.0.1:8080/v1", "http://127.0.0.1:8080/v1"],
  ["http://[::1]:1234/v1", "http://[::1]:1234/v1"],
];

for (const [input, expected] of allowed) {
  assert.equal(normalizeEduAILocalBridgeBaseUrl(input), expected);
}

for (const input of [
  "https://example.com/v1",
  "http://192.168.1.10:1234/v1",
  "ftp://localhost:1234/v1",
  "not-a-url",
]) {
  assert.throws(
    () => normalizeEduAILocalBridgeBaseUrl(input),
    `Debe rechazar ${input}`,
  );
}

console.log("EDUAI Local Bridge security: OK");


assert.equal(
  recommendEduAILocalBridgeCapacity({ memoryGB: 8, vramGB: 4 }).label,
  "3–4B Q4",
);
assert.equal(
  recommendEduAILocalBridgeCapacity({ memoryGB: 16, vramGB: 8 }).label,
  "7–8B Q4",
);
assert.equal(
  recommendEduAILocalBridgeCapacity({ memoryGB: 32, vramGB: 16 }).label,
  "12–14B Q4",
);

assert.equal(
  evaluateEduAILocalBridgeModel("qwen3-4b-q4", { memoryGB: 8, vramGB: 4 }),
  "recommended",
);
assert.equal(
  evaluateEduAILocalBridgeModel("qwen3-7b-q4", { memoryGB: 8, vramGB: 4 }),
  "possible",
);
assert.equal(
  evaluateEduAILocalBridgeModel("model-without-size", { memoryGB: 16, vramGB: 8 }),
  "unknown",
);

console.log("EDUAI Local Bridge capacity matrix: OK");
