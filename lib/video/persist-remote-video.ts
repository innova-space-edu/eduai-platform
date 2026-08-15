import { createClient as createAdmin } from "@supabase/supabase-js"

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function persistRemoteVideo(input: {
  remoteUrl: string
  userId: string
  provider: string
  model?: string | null
  prompt: string
  sourceJobId?: string | null
  metadata?: Record<string, unknown>
}) {
  const response = await fetch(input.remoteUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) {
    throw new Error(`No se pudo descargar el video de ${input.provider}: HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error(`${input.provider} devolvió un video vacío`)
  if (buffer.byteLength > 500 * 1024 * 1024) {
    throw new Error("El video supera el límite de almacenamiento de EduAI")
  }

  const supabase = getAdminSupabase()
  const path = `${input.userId}/video/${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  const { error: uploadError } = await supabase.storage
    .from("eduai-assets")
    .upload(path, buffer, { contentType: "video/mp4", upsert: false })
  if (uploadError) throw new Error(`No se pudo guardar el video en EduAI: ${uploadError.message}`)

  const { data: asset, error: assetError } = await supabase
    .from("eduai_assets")
    .insert({
      owner_id: input.userId,
      asset_type: "video",
      title: input.prompt.slice(0, 180),
      mime_type: "video/mp4",
      storage_bucket: "eduai-assets",
      storage_path: path,
      source_module: "video-studio",
      source_id: input.sourceJobId || null,
      visibility: "private",
      metadata: {
        provider: input.provider,
        model: input.model || null,
        ...input.metadata,
      },
    })
    .select("id")
    .maybeSingle()

  if (assetError) console.warn("[Video][Asset]", assetError.message)

  return {
    assetId: asset?.id || null,
    storagePath: path,
    videoUrl: `supabase://eduai-assets/${path}`,
  }
}
