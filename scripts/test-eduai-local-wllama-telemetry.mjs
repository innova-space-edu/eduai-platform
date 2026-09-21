import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [telemetry, panel, metrics] = await Promise.all([
  readFile("lib/ai/local/litert-telemetry.ts", "utf8"),
  readFile("components/admin/EduAILocalRuntimePanel.tsx", "utf8"),
  readFile("components/admin/LocalAIModelMetricsPanel.tsx", "utf8"),
]);

assert.match(telemetry, /completionTokens\?: number/);
assert.match(telemetry, /tokensPerSecond\?: number/);
assert.match(panel, /recordLocalAIEvent/);
assert.match(panel, /kind: "inference"/);
assert.match(panel, /kind: "benchmark"/);
assert.match(panel, /tokensPerSecond: result\.tokensPerSecond/);
assert.match(panel, /tokensPerSecond: avgTps/);
assert.match(panel, /backend: mode === "cpu" \|\| hardware\?\.webgpu === false \? "wasm" : undefined/);
assert.doesNotMatch(panel, /backend: "webgpu"/);
assert.match(metrics, /medianTokensPerSecond/);
assert.match(metrics, /tok\/s/);

console.log("EDUAI wllama telemetry: OK");
