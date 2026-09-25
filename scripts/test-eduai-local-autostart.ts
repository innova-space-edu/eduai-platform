import assert from "node:assert/strict";
import { chooseEduAILocalAutostartModel } from "../lib/ai/local/eduai-local-autostart";

const cache = (...ids: string[]) =>
  ids.map((catalogModelId) => ({ catalogModelId, status: "valid" }));

assert.equal(
  chooseEduAILocalAutostartModel(
    cache("eduai-local-qwen35-08b", "eduai-local-lfm26-qad"),
    { memoryGB: 8, vramGB: 0, webgpu: false, cores: 4 },
    "eduai-local-lfm26-qad",
  ),
  "eduai-local-qwen35-08b",
);

assert.equal(
  chooseEduAILocalAutostartModel(
    cache("eduai-local-lfm12-qad", "eduai-local-lfm26-qad"),
    { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
    null,
  ),
  "eduai-local-lfm26-qad",
);

assert.equal(
  chooseEduAILocalAutostartModel(
    cache("eduai-local-lfm12-qad", "eduai-local-lfm26-qad"),
    { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
    "eduai-local-lfm12-qad",
  ),
  "eduai-local-lfm12-qad",
);

assert.equal(
  chooseEduAILocalAutostartModel(
    [{ catalogModelId: "eduai-router-functiongemma-270m", status: "valid" }],
    { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
    null,
  ),
  null,
);

assert.equal(
  chooseEduAILocalAutostartModel(
    [{ catalogModelId: "eduai-local-qwen35-08b", status: "invalid" }],
    { memoryGB: 8, vramGB: 0, webgpu: false, cores: 4 },
    null,
  ),
  null,
);

console.log("EDUAI local autostart selection: OK");
