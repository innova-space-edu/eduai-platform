import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MANIFEST_PATH = path.join(process.cwd(), "artifacts", "ai", "eduai-local-corpus-manifest.json");

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle();
  return data ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS });

  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    return NextResponse.json({
      available: true,
      manifest,
      factory: {
        baseModel: "LiquidAI/LFM2.5-350M",
        runtimeArtifact: "GGUF Q4_K_M",
        trainingMethod: "LoRA / QLoRA",
        knowledgeStrategy: "RAG del repositorio + fine-tuning de comportamiento",
        trainingLocation: "GPU externa; nunca en el notebook de 8 GB",
        inferenceTarget: "wllama · navegador · CPU/WASM o WebGPU",
      },
      safeguards: {
        adminOnly: true,
        productionRouterEnabled: false,
        studentDataIncluded: false,
        conversationsIncluded: false,
      },
    }, { headers: HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Corpus no disponible";
    return NextResponse.json({
      available: false,
      error: message,
      factory: {
        baseModel: "LiquidAI/LFM2.5-350M",
        trainingMethod: "LoRA / QLoRA",
        knowledgeStrategy: "RAG del repositorio + fine-tuning de comportamiento",
      },
    }, { status: 200, headers: HEADERS });
  }
}
