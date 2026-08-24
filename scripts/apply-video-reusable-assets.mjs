import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "components", "video", "VideoStudioClient.tsx")
if (!fs.existsSync(target)) throw new Error(`No se encontró ${target}`)

let source = fs.readFileSync(target, "utf8")
let changed = false

function replaceOneOf(oldTexts, newText, label) {
  if (source.includes(newText)) return
  const match = oldTexts.find((oldText) => source.includes(oldText))
  if (!match) throw new Error(`[video-reuse] No se encontró ${label}`)
  source = source.replace(match, newText)
  changed = true
}

const reusableImport = 'import ReusableAssetPicker, { type ReusableAsset } from "@/components/assets/ReusableAssetPicker"'
if (!source.includes(reusableImport)) {
  const reactImport = 'import { useCallback, useEffect, useMemo, useRef, useState } from "react"'
  if (!source.includes(reactImport)) throw new Error("[video-reuse] No se encontró import React")
  source = source.replace(reactImport, `${reactImport}\n${reusableImport}`)
  changed = true
}

replaceOneOf(
  [
    '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n  const [isUploadingImage, setIsUploadingImage] = useState(false)',
    '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n\n  const [isUploadingImage, setIsUploadingImage] = useState(false)',
    '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n  const [uploadingImage, setUploadingImage] = useState(false)',
  ],
  '  const [imagePreview, setImagePreview] = useState<string | null>(null)\n  const [selectedImageAssetId, setSelectedImageAssetId] = useState<string | null>(null)\n  const [uploadingImage, setUploadingImage] = useState(false)',
  "estado de imagen base",
)

replaceOneOf(
  [
    '    setImageFile(file)\n    setImageUrl(null)\n    setImagePreview(file ? URL.createObjectURL(file) : null)',
  ],
  '    setImageFile(file)\n    setSelectedImageAssetId(null)\n    setImageUrl(null)\n    setImagePreview(file ? URL.createObjectURL(file) : null)',
  "reset de asset al subir archivo",
)

const modernInputMarker = `                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageChange(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-sub file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
                  />`

const legacyInputMarker = `                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void handleImageChange(file)
                  }}
                  className="block w-full text-sm text-sub file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-main hover:file:bg-sky-500"
                />`

const compactProductionInputMarker = `                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageChange(event.target.files?.[0] || null)} className="block w-full text-sm text-sub" />`

if (!source.includes("<ReusableAssetPicker")) {
  const inputMarker = source.includes(modernInputMarker)
    ? modernInputMarker
    : source.includes(legacyInputMarker)
      ? legacyInputMarker
      : source.includes(compactProductionInputMarker)
        ? compactProductionInputMarker
        : null
  if (!inputMarker) throw new Error("[video-reuse] No se encontró selector de archivo de imagen")
  const indent = inputMarker === modernInputMarker ? "                  " : "                "
  const pickerBlock = `${inputMarker}\n\n${indent}<div className="mt-4 rounded-2xl border border-medium bg-card-theme p-3">\n${indent}  <p className="mb-3 text-xs font-semibold text-main">O reutiliza una imagen guardada en Recursos IA</p>\n${indent}  <ReusableAssetPicker\n${indent}    assetType="image"\n${indent}    selectedId={selectedImageAssetId}\n${indent}    emptyText="Todavía no hay imágenes guardadas en EduAI AI Core."\n${indent}    onSelect={(asset: ReusableAsset) => {\n${indent}      if (!asset.access_url) {\n${indent}        setErrorMessage("Este recurso no tiene una URL disponible para Video Studio.")\n${indent}        return\n${indent}      }\n${indent}      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)\n${indent}      setImageFile(null)\n${indent}      setSelectedImageAssetId(asset.id)\n${indent}      setImageUrl(asset.access_url)\n${indent}      setImagePreview(asset.access_url)\n${indent}      setErrorMessage(null)\n${indent}      setSuccessMessage("Imagen reutilizable seleccionada. No se volverá a subir ni generar.")\n${indent}    }}\n${indent}  />\n${indent}</div>`
  source = source.replace(inputMarker, pickerBlock)
  changed = true
}

replaceOneOf(
  [
    '          imageUrl,\n          aspectRatio,',
    '          imageUrl,\n          imageAssetId: selectedImageAssetId,\n          aspectRatio,',
  ],
  '          imageUrl,\n          imageAssetId: selectedImageAssetId,\n          aspectRatio,',
  "identidad estable del asset en la solicitud",
)

const walletBefore = '    if (selected.toLowerCase().includes("mercadopago")) {'
const walletAfter = '    if (selected === "wallet_purchase" || selected.toLowerCase().includes("mercadopago")) {'
if (source.includes(walletBefore) || source.includes(walletAfter)) {
  replaceOneOf(
    [walletBefore, walletAfter],
    walletAfter,
    "pago con Cuenta Mercado Pago sin envío al backend",
  )
} else if (!(source.includes('mercadoPago: "wallet_purchase"') && source.includes("submitMercadoPagoPayment(activeOrder"))) {
  throw new Error("[video-reuse] No se encontró manejo equivalente de Cuenta Mercado Pago")
}

replaceOneOf(
  [
    '    setImageFile(null)\n    setImageUrl(null)\n    setImagePreview(null)',
  ],
  '    setImageFile(null)\n    setSelectedImageAssetId(null)\n    setImageUrl(null)\n    setImagePreview(null)',
  "reset del formulario",
)

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[video-reuse] Video Studio puede reutilizar imágenes y conserva el flujo de pago de producción")
} else {
  console.log("[video-reuse] Video Studio reutilizable y Payment Brick ya estaban actualizados")
}
