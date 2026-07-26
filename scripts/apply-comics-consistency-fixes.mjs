import fs from "node:fs"
import path from "node:path"

const file = path.join(process.cwd(), "app/creator-hub/comics/page.tsx")
let source = fs.readFileSync(file, "utf8")

function replaceExact(before, after, label) {
  if (source.includes(after)) return
  if (!source.includes(before)) {
    throw new Error(`[comics-consistency] No se encontró el bloque: ${label}`)
  }
  source = source.replace(before, after)
}

replaceExact(
  '{ id: "strict", label: "Estrica", description: "Añade referencias de viñetas cercanas al regenerar." },',
  '{ id: "strict", label: "Estricta", description: "Añade referencias de viñetas cercanas al regenerar." },',
  "etiqueta de consistencia estricta",
)

replaceExact(
`  const commonImagePayload = (nextCharacters: Character[]) => ({
    title,
    topic,
    audience,
    educationalGoal,
    style,
    styleDirection,
    consistencyMode,
    characters: nextCharacters.map(stripTransientCharacter),
  })`,
`  type ImageContext = {
    title: string
    topic: string
    audience: string
    educationalGoal: string
    style: ComicStyle
    styleDirection: string
    consistencyMode: ConsistencyMode
  }

  const commonImagePayload = (
    nextCharacters: Character[],
    overrides: Partial<ImageContext> = {},
  ) => ({
    title: overrides.title ?? title,
    topic: overrides.topic ?? topic,
    audience: overrides.audience ?? audience,
    educationalGoal: overrides.educationalGoal ?? educationalGoal,
    style: overrides.style ?? style,
    styleDirection: overrides.styleDirection ?? styleDirection,
    consistencyMode: overrides.consistencyMode ?? consistencyMode,
    characters: nextCharacters.map(stripTransientCharacter),
  })`,
  "contexto estable de imágenes",
)

replaceExact(
  "    const nextCharacters = generatedCharacters.map((generated: any, index: number) => {",
  "    const nextCharacters: Character[] = generatedCharacters.map((generated: any, index: number) => {",
  "tipo explícito de personajes",
)

replaceExact(
`  const generateCastReference = async (nextCharacters: Character[], force = false) => {
    if (visualBible.castImageUrl && visualBible.locked && !force) return visualBible
    if (visualBible.castImageUrl && !visualBible.stale && !force) return visualBible

    setVisualBible((current) => ({ ...current, loading: true, error: "" }))
    setProgress({ stage: "cast", done: 0, total: 1, current: "Creando la biblia visual" })
    const response = await fetch("/api/creator/comics/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cast",
        ...commonImagePayload(nextCharacters),
        preferredModel: visualBible.model || "",
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.imageUrl) throw new Error(payload?.error || "No fue posible crear la biblia visual.")
    const nextBible: VisualBible = {
      castImageUrl: payload.imageUrl,
      provider: payload.provider,
      model: payload.model,
      generatedAt: new Date().toISOString(),
      locked: visualBible.locked,
      stale: false,
      loading: false,
      error: "",
    }
    setVisualBible(nextBible)
    setProgress({ stage: "cast", done: 1, total: 1, current: "Biblia visual lista" })
    return nextBible
  }`,
`  const generateCastReference = async (
    nextCharacters: Character[],
    force = false,
    context: Partial<ImageContext> = {},
  ) => {
    if (visualBible.castImageUrl && visualBible.locked && !force) return visualBible
    if (visualBible.castImageUrl && !visualBible.stale && !force) return visualBible

    setVisualBible((current) => ({ ...current, loading: true, error: "" }))
    setProgress({ stage: "cast", done: 0, total: 1, current: "Creando la biblia visual" })
    try {
      const response = await fetch("/api/creator/comics/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cast",
          ...commonImagePayload(nextCharacters, context),
          preferredModel: visualBible.model || "",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.imageUrl) {
        throw new Error(payload?.error || "No fue posible crear la biblia visual.")
      }
      const nextBible: VisualBible = {
        castImageUrl: payload.imageUrl,
        provider: payload.provider,
        model: payload.model,
        generatedAt: new Date().toISOString(),
        locked: visualBible.locked,
        stale: false,
        loading: false,
        error: "",
      }
      setVisualBible(nextBible)
      setProgress({ stage: "cast", done: 1, total: 1, current: "Biblia visual lista" })
      return nextBible
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No fue posible crear la biblia visual."
      setVisualBible((current) => ({ ...current, loading: false, error: message }))
      throw reason
    }
  }`,
  "manejo de error de la biblia visual",
)

