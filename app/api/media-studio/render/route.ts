import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MediaStudioProject } from "@/lib/media-studio/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORMATS = new Set(["mp4", "mp3", "wav", "webm"]);
const RESOLUTIONS = new Set(["720p", "1080p", "4k", "audio"]);
const BUCKET = "media-studio";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data, error } = await supabase
    .from("media_exports")
    .select("id,project_id,format,resolution,status,storage_path,error_message,metadata,created_at,completed_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Render no encontrado" }, { status: 404 });

  let downloadUrl: string | null = null;
  if (data.status === "done" && data.storage_path) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(data.storage_path, 60 * 60 * 24);
    downloadUrl = signed?.signedUrl || null;
  }
  return NextResponse.json({ ok: true, job: { ...data, downloadUrl } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    project?: MediaStudioProject;
    format?: string;
    resolution?: string;
    masterPath?: string;
  } | null;
  const project = body?.project;
  const format = String(body?.format || "").toLowerCase();
  const resolution = String(body?.resolution || (format === "mp4" ? "1080p" : "audio")).toLowerCase();
  const masterPath = String(body?.masterPath || "").trim();
  if (!project?.id || !Array.isArray(project.tracks)) return NextResponse.json({ error: "Proyecto inválido" }, { status: 400 });
  if (!FORMATS.has(format)) return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
  if (!RESOLUTIONS.has(resolution)) return NextResponse.json({ error: "Resolución no soportada" }, { status: 400 });
  if (!masterPath || !masterPath.startsWith(`${user.id}/`)) return NextResponse.json({ error: "Falta masterPath privado del usuario" }, { status: 400 });

  const { error: projectError } = await supabase.from("media_projects").upsert({
    id: project.id,
    user_id: user.id,
    name: project.name || "Proyecto sin título",
    aspect_ratio: project.aspectRatio || "16:9",
    width: project.width || 1920,
    height: project.height || 1080,
    fps: project.fps || 30,
    duration_seconds: project.duration || 0,
    timeline_json: project,
    updated_at: new Date().toISOString(),
  });
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });

  const { data: job, error } = await supabase.from("media_exports").insert({
    user_id: user.id,
    project_id: project.id,
    format,
    resolution,
    status: "queued",
    metadata: {
      requestedFrom: "media-studio",
      aspectRatio: project.aspectRatio,
      width: project.width,
      height: project.height,
      fps: project.fps,
      duration: project.duration,
      renderer: "ffmpeg-worker",
      sourcePath: masterPath,
    },
  }).select("id,status,format,resolution,created_at").single();

  if (error || !job) return NextResponse.json({ error: error?.message || "No se pudo crear el render" }, { status: 500 });

  const workerUrl = process.env.MEDIA_RENDER_WORKER_URL?.trim();
  if (workerUrl) {
    try {
      await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MEDIA_RENDER_WORKER_SECRET ? { Authorization: `Bearer ${process.env.MEDIA_RENDER_WORKER_SECRET}` } : {}),
        },
        body: JSON.stringify({ kind: "export", exportId: job.id, projectId: project.id }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // El job queda queued: un worker con polling puede recogerlo después.
    }
  }

  return NextResponse.json({ ok: true, ...job, workerConfigured: Boolean(workerUrl) }, { status: 202 });
}
