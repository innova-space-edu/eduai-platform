import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "lib/image-config.ts")
if (!fs.existsSync(target)) throw new Error("[current-image-models] lib/image-config.ts no encontrado")

let source = fs.readFileSync(target, "utf8")
let changed = false

const oldBlock = `const GEMINI_IMAGE_MODELS_RAW = [
  process.env.GOOGLE_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_SECONDARY,
  process.env.GEMINI_IMAGE_MODEL_TERTIARY,
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
]

export const GEMINI_IMAGE_MODELS: string[] = Array.from(new Set(
  GEMINI_IMAGE_MODELS_RAW.filter((model): model is string => Boolean(model))
))`

const newBlock = `const CURRENT_GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
] as const

const CONFIGURED_GEMINI_IMAGE_MODELS = [
  process.env.GOOGLE_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_SECONDARY,
  process.env.GEMINI_IMAGE_MODEL_TERTIARY,
]

export const GEMINI_IMAGE_MODELS: string[] = Array.from(new Set([
  ...CURRENT_GEMINI_IMAGE_MODELS,
  ...CONFIGURED_GEMINI_IMAGE_MODELS.filter(
    (model): model is string => Boolean(model) && !/^gemini-2\\.5-flash-image(?:$|-)/i.test(model!),
  ),
]))`

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("[current-image-models] bloque Gemini esperado no encontrado")
  source = source.replace(oldBlock, newBlock)
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[current-image-models] Gemini 3.1/3.1 Lite primero; Gemini 2.5 legacy filtrado")
} else {
  console.log("[current-image-models] ya aplicado")
}
