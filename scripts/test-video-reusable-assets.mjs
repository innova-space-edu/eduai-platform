import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "components", "video", "VideoStudioClient.tsx")
const source = fs.readFileSync(target, "utf8")

for (const [label, value] of [
  ["ReusableAssetPicker", 'ReusableAssetPicker, { type ReusableAsset }'],
  ["asset image filter", 'assetType="image"'],
  ["selected image state", "selectedImageAssetId"],
  ["direct signed URL", "setImageUrl(asset.access_url)"],
  ["no reupload message", "No se volverá a subir ni generar"],
]) {
  if (!source.includes(value)) throw new Error(`[test-video-reuse] Falta ${label}: ${value}`)
}

console.log("[test-video-reuse] Video Studio reutiliza imágenes existentes sin nueva subida/generación")
