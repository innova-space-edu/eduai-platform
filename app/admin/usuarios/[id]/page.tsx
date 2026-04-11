"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Save, Loader2, Check, Trash2,
  BookOpen, Trophy, Flame, Zap, AlertTriangle
} from "lucide-react"

const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
const levelColors = ["", "#94a3b8", "#60a5fa", "#4ade80", "#c084fc", "#fbbf24", "#f87171"]

export default function AdminUserPage() {
  const params  = useParams()
  const userId  = params.id as string
  const router  = useRouter()
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState("")
  const [confirm,  setConfirm]  = useState<string | null>(null)

  const [profile,  setProfile]  = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [reports,  setReports]  = useState<any[]>([])

  // Campos editables
  const [name,        setName]        = useState("")
  const [xp,          setXp]          = useState(0)
  const [level,       setLevel]       = useState(1)
  const [streakDays,  setStreakDays]   = useState(0)
  const [adminReply,  setAdminReply]   = useState<Record<string, string>>({})
  const [replyStatus, setReplyStatus] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email!).maybeSingle()
      if (!data) { router.push("/dashboard"); return }
      loadUser()
    })
  }, [userId])

  async function loadUser() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin?action=user&userId=${userId}`)
      const data = await res.json()
      if (data.profile) {
        setProfile(data.profile)
        setName(data.profile.name || "")
        setXp(data.profile.xp || 0)
        setLevel(data.profile.level || 1)
        setStreakDays(data.profile.streak_days || 0)
      }
      setSessions(data.sessions || [])
      setReports(data.reports || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function saveProfile() {
    setSaving(true); setError(""); setSaved(false)
    try {
      const res  = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_user", userId, name, xp, level, streak_days: streakDays }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function confirmAction(action: string) {
    setConfirm(null)
    try {
      const res  = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      if (action === "reset_xp") { setXp(0); setLevel(1); setStreakDays(0) }
      if (action === "clear_sessions") setSessions([])
    } catch (e: any) { setError(e.message) }
  }

  async function sendReply(reportId: string) {
    const reply = adminReply[reportId]
    if (!reply?.trim()) return
    const status = replyStatus[reportId] || "resuelto"
    try {
      const res  = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply_report", reportId, reply, newStatus: status }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setAdminReply(prev => ({ ...prev, [reportId]: "" }))
      loadUser()
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-soft border-t-purple-400 animate-spin" />
    </div>
  )

  const accentColor = levelColors[level] || "#94a3b8"

  return (
    <div className="min-h-screen bg-app">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <h1 className="text-main font-bold text-sm">{profile?.name || "Usuario"}</h1>
              <p className="text-muted2 text-[11px]">{profile?.email}</p>
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-main transition-all disabled:opacity-50"
            style={{ background: saved ? "#16a34a" : "#7c3aed", boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}>
            {saving ? <><Loader2 size={13} className="animate-spin" />Guardando...</>
              : saved ? <><Check size={13} />Guardado</> : <><Save size={13} />Guardar</>}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/20" style={{ background: "rgba(239,68,68,0.08)" }}>
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Confirmar acciones destructivas */}
        {confirm && (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-red-500/25" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-red-700 text-sm">
              {confirm === "reset_xp" ? "¿Resetear XP, nivel y racha a cero?" : "¿Eliminar todas las sesiones de este usuario?"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded-xl text-xs text-sub border border-medium">Cancelar</button>
              <button onClick={() => confirmAction(confirm)} className="px-3 py-1.5 rounded-xl text-xs text-main bg-red-600 font-semibold">Confirmar</button>
            </div>
          </div>
        )}

        {/* Editar datos del perfil */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
          <h2 className="text-main font-semibold text-sm">Datos del perfil</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-purple-500/40 transition-all" />
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                <Zap size={10} className="text-amber-400" /> XP Total
              </label>
              <input type="number" min={0} value={xp} onChange={e => setXp(Number(e.target.value))}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500/40 transition-all" />
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                <Trophy size={10} style={{ color: accentColor }} /> Nivel
              </label>
              <select value={level} onChange={e => setLevel(Number(e.target.value))}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all"
                style={{ color: accentColor }}>
                {[1,2,3,4,5,6].map(l => (
                  <option key={l} value={l} className="bg-card-theme text-main">
                    {l} — {levelNames[l]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                <Flame size={10} className="text-orange-400" /> Racha (días)
              </label>
              <input type="number" min={0} value={streakDays} onChange={e => setStreakDays(Number(e.target.value))}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-orange-400 font-bold focus:outline-none focus:border-orange-500/40 transition-all" />
            </div>

            <div className="col-span-2 flex items-center gap-2 text-muted2 text-xs pt-1">
              <span>Código de usuario:</span>
              <span className="font-mono text-sub">{profile?.user_code || "—"}</span>
            </div>
          </div>
        </div>

        {/* Acciones destructivas */}
        <div className="rounded-2xl border p-5 space-y-3 border-red-500/15" style={{ background: "rgba(239,68,68,0.04)" }}>
          <h2 className="text-red-700 font-semibold text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> Acciones de mantenimiento
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setConfirm("reset_xp")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              <Zap size={14} /> Resetear XP y nivel
            </button>
            <button onClick={() => setConfirm("clear_sessions")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              <Trash2 size={14} /> Borrar historial sesiones
            </button>
          </div>
        </div>

        {/* Sesiones recientes */}
        <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
          <h2 className="text-main font-semibold text-sm mb-3 flex items-center gap-2">
            <BookOpen size={14} className="text-blue-400" /> Últimas sesiones ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="text-muted2 text-sm">Sin sesiones de estudio</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                     style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                  <span className="text-xs">{s.status === "completed" ? "✅" : "📁"}</span>
                  <span className="text-main text-xs flex-1 truncate">{s.topic}</span>
                  {s.score != null && <span className="text-amber-400 text-xs font-bold">{s.score}%</span>}
                  <span className="text-muted2 text-[10px]">
                    {new Date(s.created_at).toLocaleDateString("es-CL")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reportes del usuario */}
        {reports.length > 0 && (
          <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
            <h2 className="text-main font-semibold text-sm mb-3">🎫 Reportes enviados por este usuario</h2>
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.id} className="rounded-xl border p-3 space-y-2"
                     style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-main text-xs font-semibold">{r.subject}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>
                      {r.status}
                    </span>
                  </div>

                  {/* Responder */}
                  {r.status !== "cerrado" && (
                    <div className="space-y-2">
                      <textarea
                        value={adminReply[r.id] || ""}
                        onChange={e => setAdminReply(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Escribe tu respuesta al usuario..."
                        rows={2}
                        className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-xs text-sub placeholder-gray-400 focus:outline-none focus:border-purple-500/30 resize-none transition-all"
                      />
                      <div className="flex gap-2">
                        <select
                          value={replyStatus[r.id] || "resuelto"}
                          onChange={e => setReplyStatus(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="bg-card-soft-theme border border-soft rounded-xl px-3 py-1.5 text-xs focus:outline-none flex-1">
                          <option value="resuelto">Marcar resuelto</option>
                          <option value="en_revision">Marcar en revisión</option>
                          <option value="cerrado">Cerrar sin responder</option>
                        </select>
                        <button onClick={() => sendReply(r.id)}
                          disabled={!adminReply[r.id]?.trim()}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-main disabled:opacity-40 transition-all"
                          style={{ background: "#7c3aed" }}>
                          Enviar respuesta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
