"use client"

export type CreatorHubProject = {
  id: string
  format: string
  title: string
  createdAt: string
  updatedAt: string
  data: unknown
  accentColor?: string
  designTemplateId?: string
}

const STORAGE_KEY = "eduai.creator-hub.projects.v1"
const MAX_PROJECTS = 40

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

export function loadCreatorHubProjects(): CreatorHubProject[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((project) => project && typeof project.id === "string")
  } catch {
    return []
  }
}

export function saveCreatorHubProject(input: Omit<CreatorHubProject, "id" | "createdAt" | "updatedAt">) {
  if (!canUseStorage()) return null
  const timestamp = new Date().toISOString()
  const project: CreatorHubProject = {
    ...input,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `creator-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const projects = [project, ...loadCreatorHubProjects()].slice(0, MAX_PROJECTS)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    window.dispatchEvent(new Event("creator-hub-projects-updated"))
    return project
  } catch {
    return null
  }
}

export function removeCreatorHubProject(projectId: string) {
  if (!canUseStorage()) return
  const projects = loadCreatorHubProjects().filter((project) => project.id !== projectId)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    window.dispatchEvent(new Event("creator-hub-projects-updated"))
  } catch {
    // El almacenamiento local es un respaldo opcional; no interrumpe el editor.
  }
}

export function duplicateCreatorHubProject(projectId: string) {
  const source = loadCreatorHubProjects().find((project) => project.id === projectId)
  if (!source) return null
  return saveCreatorHubProject({
    format: source.format,
    title: `${source.title} — copia`,
    data: source.data,
    accentColor: source.accentColor,
    designTemplateId: source.designTemplateId,
  })
}

export function downloadCreatorHubProject(project: CreatorHubProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${project.title || "creator-hub-project"}.json`.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ._-]+/g, "-").toLowerCase()
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 800)
}
