/** Independent reference; never a claim that all of a model's reasoning is correct. */
export type LabExactVerification = {
  supported: boolean;
  verified: boolean;
  engine: "python-integer-subtraction-v1";
  answer?: string;
  steps?: string[];
  candidate?: string | null;
  candidateCorrect?: boolean | null;
  reason?: string;
};

export function parseExactVerification(value: unknown): LabExactVerification {
  if (!value || typeof value !== "object") throw new Error("INVALID_VERIFICATION");
  const v = value as Record<string, unknown>;
  if (v.engine !== "python-integer-subtraction-v1" || typeof v.supported !== "boolean" || typeof v.verified !== "boolean")
    throw new Error("INVALID_VERIFICATION");
  if (!v.supported && !v.verified)
    return {supported:false, verified:false, engine:v.engine, reason:typeof v.reason === "string" ? v.reason.slice(0,200) : "Formato no admitido."};
  const integer = (x:unknown): x is string => typeof x === "string" && /^[+-]?\d{1,15}$/.test(x);
  if (!v.supported || !v.verified || !integer(v.answer) || !Array.isArray(v.steps) ||
      v.steps.length > 8 || !v.steps.length || !v.steps.every(s=>typeof s === "string" && s.length < 400) ||
      !(v.candidate === null || integer(v.candidate)) ||
      !(v.candidate === null ? v.candidateCorrect === null : typeof v.candidateCorrect === "boolean"))
    throw new Error("INVALID_VERIFICATION");
  return {supported:true, verified:true, engine:v.engine, answer:v.answer, steps:v.steps as string[],
    candidate:v.candidate as string|null, candidateCorrect:v.candidateCorrect as boolean|null};
}
