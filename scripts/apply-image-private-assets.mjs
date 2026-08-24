import fs from "node:fs"
import path from "node:path"

const routePath = path.join(process.cwd(), "app/api/agents/imagenes/route.ts")
let source = fs.readFileSync(routePath, "utf8")
let changed = false

function replaceOnce(from, to, label) {
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[image-private-assets] marker not found: ${label}`)
  source = source.replace(from, to)
  changed = true
}

const adminImport = 'import { createClient as createAdmin } from "@supabase/supabase-js"\n'
if (source.includes(adminImport)) {
  source = source.replace(adminImport, "")
  changed = true
}

if (!source.includes("async function resolveReusableImageUrl(")) {
  const start = source.indexOf("async function uploadToStorage(")
  const end = source.indexOf("\nfunction detectComposition", start)
  if (start < 0 || end < 0) throw new Error("[image-private-assets] uploadToStorage markers not found")

  const replacement = `async function uploadToStorage(\n  supabase: Awaited<ReturnType<typeof createClient>>,\n  imageBase64: string,\n  userId: string\n): Promise<StoredImage | null> {\n  try {\n    const match = imageBase64.match(/^data:(image\\/[\\w.+-]+);base64,(.+)$/)\n    if (!match) return null\n\n    const mimeType = match[1]\n    const rawExt = mimeType.split("/")[1] || "png"\n    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "") || "png"\n    const buf = Buffer.from(match[2], "base64")\n    const storagePath = \`\${userId}/image/\${Date.now()}_\${Math.random().toString(36).slice(2)}.\${ext}\`\n\n    const { error } = await supabase.storage\n      .from("eduai-assets")\n      .upload(storagePath, buf, { contentType: mimeType, upsert: false })\n\n    if (error) {\n      console.warn("[Image][Storage]", error.message)\n      return null\n    }\n\n    const { data, error: signedError } = await supabase.storage\n      .from("eduai-assets")\n      .createSignedUrl(storagePath, 60 * 30)\n\n    if (signedError || !data?.signedUrl) {\n      console.warn("[Image][Storage] no se pudo firmar el asset privado:", signedError?.message || "sin URL")\n      await supabase.storage.from("eduai-assets").remove([storagePath]).catch(() => undefined)\n      return null\n    }\n\n    return { publicUrl: data.signedUrl, storagePath, mimeType }\n  } catch (error) {\n    console.error("[Image][Storage]", errMsg(error))\n    return null\n  }\n}\n\nasync function resolveReusableImageUrl(\n  supabase: Awaited<ReturnType<typeof createClient>>,\n  userId: string,\n  assetId: string | null | undefined,\n  fallback: string\n): Promise<string> {\n  if (!assetId) return fallback\n\n  const { data: asset, error } = await supabase\n    .from("eduai_assets")\n    .select("id,storage_bucket,storage_path")\n    .eq("id", assetId)\n    .eq("owner_id", userId)\n    .eq("asset_type", "image")\n    .is("deleted_at", null)\n    .maybeSingle()\n\n  if (error || !asset?.storage_bucket || !asset.storage_path) return fallback\n\n  const { data: signed, error: signedError } = await supabase.storage\n    .from(String(asset.storage_bucket))\n    .createSignedUrl(String(asset.storage_path), 60 * 30)\n\n  return signedError || !signed?.signedUrl ? fallback : signed.signedUrl\n}\n`

  source = source.slice(0, start) + replacement + source.slice(end)
  changed = true
}

replaceOnce(
  `  if (reusable && typeof reusable.result.imageUrl === "string") {\n    const requestId = await recordGenerationStart({`,
  `  if (reusable && typeof reusable.result.imageUrl === "string") {\n    const reusableImageUrl = await resolveReusableImageUrl(\n      supabase,\n      user.id,\n      reusable.assetId,\n      reusable.result.imageUrl\n    )\n    const requestId = await recordGenerationStart({`,
  "refresh signed reusable image URL",
)

replaceOnce(
  "        imageUrl: reusable.result.imageUrl,",
  "        imageUrl: reusableImageUrl,",
  "return fresh reusable image URL",
)

replaceOnce(
  "      stored = await uploadToStorage(imageBase64, user.id)",
  "      stored = await uploadToStorage(supabase, imageBase64, user.id)",
  "authenticated private upload",
)

replaceOnce(
  "      const permanentImageUrl = stored?.publicUrl ?? imageBase64",
  "      const legacyImageUrl = imageBase64",
  "preserve legacy data URL gallery",
)

replaceOnce(
  "        image_url: permanentImageUrl,",
  "        image_url: legacyImageUrl,",
  "legacy gallery image URL",
)

replaceOnce(
  '          storageBucket: "generated-images",',
  '          storageBucket: "eduai-assets",',
  "private asset bucket",
)

replaceOnce(
  "          externalUrl: stored.publicUrl,",
  "          externalUrl: null,",
  "do not persist expiring signed URL",
)

if (changed) {
  fs.writeFileSync(routePath, source)
  console.log("[image-private-assets] nuevas imágenes conectadas a eduai-assets privado")
} else {
  console.log("[image-private-assets] already applied")
}