replaceExact(
`  const requestCharacterReference = async (
    character: Character,
    castImageUrl: string,
    preferredModel: string,
  ) => {
    const response = await fetch("/api/creator/comics/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "character",
        ...commonImagePayload(characters),
        characters: characters.map(stripTransientCharacter),
        characterId: character.id,
        castImageUrl,
        preferredModel,
      }),
    })`,
`  const requestCharacterReference = async (
    character: Character,
    sourceCharacters: Character[],
    castImageUrl: string,
    preferredModel: string,
    context: Partial<ImageContext> = {},
  ) => {
    const response = await fetch("/api/creator/comics/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "character",
        ...commonImagePayload(sourceCharacters, context),
        characters: sourceCharacters.map(stripTransientCharacter),
        characterId: character.id,
        castImageUrl,
        preferredModel,
      }),
    })`,
  "personajes de referencia sin estado obsoleto",
)

replaceExact(
`  const generateVisualBible = async (sourceCharacters: Character[], force = false) => {
    const bible = await generateCastReference(sourceCharacters, force)`,
`  const generateVisualBible = async (
    sourceCharacters: Character[],
    force = false,
    context: Partial<ImageContext> = {},
  ) => {
    const bible = await generateCastReference(sourceCharacters, force, context)`,
  "contexto de biblia visual",
)

replaceExact(
  '        const updated = await requestCharacterReference(character, castImageUrl, bible.model || "")',
  '        const updated = await requestCharacterReference(character, sourceCharacters, castImageUrl, bible.model || "", context)',
  "referencia individual coordinada",
)

replaceExact(
`  const generateOneCharacterReference = async (character: Character) => {
    if (character.referenceLoading) return
    setError("")
    try {
      const { bible } = await generateVisualBible(characters, false)
      setCharacters((current) => current.map((item) => item.id === character.id ? { ...item, referenceLoading: true, referenceError: "" } : item))
      const updated = await requestCharacterReference(character, bible.castImageUrl || "", bible.model || "")
      setCharacters((current) => current.map((item) => item.id === character.id ? updated : item))
      setMessage(`Referencia visual de ${character.name} actualizada.`)`,
`  const generateOneCharacterReference = async (character: Character) => {
    if (character.referenceLoading) return
    setError("")
    try {
      const bible = await generateCastReference(characters, false)
      setCharacters((current) => current.map((item) => item.id === character.id ? { ...item, referenceLoading: true, referenceError: "" } : item))
      const updated = await requestCharacterReference(character, characters, bible.castImageUrl || "", bible.model || "")
      setCharacters((current) => current.map((item) => item.id === character.id ? updated : item))
      setMessage(`Referencia visual de ${character.name} actualizada.`)`,
  "generación individual sin duplicar todo el elenco",
)

replaceExact(
`  const generateAllImages = async (force = false) => {
    if (!panels.length || generatingAll) return
    setError("")
    setMessage("")
    try {`,
`  const generateAllImages = async (force = false) => {
    if (!panels.length || generatingAll) return
    setGeneratingAll(true)
    setError("")
    setMessage("")
    try {`,
  "bloqueo inmediato del lote",
)

replaceExact(
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
  "finalización de lote vacío",
)

replaceExact(
`      const identityPack = await generateVisualBible(generated.characters, true)
      await generatePanelsBatch(generated.panels, identityPack.characters, identityPack.bible, true)`,
`      const generationContext: Partial<ImageContext> = {
        title: generated.title,
        styleDirection: generated.styleDirection,
      }
      const identityPack = await generateVisualBible(generated.characters, true, generationContext)
      await generatePanelsBatch(generated.panels, identityPack.characters, identityPack.bible, true)`,
  "contexto inmediato del storyboard completo",
)

if (!source.endsWith("\n")) source += "\n"
fs.writeFileSync(file, source)
console.log("[comics-consistency] flujo visual estabilizado")
