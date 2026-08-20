import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const clientPath = path.join(root, "components/video/VideoStudioClient.tsx")
const marketplacePath = path.join(root, "components/video/PersonalAIMarketplace.tsx")
const freeRoutePath = path.join(root, "app/api/agents/video/route.ts")
const personalRoutePath = path.join(root, "app/api/agents/video/personal/route.ts")

for (const target of [clientPath, marketplacePath, freeRoutePath, personalRoutePath]) {
  if (!fs.existsSync(target)) throw new Error(`[video-stable-image] No se encontró ${target}`)
}

function patchFile(filePath, transform) {
  const original = fs.readFileSync(filePath, "utf8")
  const next = transform(original)
  if (next !== original) fs.writeFileSync(filePath, next)
  return next !== original
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`[video-stable-image] No se encontró ${label}`)
  return source.replace(before, after)
}

let changed = false

changed = patchFile(clientPath, source => {
  let next = source
  next = replaceRequired(
    next,
    `          mode,\n          imageUrl,\n        }),`,
    `          mode,\n          imageUrl,\n          imageAssetId: selectedImageAssetId,\n        }),`,
    "imageAssetId en creación automática",
  )

  next = replaceRequired(
    next,
    `              imageUrl={imageUrl}\n            />`,
    `              imageUrl={imageUrl}\n              imageAssetId={selectedImageAssetId}\n            />`,
    "imageAssetId hacia Premium Personal",
  )
  return next
}) || changed

changed = patchFile(marketplacePath, source => {
  let next = source
  next = replaceRequired(
    next,
    `  mode: VideoMode\n  imageUrl: string | null\n}`,
    `  mode: VideoMode\n  imageUrl: string | null\n  imageAssetId: string | null\n}`,
    "prop imageAssetId del marketplace",
  )
  next = replaceRequired(
    next,
    `          mode: props.mode,\n          imageUrl: props.imageUrl,\n          aspectRatio: "16:9",`,
    `          mode: props.mode,\n          imageUrl: props.imageUrl,\n          imageAssetId: props.imageAssetId,\n          aspectRatio: "16:9",`,
    "imageAssetId en request Premium Personal",
  )
  return next
}) || changed

changed = patchFile(freeRoutePath, source => {
  // El hardening nuevo usa resolveTrustedImageInput y ya reemplaza esta migración legacy.
  // Si está presente, no intentamos volver a insertar el fingerprint anterior.
  if (source.includes("resolveTrustedImageInput")) return source

  let next = source
  if (!next.includes('from "@/lib/video/image-asset-identity"')) {
    next = replaceRequired(
      next,
      `import { generationFingerprint } from "@/lib/ai/fingerprint"\n`,
      `import { generationFingerprint } from "@/lib/ai/fingerprint"\nimport { resolveOwnedImageAssetId, stableImageFingerprintIdentity } from "@/lib/video/image-asset-identity"\n`,
      "import de identidad estable en video automático",
    )
  }
  next = replaceRequired(
    next,
    `  imageUrl?: string | null\n  aspectRatio?: "16:9" | "9:16"`,
    `  imageUrl?: string | null\n  imageAssetId?: string | null\n  aspectRatio?: "16:9" | "9:16"`,
    "tipo imageAssetId en video automático",
  )
  next = replaceRequired(
    next,
    `    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null\n    const aspectRatio = normalizeAspectRatio(body.aspectRatio)`,
    `    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null\n    const requestedImageAssetId = typeof body.imageAssetId === "string" && body.imageAssetId.trim() ? body.imageAssetId.trim() : null\n    const aspectRatio = normalizeAspectRatio(body.aspectRatio)`,
    "lectura imageAssetId en video automático",
  )
  next = replaceRequired(
    next,
    `    const fingerprint = generationFingerprint({\n      capability: "video",\n      scopeKey: user.id,\n      payload: { prompt, style, mode, duration, withAudio, imageUrl, aspectRatio, resolution },\n    })`,
    `    const imageAssetId = await resolveOwnedImageAssetId({\n      supabase,\n      userId: user.id,\n      imageAssetId: requestedImageAssetId,\n    })\n    if (requestedImageAssetId && !imageAssetId) {\n      return Response.json({ ok: false, error: "La imagen reutilizable no pertenece a esta cuenta o ya no existe.", code: "IMAGE_ASSET_INVALID" }, { status: 400 })\n    }\n    const imageIdentity = stableImageFingerprintIdentity({ imageAssetId, imageUrl })\n\n    const fingerprint = generationFingerprint({\n      capability: "video",\n      scopeKey: user.id,\n      payload: { prompt, style, mode, duration, withAudio, imageIdentity, aspectRatio, resolution },\n    })`,
    "fingerprint estable en video automático",
  )
  next = replaceRequired(
    next,
    `      mode,\n      imageUrl,\n      aspectRatio,`,
    `      mode,\n      imageUrl,\n      imageAssetId,\n      aspectRatio,`,
    "imageAssetId en payload automático",
  )
  return next
}) || changed

