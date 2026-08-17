"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  LoaderCircle,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserRound,
  WandSparkles,
} from "lucide-react"
import ColorPalette from "@/components/ui/ColorPalette"
import DialogueOverlay, {
  type DialogueLayout,
  type DialoguePosition,
} from "@/components/creator-hub/comics/DialogueOverlay"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"
import {
  loadCloudCreatorHubProject,
  saveCreatorHubProject,
  updateCreatorHubProject,
} from "@/components/creator-hub/project-store"

type ComicStyle = "manga" | "western" | "webtoon" | "child"
type ConsistencyMode = "basic" | "high" | "strict"
type CharacterRole = "protagonist" | "supporting" | "antagonist" | "other"

type Character = {
  id: string
  name: string
  description: string
  visualDescription: string
  fixedTraits: string
  outfit: string
  accessories: string
  prohibitedChanges: string
  role: CharacterRole
  appearsAlways: boolean
  userCreated: boolean
  identityLocked: boolean
  referenceImageUrl?: string
  referenceProvider?: string
  referenceModel?: string
  referenceLoading?: boolean
  referenceError?: string
  referenceStale?: boolean
}

type Panel = {
  id: string
  title: string
  scene: string
  dialogue: string
  dialogueLayout: DialogueLayout
  dialoguePosition: DialoguePosition
  shot: string
  imagePrompt: string
  emotion: string
  background: string
  characterIds: string[]
  imageUrl?: string
  provider?: string
  model?: string
  referenceCount?: number
  loading?: boolean
  error?: string
  hidden?: boolean
  locked?: boolean
  imageLocked?: boolean
  imageDirty?: boolean
}

type VisualBible = {
  castImageUrl?: string
  provider?: string
  model?: string
  generatedAt?: string
  locked: boolean
  stale: boolean
  loading?: boolean
  error?: string
}

type BatchProgress = {
  stage: "storyboard" | "cast" | "characters" | "panels"
  done: number
  total: number
  current: string
}

const STYLES: Array<{ id: ComicStyle; label: string; icon: string; description: string }> = [
  { id: "manga", label: "Manga", icon: "🌸", description: "Tinta, contraste y ritmo visual" },
  { id: "western", label: "Historieta", icon: "💥", description: "Color y composición clásica" },
  { id: "webtoon", label: "Webtoon", icon: "📱", description: "Lectura vertical para celular" },
  { id: "child", label: "Cómic infantil", icon: "🧒", description: "Formas simples y expresivas" },
]

const CONSISTENCY_MODES: Array<{ id: ConsistencyMode; label: string; description: string }> = [
  { id: "basic", label: "Básica", description: "Contrato textual" },
  { id: "high", label: "Alta", description: "Contrato y referencias" },
  { id: "strict", label: "Estricta", description: "También usa viñetas cercanas" },
]

const DEFAULT_STYLE_DIRECTION: Record<ComicStyle, string> = {
  manga: "Tinta negra limpia, screentones controlados, fondos detallados y expresiones claras. Mantener proporciones y rostros constantes.",
  western: "Color digital equilibrado, contornos limpios, sombreado cel y composición clásica de historieta.",
  webtoon: "Color digital limpio, luz suave, fondos verticales continuos y siluetas reconocibles.",
  child: "Formas simples, colores cálidos, fondos claros, expresiones amigables y lectura inmediata.",
}

const ROLE_LABELS: Record<CharacterRole, string> = {
  protagonist: "Protagonista",
  supporting: "Secundario",
  antagonist: "Antagonista",
  other: "Otro",
}

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function blankCharacter(index = 1): Character {
  return {
    id: uid("character"),
    name: index === 1 ? "Protagonista" : `Personaje ${index}`,
    description: index === 1 ? "Personaje principal de la historia." : "Rol dentro de la historia.",
    visualDescription: "Describe edad aparente, especie, rostro, cabello o pelaje, ojos, proporciones y expresión base.",
    fixedTraits: "Rasgos físicos que no pueden cambiar.",
    outfit: "Ropa, calzado y colores exactos para toda la historieta.",
    accessories: "Accesorios permanentes.",
    prohibitedChanges: "No cambiar rostro, edad, especie, ropa, colores ni accesorios.",
    role: index === 1 ? "protagonist" : "supporting",
    appearsAlways: index === 1,
    userCreated: true,
    identityLocked: false,
    referenceStale: true,
  }
}

function roleValue(value: unknown): CharacterRole {
  return value === "supporting" || value === "antagonist" || value === "other" ? value : "protagonist"
}

function normalizeCharacter(value: any, index: number): Character {
  return {
    id: value?.id || uid("character"),
    name: value?.name || `Personaje ${index + 1}`,
    description: value?.description || "",
    visualDescription: value?.visualDescription || value?.description || "",
    fixedTraits: value?.fixedTraits || "",
    outfit: value?.outfit || "",
    accessories: value?.accessories || "",
    prohibitedChanges: value?.prohibitedChanges || "",
    role: roleValue(value?.role),
    appearsAlways: value?.appearsAlways === true || (index === 0 && value?.appearsAlways !== false),
    userCreated: value?.userCreated !== false,
    identityLocked: value?.identityLocked === true,
    referenceImageUrl: value?.referenceImageUrl,
    referenceProvider: value?.referenceProvider,
    referenceModel: value?.referenceModel,
    referenceLoading: false,
    referenceError: "",
    referenceStale: value?.referenceStale !== false,
  }
}

function requiredCharacterIds(characters: Character[]) {
  const required = characters.filter((character) => character.appearsAlways).map((character) => character.id)
  return required.length ? required : characters.slice(0, 1).map((character) => character.id)
}

