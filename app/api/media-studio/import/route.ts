import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MediaAsset, MediaAssetType, MediaStudioProject } from "@/lib/media-studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 200 * 1024 * 1024;
const BUCKET = "media-studio";
const ALLOWED_SOURCES = new Set(["pexels", "pixabay", "freesound", "jamendo", "generated"]);
const ALLOWED_TYPES = new Set<MediaAssetType>(["video", "audio", "image", "music", "sfx"]);
const ALLOWED_HOST_SUFFIXES = [
  "pexels.com",
  "pixabay.com",
  "freesound.org",
  "jamendo.com",
  "jamendoassets.com",
  "storage.jamendo.com",
  "googleusercontent.com",
  "supabase.co",
];

function isAllowedUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function extensionFrom(type: string, url: string) {
  const mimeMap: Record<string, string> = {
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/mp4": "m4a",
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  if (mimeMap[type]) return mimeMap[type];
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {}
  return "bin";
}

function safeName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 90) || "asset";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null) as { asset?: MediaAsset; project?: MediaStudioProject } | null;
  const asset = body?.asset;
  const project = body?.project;
  if (!asset?.url || !asset.name || !ALLOWED_TYPES.has(asset.type)) return NextResponse.json({ error: "Asset inválido" }, { status: 400 });
  if (!ALLOWED_SOURCES.has(asset.source)) return NextResponse.json({ error: "Fuente no permitida para importación automática" }, { status: 400 });
  if (!isAllowedUrl(asset.url)) return NextResponse.json({ error: "Host externo no permitido" }, { status: 400 });

  if (project?.id) {
    await supabase.from("media_projects").upsert({
      id: project.id,
      user_id: user.id,
      name: project.name,
      aspect_ratio: project.aspectRatio,
      width: project.width,
      height: project.height,
      fps: project.fps,
      duration_seconds: project.duration,
      timeline_json: project,
      updated_at: new Date().toISOString(),
    });
  }

  const response = await fetch(asset.url, { redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (!response.ok || !response.body) return NextResponse.json({ error: `No se pudo descargar el recurso (${response.status})` }, { status: 502 });
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "El recurso supera 200 MB" }, { status: 413 });

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) return NextResponse.json({ error: "El recurso supera 200 MB" }, { status: 413 });
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || asset.mimeType || "application/octet-stream";
  const ext = extensionFrom(contentType, asset.url);
  const projectId = project?.id || "library";
  const path = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeName(asset.name)}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "3600" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: signedError?.message || "No se pudo firmar el archivo" }, { status: 500 });

  const { data: row, error: rowError } = await supabase.from("media_assets").insert({
    user_id: user.id,
    project_id: project?.id || null,
    asset_type: asset.type,
    name: asset.name,
    source: asset.source,
    provider: asset.provider || asset.source,
    storage_path: path,
    remote_url: asset.url,
    thumbnail_url: asset.thumbnailUrl || null,
    mime_type: contentType,
    duration_seconds: asset.duration || null,
    width: asset.width || null,
    height: asset.height || null,
    license: asset.license || null,
    attribution: asset.attribution || null,
    external_url: asset.externalUrl || null,
    metadata: { imported: true, originalId: asset.id, originalUrl: asset.url, bytes: total },
  }).select("id").single();
  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });

  const saved: MediaAsset = {
    ...asset,
    id: String(row.id),
    url: signed.signedUrl,
    storagePath: path,
    mimeType: contentType,
    source: "eduai",
    provider: asset.provider ? `${asset.provider} · guardado en EDUAI` : "Nube EDUAI",
  };
  return NextResponse.json({ ok: true, asset: saved });
}
