// Admin-only Nano/Lite experiment catalog. R5 is intentionally locked pending review.
export type LabModelId = "nano-r2" | "lite-r2" | "nano-r5" | "lite-r5";
export type LabVersion = "r2" | "r5";
export const LAB_MODELS = [
  { id: "nano-r2", name: "EDUAI Nano", version: "R2", parameters: "350M", base: "LiquidAI/LFM2.5-350M" },
  { id: "lite-r2", name: "EDUAI Lite", version: "R2", parameters: "1.2B", base: "LiquidAI/LFM2.5-1.2B-Instruct" },
  { id: "nano-r5", name: "EDUAI Nano", version: "R5", parameters: "350M", base: "LiquidAI/LFM2.5-350M" },
  { id: "lite-r5", name: "EDUAI Lite", version: "R5", parameters: "1.2B", base: "LiquidAI/LFM2.5-1.2B-Instruct" },
] as const;
export const LAB_MODEL_IDS = new Set<string>(LAB_MODELS.map(x => x.id));
export const LAB_R5_ENABLED = () => process.env.EDUAI_MODEL_LAB_R5_APPROVED === "true";
export function selectLabModels(selection: unknown, version: unknown): LabModelId[] {
  const safeVersion: LabVersion = version === "r5" ? "r5" : "r2";
  if (safeVersion === "r5" && !LAB_R5_ENABLED()) throw new Error("R5_NOT_APPROVED");
  if (selection === "nano") return [("nano-" + safeVersion) as LabModelId];
  if (selection === "lite") return [("lite-" + safeVersion) as LabModelId];
  if (selection === "compare") return [("nano-" + safeVersion) as LabModelId, ("lite-" + safeVersion) as LabModelId];
  throw new Error("INVALID_MODEL_SELECTION");
}