function normalizePanel(value: any, index: number, characters: Character[]): Panel {
  const knownIds = new Set(characters.map((character) => character.id))
  const ids = Array.isArray(value?.characterIds)
    ? value.characterIds.filter((id: unknown) => typeof id === "string" && knownIds.has(id))
    : []
  const required = requiredCharacterIds(characters)
  return {
    id: value?.id || uid("panel"),
    title: value?.title || `Viñeta ${index + 1}`,
    scene: value?.scene || "",
    dialogue: value?.dialogue || "",
    dialogueLayout: value?.dialogueLayout === "bubbles" || value?.dialogueLayout === "caption" ? value.dialogueLayout : "auto",
    dialoguePosition: ["top-left", "top-right", "bottom-left", "bottom-right"].includes(value?.dialoguePosition) ? value.dialoguePosition : index % 2 ? "top-right" : "top-left",
    shot: value?.shot || "plano medio",
    imagePrompt: value?.imagePrompt || value?.scene || "",
    emotion: value?.emotion || "",
    background: value?.background || "",
    characterIds: [...new Set([...required, ...ids])],
    imageUrl: value?.imageUrl,
    provider: value?.provider,
    model: value?.model,
    referenceCount: value?.referenceCount,
    loading: false,
    error: "",
    hidden: value?.hidden === true,
    locked: value?.locked === true,
    imageLocked: value?.imageLocked === true,
    imageDirty: value?.imageDirty === true || !value?.imageUrl,
  }
}

