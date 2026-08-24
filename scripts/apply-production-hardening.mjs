import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) throw new Error(`[production-hardening] No se encontró ${relativePath}`)
  return fs.readFileSync(target, "utf8")
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source)
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`[production-hardening] No se encontró ${label}`)
  return source.replace(before, after)
}

function patch(relativePath, transform) {
  const original = read(relativePath)
  const next = transform(original)
  if (next !== original) {
    write(relativePath, next)
    console.log(`[production-hardening] actualizado ${relativePath}`)
  }
}

await import("./apply-current-image-models.mjs")
await import("./apply-video-reusable-assets.mjs")

// El parche de identidad estable es una migración de código. Una vez que el
// hardening de URL confiable ya está aplicado en este mismo checkout, no debe
// volver a intentar insertar el bloque anterior.
if (!read("app/api/agents/video/route.ts").includes("resolveTrustedImageInput")) {
  await import("./apply-video-stable-image-identity.mjs")
}
await import("./apply-personal-provider-hardening.mjs")

// ---------------------------------------------------------------------------
// TypeScript: elimina los 5 errores que el workflow antiguo ocultaba con tee.
// ---------------------------------------------------------------------------
patch("app/educador/vista-previa/page.tsx", (source) => replaceRequired(
  source,
  "    if (!page || !ids.size) return\n    clipboardRef.current = page.elements",
  "    if (!current || !page || !ids.size) return\n    clipboardRef.current = page.elements",
  "guard de current en Educador",
))

patch("components/creator-hub/comics/ComicsCreatorStudio.tsx", (source) => {
  let next = source
  next = replaceRequired(
    next,
    "    const nextCharacters = generatedCharacters.map((generated: any, index: number) => {",
    "    const nextCharacters: Character[] = generatedCharacters.map((generated: any, index: number) => {",
    "tipo Character[] de personajes generados",
  )
  next = replaceRequired(
    next,
    "    const safeCharacters = nextCharacters.length ? nextCharacters : characters",
    "    const safeCharacters: Character[] = nextCharacters.length ? nextCharacters : characters",
    "tipo Character[] de personajes seguros",
  )
  return next
})

patch("components/whiteboard/WhiteboardMathStudio.tsx", (source) => {
  if (!source.includes('xmlns="http://www.w3.org/1999/xhtml"')) return source
  return source.replace(' xmlns="http://www.w3.org/1999/xhtml"', "")
})

// ---------------------------------------------------------------------------
// BYOK: en producción se exige una clave maestra dedicada. El fallback con
// service_role queda únicamente para desarrollo local y migraciones controladas.
// ---------------------------------------------------------------------------
patch("lib/ai/personal-credentials.ts", (source) => replaceRequired(
  source,
  `function masterKeyMaterial() {
  const dedicated = process.env.EDUAI_CREDENTIALS_MASTER_KEY?.trim()
  if (dedicated) return { value: dedicated, source: "dedicated" as const }

  // Temporary rollout fallback so BYOK can work before a dedicated secret is added.
  // SUPABASE_SERVICE_ROLE_KEY is server-only and high entropy, but a separate
  // EDUAI_CREDENTIALS_MASTER_KEY remains strongly recommended for rotation isolation.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (fallback) return { value: fallback, source: "service-role-fallback" as const }

  throw new Error("No hay material de cifrado configurado para credenciales personales")
}`,
  `function masterKeyMaterial() {
  const dedicated = process.env.EDUAI_CREDENTIALS_MASTER_KEY?.trim()
  if (dedicated) return { value: dedicated, source: "dedicated" as const }

  if (process.env.NODE_ENV !== "production") {
    const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (fallback) return { value: fallback, source: "service-role-fallback" as const }
  }

  throw new Error("EDUAI_CREDENTIALS_MASTER_KEY es obligatoria en producción para cifrar credenciales personales")
}`,
  "clave maestra BYOK dedicada",
))

