import type { SupabaseClient } from "@supabase/supabase-js"

export async function resolveOwnedImageAssetId(input: {
  supabase: SupabaseClient
  userId: string
  imageAssetId?: string | null
}) {
  const requested = input.imageAssetId?.trim() || null
  if (!requested) return null

  const { data, error } = await input.supabase
    .from("eduai_assets")
    .select("id")
    .eq("id", requested)
    .eq("owner_id", input.userId)
    .eq("asset_type", "image")
    .maybeSingle()

  if (error) throw new Error(`No se pudo validar la imagen reutilizable: ${error.message}`)
  return data?.id ? String(data.id) : null
}

export function stableImageFingerprintIdentity(input: {
  imageAssetId?: string | null
  imageUrl?: string | null
}) {
  const assetId = input.imageAssetId?.trim()
  if (assetId) return `asset:${assetId}`
  return input.imageUrl?.trim() || null
}
