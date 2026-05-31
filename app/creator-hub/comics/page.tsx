"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Plus, QrCode, Sparkles, Trash2 } from "lucide-react"

type ComicStyle = "manga" | "western" | "webtoon" | "child"

type Character = {
  id: string
  name: string
  description: string
}

type Panel = {
  id: string
  title: string
  scene: string
  dialogue: string
}

const STYLES: Array<{ id: ComicStyle; label: string; icon: string; description: string }> = [
  { id: "manga", label: "Manga", icon: "🌸", description: "Blanco y negro, expresivo y dinámico" },
  { id: "western", label: "Historieta", icon: "💥", description: "Viñetas clásicas y coloridas" },
  { id: "webtoon", label: "Webtoon", icon: "📱", description: "Lectura vertical para celular" },
  { id: "child", label: "Cómic infantil", icon: "🧒", description: "Visual simple y amigable" },
]

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultPanels(topic: string): Panel[] {
  const subject = topic.trim() || "el tema elegido"
  return [
    { id: uid("panel"), title: "Inicio", scene: `Presenta el contexto de ${subject} y al personaje principal.`, dialogue: "¿Qué está ocurriendo aquí?" },
    { id: uid("panel"), title: "Problema", scene: `El personaje descubre una pregunta o desafío relacionado con ${subject}.`, dialogue: "Necesitamos investigar antes de tomar una decisión." },
    { id: uid("panel"), title: "Exploración", scene: `Los personajes observan evidencias, comparan ideas y explican un concepto clave de ${subject}.`, dialogue: "Mira esta evidencia. Ahora entiendo mejor el problema." },
    { id: uid("panel"), title: "Cierre", scene: `La historia concluye con una solución y una reflexión sobre ${subject}.`, dialogue: "Aprendimos que comprender el contexto cambia nuestras decisiones." },
  ]
}

