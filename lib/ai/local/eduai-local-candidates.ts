export type EduAILocalCandidate = {
  modelId: string;
  label: string;
  source: "catalog" | "custom-gguf";
  qualityScore: number;
  qualityThreshold: number;
  criticalFailures: string[];
  promotionGatePassed: boolean;
  ramGB: number | null;
  vramGB: number | null;
  webgpu: boolean;
  createdAt: string;
};

const STORAGE_KEY = "eduai-local-candidates-v1";

export function upsertEduAILocalCandidate(
  current: EduAILocalCandidate[],
  candidate: EduAILocalCandidate,
) {
  return [
    candidate,
    ...current.filter((item) => item.modelId !== candidate.modelId),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
}

export function readEduAILocalCandidates(): EduAILocalCandidate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is EduAILocalCandidate =>
        item &&
        typeof item.modelId === "string" &&
        typeof item.qualityScore === "number" &&
        typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function saveEduAILocalCandidate(candidate: EduAILocalCandidate) {
  if (typeof window === "undefined") return;
  try {
    const next = upsertEduAILocalCandidate(readEduAILocalCandidates(), candidate);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("eduai-local-candidates-changed"));
  } catch {
    // Registro opcional: una cuota llena no debe invalidar el Quality Gate.
  }
}

export function clearEduAILocalCandidates() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("eduai-local-candidates-changed"));
  } catch {
    // Sin efecto si el navegador bloquea localStorage.
  }
}
