import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "components", "video", "VideoStudioClient.tsx")
if (!fs.existsSync(target)) throw new Error(`No se encontró ${target}`)

let source = fs.readFileSync(target, "utf8")
let changed = false

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) throw new Error(`[video-reuse] No se encontró ${label}`)
  source = source.replace(oldText, newText)
  changed = true
}

replaceRequired(
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react"',
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react"\nimport ReusableAssetPicker, { type ReusableAsset } from "@/components/assets/ReusableAssetPicker"',
  "import React",
)

replaceRequired(
  '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n\n  const [isUploadingImage, setIsUploadingImage] = useState(false)',
  '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n  const [selectedImageAssetId, setSelectedImageAssetId] = useState<string | null>(null)\n\n  const [isUploadingImage, setIsUploadingImage] = useState(false)',
  "estado de imagen base",
)

replaceRequired(
  '    setImageFile(file)\n    setImageUrl(null)\n    setImagePreview(file ? URL.createObjectURL(file) : null)',
  '    setImageFile(file)\n    setSelectedImageAssetId(null)\n    setImageUrl(null)\n    setImagePreview(file ? URL.createObjectURL(file) : null)',
  "reset de asset al subir archivo",
)

const inputMarker = `                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void handleImageChange(file)
                  }}
                  className="block w-full text-sm text-sub file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-main hover:file:bg-sky-500"
                />`
const pickerBlock = `${inputMarker}

                <div className="mt-4 rounded-2xl border border-medium bg-card-theme p-3">
                  <p className="mb-3 text-xs font-semibold text-main">O reutiliza una imagen que ya generaste</p>
                  <ReusableAssetPicker
                    assetType="image"
                    selectedId={selectedImageAssetId}
                    emptyText="Todavía no hay imágenes guardadas en EduAI AI Core."
                    onSelect={(asset: ReusableAsset) => {
                      if (!asset.access_url) {
                        setErrorMessage("Este recurso no tiene una URL disponible para Video Studio.")
                        return
                      }
                      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
                      setImageFile(null)
                      setSelectedImageAssetId(asset.id)
                      setImageUrl(asset.access_url)
                      setImagePreview(asset.access_url)
                      setErrorMessage(null)
                      setSuccessMessage("Imagen reutilizable seleccionada. No se volverá a subir ni generar.")
                    }}
                  />
                </div>`
replaceRequired(inputMarker, pickerBlock, "selector de archivo de imagen")

replaceRequired(
  '    setImageFile(null)\n    setImageUrl(null)\n    setImagePreview(null)',
  '    setImageFile(null)\n    setSelectedImageAssetId(null)\n    setImageUrl(null)\n    setImagePreview(null)',
  "reset del formulario",
)

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[video-reuse] Video Studio puede reutilizar imágenes de eduai_assets")
} else {
  console.log("[video-reuse] selector de imágenes reutilizables ya estaba aplicado")
}
