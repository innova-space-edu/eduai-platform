import assert from "node:assert/strict";
import { upsertEduAILocalCandidate } from "../lib/ai/local/eduai-local-candidates";

const base = {
  source: "catalog" as const,
  qualityThreshold: 80,
  criticalFailures: [],
  promotionGatePassed: true,
  ramGB: 8,
  vramGB: 4,
  webgpu: true,
};

const first = {
  ...base,
  modelId: "a",
  label: "A",
  qualityScore: 85,
  createdAt: "2026-09-21T10:00:00.000Z",
};
const newer = {
  ...base,
  modelId: "a",
  label: "A v2",
  qualityScore: 90,
  createdAt: "2026-09-21T11:00:00.000Z",
};
const other = {
  ...base,
  modelId: "b",
  label: "B",
  qualityScore: 82,
  createdAt: "2026-09-21T10:30:00.000Z",
};

const result = upsertEduAILocalCandidate([first, other], newer);
assert.equal(result.length, 2);
assert.equal(result[0].modelId, "a");
assert.equal(result[0].qualityScore, 90);
assert.equal(result[1].modelId, "b");

console.log("EDUAI local candidate registry: OK");
