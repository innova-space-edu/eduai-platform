import {
  EDUAI_LOCAL_MODELS,
  evaluateEduAILocalModel,
  type EduAIHardwareProfile,
  type EduAIModelFit,
} from "./eduai-local-models";

export type EduAILocalAutostartCacheEntry = {
  catalogModelId: string | null;
  status: string;
};

const FIT_RANK: Record<EduAIModelFit, number> = {
  recommended: 0,
  compatible: 1,
  heavy: 2,
  avoid: 3,
};

export function chooseEduAILocalAutostartModel(
  cached: EduAILocalAutostartCacheEntry[],
  profile: EduAIHardwareProfile,
  preferredModelId?: string | null,
) {
  const validIds = new Set(
    cached
      .filter((entry) => entry.status === "valid" && entry.catalogModelId)
      .map((entry) => entry.catalogModelId as string),
  );

  const eligible = EDUAI_LOCAL_MODELS
    .filter((model) => model.role !== "router")
    .filter((model) => validIds.has(model.id))
    .map((model) => ({
      model,
      fit: evaluateEduAILocalModel(model, profile),
    }))
    .filter((entry) => entry.fit !== "avoid");

  if (!eligible.length) return null;

  const preferred = preferredModelId
    ? eligible.find((entry) => entry.model.id === preferredModelId)
    : null;
  if (preferred && preferred.fit !== "heavy") return preferred.model.id;

  eligible.sort((left, right) => {
    const fitDelta = FIT_RANK[left.fit] - FIT_RANK[right.fit];
    if (fitDelta !== 0) return fitDelta;
    return right.model.sizeMB - left.model.sizeMB;
  });

  return eligible[0]?.model.id || null;
}
