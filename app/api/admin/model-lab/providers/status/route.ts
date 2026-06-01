import { NextResponse } from "next/server";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export async function GET() {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  return NextResponse.json({
    providers: {
      fal: { configured: Boolean(process.env.FAL_KEY) },
      openrouter: { configured: Boolean(process.env.OPENROUTER_API_KEY) },
    },
  });
}
