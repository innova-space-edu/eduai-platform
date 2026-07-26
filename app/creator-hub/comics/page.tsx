"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Copy, Download, Eye, EyeOff, ImagePlus, LoaderCircle, Lock, Plus, QrCode, RefreshCw, Sparkles, Trash2, Unlock } from "lucide-react"
import ColorPalette from "@/components/ui/ColorPalette"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"
import { loadCloudCreatorHubProject, saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"

type ComicStyle = "manga" | "western" | "webtoon" | "child"

type Character = {
  id: string
  name: string
  description: string
  visualDescription: string
}

type Panel = {
  id: string
  title: string
  scene: string
  dialogue: string
  shot: string
  imagePrompt: string
  imageUrl?: string
  provider?: string
  loading?: boolean
  error?: string
  hidden?: boolean
  locked?: boolean
}

const STYLES: Array<{ id: ComicStyle; label: string; icon: string; description: string }> = [
  { id: "manga", label: "Manga", icon: "🌸", description: "Blanco y negro, expresivo y dinámico" },
  { id: "western", label: "Historieta", icon: "💥", description: "Viñetas clásicas y coloridas" },
  { id: "webtoon", label: "Webtoon", icon: "📱", description: "Lectura vertical para celular" },
  { id: "child", label: "Cómic infantil", icon: "🧒", description: "Visual simple y amigable" },
]

const VISUAL_STYLE: Record<ComicStyle, string> = {
  manga: "black and white manga panel, precise ink line art, screentone shading, expressive faces, cinematic composition",
  western: "colorful western comic-book panel, clean outlines, dynamic action, polished digital illustration",
  webtoon: "modern Korean webtoon panel, clean digital illustration, vertical-friendly composition, polished colors",
  child: "friendly children's educational comic panel, simple readable shapes, warm colorful illustration",
}

const API_STYLE: Record<ComicStyle, string> = {
  manga: "anime",
  western: "digital art",
  webtoon: "anime",
  child: "educational",
}

function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fallbackPanels(topic: string): Panel[] {
  const subject = topic.trim() || "el tema elegido"
  const base = [
    ["Inicio", `Presenta el lugar, a los personajes y el contexto de ${subject}.`, "Algo extraño está ocurriendo. ¿Lo investigamos?", "plano general"],
    ["Pregunta", `El protagonista descubre un desafío o pregunta central relacionada con ${subject}.`, "Antes de decidir, necesitamos entender el problema.", "plano medio"],
    ["Exploración", `Los personajes observan evidencias y comparan explicaciones sobre ${subject}.`, "Mira esta evidencia; cambia lo que pensábamos.", "plano detalle"],
    ["Explicación", `La guía explica el concepto principal mediante un ejemplo visual y cotidiano.`, "Ahora puedo relacionarlo con algo de la vida real.", "plano conjunto"],
    ["Resolución", `Los personajes aplican lo aprendido para resolver el desafío inicial.`, "La solución funciona porque usamos la evidencia correcta.", "plano dinámico"],
    ["Cierre", `La historia termina con una conclusión y una reflexión sobre ${subject}.`, "Comprender el tema nos ayuda a tomar mejores decisiones.", "plano final"],
  ]
  return base.map(([title, scene, dialogue, shot]) => ({
    id: uid("panel"),
    title,
    scene,
    dialogue,
    shot,
    imagePrompt: `${scene} ${shot}.`,
    hidden: false,
    locked: false,
  }))
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export default function ComicsCreatorPage() {
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get("project")
  const [title, setTitle] = useState("Nueva historieta educativa")
  const [summary, setSummary] = useState("")
  const [topic, setTopic] = useState("")
  const [audience, setAudience] = useState("Estudiantes de enseñanza media")
  const [educationalGoal, setEducationalGoal] = useState("")
  const [style, setStyle] = useState<ComicStyle>("manga")
  const [panelCount, setPanelCount] = useState(6)
  const [accentColor, setAccentColor] = useState("#ec4899")
  const [characters, setCharacters] = useState<Character[]>([
    { id: uid("character"), name: "Protagonista", description: "Estudiante curioso que formula preguntas y busca evidencias.", visualDescription: "Adolescente de cabello oscuro, mochila azul y expresión curiosa." },
    { id: uid("character"), name: "Guía", description: "Personaje que acompaña el aprendizaje con ejemplos claros.", visualDescription: "Persona adulta de cabello corto, chaqueta clara y cuaderno en la mano." },
  ])
  const [panels, setPanels] = useState<Panel[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const hydratedRef = useRef(false)

  const project = useMemo(() => ({
    version: "comics-layered-v3",
    title,
    summary,
    topic,
    audience,
    educationalGoal,
    style,
    panelCount,
    accentColor,
    characters,
    panels,
  }), [accentColor, audience, characters, educationalGoal, panelCount, panels, style, summary, title, topic])

  useEffect(() => {
    if (!requestedProjectId || hydratedRef.current) return
    hydratedRef.current = true
    void loadCloudCreatorHubProject(requestedProjectId).then((saved) => {
      if (!saved || saved.format !== "comic" || !saved.data || typeof saved.data !== "object") return
      const data = saved.data as any
      setProjectId(saved.id)
      setTitle(data.title || saved.title)
      setSummary(data.summary || "")
      setTopic(data.topic || "")
      setAudience(data.audience || "Estudiantes")
      setEducationalGoal(data.educationalGoal || "")
      setStyle(data.style || "manga")
      setPanelCount(Number(data.panelCount) || 6)
      setAccentColor(data.accentColor || saved.accentColor || "#ec4899")
      setCharacters(Array.isArray(data.characters) ? data.characters : [])
      setPanels(Array.isArray(data.panels) ? data.panels : [])
      setMessage("Proyecto reabierto. Puedes continuar editándolo.")
    })
  }, [requestedProjectId])

  useEffect(() => {
    if (!projectId) return
    updateCreatorHubProject(projectId, {
      title: title || "Historieta educativa",
      data: project,
      accentColor,
      designTemplateId: `comic:${style}`,
    })
  }, [accentColor, project, projectId, style, title])

  const ensureProject = (nextProject: typeof project) => {
    if (projectId) return projectId
    const saved = saveCreatorHubProject({
      format: "comic",
      title: nextProject.title || "Historieta educativa",
      data: nextProject,
      accentColor,
      designTemplateId: `comic:${style}`,
    })
    setProjectId(saved?.id || null)
    return saved?.id || null
  }

  const generateStoryboard = async () => {
    if (!topic.trim()) {
      setError("Describe primero el tema o la historia.")
      return
    }
    setGeneratingStoryboard(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/creator/comics/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, educationalGoal, style, panelCount, characters }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.storyboard) throw new Error(payload?.error || "No fue posible generar el storyboard.")
      const storyboard = payload.storyboard
      const nextCharacters = Array.isArray(storyboard.characters)
        ? storyboard.characters.map((character: any) => ({ id: uid("character"), name: character.name || "Personaje", description: character.description || "", visualDescription: character.visualDescription || character.description || "" }))
        : characters
      const nextPanels = Array.isArray(storyboard.panels)
        ? storyboard.panels.map((panel: any) => ({ id: uid("panel"), title: panel.title || "Viñeta", scene: panel.scene || "", dialogue: panel.dialogue || "", shot: panel.shot || "", imagePrompt: panel.imagePrompt || panel.scene || "", hidden: false, locked: false }))
        : fallbackPanels(topic)
      setTitle(storyboard.title || title)
      setSummary(storyboard.summary || "")
      setCharacters(nextCharacters)
      setPanels(nextPanels)
      const nextProject = { ...project, title: storyboard.title || title, summary: storyboard.summary || "", characters: nextCharacters, panels: nextPanels }
      ensureProject(nextProject)
      setMessage("Storyboard creado. Ahora puedes editar cada capa y generar las imágenes.")
    } catch (reason) {
      const fallback = fallbackPanels(topic)
      setPanels(fallback)
      ensureProject({ ...project, panels: fallback })
      setError(`${reason instanceof Error ? reason.message : "Falló la IA."} Se creó una estructura local para que puedas continuar.`)
    } finally {
      setGeneratingStoryboard(false)
    }
  }

  const buildImagePrompt = (panel: Panel, index: number) => {
    const cast = characters
      .filter((character) => character.name.trim())
      .map((character) => `${character.name}: ${character.visualDescription || character.description}`)
      .join(" | ")
    const storyContext = panels.map((item, itemIndex) => `${itemIndex + 1}. ${item.title}: ${item.scene}`).join(" ")
    return [
      `Create panel ${index + 1} of one coherent educational comic titled "${title}" about ${topic}.`,
      `Complete story continuity: ${storyContext}`,
      `Current panel: ${panel.title}. Scene: ${panel.scene}. Shot: ${panel.shot}. Detailed visual instruction: ${panel.imagePrompt}.`,
      `Character model sheet, identical in every panel: ${cast}. Do not change clothing, hair, face, colors, age or accessories.`,
      `Style: ${VISUAL_STYLE[style]}. Audience: ${audience}.`,
      educationalGoal ? `Educational objective: ${educationalGoal}.` : "",
      `Continuity key: EDUAI-${projectId || "comic"}-${characters.map((character) => character.name).join("-")}.`,
      "One single comic panel, no written words, no captions, no speech bubbles, no watermark. Leave clear negative space for an editable dialogue bubble.",
    ].filter(Boolean).join(" ")
  }

  const generatePanelImage = async (panel: Panel, index: number) => {
    if (panel.loading) return false
    setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, loading: true, error: "" } : item))
    try {
      const vertical = style === "webtoon"
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildImagePrompt(panel, index),
          customPrompt: buildImagePrompt(panel, index),
          style: API_STYLE[style],
          width: vertical ? 768 : 1024,
          height: vertical ? 1152 : 768,
          provider: "auto",
          mode: "quality",
          source: "comic_panel",
          topic: topic.trim() || title,
          educationalContext: `${audience}. ${educationalGoal}. Panel ${index + 1}: ${panel.scene}`,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.imageUrl) throw new Error(payload?.error || "Ningún motor de imagen quedó disponible.")
      setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, imageUrl: payload.imageUrl, provider: payload.model ? `${payload.provider} · ${payload.model}` : payload.provider, loading: false, error: "" } : item))
      return true
    } catch (reason) {
      setPanels((current) => current.map((item) => item.id === panel.id ? { ...item, loading: false, error: reason instanceof Error ? reason.message : "No fue posible generar la imagen." } : item))
      return false
    }
  }

  const generateAllImages = async () => {
    if (!panels.length || generatingAll) return
    setGeneratingAll(true)
    setMessage("Generando imágenes en orden para mantener la continuidad visual...")
    for (let index = 0; index < panels.length; index += 1) {
      const panel = panels[index]
      if (panel.hidden || panel.imageUrl) continue
      await generatePanelImage(panel, index)
    }
    setGeneratingAll(false)
    setMessage("Proceso de imágenes terminado. Revisa cada viñeta y regenera las que necesites.")
  }

  const updateCharacter = (id: string, field: keyof Omit<Character, "id">, value: string) => {
    setCharacters((current) => current.map((character) => character.id === id ? { ...character, [field]: value } : character))
  }

  const updatePanel = (id: string, patch: Partial<Panel>) => {
    setPanels((current) => current.map((panel) => panel.id === id ? { ...panel, ...patch } : panel))
  }

  const copyProject = async () => {
    await navigator.clipboard.writeText(JSON.stringify(project, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-soft bg-app backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/creator-hub" className="rounded-xl border border-soft p-2 text-muted2 hover:text-main"><ArrowLeft size={15} /></Link>
            <div><div className="flex items-center gap-2"><h1 className="font-bold text-main">Mangas e historietas por capas</h1><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${accentColor}18`, color: accentColor }}>PRO</span></div><p className="text-xs text-muted2">Storyboard con IA, personajes consistentes, imágenes por viñeta y diálogos editables.</p></div>
          </div>
          <Link href="/qr-studio" className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs text-sub"><QrCode size={14} /> QR Studio</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="space-y-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto xl:pr-1">
          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <h2 className="mb-4 font-semibold text-main">1. Define el proyecto</h2>
            <div className="space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título de la historieta" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm font-bold text-main outline-none" />
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={4} placeholder="Tema o historia central. Ejemplo: riesgos naturales en Antofagasta..." className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Público objetivo" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <textarea value={educationalGoal} onChange={(event) => setEducationalGoal(event.target.value)} rows={3} placeholder="Objetivo educativo" className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm text-main outline-none" />
              <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-black uppercase tracking-wider text-muted2">Viñetas<input type="number" min={4} max={10} value={panelCount} onChange={(event) => setPanelCount(Math.max(4, Math.min(10, Number(event.target.value) || 6)))} className="mt-1.5 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main" /></label><ColorPalette value={accentColor} onChange={setAccentColor} /></div>
            </div>
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5"><h2 className="mb-3 font-semibold text-main">2. Estilo visual</h2><div className="grid grid-cols-2 gap-2">{STYLES.map((item) => <button key={item.id} type="button" onClick={() => setStyle(item.id)} className="rounded-2xl border p-3 text-left" style={{ borderColor: style === item.id ? `${accentColor}66` : "var(--border-soft)", background: style === item.id ? `${accentColor}0f` : "var(--bg-card-soft)" }}><p className="text-sm font-semibold text-main">{item.icon} {item.label}</p><p className="mt-1 text-xs text-muted2">{item.description}</p></button>)}</div></div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-main">3. Ficha visual de personajes</h2><button type="button" onClick={() => setCharacters((current) => [...current, { id: uid("character"), name: "Nuevo personaje", description: "Rol dentro de la historia.", visualDescription: "Describe rostro, cabello, ropa, colores y accesorios." }])} className="flex items-center gap-1.5 text-xs text-blue-500"><Plus size={13} /> Agregar</button></div>
            <div className="space-y-2">{characters.map((character) => <div key={character.id} className="rounded-2xl border border-soft bg-card-soft-theme p-3"><div className="flex gap-2"><input value={character.name} onChange={(event) => updateCharacter(character.id, "name", event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-main outline-none" /><button type="button" onClick={() => setCharacters((current) => current.filter((item) => item.id !== character.id))} className="text-muted2 hover:text-red-500"><Trash2 size={14} /></button></div><textarea value={character.description} onChange={(event) => updateCharacter(character.id, "description", event.target.value)} rows={2} className="mt-2 w-full resize-y bg-transparent text-xs text-muted2 outline-none" /><textarea value={character.visualDescription} onChange={(event) => updateCharacter(character.id, "visualDescription", event.target.value)} rows={3} placeholder="Apariencia fija para todas las viñetas" className="mt-2 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs text-sub outline-none" /></div>)}</div>
          </div>

          {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-3 text-xs leading-5 text-red-500">{error}</div>}
          {message && <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-5 text-blue-600">{message}</div>}
          <button type="button" onClick={generateStoryboard} disabled={generatingStoryboard || !topic.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40" style={{ background: `linear-gradient(135deg,${accentColor},#7c3aed)` }}>{generatingStoryboard ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{generatingStoryboard ? "Creando storyboard con IA..." : panels.length ? "Regenerar storyboard" : "Crear storyboard con IA"}</button>
        </section>

        <section className="rounded-3xl border border-soft bg-card-theme p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-main">Storyboard visual editable</h2><p className="mt-1 text-xs text-muted2">Cada viñeta es una capa. La imagen, el diálogo y la escena se pueden modificar por separado.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPanels((current) => [...current, { id: uid("panel"), title: `Viñeta ${current.length + 1}`, scene: "Describe la escena.", dialogue: "Escribe el diálogo.", shot: "plano medio", imagePrompt: "", hidden: false, locked: false }])} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs text-sub"><Plus size={13} /> Viñeta</button><button type="button" onClick={generateAllImages} disabled={generatingAll || !panels.length} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: accentColor }}>{generatingAll ? <LoaderCircle size={13} className="animate-spin" /> : <ImagePlus size={13} />} Generar todas</button><button type="button" onClick={copyProject} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs text-sub"><Copy size={13} /> {copied ? "Copiado" : "JSON"}</button></div></div>

          {summary && <div className="mb-4 rounded-2xl border border-soft bg-card-soft-theme p-4 text-xs leading-6 text-sub"><strong>Sinopsis:</strong> {summary}</div>}

          {panels.length === 0 ? <div className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-soft p-8 text-center"><span className="text-5xl">💬</span><p className="font-semibold text-main">Todavía no hay viñetas</p><p className="max-w-sm text-sm text-muted2">Describe la historia y pulsa “Crear storyboard con IA”.</p></div> : <div className={`grid gap-4 ${style === "webtoon" ? "grid-cols-1" : "md:grid-cols-2"}`}>{panels.map((panel, index) => <article key={panel.id} className={`rounded-3xl border border-soft bg-card-soft-theme p-3 ${panel.hidden ? "opacity-50" : ""}`}>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${accentColor}18`, color: accentColor }}>{index + 1}</span><input disabled={panel.locked} value={panel.title} onChange={(event) => updatePanel(panel.id, { title: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-main outline-none disabled:opacity-50" /><button type="button" onClick={() => updatePanel(panel.id, { hidden: !panel.hidden })} className="text-muted2">{panel.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button><button type="button" onClick={() => updatePanel(panel.id, { locked: !panel.locked })} className="text-muted2">{panel.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" onClick={() => setPanels((current) => moveItem(current, index, -1))} disabled={index === 0} className="text-muted2 disabled:opacity-25"><ArrowUp size={13} /></button><button type="button" onClick={() => setPanels((current) => moveItem(current, index, 1))} disabled={index === panels.length - 1} className="text-muted2 disabled:opacity-25"><ArrowDown size={13} /></button><button type="button" onClick={() => setPanels((current) => current.filter((item) => item.id !== panel.id))} className="text-muted2 hover:text-red-500"><Trash2 size={14} /></button></div>

            <div id={`comic-panel-${panel.id}`} className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-soft bg-white ${style === "webtoon" ? "aspect-[2/3]" : "aspect-[4/3]"}`}>
              {panel.imageUrl ? <img src={panel.imageUrl} alt={`Viñeta ${index + 1}: ${panel.title}`} className="h-full w-full object-cover" /> : panel.loading ? <div className="flex flex-col items-center gap-2 text-center"><LoaderCircle size={28} className="animate-spin" style={{ color: accentColor }} /><p className="text-xs text-muted2">Generando imagen coherente...</p></div> : <button type="button" onClick={() => void generatePanelImage(panel, index)} className="flex flex-col items-center gap-2 p-5 text-muted2 hover:text-main"><ImagePlus size={30} /><span className="text-xs font-semibold">Generar imagen de esta escena</span></button>}
              {panel.imageUrl && panel.dialogue && <div className="absolute left-3 top-3 max-w-[72%] rounded-2xl rounded-tl-sm border border-black/10 bg-white/95 px-3 py-2 text-[11px] font-semibold leading-4 text-slate-900 shadow-lg">{panel.dialogue}</div>}
              {panel.imageUrl && <div className="absolute bottom-2 right-2 flex gap-1"><button type="button" onClick={() => void downloadRenderedAsImage(`comic-panel-${panel.id}`, `comic-vineta-${index + 1}`, "png")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white" title="Descargar viñeta con diálogo"><Download size={13} /></button><button type="button" onClick={() => void generatePanelImage(panel, index)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white" title="Regenerar imagen"><RefreshCw size={13} /></button></div>}
            </div>
            {panel.provider && <p className="mt-1 truncate text-[9px] text-muted2">Motor: {panel.provider}</p>}
            {panel.error && <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-red-500">{panel.error}</p>}

            <div className="mt-3 grid gap-3"><label className="text-[10px] font-bold uppercase tracking-wider text-muted2">Escena<textarea disabled={panel.locked} value={panel.scene} onChange={(event) => updatePanel(panel.id, { scene: event.target.value })} rows={4} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label><label className="text-[10px] font-bold uppercase tracking-wider text-muted2">Diálogo · capa independiente<textarea disabled={panel.locked} value={panel.dialogue} onChange={(event) => updatePanel(panel.id, { dialogue: event.target.value })} rows={3} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label><div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-bold uppercase tracking-wider text-muted2">Plano<input disabled={panel.locked} value={panel.shot} onChange={(event) => updatePanel(panel.id, { shot: event.target.value })} className="mt-1 w-full rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub" /></label><button type="button" onClick={() => void generatePanelImage(panel, index)} disabled={panel.loading || panel.hidden} className="mt-4 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: accentColor }}>{panel.loading ? <LoaderCircle size={12} className="animate-spin" /> : <ImagePlus size={12} />}{panel.imageUrl ? "Regenerar" : "Generar"}</button></div><label className="text-[10px] font-bold uppercase tracking-wider text-muted2">Prompt visual editable<textarea disabled={panel.locked} value={panel.imagePrompt} onChange={(event) => updatePanel(panel.id, { imagePrompt: event.target.value })} rows={3} className="mt-1 w-full resize-y rounded-xl border border-soft bg-card-theme px-2.5 py-2 text-xs normal-case text-sub outline-none disabled:opacity-50" /></label></div>
          </article>)}</div>}

          {projectId && <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-700"><CheckCircle2 size={14} /> La historieta se guarda automáticamente en Mis proyectos.</div>}
        </section>
      </div>
    </main>
  )
}