// ---------------------------------------------------------------------------
// Nube EduAI pública: ownership explícito y rate limiting fail-closed en prod.
// ---------------------------------------------------------------------------
patch("app/api/repository/public-access/[token]/items/route.ts", (source) => {
  let next = source
  next = replaceRequired(
    next,
    "  if (!url || !authToken) return true",
    '  if (!url || !authToken) return process.env.NODE_ENV !== "production"',
    "rate limit sin configuración",
  )
  next = replaceRequired(
    next,
    "    if (!response.ok) return true",
    "    if (!response.ok) return false",
    "rate limit HTTP fail-closed",
  )
  next = replaceRequired(
    next,
    "  } catch {\n    return true\n  }\n}\n\nfunction cleanText",
    "  } catch {\n    return false\n  }\n}\n\nfunction cleanText",
    "rate limit excepción fail-closed",
  )
  next = replaceRequired(
    next,
    '    .eq("visibility", "public")\n    .order("created_at", { ascending: false })',
    '    .eq("visibility", "public")\n    .eq("created_by", access.ownerId)\n    .order("created_at", { ascending: false })',
    "ownership del listado público",
  )
  return next
})

patch("app/api/repository/public-access/[token]/items/[itemId]/route.ts", (source) => {
  let next = source
  next = replaceRequired(
    next,
    "  return admin\n}\n\nexport async function GET",
    "  return { admin, ownerId }\n}\n\nexport async function GET",
    "ownerId del acceso público",
  )
  next = replaceRequired(
    next,
    `  const admin = await validatePublicAccess(token)
  if (!admin) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  const { data, error } = await admin`,
    `  const access = await validatePublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }
  const { admin, ownerId } = access

  const { data, error } = await admin`,
    "desestructuración del acceso público",
  )
  next = replaceRequired(
    next,
    '    .eq("id", itemId)\n    .eq("visibility", "public")\n    .maybeSingle()',
    '    .eq("id", itemId)\n    .eq("visibility", "public")\n    .eq("created_by", ownerId)\n    .maybeSingle()',
    "ownership del material público",
  )
  return next
})

// ---------------------------------------------------------------------------
// Video Studio: nunca confía en imageUrl enviado por el cliente. Para uploads
// solo admite video-inputs del propio usuario; para reutilización resuelve el
// asset privado por owner_id y genera una nueva URL firmada server-side.
// La ruta v2 de Créditos IA ya incorpora este hardening de forma nativa, por lo
// que el parche legado debe ser idempotente y no intentar reescribirla.
// ---------------------------------------------------------------------------
patch("app/api/agents/video/route.ts", (source) => {
  const alreadyHardenedCreditsRoute =
    source.includes('import { resolveTrustedImageInput } from "@/lib/video/trusted-image-input"') &&
    source.includes("const trustedImage = await resolveTrustedImageInput({") &&
    source.includes("const imageIdentity = trustedImage.identity") &&
    source.includes("billingMode: selectedModel.provider === \"auto\" ? \"free\" : \"credits\"")

  if (alreadyHardenedCreditsRoute) return source

  let next = source
  const oldImport = 'import { resolveOwnedImageAssetId, stableImageFingerprintIdentity } from "@/lib/video/image-asset-identity"\n'
  if (next.includes(oldImport)) next = next.replace(oldImport, "")
  const trustedImport = 'import { resolveTrustedImageInput } from "@/lib/video/trusted-image-input"\n'
  if (!next.includes(trustedImport)) {
    next = replaceRequired(
      next,
      'import { generationFingerprint } from "@/lib/ai/fingerprint"\n',
      'import { generationFingerprint } from "@/lib/ai/fingerprint"\n' + trustedImport,
      "import de imagen confiable en video automático",
    )
  }
  next = replaceRequired(
    next,
    '    if (mode === "image_to_video" && !imageUrl) {',
    '    if (mode === "image_to_video" && !imageUrl && !requestedImageAssetId) {',
    "requisito imageUrl o imageAssetId",
  )
  next = replaceRequired(
    next,
    `    const imageAssetId = await resolveOwnedImageAssetId({
      supabase,
      userId: user.id,
      imageAssetId: requestedImageAssetId,
    })
    if (requestedImageAssetId && !imageAssetId) {
      return Response.json({ ok: false, error: "La imagen reutilizable no pertenece a esta cuenta o ya no existe.", code: "IMAGE_ASSET_INVALID" }, { status: 400 })
    }
    const imageIdentity = stableImageFingerprintIdentity({ imageAssetId, imageUrl })`,
    `    const trustedImage = await resolveTrustedImageInput({
      supabase,
      userId: user.id,
      imageUrl,
      imageAssetId: requestedImageAssetId,
    })
    if (!trustedImage.ok) {
      return Response.json({ ok: false, error: trustedImage.error, code: trustedImage.code }, { status: 400 })
    }
    const imageAssetId = trustedImage.imageAssetId
    const trustedImageUrl = trustedImage.imageUrl
    const imageIdentity = trustedImage.identity`,
    "resolución segura de imagen automática",
  )
  next = replaceRequired(
    next,
    "      mode,\n      imageUrl,\n      imageAssetId,\n      aspectRatio,",
    "      mode,\n      imageUrl: trustedImageUrl,\n      imageAssetId,\n      aspectRatio,",
    "URL confiable en payload automático",
  )
  next = replaceRequired(
    next,
    "        image_url: imageUrl,",
    "        image_url: trustedImageUrl,",
    "URL confiable persistida en video automático",
  )
  return next
})

