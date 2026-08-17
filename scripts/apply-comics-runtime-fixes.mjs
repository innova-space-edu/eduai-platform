import fs from "node:fs"
import path from "node:path"

await import("./apply-content-processor-ai-core.mjs")
await import("./test-content-processor-ai-core.mjs")

const candidates = [
  "components/creator-hub/comics/ComicsCreatorStudio.tsx",
  "app/creator-hub/comics/page.tsx",
]

const relativeFile = candidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)))
if (!relativeFile) {
  console.log("[comics-runtime] editor no encontrado")
  process.exit(0)
}

const file = path.join(process.cwd(), relativeFile)
let source = fs.readFileSync(file, "utf8")
const original = source

function replace(before, after) {
  if (source.includes(after)) return
  if (source.includes(before)) source = source.replace(before, after)
}

replace('label: "Estrica"', 'label: "Estricta"')
replace(
  "const nextCharacters = generatedCharacters.map((generated: any, index: number) => {",
  "const nextCharacters: Character[] = generatedCharacters.map((generated: any, index: number) => {",
)
replace(
  "const safeCharacters = nextCharacters.length ? nextCharacters : characters",
  "const safeCharacters: Character[] = nextCharacters.length ? nextCharacters : characters",
)
replace(
  `  const generateAllImages = async (force = false) => {
    if (!panels.length || generatingAll) return
    setError("")`,
  `  const generateAllImages = async (force = false) => {
    if (!panels.length || generatingAll) return
    setGeneratingAll(true)
    setError("")`,
)
replace(
  `    if (!targets.length) {
      setMessage("Las imágenes visibles ya están actualizadas o bloqueadas.")
      return
    }`,
  `    if (!targets.length) {
      setGeneratingAll(false)
      setProgress(null)
      setMessage("Las imágenes visibles ya están actualizadas o bloqueadas.")
      return
    }`,
)
replace(
  `    if (!response.ok || !payload?.imageUrl) throw new Error(payload?.error || "No fue posible crear la biblia visual.")`,
  `    if (!response.ok || !payload?.imageUrl) {
      const failure = payload?.error || "No fue posible crear la biblia visual."
      setVisualBible((current) => ({ ...current, loading: false, error: failure }))
      throw new Error(failure)
    }`,
)

if (source !== original) {
  fs.writeFileSync(file, source.endsWith("\n") ? source : `${source}\n`)
  console.log(`[comics-runtime] correcciones aplicadas en ${relativeFile}`)
} else {
  console.log("[comics-runtime] sin cambios pendientes")
}