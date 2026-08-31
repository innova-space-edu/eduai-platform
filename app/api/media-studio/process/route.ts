import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATIONS = new Set(["proxy", "denoise", "normalize", "stems", "extract_audio"]);
const BUCKET = "media-studio";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: job, error } = await supabase
    .from("media_processing_jobs")
    .select("id,project_id,asset_id,operation,status,progress,input_storage_path,output_storage_paths,parameters,error_message,created_at,started_at,completed_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });

  const outputs = Array.isArray(job.output_storage_paths) ? job.output_storage_paths : [];
  const signedOutputs: Array<{ path: string; url?: string }> = [];
  for (const raw of outputs) {
    const path = typeof raw === "string" ? raw : String(raw?.path || "");
    if (!path) continue;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    signedOutputs.push({ path, ...(data?.signedUrl ? { url: data.signedUrl } : {}) });
  }

  return NextResponse.json({ ok: true, job: { ...job, signedOutputs } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    assetId?: string;
    operation?: string;
    projectId?: string;
    parameters?: Record<string, unknown>;
  } | null;

  const assetId = String(body?.assetId || "").trim();
  const operation = String(body?.operation || "").trim().toLowerCase();
  if (!assetId) return NextResponse.json({ error: "Falta assetId" }, { status: 400 });
  if (!OPERATIONS.has(operation)) return NextResponse.json({ error: "Operación no soportada" }, { status: 400 });

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id,project_id,asset_type,name,storage_path,mime_type,duration_seconds,metadata")
    .eq("id", assetId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "Asset no encontrado" }, { status: 404 });
  if (!asset.storage_path) return NextResponse.json({ error: "Guarda primero el recurso en EDUAI antes de procesarlo" }, { status: 400 });

  const audioOnly = new Set(["denoise", "normalize", "stems"]);
  if (audioOnly.has(operation) && !["audio", "music", "sfx", "video"].includes(asset.asset_type)) {
    return NextResponse.json({ error: "Esta operación requiere audio o video" }, { status: 400 });
  }

  const { data: job, error } = await supabase.from("media_processing_jobs").insert({
    user_id: user.id,
    project_id: body?.projectId || asset.project_id || null,
    asset_id: asset.id,
    operation,
    status: "queued",
    progress: 0,
    input_storage_path: asset.storage_path,
    parameters: {
      ...(body?.parameters || {}),
      inputName: asset.name,
      inputType: asset.asset_type,
      inputMime: asset.mime_type,
      duration: asset.duration_seconds,
    },
  }).select("id,status,operation,created_at").single();

  if (error || !job) return NextResponse.json({ error: error?.message || "No se pudo crear el trabajo" }, { status: 500 });

  const workerUrl = (process.env.MEDIA_PROCESS_WORKER_URL || process.env.MEDIA_RENDER_WORKER_URL || "").trim();
  if (workerUrl) {
    try {
      await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MEDIA_RENDER_WORKER_SECRET ? { Authorization: `Bearer ${process.env.MEDIA_RENDER_WORKER_SECRET}` } : {}),
        },
        body: JSON.stringify({ kind: "processing", jobId: job.id }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Permanece queued. Un worker con polling puede recogerlo después.
    }
  }

  return NextResponse.json({ ok: true, ...job }, { status: 202 });
}
