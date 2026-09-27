import {
  EDUAI_LOCAL_MODELS,
  evaluateEduAILocalModel,
  type EduAIHardwareProfile,
} from "./eduai-local-models";
import type { EduAILocalCandidate } from "./eduai-local-candidates";

export type EduAILocalBenchmarkRecord = {
  modelId: string;
  avgLatencyMs: number;
  avgTps: number | null;
  totalTokens: number;
  ramGB: number | null;
  vramGB: number | null;
  webgpu: boolean;
  runtimeMode?: "auto" | "cpu";
  createdAt: string;
};

export type EduAILocalEvidencePick = {
  modelId: string;
  label: string;
  qualityScore: number;
  tokensPerSecond: number | null;
  avgLatencyMs: number | null;
  evidenceAt: string;
};

export type EduAILocalEvidenceRecommendations = {
  quality: EduAILocalEvidencePick | null;
  speed: EduAILocalEvidencePick | null;
  evaluatedModels: number;
};

const BENCHMARK_PREFIX = "eduai-local-benchmark:";

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type HardwareEvidence = {
  ramGB: number | null;
  vramGB: number | null;
  webgpu: boolean;
  runtimeMode?: "auto" | "cpu";
};

function hardwareSnapshotMatchesProfile(
  snapshot: HardwareEvidence,
  profile: EduAIHardwareProfile,
) {
  if (snapshot.webgpu !== profile.webgpu) return false;
  if (
    snapshot.ramGB !== null &&
    profile.memoryGB !== null &&
    Math.abs(snapshot.ramGB - profile.memoryGB) > 4
  ) return false;
  if (
    snapshot.vramGB !== null &&
    profile.vramGB !== null &&
    Math.abs(snapshot.vramGB - profile.vramGB) > 2
  ) return false;
  return true;
}

export function hardwareEvidenceMatches(
  candidate: HardwareEvidence,
  benchmark: HardwareEvidence,
) {
  if (candidate.webgpu !== benchmark.webgpu) return false;
  if (
    candidate.runtimeMode &&
    benchmark.runtimeMode &&
    candidate.runtimeMode !== benchmark.runtimeMode
  ) return false;
  if (
    candidate.ramGB !== null &&
    benchmark.ramGB !== null &&
    Math.abs(candidate.ramGB - benchmark.ramGB) > 4
  ) return false;
  if (
    candidate.vramGB !== null &&
    benchmark.vramGB !== null &&
    Math.abs(candidate.vramGB - benchmark.vramGB) > 2
  ) return false;
  return true;
}

export function recommendEduAILocalFromEvidence(
  candidates: EduAILocalCandidate[],
  benchmarks: EduAILocalBenchmarkRecord[],
  profile: EduAIHardwareProfile,
): EduAILocalEvidenceRecommendations {
  const benchmarkByModel = new Map<string, EduAILocalBenchmarkRecord>();
  for (const item of [...benchmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!benchmarkByModel.has(item.modelId)) benchmarkByModel.set(item.modelId, item);
  }

  const rows: EduAILocalEvidencePick[] = [];
  for (const candidate of candidates) {
    if (!candidate.promotionGatePassed || candidate.criticalFailures.length) continue;
    if (candidate.source !== "catalog") continue;

    const model = EDUAI_LOCAL_MODELS.find((item) => item.id === candidate.modelId);
    if (!model || model.role === "router") continue;
    if (evaluateEduAILocalModel(model, profile) === "avoid") continue;
    if (!hardwareSnapshotMatchesProfile(candidate, profile)) continue;

    const benchmark = benchmarkByModel.get(candidate.modelId);
    if (
      benchmark &&
      (
        !hardwareEvidenceMatches(candidate, benchmark) ||
        !hardwareSnapshotMatchesProfile(benchmark, profile)
      )
    ) continue;

    rows.push({
      modelId: candidate.modelId,
      label: candidate.label,
      qualityScore: candidate.qualityScore,
      tokensPerSecond: benchmark?.avgTps ?? null,
      avgLatencyMs: benchmark?.avgLatencyMs ?? null,
      evidenceAt: [candidate.createdAt, benchmark?.createdAt || ""].sort().at(-1) || candidate.createdAt,
    });
  }

  const quality =
    [...rows].sort(
      (a, b) =>
        b.qualityScore - a.qualityScore ||
        (b.tokensPerSecond ?? -1) - (a.tokensPerSecond ?? -1),
    )[0] || null;

  const speed =
    [...rows]
      .filter(
        (item) =>
          typeof item.tokensPerSecond === "number" &&
          Number.isFinite(item.tokensPerSecond) &&
          item.tokensPerSecond > 0,
      )
      .sort(
        (a, b) =>
          (b.tokensPerSecond ?? 0) - (a.tokensPerSecond ?? 0) ||
          b.qualityScore - a.qualityScore,
      )[0] || null;

  return { quality, speed, evaluatedModels: rows.length };
}

export function readEduAILocalBenchmarks(): EduAILocalBenchmarkRecord[] {
  if (typeof window === "undefined") return [];
  const output: EduAILocalBenchmarkRecord[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(BENCHMARK_PREFIX)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const modelId =
        typeof parsed.modelId === "string"
          ? parsed.modelId
          : key.slice(BENCHMARK_PREFIX.length);
      const avgLatencyMs = numberOrNull(parsed.avgLatencyMs);
      if (!modelId || avgLatencyMs === null) continue;

      output.push({
        modelId,
        avgLatencyMs,
        avgTps: numberOrNull(parsed.avgTps),
        totalTokens: numberOrNull(parsed.totalTokens) ?? 0,
        ramGB: numberOrNull(parsed.ramGB),
        vramGB: numberOrNull(parsed.vramGB),
        webgpu: parsed.webgpu === true,
        runtimeMode:
          parsed.runtimeMode === "cpu" || parsed.runtimeMode === "auto"
            ? parsed.runtimeMode
            : undefined,
        createdAt:
          typeof parsed.createdAt === "string"
            ? parsed.createdAt
            : "1970-01-01T00:00:00.000Z",
      });
    }
  } catch {
    return [];
  }

  return output.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
