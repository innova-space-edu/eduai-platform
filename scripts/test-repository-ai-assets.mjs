import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pagePath = path.join(root, "app", "repositorio", "page.tsx")
const componentPath = path.join(root, "components", "assets", "AIAssetLibraryModal.tsx")
const pickerPath = path.join(root, "components", "assets", "ReusableAssetPicker.tsx")
const listRoutePath = path.join(root, "app", "api", "assets", "route.ts")
const detailRoutePath = path.join(root, "app", "api", "assets", "[id]", "route.ts")

const page = fs.readFileSync(pagePath, "utf8")
const component = fs.readFileSync(componentPath, "utf8")
const picker = fs.readFileSync(pickerPath, "utf8")
const listRoute = fs.readFileSync(listRoutePath, "utf8")
const detailRoute = fs.readFileSync(detailRoutePath, "utf8")

for (const [label, text] of [
  ["import modal", 'import AIAssetLibraryModal from "@/components/assets/AIAssetLibraryModal"'],
  ["estado modal", "aiAssetsOpen"],
  ["botón Recursos IA", "> Recursos IA</button>"],
  ["modal privado", "<AIAssetLibraryModal open={aiAssetsOpen}"],
]) {
  if (!page.includes(text)) throw new Error(`[test-repository-ai-assets] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["API assets", 'fetch("/api/assets?limit=100"'],
  ["texto de reutilización", "Las solicitudes idénticas se reutilizan automáticamente"],
  ["enlaces temporales", "Los enlaces firmados son temporales"],
]) {
  if (!component.includes(text)) throw new Error(`[test-repository-ai-assets] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["preview reutilizable", "<AssetPreview asset={asset} />"],
  ["miniatura de imagen", "asset.asset_type.toLowerCase().includes(\"image\") && asset.access_url"],
  ["lazy loading", 'loading="lazy"'],
]) {
  if (!picker.includes(text)) throw new Error(`[test-repository-ai-assets] Falta ${label}: ${text}`)
}

if (!listRoute.includes('.eq("owner_id", user.id)')) {
  throw new Error("[test-repository-ai-assets] La lista de assets debe filtrar explícitamente por owner_id")
}

if (!detailRoute.includes('.eq("owner_id", user.id)')) {
  throw new Error("[test-repository-ai-assets] El detalle/versiones debe filtrar explícitamente por owner_id")
}

if (!detailRoute.includes('.or(`id.eq.${rootId},root_asset_id.eq.${rootId}`)')) {
  throw new Error("[test-repository-ai-assets] El historial debe incluir el asset raíz además de sus versiones")
}

console.log("[test-repository-ai-assets] Nube EduAI expone recursos IA privados, con ownership explícito, historial completo y previews reutilizables")
