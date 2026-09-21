import assert from "node:assert/strict";
import { normalizeEduAILocalBridgeBaseUrl } from "../lib/ai/local/eduai-local-bridge";

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
    undefined,
    `Debe rechazar ${input}`,
  );
}

console.log("EDUAI Local Bridge security: OK");
