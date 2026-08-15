import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pagePath = path.join(root, "app", "repositorio", "page.tsx")
const componentPath = path.join(root, "components", "assets", "AIAssetLibraryModal.tsx")

const page = fs.readFileSync(pagePath, "utf8")
const component = fs.readFileSync(componentPath, "utf8")

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

console.log("[test-repository-ai-assets] Nube EduAI expone recursos IA privados reutilizables")
