import { NextResponse } from "next/server";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";
import { MODEL_LAB_CATALOG } from "@/lib/ai/model-lab-catalog";
import { MODEL_LAB_PROVIDERS } from "@/lib/ai/model-lab-providers";

export async function GET() {
  const access = await getModelLabAccess();

  if (access.status !== "ok") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  return NextResponse.json({
    models: MODEL_LAB_CATALOG,
    providers: MODEL_LAB_PROVIDERS,
  });
}