patch("app/api/agents/video/personal/route.ts", (source) => {
  let next = source
  const oldImport = 'import { resolveOwnedImageAssetId, stableImageFingerprintIdentity } from "@/lib/video/image-asset-identity"\n'
  if (next.includes(oldImport)) next = next.replace(oldImport, "")
  const trustedImport = 'import { resolveTrustedImageInput } from "@/lib/video/trusted-image-input"\n'
  if (!next.includes(trustedImport)) {
    next = replaceRequired(
      next,
      'import { generationFingerprint } from "@/lib/ai/fingerprint"\n',
      'import { generationFingerprint } from "@/lib/ai/fingerprint"\n' + trustedImport,
      "import de imagen confiable en video personal",
    )
  }
  next = replaceRequired(
    next,
    '  if (mode === "image_to_video" && !imageUrl) return NextResponse.json({ ok: false, error: "Imagen a video requiere una imagen base" }, { status: 400 })',
    '  if (mode === "image_to_video" && !imageUrl && !requestedImageAssetId) return NextResponse.json({ ok: false, error: "Imagen a video requiere una imagen base" }, { status: 400 })',
    "requisito imagen personal",
  )
  next = replaceRequired(
    next,
    `    const imageAssetId = await resolveOwnedImageAssetId({
      supabase,
      userId: user.id,
      imageAssetId: requestedImageAssetId,
    })
    if (requestedImageAssetId && !imageAssetId) {
      return NextResponse.json({ ok: false, error: "La imagen reutilizable no pertenece a esta cuenta o ya no existe.", code: "IMAGE_ASSET_INVALID" }, { status: 400 })
    }
    const imageIdentity = stableImageFingerprintIdentity({ imageAssetId, imageUrl })`,
    `    const trustedImage = await resolveTrustedImageInput({
      supabase,
      userId: user.id,
      imageUrl,
      imageAssetId: requestedImageAssetId,
    })
    if (!trustedImage.ok) {
      return NextResponse.json({ ok: false, error: trustedImage.error, code: trustedImage.code }, { status: 400 })
    }
    const imageAssetId = trustedImage.imageAssetId
    const trustedImageUrl = trustedImage.imageUrl
    const imageIdentity = trustedImage.identity`,
    "resolución segura de imagen personal",
  )
  next = replaceRequired(
    next,
    "      mode,\n      imageUrl,\n      imageAssetId,\n      aspectRatio,",
    "      mode,\n      imageUrl: trustedImageUrl,\n      imageAssetId,\n      aspectRatio,",
    "URL confiable en payload personal",
  )
  next = replaceRequired(
    next,
    "        image_url: imageUrl,",
    "        image_url: trustedImageUrl,",
    "URL confiable persistida en video personal",
  )
  next = replaceRequired(
    next,
    "      mode,\n      imageUrl,\n      aspectRatio,\n      resolution,",
    "      mode,\n      imageUrl: trustedImageUrl,\n      aspectRatio,\n      resolution,",
    "URL confiable enviada al proveedor personal",
  )
  return next
})

console.log("[production-hardening] gate de producción aplicado")
