import assert from "node:assert/strict";
import { recommendEduAILocalFromEvidence } from "../lib/ai/local/eduai-local-evidence";
import type { EduAILocalCandidate } from "../lib/ai/local/eduai-local-candidates";

const base = {
  source: "catalog" as const,
  qualityThreshold: 80,
  criticalFailures: [],
  promotionGatePassed: true,
  ramGB: 8,
  vramGB: 4,
  webgpu: true,
  runtimeMode: "auto" as const,
  createdAt: "2026-09-21T10:00:00.000Z",
};

const candidates: EduAILocalCandidate[] = [
  { ...base, modelId: "eduai-local-lfm12-qad", label: "LFM 1.2B", qualityScore: 92 },
  { ...base, modelId: "eduai-local-lfm26-qad", label: "LFM 2.6B", qualityScore: 96 },
];

const benchmarks = [
  {
    modelId: "eduai-local-lfm12-qad",
    avgLatencyMs: 900,
    avgTps: 18,
    totalTokens: 120,
    ramGB: 8,
    vramGB: 4,
    webgpu: true,
    runtimeMode: "auto" as const,
    createdAt: "2026-09-21T11:00:00.000Z",
  },
  {
    modelId: "eduai-local-lfm26-qad",
    avgLatencyMs: 1600,
    avgTps: 10,
    totalTokens: 120,
    ramGB: 8,
    vramGB: 4,
    webgpu: true,
    runtimeMode: "auto" as const,
    createdAt: "2026-09-21T11:05:00.000Z",
  },
];

const result = recommendEduAILocalFromEvidence(
  candidates,
  [
    ...benchmarks,
    {
      ...benchmarks[0],
      avgTps: 2,
      createdAt: "2026-09-21T09:00:00.000Z",
    },
  ],
  { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
);

assert.equal(result.evaluatedModels, 2);
assert.equal(result.quality?.modelId, "eduai-local-lfm26-qad");
assert.equal(result.speed?.modelId, "eduai-local-lfm12-qad");
assert.equal(result.speed?.tokensPerSecond, 18);

const wrongHardware = recommendEduAILocalFromEvidence(
  candidates,
  benchmarks.map((item) => ({ ...item, vramGB: 12 })),
  { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
);
assert.equal(wrongHardware.evaluatedModels, 0);

const wrongProfile = recommendEduAILocalFromEvidence(
  candidates,
  benchmarks,
  { memoryGB: 16, vramGB: 12, webgpu: true, cores: 16 },
);
assert.equal(wrongProfile.evaluatedModels, 0);

const wrongRoute = recommendEduAILocalFromEvidence(
  candidates,
  benchmarks.map((item) => ({ ...item, runtimeMode: "cpu" as const })),
  { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
);
assert.equal(wrongRoute.evaluatedModels, 0);

console.log("EDUAI local evidence recommendation: OK");