function fallbackPanels(topic: string, worldContext: string, characters: Character[]): Panel[] {
  const subject = topic.trim() || "la historia descrita"
  const contextHint = worldContext.trim() ? "Respeta las reglas y ambientación del contexto del mundo." : "Mantén continuidad con la escena anterior."
  const base = [
    ["Inicio", `Presenta el mundo, al protagonista y la situación inicial de ${subject}.`, "Algo está a punto de cambiar.", "plano general", "expectativa"],
    ["Incidente", `Ocurre un hecho que altera la vida del protagonista y activa el conflicto.`, "No puedo ignorar lo que acaba de pasar.", "plano medio", "sorpresa"],
    ["Decisión", `El protagonista toma una decisión y avanza hacia una consecuencia concreta.`, "Tengo que descubrir la verdad.", "plano dinámico", "determinación"],
    ["Giro", `Aparece una evidencia o dificultad que cambia la comprensión del conflicto.`, "Esto cambia todo lo que creía saber.", "primer plano", "impacto"],
    ["Resolución", `El protagonista actúa usando lo aprendido y enfrenta el núcleo del problema.`, "Ahora sé qué debo hacer.", "plano conjunto", "resolución"],
    ["Cierre", `La historia concluye mostrando una consecuencia y una nueva perspectiva sobre ${subject}.`, "El futuro no será igual después de esto.", "plano final", "reflexión"],
  ]
  return base.map(([panelTitle, scene, dialogue, shot, emotion], index) => normalizePanel({
    id: uid("panel"),
    title: panelTitle,
    scene,
    dialogue,
    shot,
    emotion,
    background: contextHint,
    imagePrompt: scene,
    imageDirty: true,
    dialoguePosition: index % 2 ? "top-right" : "top-left",
  }, index, characters))
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

function stripTransientCharacter(character: Character) {
  const { referenceLoading: _loading, referenceError: _error, ...rest } = character
  return rest
}

function stripTransientPanel(panel: Panel) {
  const { loading: _loading, error: _error, ...rest } = panel
  return rest
}

function mergeGeneratedCharacter(existing: Character | undefined, generated: any, index: number): Character {
  if (!existing) return normalizeCharacter({ ...generated, userCreated: false, appearsAlways: generated?.appearsAlways === true }, index)
  if (existing.identityLocked) return existing
  return normalizeCharacter({
    ...generated,
    id: existing.id,
    name: existing.name,
    description: existing.description || generated?.description,
    visualDescription: existing.visualDescription || generated?.visualDescription,
    fixedTraits: existing.fixedTraits || generated?.fixedTraits,
    outfit: existing.outfit || generated?.outfit,
    accessories: existing.accessories || generated?.accessories,
    prohibitedChanges: existing.prohibitedChanges || generated?.prohibitedChanges,
    role: existing.role,
    appearsAlways: existing.appearsAlways,
    userCreated: existing.userCreated,
    identityLocked: existing.identityLocked,
    referenceImageUrl: existing.referenceImageUrl,
    referenceProvider: existing.referenceProvider,
    referenceModel: existing.referenceModel,
    referenceStale: true,
  }, index)
}

export default function ComicsCreatorStudio() {
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get("project")
  const [title, setTitle] = useState("Nueva historieta")
  const [summary, setSummary] = useState("")
  const [topic, setTopic] = useState("")
  const [worldContext, setWorldContext] = useState("")
  const [audience, setAudience] = useState("Estudiantes de enseñanza media")
  const [educationalGoal, setEducationalGoal] = useState("")
  const [autoCast, setAutoCast] = useState(true)
  const [allowExtras, setAllowExtras] = useState(true)
  const [style, setStyle] = useState<ComicStyle>("manga")
  const [styleDirection, setStyleDirection] = useState(DEFAULT_STYLE_DIRECTION.manga)
  const [consistencyMode, setConsistencyMode] = useState<ConsistencyMode>("high")
  const [panelCount, setPanelCount] = useState(6)
  const [accentColor, setAccentColor] = useState("#a45135")
  const [characters, setCharacters] = useState<Character[]>([blankCharacter(1)])
  const [panels, setPanels] = useState<Panel[]>([])
  const [visualBible, setVisualBible] = useState<VisualBible>({ locked: false, stale: true })
  const [projectId, setProjectId] = useState<string | null>(null)
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const hydratedRef = useRef(false)

  const project = useMemo(() => ({
    version: "comics-consistent-v5",
    title,
    summary,
    topic,
    worldContext,
    audience,
    educationalGoal,
    autoCast,
    allowExtras,
    style,
    styleDirection,
    consistencyMode,
    panelCount,
    accentColor,
    characters: characters.map(stripTransientCharacter),
    panels: panels.map(stripTransientPanel),
    visualBible: { ...visualBible, loading: false, error: "" },
  }), [accentColor, allowExtras, audience, autoCast, characters, consistencyMode, educationalGoal, panelCount, panels, style, styleDirection, summary, title, topic, visualBible, worldContext])

  useEffect(() => {
    if (!requestedProjectId || hydratedRef.current) return
    hydratedRef.current = true
    void loadCloudCreatorHubProject(requestedProjectId).then((saved) => {
      if (!saved || saved.format !== "comic" || !saved.data || typeof saved.data !== "object") return
      const data = saved.data as any
      const restoredCharacters = Array.isArray(data.characters) ? data.characters.map(normalizeCharacter) : []
      const safeCharacters = restoredCharacters.length ? restoredCharacters : [blankCharacter(1)]
      setProjectId(saved.id)
      setTitle(data.title || saved.title)
      setSummary(data.summary || "")
      setTopic(data.topic || "")
      setWorldContext(data.worldContext || "")
      setAudience(data.audience || "Estudiantes")
      setEducationalGoal(data.educationalGoal || "")
      setAutoCast(data.autoCast !== false)
      setAllowExtras(data.allowExtras !== false)
      setStyle(data.style || "manga")
      setStyleDirection(data.styleDirection || DEFAULT_STYLE_DIRECTION[data.style as ComicStyle] || DEFAULT_STYLE_DIRECTION.manga)
      setConsistencyMode(data.consistencyMode || "high")
      setPanelCount(Number(data.panelCount) || 6)
      setAccentColor(data.accentColor || saved.accentColor || "#a45135")
      setCharacters(safeCharacters)
      setPanels(Array.isArray(data.panels) ? data.panels.map((panel: any, index: number) => normalizePanel(panel, index, safeCharacters)) : [])
      setVisualBible({
        castImageUrl: data.visualBible?.castImageUrl,
        provider: data.visualBible?.provider,
        model: data.visualBible?.model,
        generatedAt: data.visualBible?.generatedAt,
        locked: data.visualBible?.locked === true,
        stale: data.visualBible?.stale !== false,
        loading: false,
        error: "",
      })
      setMessage("Proyecto reabierto.")
    })
  }, [requestedProjectId])

  useEffect(() => {
    if (!projectId) return
    updateCreatorHubProject(projectId, {
      title: title || "Historieta",
      data: project,
      accentColor,
      designTemplateId: `comic:${style}`,
    })
  }, [accentColor, project, projectId, style, title])

  const ensureProject = (nextProject: typeof project) => {
    if (projectId) return projectId
    const saved = saveCreatorHubProject({
      format: "comic",
      title: nextProject.title || "Historieta",
      data: nextProject,
      accentColor,
      designTemplateId: `comic:${style}`,
    })
    setProjectId(saved?.id || null)
    return saved?.id || null
  }

  const commonImagePayload = (nextCharacters: Character[]) => ({
    title,
    topic,
    worldContext,
    audience,
    educationalGoal,
    allowExtras,
    style,
    styleDirection,
    consistencyMode,
    characters: nextCharacters.map(stripTransientCharacter),
  })

  const updateStyle = (nextStyle: ComicStyle) => {
    setStyle(nextStyle)
    setStyleDirection(DEFAULT_STYLE_DIRECTION[nextStyle])
    if (!visualBible.locked) setVisualBible((current) => ({ ...current, stale: true }))
    setCharacters((current) => current.map((character) => character.identityLocked ? character : { ...character, referenceStale: true }))
    setPanels((current) => current.map((panel) => panel.imageLocked ? panel : { ...panel, imageDirty: true }))
  }

  const updateCharacter = (id: string, field: keyof Character, value: string | boolean) => {
    const identityFields: Array<keyof Character> = [
      "name", "visualDescription", "fixedTraits", "outfit", "accessories", "prohibitedChanges", "role",
    ]
    setCharacters((current) => current.map((character) => {
      if (character.id !== id) return character
      const next = { ...character, [field]: value }
      if (identityFields.includes(field)) next.referenceStale = true
      return next
    }))
    if (identityFields.includes(field) && !visualBible.locked) {
      setVisualBible((current) => ({ ...current, stale: true }))
      setPanels((current) => current.map((panel) => panel.imageLocked ? panel : { ...panel, imageDirty: true }))
    }
    if (field === "appearsAlways") {
      setPanels((current) => current.map((panel) => ({
        ...panel,
        characterIds: value === true
          ? [...new Set([...panel.characterIds, id])]
          : panel.characterIds,
        imageDirty: panel.imageLocked ? panel.imageDirty : true,
      })))
    }
  }

  const removeCharacter = (id: string) => {
    setCharacters((current) => current.filter((character) => character.id !== id))
    setPanels((current) => current.map((panel) => ({
      ...panel,
      characterIds: panel.characterIds.filter((characterId) => characterId !== id),
      imageDirty: panel.imageLocked ? panel.imageDirty : true,
    })))
    if (!visualBible.locked) setVisualBible((current) => ({ ...current, stale: true }))
  }

  const updatePanel = (id: string, patch: Partial<Panel>, visualChange = false) => {
    setPanels((current) => current.map((panel) => panel.id === id
      ? { ...panel, ...patch, imageDirty: visualChange && !panel.imageLocked ? true : panel.imageDirty }
      : panel))
  }

  const requestStoryboard = async () => {
    if (!topic.trim() && !worldContext.trim()) throw new Error("Describe la historia o el contexto del mundo.")
    if (!characters.length) throw new Error("Agrega al menos un personaje.")
    setProgress({ stage: "storyboard", done: 0, total: 1, current: "Construyendo la historia" })
    const response = await fetch("/api/creator/comics/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        worldContext,
        audience,
        educationalGoal,
        style,
        panelCount,
        autoCast,
        allowExtras,
        characters: characters.map(stripTransientCharacter),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.storyboard) throw new Error(payload?.error || "No fue posible generar el storyboard.")

    const storyboard = payload.storyboard
    const generatedCharacters = Array.isArray(storyboard.characters) ? storyboard.characters : []
    const nextCharacters: Character[] = generatedCharacters.map((generated: any, index: number) => {
      const existing = characters.find((character) => character.name.trim().toLowerCase() === String(generated.name || "").trim().toLowerCase())
      return mergeGeneratedCharacter(existing, generated, index)
    })
    const safeCharacters: Character[] = nextCharacters.length ? nextCharacters : characters
    const nameToId = new Map(safeCharacters.map((character) => [character.name.trim().toLowerCase(), character.id]))
    const alwaysIds = safeCharacters.filter((character) => character.appearsAlways).map((character) => character.id)
    const nextPanels = Array.isArray(storyboard.panels)
      ? storyboard.panels.map((panel: any, index: number) => normalizePanel({
          ...panel,
          id: uid("panel"),
          dialoguePosition: index % 2 ? "top-right" : "top-left",
          characterIds: [...alwaysIds, ...(Array.isArray(panel.characterNames)
            ? panel.characterNames.map((name: unknown) => nameToId.get(String(name).trim().toLowerCase())).filter(Boolean)
            : [])],
          imageDirty: true,
        }, index, safeCharacters))
      : fallbackPanels(topic, worldContext, safeCharacters)

    const nextTitle = storyboard.title || title
    const nextSummary = storyboard.summary || ""
    const nextStyleDirection = storyboard.styleDirection || styleDirection
    setTitle(nextTitle)
    setSummary(nextSummary)
    setStyleDirection(nextStyleDirection)
    setCharacters(safeCharacters)
    setPanels(nextPanels)
    if (!visualBible.locked) setVisualBible((current) => ({ ...current, stale: true }))
    setProgress({ stage: "storyboard", done: 1, total: 1, current: "Storyboard listo" })
    return { title: nextTitle, summary: nextSummary, styleDirection: nextStyleDirection, characters: safeCharacters, panels: nextPanels }
  }

  const generateCastReference = async (nextCharacters: Character[], force = false) => {
    if (visualBible.castImageUrl && visualBible.locked && !force) return visualBible
    if (visualBible.castImageUrl && !visualBible.stale && !force) return visualBible
    setVisualBible((current) => ({ ...current, loading: true, error: "" }))
    setProgress({ stage: "cast", done: 0, total: 1, current: "Creando la biblia visual" })
    const response = await fetch("/api/creator/comics/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cast", ...commonImagePayload(nextCharacters), preferredModel: visualBible.model || "" }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.imageUrl) {
      const failure = payload?.error || "No fue posible crear la biblia visual."
      setVisualBible((current) => ({ ...current, loading: false, error: failure }))
      throw new Error(failure)
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
  }

  const requestCharacterReference = async (character: Character, sourceCharacters: Character[], castImageUrl: string, preferredModel: string) => {
    const response = await fetch("/api/creator/comics/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "character",
        ...commonImagePayload(sourceCharacters),
        characterId: character.id,
        castImageUrl,
        preferredModel,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.imageUrl) throw new Error(payload?.error || `No fue posible crear la referencia de ${character.name}.`)
    return { ...character, referenceImageUrl: payload.imageUrl, referenceProvider: payload.provider, referenceModel: payload.model, referenceLoading: false, referenceError: "", referenceStale: false }
  }

  const generateVisualBible = async (sourceCharacters: Character[], force = false) => {
    const bible = await generateCastReference(sourceCharacters, force)
    const castImageUrl = bible.castImageUrl || ""
    if (!castImageUrl) throw new Error("La biblia visual no contiene una imagen.")
    const targets = sourceCharacters.filter((character) => !character.identityLocked && (force || !character.referenceImageUrl || character.referenceStale))
    if (!targets.length) return { bible, characters: sourceCharacters }
    setProgress({ stage: "characters", done: 0, total: targets.length, current: "Preparando personajes" })
    setCharacters((current) => current.map((character) => targets.some((target) => target.id === character.id) ? { ...character, referenceLoading: true, referenceError: "" } : character))
    const generated = new Map<string, Character>()
    let completed = 0
    await runPool(targets, 3, async (character) => {
      try {
        generated.set(character.id, await requestCharacterReference(character, sourceCharacters, castImageUrl, bible.model || ""))
      } catch (reason) {
        generated.set(character.id, { ...character, referenceLoading: false, referenceError: reason instanceof Error ? reason.message : "Falló la referencia visual.", referenceStale: true })
      } finally {
        completed += 1
        setProgress({ stage: "characters", done: completed, total: targets.length, current: character.name })
      }
    })
    const nextCharacters = sourceCharacters.map((character) => generated.get(character.id) || character)
    setCharacters(nextCharacters)
    return { bible, characters: nextCharacters }
  }

  const generateOneCharacterReference = async (character: Character) => {
    if (character.referenceLoading) return
    setError("")
    try {
      const { bible } = await generateVisualBible(characters, false)
      setCharacters((current) => current.map((item) => item.id === character.id ? { ...item, referenceLoading: true, referenceError: "" } : item))
      const updated = await requestCharacterReference(character, characters, bible.castImageUrl || "", bible.model || "")
      setCharacters((current) => current.map((item) => item.id === character.id ? updated : item))
      setMessage(`Referencia visual de ${character.name} actualizada.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible generar la referencia visual.")
    } finally {
      setProgress(null)
    }
  }

  const generatePanelImage = async (panel: Panel, index: number, sourcePanels = panels, sourceCharacters = characters, bible = visualBible, force = false) => {
    if (panel.loading || panel.imageLocked) return false
    if (!force && panel.imageUrl && !panel.imageDirty) return true
    setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, loading: true, error: "" } : item))
    try {
      const neighborImages = [sourcePanels[index - 1]?.imageUrl, sourcePanels[index + 1]?.imageUrl].filter(Boolean)
      const response = await fetch("/api/creator/comics/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "panel",
          ...commonImagePayload(sourceCharacters),
          panel: stripTransientPanel(panel),
          panels: sourcePanels.map(stripTransientPanel),
          panelIndex: index,
          castImageUrl: bible.castImageUrl || "",
          neighborImages,
          preferredModel: bible.model || "",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.imageUrl) throw new Error(payload?.error || "No fue posible generar esta viñeta.")
      setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, imageUrl: payload.imageUrl, provider: payload.provider, model: payload.model, referenceCount: payload.referenceCount, loading: false, error: "", imageDirty: false } : item))
      return true
    } catch (reason) {
      setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, loading: false, error: reason instanceof Error ? reason.message : "No fue posible generar la imagen." } : item))
      return false
    }
  }

  const generatePanelsBatch = async (sourcePanels: Panel[], sourceCharacters: Character[], bible: VisualBible, force = false) => {
    const targets = sourcePanels.map((panel, index) => ({ panel, index })).filter(({ panel }) => !panel.hidden && !panel.imageLocked && (force || !panel.imageUrl || panel.imageDirty))
    if (!targets.length) {
      setGeneratingAll(false)
      setProgress(null)
      setMessage("Las imágenes visibles ya están actualizadas o bloqueadas.")
      return
    }
    setGeneratingAll(true)
    let completed = 0
    setProgress({ stage: "panels", done: 0, total: targets.length, current: "Generando viñetas" })
    await runPool(targets, 3, async ({ panel, index }) => {
      await generatePanelImage(panel, index, sourcePanels, sourceCharacters, bible, force)
      completed += 1
      setProgress({ stage: "panels", done: completed, total: targets.length, current: panel.title })
    })
    setGeneratingAll(false)
    setProgress(null)
    setMessage("Generación terminada con el reparto, el contexto del mundo y la biblia visual compartidos.")
  }

  const generateAllImages = async (force = false) => {
    if (!panels.length || generatingAll) return
    setGeneratingAll(true)
    setError("")
    setMessage("")
    try {
      const identityPack = await generateVisualBible(characters, false)
      await generatePanelsBatch(panels, identityPack.characters, identityPack.bible, force)
    } catch (reason) {
      setGeneratingAll(false)
      setProgress(null)
      setError(reason instanceof Error ? reason.message : "No fue posible generar la historieta completa.")
    }
  }

  const generateStoryboardOnly = async () => {
    setGeneratingStoryboard(true)
    setError("")
    setMessage("")
    try {
      const generated = await requestStoryboard()
      ensureProject({ ...project, title: generated.title, summary: generated.summary, styleDirection: generated.styleDirection, characters: generated.characters.map(stripTransientCharacter), panels: generated.panels.map(stripTransientPanel) })
      setMessage("Storyboard creado.")
    } catch (reason) {
      const fallback = fallbackPanels(topic, worldContext, characters)
      setPanels(fallback)
      ensureProject({ ...project, panels: fallback.map(stripTransientPanel) })
      setError(`${reason instanceof Error ? reason.message : "Falló la IA."} Se creó una estructura local para continuar.`)
    } finally {
      setGeneratingStoryboard(false)
      setProgress(null)
    }
  }

  const createCompleteComic = async () => {
    if ((!topic.trim() && !worldContext.trim()) || generatingStoryboard || generatingAll) return
    setGeneratingStoryboard(true)
    setGeneratingAll(true)
    setError("")
    setMessage("")
    try {
      const generated = await requestStoryboard()
      ensureProject({ ...project, title: generated.title, summary: generated.summary, styleDirection: generated.styleDirection, characters: generated.characters.map(stripTransientCharacter), panels: generated.panels.map(stripTransientPanel) })
      const identityPack = await generateVisualBible(generated.characters, true)
      await generatePanelsBatch(generated.panels, identityPack.characters, identityPack.bible, true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear la historieta completa.")
      setProgress(null)
      setGeneratingAll(false)
    } finally {
      setGeneratingStoryboard(false)
    }
  }

  const copyProject = async () => {
    await navigator.clipboard.writeText(JSON.stringify(project, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const progressPercent = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0
  const primaryBusy = generatingStoryboard || generatingAll

  return (
    <main className="min-h-screen bg-app">
      <header className="sticky top-0 z-20 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/creator-hub" className="p-2 text-muted2 hover:text-main"><ArrowLeft size={15} /></Link>
            <div><h1 className="font-bold text-main">Mangas e historietas</h1><p className="text-xs text-muted2">Reparto controlado, mundo persistente, referencias compartidas y diálogo editable.</p></div>
          </div>
          <Link href="/qr-studio" className="flex items-center gap-1.5 px-2 py-2 text-xs text-sub"><QrCode size={14} /> QR Studio</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1580px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[455px_minmax(0,1fr)]">
        <section className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-92px)] xl:overflow-y-auto xl:pr-1">
          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <h2 className="mb-4 font-semibold text-main">Historia y mundo</h2>
            <div className="space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm font-bold text-main outline-none" />
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} maxLength={4000} placeholder="Premisa, tema o conflicto principal" className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <div><textarea value={worldContext} onChange={(event) => setWorldContext(event.target.value)} rows={8} maxLength={12000} placeholder="Contexto completo del mundo: época, lugares, reglas, sociedad, tecnología, magia, historia previa, conflictos, tono y cualquier condición que deba mantenerse en toda la obra." className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm leading-5 text-main outline-none" /><p className="mt-1 text-right text-[9px] text-muted2">{worldContext.length.toLocaleString("es-CL")} / 12.000</p></div>
              <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Público objetivo" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <textarea value={educationalGoal} onChange={(event) => setEducationalGoal(event.target.value)} rows={2} placeholder="Objetivo narrativo o educativo opcional" className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-2 rounded-xl border border-soft p-3 text-xs text-sub"><input type="checkbox" checked={autoCast} onChange={(event) => setAutoCast(event.target.checked)} className="mt-0.5" /><span><strong className="block text-main">Completar reparto</strong>Si solo hay un personaje, crea secundarios adecuados al mundo, nunca un guía automático.</span></label>
                <label className="flex items-start gap-2 rounded-xl border border-soft p-3 text-xs text-sub"><input type="checkbox" checked={allowExtras} onChange={(event) => setAllowExtras(event.target.checked)} className="mt-0.5" /><span><strong className="block text-main">Permitir extras</strong>Multitudes o personajes ambientales sin convertirlos en protagonistas.</span></label>
              </div>
              <div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-black uppercase tracking-wider text-muted2">Viñetas<input type="number" min={4} max={10} value={panelCount} onChange={(event) => setPanelCount(Math.max(4, Math.min(10, Number(event.target.value) || 6)))} className="mt-1.5 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main" /></label><ColorPalette value={accentColor} onChange={setAccentColor} /></div>
            </div>
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <h2 className="mb-3 font-semibold text-main">Estilo y consistencia</h2>
            <div className="grid grid-cols-2 gap-2">{STYLES.map((item) => <button key={item.id} type="button" onClick={() => updateStyle(item.id)} className="rounded-2xl border p-3 text-left" style={{ borderColor: style === item.id ? `${accentColor}66` : "var(--border-soft)", background: style === item.id ? `${accentColor}0f` : "var(--bg-card-soft)" }}><p className="text-sm font-semibold text-main">{item.icon} {item.label}</p><p className="mt-1 text-xs text-muted2">{item.description}</p></button>)}</div>
            <textarea value={styleDirection} onChange={(event) => { setStyleDirection(event.target.value); if (!visualBible.locked) setVisualBible((current) => ({ ...current, stale: true })); setPanels((current) => current.map((panel) => panel.imageLocked ? panel : { ...panel, imageDirty: true })) }} rows={4} className="mt-3 w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-sub outline-none" placeholder="Dirección artística global" />
            <div className="mt-3 grid grid-cols-3 gap-2">{CONSISTENCY_MODES.map((mode) => <button key={mode.id} type="button" onClick={() => { setConsistencyMode(mode.id); setPanels((current) => current.map((panel) => panel.imageLocked ? panel : { ...panel, imageDirty: true })) }} className="rounded-xl border p-2 text-left" style={{ borderColor: consistencyMode === mode.id ? `${accentColor}66` : "var(--border-soft)" }}><p className="text-[11px] font-bold text-main">{mode.label}</p><p className="mt-1 text-[9px] leading-4 text-muted2">{mode.description}</p></button>)}</div>
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-main">Biblia visual</h2><p className="mt-1 text-[10px] leading-4 text-muted2">Incluye únicamente el reparto actual.</p></div><button type="button" onClick={() => setVisualBible((current) => ({ ...current, locked: !current.locked }))} className="p-2 text-muted2">{visualBible.locked ? <Lock size={15} /> : <Unlock size={15} />}</button></div>
            <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-soft bg-card-soft-theme">{visualBible.castImageUrl ? <img src={visualBible.castImageUrl} alt="Biblia visual" className="h-full w-full object-cover" /> : visualBible.loading ? <LoaderCircle size={28} className="animate-spin text-muted2" /> : <div className="text-center text-muted2"><Images size={28} className="mx-auto" /><p className="mt-2 text-xs">Sin generar</p></div>}</div>
            <div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold text-sub">{visualBible.model || "Modelo pendiente"}</p><p className={`text-[9px] ${visualBible.stale ? "text-amber-600" : "text-emerald-600"}`}>{visualBible.stale ? "Debe actualizarse" : "Identidad sincronizada"}</p></div><button type="button" disabled={visualBible.loading || visualBible.locked} onClick={() => void generateVisualBible(characters, true).then(() => { setProgress(null); setMessage("Biblia visual actualizada.") }).catch((reason) => { setProgress(null); setError(reason instanceof Error ? reason.message : "Falló la biblia visual.") })} className="flex items-center gap-1.5 px-2 py-2 text-xs font-semibold text-sub disabled:opacity-35">{visualBible.loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} {visualBible.castImageUrl ? "Regenerar" : "Generar"}</button></div>
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-main">Personajes</h2><p className="mt-1 text-[10px] text-muted2">El sistema no agrega un guía por defecto.</p></div><button type="button" onClick={() => setCharacters((current) => [...current, blankCharacter(current.length + 1)])} className="flex items-center gap-1.5 text-xs text-blue-600"><Plus size={13} /> Agregar</button></div>
            <div className="space-y-3">{characters.map((character) => <article key={character.id} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="flex gap-3"><div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-soft bg-card-theme">{character.referenceImageUrl ? <img src={character.referenceImageUrl} alt={`Referencia de ${character.name}`} className="h-full w-full object-cover" /> : character.referenceLoading ? <LoaderCircle size={20} className="animate-spin text-muted2" /> : <UserRound size={22} className="text-muted2" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1"><input disabled={character.identityLocked} value={character.name} onChange={(event) => updateCharacter(character.id, "name", event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-main outline-none disabled:opacity-60" /><button type="button" onClick={() => updateCharacter(character.id, "identityLocked", !character.identityLocked)} className="p-1.5 text-muted2">{character.identityLocked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" onClick={() => removeCharacter(character.id)} disabled={characters.length <= 1} className="p-1.5 text-muted2 hover:text-red-500 disabled:opacity-25"><Trash2 size={13} /></button></div><textarea value={character.description} onChange={(event) => updateCharacter(character.id, "description", event.target.value)} rows={2} className="mt-1 w-full resize-y bg-transparent text-[11px] leading-4 text-muted2 outline-none" /><div className="mt-2 grid grid-cols-2 gap-2"><select disabled={character.identityLocked} value={character.role} onChange={(event) => updateCharacter(character.id, "role", event.target.value)} className="rounded-lg border border-soft bg-card-theme px-2 py-1.5 text-[10px] text-sub">{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="flex items-center gap-1.5 rounded-lg border border-soft px-2 py-1.5 text-[10px] text-sub"><input type="checkbox" checked={character.appearsAlways} onChange={(event) => updateCharacter(character.id, "appearsAlways", event.target.checked)} /> Siempre aparece</label></div><div className="mt-2 flex items-center justify-between gap-2"><span className={`text-[9px] font-bold ${character.referenceStale ? "text-amber-600" : character.referenceImageUrl ? "text-emerald-600" : "text-muted2"}`}>{character.userCreated ? "Definido por usuario" : "Secundario generado"} · {character.referenceStale ? "referencia pendiente" : character.referenceImageUrl ? "identidad lista" : "sin referencia"}</span><button type="button" disabled={character.referenceLoading || character.identityLocked} onClick={() => void generateOneCharacterReference(character)} className="flex items-center gap-1 text-[10px] font-bold text-sub disabled:opacity-35">{character.referenceLoading ? <LoaderCircle size={11} className="animate-spin" /> : <ImagePlus size={11} />} Referencia</button></div></div></div>
              <details className="mt-3 rounded-xl border border-soft p-3" open={!character.referenceImageUrl}><summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-muted2">Contrato visual</summary><div className="mt-3 space-y-2"><label className="block text-[9px] font-bold uppercase tracking-wider text-muted2">Apariencia<textarea disabled={character.identityLocked} value={character.visualDescription} onChange={(event) => updateCharacter(character.id, "visualDescription", event.target.value)} rows={3} className="mt-1 w-full resize-y rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-[11px] normal-case leading-4 text-sub outline-none disabled:opacity-55" /></label><label className="block text-[9px] font-bold uppercase tracking-wider text-muted2">Rasgos fijos<textarea disabled={character.identityLocked} value={character.fixedTraits} onChange={(event) => updateCharacter(character.id, "fixedTraits", event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-[11px] normal-case leading-4 text-sub outline-none disabled:opacity-55" /></label><label className="block text-[9px] font-bold uppercase tracking-wider text-muted2">Vestuario<textarea disabled={character.identityLocked} value={character.outfit} onChange={(event) => updateCharacter(character.id, "outfit", event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-[11px] normal-case leading-4 text-sub outline-none disabled:opacity-55" /></label><label className="block text-[9px] font-bold uppercase tracking-wider text-muted2">Accesorios<input disabled={character.identityLocked} value={character.accessories} onChange={(event) => updateCharacter(character.id, "accessories", event.target.value)} className="mt-1 w-full rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-[11px] normal-case text-sub outline-none disabled:opacity-55" /></label><label className="block text-[9px] font-bold uppercase tracking-wider text-muted2">No cambiar<textarea disabled={character.identityLocked} value={character.prohibitedChanges} onChange={(event) => updateCharacter(character.id, "prohibitedChanges", event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-soft bg-card-theme px-2.5 py-2 text-[11px] normal-case leading-4 text-sub outline-none disabled:opacity-55" /></label></div></details>
              {character.referenceError && <p className="mt-2 text-[10px] text-red-500">{character.referenceError}</p>}
            </article>)}</div>
          </div>

          {progress && <div className="rounded-2xl border border-soft bg-card-theme p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-main">{progress.current}</p><p className="mt-1 text-[10px] text-muted2">{progress.done} de {progress.total}</p></div><span className="text-xs font-black text-sub">{progressPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-card-soft-theme"><div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: accentColor }} /></div></div>}
          {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-3 text-xs leading-5 text-red-500">{error}</div>}
          {message && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-700">{message}</div>}
          <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void createCompleteComic()} disabled={primaryBusy || (!topic.trim() && !worldContext.trim()) || !characters.length} className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40" style={{ background: accentColor }}>{primaryBusy ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}{primaryBusy ? "Creando..." : "Crear completa"}</button><button type="button" onClick={() => void generateStoryboardOnly()} disabled={primaryBusy || (!topic.trim() && !worldContext.trim()) || !characters.length} className="flex items-center justify-center gap-2 rounded-xl border border-soft px-4 py-3 text-sm font-bold text-sub disabled:opacity-40"><Sparkles size={16} /> Solo storyboard</button></div>
        </section>

        <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-main">Storyboard editable</h2><p className="mt-1 text-xs text-muted2">El diálogo se distribuye en zonas seguras y no regenera la imagen.</p></div><div className="flex flex-wrap gap-1"><button type="button" onClick={() => setPanels((current) => [...current, normalizePanel({ title: `Viñeta ${current.length + 1}`, scene: "Describe la escena.", dialogue: "Escribe el diálogo.", shot: "plano medio", imagePrompt: "", imageDirty: true }, current.length, characters)])} className="flex items-center gap-1.5 px-2 py-2 text-xs text-sub"><Plus size={13} /> Viñeta</button><button type="button" onClick={() => void generateAllImages(false)} disabled={generatingAll || !panels.length} className="flex items-center gap-1.5 px-2 py-2 text-xs font-bold text-sub disabled:opacity-40">{generatingAll ? <LoaderCircle size={13} className="animate-spin" /> : <ImagePlus size={13} />} Actualizar imágenes</button><button type="button" onClick={copyProject} className="flex items-center gap-1.5 px-2 py-2 text-xs text-sub"><Copy size={13} /> {copied ? "Copiado" : "JSON"}</button></div></div>
          {summary && <div className="mb-4 rounded-2xl border border-soft bg-card-soft-theme p-4 text-xs leading-6 text-sub"><strong>Sinopsis:</strong> {summary}</div>}

          {panels.length === 0 ? <div className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-soft p-8 text-center"><span className="text-5xl">💬</span><p className="font-semibold text-main">Todavía no hay viñetas</p><p className="max-w-sm text-sm text-muted2">Crea la historieta completa o genera solamente el storyboard.</p></div> : <div className={`grid gap-4 ${style === "webtoon" ? "grid-cols-1" : "2xl:grid-cols-2"}`}>{panels.map((panel, index) => <article key={panel.id} className={`rounded-3xl border border-soft bg-card-soft-theme p-3 ${panel.hidden ? "opacity-50" : ""}`}>
            <div className="mb-3 flex items-center gap-1"><span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${accentColor}18`, color: accentColor }}>{index + 1}</span><input disabled={panel.locked} value={panel.title} onChange={(event) => updatePanel(panel.id, { title: event.target.value }, false)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-main outline-none disabled:opacity-50" />{panel.imageDirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-amber-700">Actualizar</span>}<button type="button" onClick={() => updatePanel(panel.id, { hidden: !panel.hidden })} className="p-1.5 text-muted2">{panel.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button><button type="button" onClick={() => updatePanel(panel.id, { locked: !panel.locked })} className="p-1.5 text-muted2">{panel.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" onClick={() => setPanels((current) => moveItem(current, index, -1))} disabled={index === 0} className="p-1 text-muted2 disabled:opacity-25"><ArrowUp size={13} /></button><button type="button" onClick={() => setPanels((current) => moveItem(current, index, 1))} disabled={index === panels.length - 1} className="p-1 text-muted2 disabled:opacity-25"><ArrowDown size={13} /></button><button type="button" onClick={() => setPanels((current) => current.filter((item) => item.id !== panel.id))} className="p-1.5 text-muted2 hover:text-red-500"><Trash2 size={13} /></button></div>
            <div id={`comic-panel-${panel.id}`} className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-soft bg-white ${style === "webtoon" ? "aspect-[2/3]" : "aspect-[4/3]"}`}>
              {panel.imageUrl ? <img src={panel.imageUrl} alt={`Viñeta ${index + 1}: ${panel.title}`} className="h-full w-full object-cover" /> : panel.loading ? <div className="flex flex-col items-center gap-2 text-center"><LoaderCircle size={28} className="animate-spin" style={{ color: accentColor }} /><p className="text-xs text-muted2">Aplicando referencias...</p></div> : <button type="button" onClick={() => void generateVisualBible(characters, false).then((pack) => generatePanelImage(panel, index, panels, pack.characters, pack.bible, true)).catch((reason) => setError(reason instanceof Error ? reason.message : "Falló la imagen."))} className="flex flex-col items-center gap-2 p-5 text-muted2 hover:text-main"><ImagePlus size={30} /><span className="text-xs font-semibold">Generar imagen</span></button>}
              {panel.imageUrl && <DialogueOverlay dialogue={panel.dialogue} characters={characters.filter((character) => panel.characterIds.includes(character.id))} layout={panel.dialogueLayout} position={panel.dialoguePosition} />}
              {panel.imageUrl && <div className="absolute bottom-2 right-2 z-30 flex gap-1"><button type="button" onClick={() => void downloadRenderedAsImage(`comic-panel-${panel.id}`, `comic-vineta-${index + 1}`, "png")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white" title="Descargar"><Download size={13} /></button><button type="button" onClick={() => updatePanel(panel.id, { imageLocked: !panel.imageLocked })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white">{panel.imageLocked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" disabled={panel.imageLocked || panel.loading} onClick={() => void generateVisualBible(characters, false).then((pack) => generatePanelImage(panel, index, panels, pack.characters, pack.bible, true)).catch((reason) => setError(reason instanceof Error ? reason.message : "Falló la imagen."))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white disabled:opacity-35"><RefreshCw size={13} /></button></div>}
            </div>
            {panel.provider && <p className="mt-1 truncate text-[9px] text-muted2">Motor: {panel.provider} · {panel.model} · {panel.referenceCount || 0} referencias</p>}
            {panel.error && <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-red-500">{panel.error}</p>}
            <div className="mt-3 space-y-3">
              <div><p className="text-[9px] font-black uppercase tracking-wider text-muted2">Personajes visibles</p><div className="mt-1.5 flex flex-wrap gap-1">{characters.map((character) => { const active = panel.characterIds.includes(character.id); const required = character.appearsAlways; return <button key={character.id} type="button" disabled={panel.locked || required} onClick={() => updatePanel(panel.id, { characterIds: active ? panel.characterIds.filter((id) => id !== character.id) : [...panel.characterIds, character.id] }, true)} className="flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold disabled:opacity-60" style={{ borderColor: active ? `${accentColor}66` : "var(--border-soft)", color: active ? accentColor : "var(--text-muted)" }}>{active && <Check size={10} />}{character.name}{required ? " · fijo" : ""}</button> })}</div></div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-muted2">Escena<textarea disabled={panel.locked} value={panel.scene} onChange={(event) => updatePanel(panel.id, { scene: event.target.value }, true)} rows={4} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case leading-5 text-sub outline-none disabled:opacity-50" /></label>
              <label className="block text-[9px] font-black uppercase tracking-wider text-muted2">Diálogo · capa independiente<textarea disabled={panel.locked} value={panel.dialogue} onChange={(event) => updatePanel(panel.id, { dialogue: event.target.value }, false)} rows={4} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case leading-5 text-sub outline-none disabled:opacity-50" /></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black uppercase tracking-wider text-muted2">Distribución<select disabled={panel.locked} value={panel.dialogueLayout} onChange={(event) => updatePanel(panel.id, { dialogueLayout: event.target.value as DialogueLayout }, false)} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub"><option value="auto">Automática</option><option value="bubbles">Nubes</option><option value="caption">Banda inferior</option></select></label><label className="text-[9px] font-black uppercase tracking-wider text-muted2">Primera nube<select disabled={panel.locked} value={panel.dialoguePosition} onChange={(event) => updatePanel(panel.id, { dialoguePosition: event.target.value as DialoguePosition }, false)} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub"><option value="top-left">Arriba izquierda</option><option value="top-right">Arriba derecha</option><option value="bottom-left">Abajo izquierda</option><option value="bottom-right">Abajo derecha</option></select></label></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black uppercase tracking-wider text-muted2">Plano<input disabled={panel.locked} value={panel.shot} onChange={(event) => updatePanel(panel.id, { shot: event.target.value }, true)} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label><label className="text-[9px] font-black uppercase tracking-wider text-muted2">Emoción<input disabled={panel.locked} value={panel.emotion} onChange={(event) => updatePanel(panel.id, { emotion: event.target.value }, true)} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label></div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-muted2">Fondo<input disabled={panel.locked} value={panel.background} onChange={(event) => updatePanel(panel.id, { background: event.target.value }, true)} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label>
              <label className="block text-[9px] font-black uppercase tracking-wider text-muted2">Instrucción visual adicional<textarea disabled={panel.locked} value={panel.imagePrompt} onChange={(event) => updatePanel(panel.id, { imagePrompt: event.target.value }, true)} rows={2} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case leading-5 text-sub outline-none disabled:opacity-50" /></label>
            </div>
          </article>)}</div>}
          {panels.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-soft pt-4"><div className="flex items-center gap-2 text-[10px] text-muted2"><ShieldCheck size={13} /> {visualBible.castImageUrl ? "Identidad visual activa" : "Genera la biblia visual para mayor consistencia"}</div><button type="button" onClick={() => void generateAllImages(true)} disabled={generatingAll} className="flex items-center gap-2 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-sub disabled:opacity-35">{generatingAll ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerar no bloqueadas</button></div>}
        </section>
      </div>
    </main>
  )
}