changed = patchFile(personalRoutePath, source => {
  // Igual que la ruta automática: si ya existe el resolvedor seguro moderno,
  // esta migración legacy debe ser un no-op idempotente.
  if (source.includes("resolveTrustedImageInput")) return source

  let next = source
  if (!next.includes('from "@/lib/video/image-asset-identity"')) {
    next = replaceRequired(
      next,
      `import { generationFingerprint } from "@/lib/ai/fingerprint"\n`,
      `import { generationFingerprint } from "@/lib/ai/fingerprint"\nimport { resolveOwnedImageAssetId, stableImageFingerprintIdentity } from "@/lib/video/image-asset-identity"\n`,
      "import de identidad estable en Premium Personal",
    )
  }
  next = replaceRequired(
    next,
    `  imageUrl?: string | null\n  aspectRatio?: "16:9" | "9:16"`,
    `  imageUrl?: string | null\n  imageAssetId?: string | null\n  aspectRatio?: "16:9" | "9:16"`,
    "tipo imageAssetId en Premium Personal",
  )
  next = replaceRequired(
    next,
    `  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null\n  const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9"`,
    `  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null\n  const requestedImageAssetId = typeof body.imageAssetId === "string" && body.imageAssetId.trim() ? body.imageAssetId.trim() : null\n  const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9"`,
    "lectura imageAssetId en Premium Personal",
  )
  next = replaceRequired(
    next,
    `    const credential = await getPersonalCredentialSecret(user.id, provider)`,
    `    const imageAssetId = await resolveOwnedImageAssetId({\n      supabase,\n      userId: user.id,\n      imageAssetId: requestedImageAssetId,\n    })\n    if (requestedImageAssetId && !imageAssetId) {\n      return NextResponse.json({ ok: false, error: "La imagen reutilizable no pertenece a esta cuenta o ya no existe.", code: "IMAGE_ASSET_INVALID" }, { status: 400 })\n    }\n    const imageIdentity = stableImageFingerprintIdentity({ imageAssetId, imageUrl })\n\n    const credential = await getPersonalCredentialSecret(user.id, provider)`,
    "validación de asset antes del proveedor personal",
  )
  next = replaceRequired(
    next,
    `        mode,\n        imageUrl,\n        aspectRatio,`,
    `        mode,\n        imageIdentity,\n        aspectRatio,`,
    "fingerprint estable Premium Personal",
  )
  next = replaceRequired(
    next,
    `      mode,\n      imageUrl,\n      aspectRatio,`,
    `      mode,\n      imageUrl,\n      imageAssetId,\n      aspectRatio,`,
    "imageAssetId en payload Premium Personal",
  )
  return next
}) || changed

console.log(changed
  ? "[video-stable-image] fingerprint Imagen→Video usa assetId estable y validado por usuario"
  : "[video-stable-image] ya aplicado")
