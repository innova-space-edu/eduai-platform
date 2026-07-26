"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  LoaderCircle,
  MessageSquare,
  Plus,
  Send,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import ProjectReadOnlyPreview from "@/components/creator-hub/ProjectReadOnlyPreview"
import { getCreatorHubFormat } from "@/components/creator-hub/catalog"
import { loadCloudCreatorHubProject, type CreatorHubProject } from "@/components/creator-hub/project-store"

type Collaborator = {
  id: string
  collaborator_id: string
  permission: "view" | "comment" | "edit"
  invited_email?: string | null
  created_at: string
  updated_at: string
}

type Comment = {
  id: string
  user_id: string
  parent_id?: string | null
  block_path?: string | null
  body: string
  resolved: boolean
  created_at: string
  updated_at: string
}

type ShareLink = {
  id: string
  token: string
  permission: "view" | "comment"
  expires_at?: string | null
  is_active: boolean
  created_at: string
}

export default function CreatorCollaborationPage() {
  const params = useParams()
  const projectId = String(params?.id || "")
  const [project, setProject] = useState<CreatorHubProject | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [permission, setPermission] = useState<"view" | "comment" | "edit">("comment")
  const [commentBody, setCommentBody] = useState("")
  const [blockPath, setBlockPath] = useState("")
  const [busy, setBusy] = useState("")
  const [copiedToken, setCopiedToken] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const loadedProject = await loadCloudCreatorHubProject(projectId)
    if (!loadedProject) {
      setError("No se encontró el proyecto o no tienes acceso.")
      setLoading(false)
      return
    }
    setProject(loadedProject)
    try {
      const response = await fetch(`/api/creator/collaboration?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible cargar la colaboración.")
      setCollaborators(payload.collaborators || [])
      setComments(payload.comments || [])
      setShareLinks(payload.shareLinks || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar la colaboración.")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const invite = async () => {
    if (!email.trim()) return
    setBusy("invite")
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/creator/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", projectId, email, permission }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible invitar al colaborador.")
      setEmail("")
      setMessage("Colaborador agregado o permiso actualizado.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible invitar al colaborador.")
    } finally {
      setBusy("")
    }
  }

  const addComment = async () => {
    if (!commentBody.trim()) return
    setBusy("comment")
    setError("")
    try {
      const response = await fetch("/api/creator/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", projectId, body: commentBody, blockPath }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible publicar el comentario.")
      setCommentBody("")
      setBlockPath("")
      setComments((current) => [...current, payload.comment])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible publicar el comentario.")
    } finally {
      setBusy("")
    }
  }

  const createShareLink = async () => {
    setBusy("link")
    setError("")
    try {
      const response = await fetch("/api/creator/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share-link", projectId, permission: "view", expiresInDays: 30 }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible crear el enlace.")
      setShareLinks((current) => [payload.shareLink, ...current])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear el enlace.")
    } finally {
      setBusy("")
    }
  }

  const changePermission = async (collaborator: Collaborator, nextPermission: Collaborator["permission"]) => {
    const response = await fetch("/api/creator/collaboration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "permission", id: collaborator.id, permission: nextPermission }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload?.error || "No fue posible cambiar el permiso.")
      return
    }
    setCollaborators((current) => current.map((item) => item.id === collaborator.id ? { ...item, permission: nextPermission } : item))
  }

  const resolveComment = async (comment: Comment) => {
    const response = await fetch("/api/creator/collaboration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve-comment", id: comment.id, resolved: !comment.resolved }),
    })
    if (!response.ok) return
    setComments((current) => current.map((item) => item.id === comment.id ? { ...item, resolved: !item.resolved } : item))
  }

  const remove = async (type: "collaborator" | "comment" | "share-link", id: string) => {
    const response = await fetch(`/api/creator/collaboration?type=${type}&id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!response.ok) return
    if (type === "collaborator") setCollaborators((current) => current.filter((item) => item.id !== id))
    if (type === "comment") setComments((current) => current.filter((item) => item.id !== id))
    if (type === "share-link") setShareLinks((current) => current.filter((item) => item.id !== id))
  }

  const shareUrl = (token: string) => `${window.location.origin}/share/creator/${token}`
  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(shareUrl(token))
    setCopiedToken(token)
    window.setTimeout(() => setCopiedToken(""), 1400)
  }

  const unresolved = useMemo(() => comments.filter((comment) => !comment.resolved), [comments])
  const meta = project ? getCreatorHubFormat(project.format) : null
  const accent = project?.accentColor || meta?.color || "#7c3aed"

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle size={34} className="animate-spin text-violet-500" /></div>
  if (!project) return <div className="mx-auto max-w-xl px-6 py-20 text-center"><p className="text-lg font-bold text-main">No fue posible abrir la colaboración</p><p className="mt-2 text-sm text-muted2">{error}</p><Link href="/creator-hub/projects" className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Volver a proyectos</Link></div>

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><Link href={`/creator-hub/projects/${encodeURIComponent(projectId)}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2"><ArrowLeft size={15} /></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl" style={{ background: `${accent}16` }}>{meta?.icon || "✦"}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-main">Colaboración · {project.title}</p><p className="hidden text-[11px] text-muted2 sm:block">Invita, comenta y comparte una vista protegida.</p></div></div>
          <span className="rounded-full px-3 py-1 text-[10px] font-bold" style={{ background: `${accent}12`, color: accent }}>{collaborators.length} colaboradores · {unresolved.length} comentarios abiertos</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1700px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[470px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          <section className="rounded-3xl border border-soft bg-card-theme p-4">
            <div className="flex items-center gap-2"><UserPlus size={15} style={{ color: accent }} /><h2 className="text-sm font-bold text-main">Invitar colaborador</h2></div>
            <p className="mt-1 text-xs leading-5 text-muted2">El correo debe pertenecer a una cuenta EduAI registrada.</p>
            <div className="mt-4 space-y-2"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.cl" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none" /><div className="grid grid-cols-[1fr_auto] gap-2"><select value={permission} onChange={(event) => setPermission(event.target.value as any)} className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main"><option value="view">Solo lectura</option><option value="comment">Comentar</option><option value="edit">Editar</option></select><button type="button" onClick={invite} disabled={busy === "invite" || !email.trim()} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40" style={{ background: accent }}>{busy === "invite" ? <LoaderCircle size={13} className="animate-spin" /> : <Plus size={13} />} Invitar</button></div></div>
          </section>

          <section className="rounded-3xl border border-soft bg-card-theme p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users size={15} className="text-blue-500" /><h2 className="text-sm font-bold text-main">Colaboradores</h2></div><span className="text-[10px] font-bold text-muted2">{collaborators.length}</span></div>
            <div className="mt-3 space-y-2">{collaborators.length === 0 ? <p className="rounded-xl border border-dashed border-soft p-4 text-center text-xs text-muted2">Todavía no hay colaboradores.</p> : collaborators.map((collaborator) => <div key={collaborator.id} className="flex items-center gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-xs font-black text-blue-600">@</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-main">{collaborator.invited_email || collaborator.collaborator_id}</p><p className="text-[9px] text-muted2">Actualizado {new Date(collaborator.updated_at).toLocaleString("es-CL")}</p></div><select value={collaborator.permission} onChange={(event) => void changePermission(collaborator, event.target.value as any)} className="rounded-lg border border-soft bg-card-theme px-2 py-1.5 text-[9px] text-main"><option value="view">Ver</option><option value="comment">Comentar</option><option value="edit">Editar</option></select><button type="button" onClick={() => void remove("collaborator", collaborator.id)} className="text-muted2 hover:text-red-500"><Trash2 size={13} /></button></div>)}</div>
          </section>

          <section className="rounded-3xl border border-soft bg-card-theme p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Share2 size={15} className="text-violet-500" /><h2 className="text-sm font-bold text-main">Enlaces compartidos</h2></div><button type="button" onClick={createShareLink} disabled={busy === "link"} className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600">{busy === "link" ? <LoaderCircle size={11} className="animate-spin" /> : <Link2 size={11} />} Crear enlace</button></div>
            <div className="mt-3 space-y-2">{shareLinks.length === 0 ? <p className="rounded-xl border border-dashed border-soft p-4 text-center text-xs text-muted2">No hay enlaces activos.</p> : shareLinks.map((link) => <div key={link.id} className={`rounded-2xl border border-soft bg-card-soft-theme p-3 ${!link.is_active ? "opacity-50" : ""}`}><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-[9px] text-muted2">{link.token}</p><button type="button" onClick={() => void copyLink(link.token)} className="inline-flex items-center gap-1 rounded-lg border border-soft px-2 py-1 text-[9px] font-bold text-sub">{copiedToken === link.token ? <Check size={10} /> : <Copy size={10} />} {copiedToken === link.token ? "Copiado" : "Copiar"}</button><button type="button" onClick={() => void remove("share-link", link.id)} className="text-muted2 hover:text-red-500"><Trash2 size={12} /></button></div><p className="mt-2 text-[9px] text-muted2">Lectura · {link.expires_at ? `expira ${new Date(link.expires_at).toLocaleDateString("es-CL")}` : "sin vencimiento"}</p></div>)}</div>
          </section>

          <section className="rounded-3xl border border-soft bg-card-theme p-4">
            <div className="flex items-center gap-2"><MessageSquare size={15} className="text-amber-500" /><h2 className="text-sm font-bold text-main">Nuevo comentario</h2></div>
            <input value={blockPath} onChange={(event) => setBlockPath(event.target.value)} placeholder="Ruta del bloque, ej: sections[2].points (opcional)" className="mt-3 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 font-mono text-[10px] text-main outline-none" />
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={4} placeholder="Escribe una observación, corrección o sugerencia..." className="mt-2 w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-main outline-none" />
            <button type="button" onClick={addComment} disabled={busy === "comment" || !commentBody.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy === "comment" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />} Publicar comentario</button>
          </section>

          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-xs leading-5 text-red-500">{error}</div>}
          {message && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-700">{message}</div>}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold text-main">Vista del proyecto</p><p className="mt-0.5 text-[11px] text-muted2">Los comentarios pueden señalar rutas específicas del contenido.</p></div><Link href={`/creator-hub/projects/${encodeURIComponent(projectId)}`} className="text-[10px] font-bold" style={{ color: accent }}>Abrir editor</Link></div><div className="overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-3 sm:p-5"><ProjectReadOnlyPreview format={project.format} data={project.data} accentColor={accent} /></div></div>

          <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-main">Comentarios</h2><p className="mt-1 text-xs text-muted2">Resuelve observaciones cuando ya fueron aplicadas.</p></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700">{unresolved.length} abiertos</span></div>
            <div className="mt-4 space-y-3">{comments.length === 0 ? <div className="rounded-2xl border border-dashed border-soft p-8 text-center text-xs text-muted2">Todavía no hay comentarios.</div> : comments.map((comment) => <article key={comment.id} className={`rounded-2xl border p-4 ${comment.resolved ? "border-emerald-500/20 bg-emerald-500/5 opacity-70" : "border-soft bg-card-soft-theme"}`}><div className="flex items-start gap-3"><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xs font-black text-amber-700">💬</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold text-main">Usuario {comment.user_id.slice(0, 8)}</span><span className="text-[9px] text-muted2">{new Date(comment.created_at).toLocaleString("es-CL")}</span>{comment.block_path && <span className="rounded-full border border-soft bg-card-theme px-2 py-0.5 font-mono text-[9px] text-muted2">{comment.block_path}</span>}</div><p className="mt-2 whitespace-pre-line text-xs leading-5 text-sub">{comment.body}</p></div><button type="button" onClick={() => void resolveComment(comment)} className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${comment.resolved ? "border-emerald-500/20 text-emerald-700" : "border-soft text-muted2"}`}>{comment.resolved ? "Reabrir" : "Resolver"}</button><button type="button" onClick={() => void remove("comment", comment.id)} className="text-muted2 hover:text-red-500"><Trash2 size={12} /></button></div></article>)}</div>
          </section>
        </section>
      </main>
    </div>
  )
}
