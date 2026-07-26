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
  thumbnailUrl?: string
  status?: "draft" | "final" | "archived" | "trashed"
  currentVersion?: number
}

const STORAGE_KEY = "eduai.creator-hub.projects.v2"
const LEGACY_STORAGE_KEY = "eduai.creator-hub.projects.v1"
const MAX_PROJECTS = 100
const updateTimers = new Map<string, ReturnType<typeof setTimeout>>()

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

function writeProjects(projects: CreatorHubProject[]) {
  if (!canUseStorage()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)))
    window.dispatchEvent(new Event("creator-hub-projects-updated"))
    return true
  } catch {
    return false
  }
}

function normalizeProject(value: any): CreatorHubProject | null {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.format !== "string") return null
  const timestamp = new Date().toISOString()
  return {
    id: value.id,
    format: value.format,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Material sin título",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : timestamp,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : timestamp,
    data: value.data ?? {},
    accentColor: typeof value.accentColor === "string" ? value.accentColor : undefined,
    designTemplateId: typeof value.designTemplateId === "string" ? value.designTemplateId : undefined,
    thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined,
    status: ["draft", "final", "archived", "trashed"].includes(value.status) ? value.status : "draft",
    currentVersion: Number.isFinite(value.currentVersion) ? Math.max(1, Number(value.currentVersion)) : 1,
  }
}

function mergeProjects(local: CreatorHubProject[], cloud: CreatorHubProject[]) {
  const map = new Map<string, CreatorHubProject>()
  for (const project of [...local, ...cloud]) {
    const current = map.get(project.id)
    if (!current || new Date(project.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) map.set(project.id, project)
  }
  return [...map.values()].filter((project) => project.status !== "trashed").sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, MAX_PROJECTS)
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
  return payload
}

async function createCloudProject(project: CreatorHubProject) {
  try {
    await requestJson("/api/creator/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    })
  } catch (error) {
    console.warn("[CreatorHub][CloudCreate]", error)
  }
}

function scheduleCloudUpdate(project: CreatorHubProject) {
  const previous = updateTimers.get(project.id)
  if (previous) clearTimeout(previous)
  updateTimers.set(project.id, setTimeout(async () => {
    updateTimers.delete(project.id)
    try {
      await requestJson("/api/creator/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      })
    } catch (error) {
      console.warn("[CreatorHub][CloudUpdate]", error)
    }
  }, 900))
}

export function loadCreatorHubProjects(): CreatorHubProject[] {
  if (!canUseStorage()) return []
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw) window.localStorage.setItem(STORAGE_KEY, raw)
    }
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeProject).filter(Boolean) as CreatorHubProject[]
  } catch {
    return []
  }
}

export async function loadCloudCreatorHubProjects(): Promise<CreatorHubProject[]> {
  try {
    const payload = await requestJson("/api/creator/projects")
    const cloud = Array.isArray(payload?.projects) ? payload.projects.map(normalizeProject).filter(Boolean) as CreatorHubProject[] : []
    const merged = mergeProjects(loadCreatorHubProjects(), cloud)
    writeProjects(merged)
    return merged
  } catch (error) {
    console.warn("[CreatorHub][CloudList]", error)
    return loadCreatorHubProjects()
  }
}

export function loadCreatorHubProject(projectId: string) {
  return loadCreatorHubProjects().find((project) => project.id === projectId) || null
}

export async function loadCloudCreatorHubProject(projectId: string): Promise<CreatorHubProject | null> {
  const local = loadCreatorHubProject(projectId)
  try {
    const payload = await requestJson(`/api/creator/projects?projectId=${encodeURIComponent(projectId)}&versions=1`)
    const project = normalizeProject(payload?.project)
    if (!project) return local
    writeProjects(mergeProjects(loadCreatorHubProjects(), [project]))
    return project
  } catch (error) {
    console.warn("[CreatorHub][CloudRead]", error)
    return local
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
    status: input.status || "draft",
    currentVersion: input.currentVersion || 1,
  }
  const projects = [project, ...loadCreatorHubProjects()].slice(0, MAX_PROJECTS)
  if (!writeProjects(projects)) return null
  void createCloudProject(project)
  return project
}

export function updateCreatorHubProject(
  projectId: string,
  patch: Partial<Omit<CreatorHubProject, "id" | "createdAt">>,
) {
  if (!canUseStorage()) return null
  let updated: CreatorHubProject | null = null
  const projects = loadCreatorHubProjects().map((project) => {
    if (project.id !== projectId) return project
    updated = {
      ...project,
      ...patch,
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
    }
    return updated
  })
  if (!updated) return null
  if (!writeProjects(projects)) return null
  scheduleCloudUpdate(updated)
  return updated
}

export async function saveCreatorHubProjectVersion(projectId: string, note = "Versión guardada") {
  const project = loadCreatorHubProject(projectId)
  if (!project) return null
  try {
    const payload = await requestJson("/api/creator/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...project, createVersion: true, note }),
    })
    const updated = normalizeProject(payload?.project)
    if (updated) writeProjects(mergeProjects(loadCreatorHubProjects(), [updated]))
    return updated
  } catch (error) {
    console.warn("[CreatorHub][CloudVersion]", error)
    return null
  }
}

export function removeCreatorHubProject(projectId: string) {
  if (!canUseStorage()) return
  const projects = loadCreatorHubProjects().filter((project) => project.id !== projectId)
  writeProjects(projects)
  void fetch(`/api/creator/projects?id=${encodeURIComponent(projectId)}`, { method: "DELETE" }).catch(() => undefined)
}

export function duplicateCreatorHubProject(projectId: string) {
  const source = loadCreatorHubProjects().find((project) => project.id === projectId)
  if (!source) return null
  return saveCreatorHubProject({
    format: source.format,
    title: `${source.title} — copia`,
    data: structuredClone(source.data),
    accentColor: source.accentColor,
    designTemplateId: source.designTemplateId,
    status: "draft",
    currentVersion: 1,
  })
}

export function importCreatorHubProject(value: unknown) {
  const project = normalizeProject(value)
  if (!project) return null
  const existing = loadCreatorHubProjects()
  const imported = {
    ...project,
    id: existing.some((item) => item.id === project.id)
      ? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `creator-${Date.now()}`)
      : project.id,
    title: existing.some((item) => item.id === project.id) ? `${project.title} — importado` : project.title,
    updatedAt: new Date().toISOString(),
  }
  writeProjects(mergeProjects(existing, [imported]))
  void createCloudProject(imported)
  return imported
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