export default function ComicsCreatorPage() {
  const [topic, setTopic] = useState("")
  const [audience, setAudience] = useState("Estudiantes de enseñanza media")
  const [educationalGoal, setEducationalGoal] = useState("")
  const [style, setStyle] = useState<ComicStyle>("manga")
  const [characters, setCharacters] = useState<Character[]>([
    { id: uid("character"), name: "Protagonista", description: "Estudiante curioso que formula preguntas y busca evidencias." },
    { id: uid("character"), name: "Guía", description: "Personaje que acompaña el aprendizaje con ejemplos claros." },
  ])
  const [panels, setPanels] = useState<Panel[]>([])
  const [copied, setCopied] = useState(false)

  const project = useMemo(() => ({
    version: "comics-beta-1",
    topic,
    audience,
    educationalGoal,
    style,
    characters,
    panels,
  }), [audience, characters, educationalGoal, panels, style, topic])

  const generateStoryboard = () => {
    setPanels(defaultPanels(topic))
  }

  const addCharacter = () => {
    setCharacters((current) => [...current, { id: uid("character"), name: "Nuevo personaje", description: "Describe su función dentro de la historia." }])
  }

  const updateCharacter = (id: string, field: "name" | "description", value: string) => {
    setCharacters((current) => current.map((character) => character.id === id ? { ...character, [field]: value } : character))
  }

  const removeCharacter = (id: string) => {
    setCharacters((current) => current.filter((character) => character.id !== id))
  }

  const addPanel = () => {
    setPanels((current) => [...current, { id: uid("panel"), title: `Viñeta ${current.length + 1}`, scene: "Describe la escena.", dialogue: "Escribe el diálogo principal." }])
  }

  const updatePanel = (id: string, field: "title" | "scene" | "dialogue", value: string) => {
    setPanels((current) => current.map((panel) => panel.id === id ? { ...panel, [field]: value } : panel))
  }

  const removePanel = (id: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== id))
  }

  const copyProject = async () => {
    await navigator.clipboard.writeText(JSON.stringify(project, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-soft bg-app backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/creator-hub" className="p-2 rounded-xl border border-soft text-muted2 hover:text-main" title="Volver a Creator Hub">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-main font-bold">Mangas e historietas</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899" }}>BETA</span>
              </div>
              <p className="text-muted2 text-xs">Crea un storyboard educativo editable antes de generar imágenes.</p>
            </div>
          </div>
          <Link href="/qr-studio" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-soft text-xs text-sub">
            <QrCode size={14} /> QR Studio
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <section className="space-y-5">
          <div className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
            <h2 className="text-main font-semibold mb-4">1. Define el proyecto</h2>
            <div className="space-y-3">
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={4}
                placeholder="Tema o idea central. Ejemplo: riesgos naturales en Antofagasta, fotosíntesis, convivencia escolar..."
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none resize-y" />
              <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Público objetivo"
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none" />
              <textarea value={educationalGoal} onChange={(event) => setEducationalGoal(event.target.value)} rows={3}
                placeholder="Objetivo educativo opcional"
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm text-main outline-none resize-y" />
            </div>
          </div>

          <div className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
            <h2 className="text-main font-semibold mb-3">2. Elige el estilo</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {STYLES.map((item) => (
                <button key={item.id} onClick={() => setStyle(item.id)} className="rounded-2xl border p-3 text-left transition-all"
                  style={{ borderColor: style === item.id ? "rgba(236,72,153,0.42)" : "var(--border-soft)", background: style === item.id ? "rgba(236,72,153,0.08)" : "transparent" }}>
                  <p className="text-main text-sm font-semibold">{item.icon} {item.label}</p>
                  <p className="text-muted2 text-xs mt-1">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-main font-semibold">3. Personajes</h2>
              <button onClick={addCharacter} className="flex items-center gap-1.5 text-xs text-blue-400"><Plus size={13} /> Agregar</button>
            </div>
            <div className="space-y-2">
              {characters.map((character) => (
                <div key={character.id} className="rounded-2xl border border-soft p-3">
                  <div className="flex gap-2">
                    <input value={character.name} onChange={(event) => updateCharacter(character.id, "name", event.target.value)} className="flex-1 bg-transparent text-main text-sm font-semibold outline-none" />
                    <button onClick={() => removeCharacter(character.id)} className="text-muted2 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                  <textarea value={character.description} onChange={(event) => updateCharacter(character.id, "description", event.target.value)} rows={2}
                    className="w-full bg-transparent text-muted2 text-xs outline-none resize-y mt-2" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={generateStoryboard} className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#db2777,#7c3aed)" }}>
            <Sparkles size={16} /> Crear storyboard inicial
          </button>
        </section>

        <section className="rounded-3xl border border-soft p-5" style={{ background: "var(--bg-card-soft)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-main font-semibold">Storyboard editable</h2>
              <p className="text-muted2 text-xs mt-1">Primera versión: organiza escenas y diálogos antes de generar imágenes.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={addPanel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-soft text-xs text-sub"><Plus size={13} /> Viñeta</button>
              <button onClick={copyProject} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-soft text-xs text-sub"><Copy size={13} /> {copied ? "Copiado" : "Copiar JSON"}</button>
            </div>
          </div>

          {panels.length === 0 ? (
            <div className="min-h-96 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-soft rounded-2xl p-8">
              <span className="text-5xl">💬</span>
              <p className="text-main font-semibold">Todavía no hay viñetas</p>
              <p className="text-muted2 text-sm max-w-sm">Describe el tema y crea un storyboard inicial. Luego podrás editar escenas y diálogos.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {panels.map((panel, index) => (
                <article key={panel.id} className="rounded-2xl border border-soft p-3 min-h-56">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899" }}>{index + 1}</span>
                    <input value={panel.title} onChange={(event) => updatePanel(panel.id, "title", event.target.value)} className="flex-1 bg-transparent text-main text-sm font-semibold outline-none" />
                    <button onClick={() => removePanel(panel.id)} className="text-muted2 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                  <label className="text-[10px] text-muted2 font-bold tracking-wider">ESCENA</label>
                  <textarea value={panel.scene} onChange={(event) => updatePanel(panel.id, "scene", event.target.value)} rows={4}
                    className="w-full mt-1 rounded-xl border border-soft bg-transparent px-2.5 py-2 text-xs text-sub outline-none resize-y" />
                  <label className="block text-[10px] text-muted2 font-bold tracking-wider mt-3">DIÁLOGO</label>
                  <textarea value={panel.dialogue} onChange={(event) => updatePanel(panel.id, "dialogue", event.target.value)} rows={3}
                    className="w-full mt-1 rounded-xl border border-soft bg-transparent px-2.5 py-2 text-xs text-sub outline-none resize-y" />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
