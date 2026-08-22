import type { SupabaseClient } from "@supabase/supabase-js"

const VIDEO_INPUT_BUCKET = "video-inputs"

export type TrustedImageInputResult =
  | {
      ok: true
      imageUrl: string | null
      imageAssetId: string | null
      identity: string | null
    }
  | {
      ok: false
      error: string
      code: "IMAGE_ASSET_INVALID" | "IMAGE_URL_UNTRUSTED" | "IMAGE_URL_UNAVAILABLE"
    }

function configuredSupabaseOrigin() {
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function parseOwnedVideoInputPath(value: string, userId: string) {
  const expectedOrigin = configuredSupabaseOrigin()
  if (!expectedOrigin) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.origin !== expectedOrigin) return null

  const prefixes = [
    `/storage/v1/object/sign/${VIDEO_INPUT_BUCKET}/`,
    `/storage/v1/object/authenticated/${VIDEO_INPUT_BUCKET}/`,
  ]
  const prefix = prefixes.find((candidate) => url.pathname.startsWith(candidate))
  if (!prefix) return null

  let storagePath: string
  try {
    storagePath = decodeURIComponent(url.pathname.slice(prefix.length))
  } catch {
    return null
  }

  if (!storagePath.startsWith(`${userId}/`)) return null
  if (storagePath.includes("..") || storagePath.includes("\\")) return null
  if (storagePath.length > 700) return null
  return storagePath
}

export async function resolveTrustedImageInput(input: {
  supabase: SupabaseClient
  userId: string
  imageUrl?: string | null
  imageAssetId?: string | null
}): Promise<TrustedImageInputResult> {
  const requestedAssetId = input.imageAssetId?.trim() || null

  if (requestedAssetId) {
    const { data, error } = await input.supabase
      .from("eduai_assets")
      .select("id,storage_bucket,storage_path")
      .eq("id", requestedAssetId)
      .eq("owner_id", input.userId)
      .eq("asset_type", "image")
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      return { ok: false, error: `No se pudo validar la imagen reutilizable: ${error.message}`, code: "IMAGE_ASSET_INVALID" }
    }
    if (!data?.id || !data.storage_bucket || !data.storage_path) {
      return {
        ok: false,
        error: "La imagen reutilizable no pertenece a esta cuenta, ya no existe o no está almacenada de forma privada en EduAI.",
        code: "IMAGE_ASSET_INVALID",
      }
    }

    const { data: signed, error: signedError } = await input.supabase.storage
      .from(String(data.storage_bucket))
      .createSignedUrl(String(data.storage_path), 60 * 30)

    if (signedError || !signed?.signedUrl) {
      return { ok: false, error: "No se pudo preparar la imagen reutilizable de forma segura.", code: "IMAGE_URL_UNAVAILABLE" }
    }

    return {
      ok: true,
      imageUrl: signed.signedUrl,
      imageAssetId: String(data.id),
      identity: `asset:${data.id}`,
    }
  }

  const requestedUrl = input.imageUrl?.trim() || null
  if (!requestedUrl) {
    return { ok: true, imageUrl: null, imageAssetId: null, identity: null }
  }

  const storagePath = parseOwnedVideoInputPath(requestedUrl, input.userId)
  if (!storagePath) {
    return {
      ok: false,
      error: "La imagen base debe provenir de una subida privada de Video Studio o de Recursos IA de esta cuenta.",
      code: "IMAGE_URL_UNTRUSTED",
    }
  }

  const { data: signed, error } = await input.supabase.storage
    .from(VIDEO_INPUT_BUCKET)
    .createSignedUrl(storagePath, 60 * 30)

  if (error || !signed?.signedUrl) {
    return { ok: false, error: "La imagen base ya no está disponible o no pertenece a esta cuenta.", code: "IMAGE_URL_UNAVAILABLE" }
  }

  return {
    ok: true,
    imageUrl: signed.signedUrl,
    imageAssetId: null,
    identity: `storage:${VIDEO_INPUT_BUCKET}:${storagePath}`,
  }
}
