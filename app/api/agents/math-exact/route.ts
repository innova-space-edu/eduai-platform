import { createClient } from "@/lib/supabase/server";
import { solveExactMath, formatExactMath, type ExactInput } from "@/lib/math/exact-solver";
import { solveViaSympy } from "@/lib/math/sympy-client";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return Response.json({ error: "Solicitud demasiado grande" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Se requiere un objeto JSON" }, { status: 400 });
  }
  const input = body as ExactInput;
  const local = solveExactMath(input);
  const result = local.verified ? local : await solveViaSympy(input);
  if (!result.verified) {
    return Response.json({ verified: false, supported: false, reason: result.reason || local.reason },
      { status: 422 });
  }
  return Response.json({ ...result, text: formatExactMath(result), productionReady: false });
}
