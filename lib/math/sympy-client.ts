import type { ExactInput, ExactResult } from "./exact-solver";

const SYMPY_OPERATIONS = new Set(["quadratic", "polynomial_derivative", "polynomial_integral", "linear_system3", "binomial_exact"]);

/** Backend-to-backend only; the client can never select a URL or send arbitrary code. */
export async function solveViaSympy(input: ExactInput): Promise<ExactResult> {
  if (!SYMPY_OPERATIONS.has(String(input.operation || ""))) {
    return { supported: false, verified: false, reason: "UNSUPPORTED_OPERATION" };
  }
  const raw = process.env.EDUAI_MATH_ENGINE_URL;
  const token = process.env.EDUAI_MATH_ENGINE_TOKEN;
  if (!raw || !token) return { supported: false, verified: false, reason: "SYMPY_NOT_CONFIGURED" };
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
      return { supported: false, verified: false, reason: "MATH_ENGINE_REQUIRES_HTTPS" };
    }
    url.pathname = "/solve";
    url.search = "";
    url.hash = "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) return { supported: false, verified: false, reason: "SYMPY_HTTP_" + response.status };
      const value: unknown = await response.json();
      if (!value || typeof value !== "object") throw new Error("INVALID_RESPONSE");
      const item = value as Record<string, unknown>;
      if (item.supported !== true || item.verified !== true || typeof item.answer !== "string" || item.answer.length > 4096
        || !Array.isArray(item.steps) || item.steps.some((s) => typeof s !== "string" || s.length > 4096)) {
        return { supported: false, verified: false, reason: "SYMPY_UNVERIFIED" };
      }
      return { supported: true, verified: true, operation: String(input.operation), engine: "sympy" as never,
        answer: item.answer, steps: item.steps as string[] };
    } finally { clearTimeout(timer); }
  } catch {
    return { supported: false, verified: false, reason: "SYMPY_UNAVAILABLE" };
  }
}
