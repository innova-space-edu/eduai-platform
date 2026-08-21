import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-image-private-assets.mjs")
const routePath = path.join(root, "app/api/agents/imagenes/route.ts")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) {
    throw new Error(`[test-image-private-assets] idempotency run ${i + 1} failed: ${run.stderr || run.stdout}`)
  }
}

const source = fs.readFileSync(routePath, "utf8")
const occurrences = (needle) => source.split(needle).length - 1

if (occurrences("async function resolveReusableImageUrl(") !== 1) {
  throw new Error("[test-image-private-assets] reusable URL resolver must exist exactly once")
}
if (source.includes('createClient as createAdmin')) {
  throw new Error("[test-image-private-assets] Image Studio must not require service-role upload")
}
if (!source.includes('.from("eduai-assets")\n      .upload(storagePath')) {
  throw new Error("[test-image-private-assets] new images must upload to private eduai-assets")
}
if (source.includes('.from("generated-images")\n      .upload(storagePath')) {
  throw new Error("[test-image-private-assets] new image uploads still target public generated-images")
}
if (!source.includes('storageBucket: "eduai-assets"')) {
  throw new Error("[test-image-private-assets] asset metadata must point to eduai-assets")
}
if (!source.includes("externalUrl: null")) {
  throw new Error("[test-image-private-assets] expiring signed URL must not be persisted as externalUrl")
}
if (!source.includes("const legacyImageUrl = imageBase64") || !source.includes("image_url: legacyImageUrl")) {
  throw new Error("[test-image-private-assets] legacy gallery compatibility was not preserved")
}
if (!source.includes("const reusableImageUrl = await resolveReusableImageUrl(")) {
  throw new Error("[test-image-private-assets] reuse path must refresh signed access URL")
}
if (!source.includes("stored = await uploadToStorage(supabase, imageBase64, user.id)")) {
  throw new Error("[test-image-private-assets] private upload must use the authenticated user client")
}

console.log("[test-image-private-assets] Image Studio guarda nuevos assets privados y renueva URLs firmadas; parche idempotente")
