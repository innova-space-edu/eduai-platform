import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createEduAIAsset } from "@/lib/ai/reuse"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 500 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image", "video", "audio", "music", "document", "presentation", "dataset", "other"])

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function safeExt(mime: string) {
  const known: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "application/json": "json",
    "text/plain": "txt",
  }
  return known[mime] || (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin"
}

function normalizeRemoteUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const url = new URL(value.trim())
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error("Solo se permiten URLs HTTP/HTTPS")
  if (url.username || url.password) throw new Error("La URL no puede contener credenciales")
  return url.toString()
}

async function remoteBytes(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
    headers: { "User-Agent": "EduAI-Asset-Importer/1.0" },
  })
  if (!response.ok) throw new Error(`El recurso respondió HTTP ${response.status}`)
  const declared = Number(response.headers.get("content-length") || 0)
  if (declared > MAX_BYTES) throw new Error("El recurso supera 500 MB")
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error("El recurso está vacío")
  if (buffer.byteLength > MAX_BYTES) throw new Error("El recurso supera 500 MB")
  return {
    buffer,
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const remoteUrl = normalizeRemoteUrl(body.url)
  if (!remoteUrl) return Response.json({ error: "Debes indicar la URL del recurso existente" }, { status: 400 })

  const requestedType = String(body.asset_type || "other").toLowerCase()
  const assetType = ALLOWED_TYPES.has(requestedType) ? requestedType : "other"
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "Recurso EduAI"
  const sourceModule = typeof body.source_module === "string" ? body.source_module.trim().slice(0, 80) : "import"
  const sourceId = typeof body.source_id === "string" ? body.source_id.trim().slice(0, 240) : null

  try {
    const { buffer, mimeType } = await remoteBytes(remoteUrl)
    const contentHash = createHash("sha256").update(buffer).digest("hex")

    const { data: existing } = await supabase
      .from("eduai_assets")
      .select("id,title,storage_bucket,storage_path,external_url,mime_type,asset_type")
      .eq("owner_id", user.id)
      .eq("fingerprint", contentHash)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return Response.json({
        success: true,
        reused: true,
        generationAvoided: true,
        asset: existing,
      })
    }

    const admin = getAdmin()
    const ext = safeExt(mimeType)
    const storagePath = `${user.id}/import/${Date.now()}_${contentHash.slice(0, 16)}.${ext}`
    const { error: uploadError } = await admin.storage
      .from("eduai-assets")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false })
    if (uploadError) throw new Error(uploadError.message)

    const assetId = await createEduAIAsset(supabase, {
      ownerId: user.id,
      assetType,
      title,
      mimeType,
      storageBucket: "eduai-assets",
      storagePath,
      sourceModule,
      sourceId,
      fingerprint: contentHash,
      visibility: "private",
      metadata: {
        importedFrom: remoteUrl,
        contentHash,
        originalBytes: buffer.byteLength,
      },
      processingPurpose: "Conservar y reutilizar un recurso generado o incorporado por el usuario",
    })

    if (!assetId) throw new Error("No se pudo registrar el recurso en la Asset Library")

    const { data: signed } = await supabase.storage
      .from("eduai-assets")
      .createSignedUrl(storagePath, 60 * 30)

    return Response.json({
      success: true,
      reused: false,
      assetId,
      mimeType,
      accessUrl: signed?.signedUrl || null,
    }, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el recurso" },
      { status: 500 },
    )
  }
}
