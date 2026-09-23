"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Save,
  Loader2,
  Check,
  Trash2,
  BookOpen,
  Trophy,
  Flame,
  Zap,
  AlertTriangle,
  ShieldCheck,
  KeyRound,
  Ban,
  UserCog,
  Mail,
  Eye,
  EyeOff,
  WandSparkles,
  LockKeyhole,
  Clock3,
} from "lucide-react"

const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
const levelColors = ["", "#94a3b8", "#60a5fa", "#4ade80", "#c084fc", "#fbbf24", "#f87171"]

const ACCOUNT_TYPES = [
  { value: "teacher", label: "Docente" },
  { value: "university_student", label: "Estudiante universitario" },
  { value: "researcher", label: "Investigador/a" },
  { value: "professional", label: "Profesional" },
  { value: "other", label: "Otro" },
]

const ACCESS_TIERS = [
  { value: "restricted", label: "Restringido" },
  { value: "standard", label: "Estándar" },
  { value: "teacher", label: "Docente" },
  { value: "researcher", label: "Investigador" },
  { value: "admin", label: "Administrador de funciones" },
]

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export default function AdminUserPage() {
  const params = useParams()
  const userId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [securityBusy, setSecurityBusy] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [confirm, setConfirm] = useState<string | null>(null)

  const [profile, setProfile] = useState<any>(null)
  const [account, setAccount] = useState<any>(null)
  const [access, setAccess] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [examCount, setExamCount] = useState(0)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [streakDays, setStreakDays] = useState(0)
  const [accountType, setAccountType] = useState("other")
  const [accessTier, setAccessTier] = useState("standard")
  const [countryCode, setCountryCode] = useState("")
  const [panelAdmin, setPanelAdmin] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [adminReply, setAdminReply] = useState<Record<string, string>>({})
  const [replyStatus, setReplyStatus] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login")
        return
      }

      const { data } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email!)
        .maybeSingle()

      if (!data) {
        router.push("/dashboard")
        return
      }

      loadUser()
    })
  }, [userId])

  function applyBundle(data: any) {
    setProfile(data.profile || null)
    setAccount(data.account || null)
    setAccess(data.access || null)
    setSessions(data.sessions || [])
    setReports(data.reports || [])
    setExamCount(data.examCount || 0)

    setName(data.profile?.name || data.account?.userMetadata?.name || "")
    setEmail(data.account?.email || data.profile?.email || "")
    setXp(data.profile?.xp || 0)
    setLevel(data.profile?.level || 1)
    setStreakDays(data.profile?.streak_days || 0)
    setAccountType(data.access?.account_type || "other")
    setAccessTier(data.access?.access_tier || "standard")
    setCountryCode(data.access?.country_code || "")
    setPanelAdmin(Boolean(data.account?.isPanelAdmin))
  }

  async function loadUser() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el usuario")
      applyBundle(data)
    } catch (e: any) {
      setError(e.message || "No se pudo cargar el usuario")
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    setError("")
    setNotice("")
    setSaved(false)

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          xp,
          level,
          streak_days: streakDays,
          ...(access
            ? {
                account_type: accountType,
                access_tier: accessTier,
                country_code: countryCode,
              }
            : {}),
          panel_admin: panelAdmin,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo guardar")

      applyBundle(data)
      setSaved(true)
      setNotice("Datos y permisos actualizados correctamente.")
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  async function updatePassword() {
    setError("")
    setNotice("")
    setPasswordSaved(false)

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setSecurityBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_password", password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar la contraseña")
      }

      setNewPassword("")
      setConfirmPassword("")
      setPasswordSaved(true)
      setNotice("Contraseña reemplazada correctamente.")
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (e: any) {
      setError(e.message || "No se pudo cambiar la contraseña")
    } finally {
      setSecurityBusy(false)
    }
  }

  function generateTemporaryPassword() {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?"
    const values = new Uint32Array(18)
    crypto.getRandomValues(values)
    const generated = Array.from(values)
      .map(value => alphabet[value % alphabet.length])
      .join("")
    setNewPassword(generated)
    setConfirmPassword(generated)
    setShowPassword(true)
  }

  async function setSuspension(suspended: boolean) {
    setConfirm(null)
    setSecurityBusy(true)
    setError("")
    setNotice("")

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_suspension", suspended }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado de la cuenta")
      }

      applyBundle(data)
      setNotice(suspended ? "Cuenta suspendida." : "Cuenta reactivada.")
    } catch (e: any) {
      setError(e.message || "No se pudo cambiar el estado de la cuenta")
    } finally {
      setSecurityBusy(false)
    }
  }

  async function confirmAction(action: string) {
    if (action === "suspend") {
      await setSuspension(true)
      return
    }
    if (action === "unsuspend") {
      await setSuspension(false)
      return
    }

    setConfirm(null)
    setError("")
    setNotice("")

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Acción fallida")

      if (action === "reset_xp") {
        setXp(0)
        setLevel(1)
        setStreakDays(0)
        setNotice("XP, nivel y racha restablecidos.")
      }
      if (action === "clear_sessions") {
        setSessions([])
        setNotice("Historial de sesiones eliminado.")
      }
    } catch (e: any) {
      setError(e.message || "No se pudo completar la acción")
    }
  }

  async function sendReply(reportId: string) {
    const reply = adminReply[reportId]
    if (!reply?.trim()) return
    const status = replyStatus[reportId] || "resuelto"

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply_report",
          reportId,
          reply,
          newStatus: status,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo responder")

      setAdminReply(prev => ({ ...prev, [reportId]: "" }))
      loadUser()
    } catch (e: any) {
      setError(e.message || "No se pudo responder")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-soft border-t-purple-400 animate-spin" />
      </div>
    )
  }

  if (!profile && !account) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-500/20 p-6 text-center">
          <AlertTriangle size={30} className="mx-auto mb-3 text-red-500" />
          <p className="text-main font-semibold">No se pudo abrir este usuario</p>
          <p className="text-sub text-sm mt-2">{error || "Usuario no encontrado"}</p>
          <Link
            href="/admin"
            className="inline-flex mt-5 items-center gap-2 rounded-xl border border-soft px-4 py-2 text-sm text-sub"
          >
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
      </div>
    )
  }

  const accentColor = levelColors[level] || "#94a3b8"
  const suspended = Boolean(account?.suspended)

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/admin"
              className="w-8 h-8 flex flex-shrink-0 items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-main font-bold text-sm truncate">
                  {profile?.name || account?.userMetadata?.name || "Usuario"}
                </h1>
                {suspended && (
                  <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                    Suspendido
                  </span>
                )}
                {panelAdmin && (
                  <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-500">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-muted2 text-[11px] truncate">{email || "Sin correo"}</p>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving || securityBusy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: saved ? "#16a34a" : "#7c3aed",
              boxShadow: "0 2px 10px rgba(124,58,237,0.3)",
            }}
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Guardando...
              </>
            ) : saved ? (
              <>
                <Check size={13} />
                Guardado
              </>
            ) : (
              <>
                <Save size={13} />
                Guardar cambios
              </>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/20"
            style={{ background: "rgba(239,68,68,0.08)" }}
          >
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {notice && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/20"
            style={{ background: "rgba(16,185,129,0.07)" }}
          >
            <Check size={14} className="text-emerald-500 flex-shrink-0" />
            <p className="text-emerald-600 text-sm">{notice}</p>
          </div>
        )}

        {confirm && (
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-red-500/25"
            style={{ background: "rgba(239,68,68,0.08)" }}
          >
            <p className="text-red-600 text-sm">
              {confirm === "reset_xp" && "¿Restablecer XP, nivel y racha de este usuario?"}
              {confirm === "clear_sessions" && "¿Eliminar todas las sesiones de estudio de este usuario?"}
              {confirm === "suspend" && "¿Suspender esta cuenta e impedir nuevos accesos?"}
              {confirm === "unsuspend" && "¿Reactivar esta cuenta?"}
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setConfirm(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-sub border border-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmAction(confirm)}
                className="px-3 py-1.5 rounded-xl text-xs text-white bg-red-600 font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section
            className="rounded-2xl border p-5 space-y-4"
            style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-main font-semibold text-sm flex items-center gap-2">
                  <UserCog size={15} className="text-purple-500" />
                  Datos del usuario
                </h2>
                <p className="text-muted2 text-xs mt-1">
                  Información visible y progreso dentro de EduAI.
                </p>
              </div>
              <span className="text-[10px] text-muted2 font-mono">
                {profile?.user_code || "sin código"}
              </span>
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                Nombre
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={120}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-purple-500/40 transition-all"
              />
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                <Mail size={10} className="text-blue-500" />
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-blue-500/40 transition-all"
              />
              <p className="text-muted2 text-[10px] mt-1.5">
                El administrador puede cambiarlo y se actualizará también en Supabase Auth.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <Zap size={10} className="text-amber-400" /> XP
                </label>
                <input
                  type="number"
                  min={0}
                  value={xp}
                  onChange={e => setXp(Number(e.target.value))}
                  className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-amber-500 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <Trophy size={10} style={{ color: accentColor }} /> Nivel
                </label>
                <select
                  value={level}
                  onChange={e => setLevel(Number(e.target.value))}
                  className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ color: accentColor }}
                >
                  {[1, 2, 3, 4, 5, 6].map(l => (
                    <option key={l} value={l}>
                      {l} — {levelNames[l]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <Flame size={10} className="text-orange-400" /> Racha
                </label>
                <input
                  type="number"
                  min={0}
                  value={streakDays}
                  onChange={e => setStreakDays(Number(e.target.value))}
                  className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-orange-500 font-bold focus:outline-none"
                />
              </div>
            </div>
          </section>

          <section
            className="rounded-2xl border p-5 space-y-4"
            style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}
          >
            <div>
              <h2 className="text-main font-semibold text-sm flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-500" />
                Cuenta y permisos
              </h2>
              <p className="text-muted2 text-xs mt-1">
                Acceso funcional y privilegios de administración.
              </p>
            </div>

            {access ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                      Tipo de cuenta
                    </label>
                    <select
                      value={accountType}
                      onChange={e => setAccountType(e.target.value)}
                      className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none"
                    >
                      {ACCOUNT_TYPES.map(item => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                      Nivel de acceso
                    </label>
                    <select
                      value={accessTier}
                      onChange={e => setAccessTier(e.target.value)}
                      disabled={access?.age_band === "under_18"}
                      className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none disabled:opacity-50"
                    >
                      {ACCESS_TIERS.map(item => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                      País (ISO)
                    </label>
                    <input
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="CL"
                      maxLength={2}
                      className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main uppercase focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                      Banda etaria
                    </label>
                    <div className="h-[42px] flex items-center rounded-xl border border-soft bg-card-soft-theme px-3 text-sm text-sub">
                      {access.age_band === "under_18" ? "Menor de 18" : "Adulto"}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600">
                Esta cuenta no tiene un registro <span className="font-mono">eduai_user_access</span>. Los permisos de acceso no se modificarán hasta que exista ese perfil.
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-soft bg-card-soft-theme p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={panelAdmin}
                disabled={access?.age_band === "under_18"}
                onChange={e => setPanelAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 disabled:opacity-40"
              />
              <div>
                <p className="text-main text-sm font-medium">Acceso al panel de administración</p>
                <p className="text-muted2 text-xs mt-0.5">
                  {access?.age_band === "under_18"
                    ? "No disponible para cuentas de menores de 18 años."
                    : <>Autoriza el ingreso a <span className="font-mono">/admin</span>. Es independiente del nivel funcional anterior.</>}
                </p>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-xl border border-soft bg-card-soft-theme p-3">
                <p className="text-muted2">Correo confirmado</p>
                <p className="text-main font-semibold mt-1">
                  {account?.emailConfirmedAt ? "Sí" : "No"}
                </p>
              </div>
              <div className="rounded-xl border border-soft bg-card-soft-theme p-3">
                <p className="text-muted2">Exámenes enviados</p>
                <p className="text-main font-semibold mt-1">{examCount}</p>
              </div>
            </div>
          </section>
        </div>

        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-main font-semibold text-sm flex items-center gap-2">
                <LockKeyhole size={15} className="text-blue-500" />
                Seguridad de la cuenta
              </h2>
              <p className="text-muted2 text-xs mt-1">
                La contraseña actual no se puede visualizar. Solo puede reemplazarse por una nueva.
              </p>
            </div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                suspended
                  ? "border-red-500/20 bg-red-500/10 text-red-500"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              }`}
            >
              {suspended ? "Cuenta suspendida" : "Cuenta activa"}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 pr-10 text-sm text-main focus:outline-none focus:border-blue-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-main"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-muted2 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                Confirmar
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-blue-500/40"
              />
            </div>

            <button
              onClick={updatePassword}
              disabled={securityBusy || !newPassword}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {securityBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {passwordSaved ? "Actualizada" : "Cambiar contraseña"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={generateTemporaryPassword}
              className="inline-flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs font-medium text-sub hover:text-main"
            >
              <WandSparkles size={13} />
              Generar contraseña temporal
            </button>

            <p className="text-muted2 text-[11px]">
              No se registra ni se muestra ninguna contraseña anterior.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 border-t border-soft pt-4">
            <div className="rounded-xl bg-card-soft-theme border border-soft p-3">
              <p className="text-muted2 text-[10px] uppercase tracking-wider">Creada</p>
              <p className="text-sub text-xs mt-1">{formatDate(account?.createdAt)}</p>
            </div>
            <div className="rounded-xl bg-card-soft-theme border border-soft p-3">
              <p className="text-muted2 text-[10px] uppercase tracking-wider">Último acceso</p>
              <p className="text-sub text-xs mt-1">{formatDate(account?.lastSignInAt)}</p>
            </div>
            <div className="rounded-xl bg-card-soft-theme border border-soft p-3">
              <p className="text-muted2 text-[10px] uppercase tracking-wider">ID de Auth</p>
              <p className="text-sub text-[10px] mt-1 font-mono break-all">{account?.id || userId}</p>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-5 space-y-3 border-red-500/15"
          style={{ background: "rgba(239,68,68,0.04)" }}
        >
          <h2 className="text-red-600 font-semibold text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> Acciones de mantenimiento
          </h2>
          <p className="text-muted2 text-xs">
            Las acciones siguientes afectan el acceso o el historial del usuario.
          </p>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setConfirm(suspended ? "unsuspend" : "suspend")}
              disabled={securityBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50"
              style={{
                background: suspended ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                borderColor: suspended ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.2)",
                color: suspended ? "#10b981" : "#ef4444",
              }}
            >
              <Ban size={14} />
              {suspended ? "Reactivar cuenta" : "Suspender cuenta"}
            </button>

            <button
              onClick={() => setConfirm("reset_xp")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all"
              style={{
                background: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.2)",
                color: "#ef4444",
              }}
            >
              <Zap size={14} /> Restablecer XP y nivel
            </button>

            <button
              onClick={() => setConfirm("clear_sessions")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all"
              style={{
                background: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.2)",
                color: "#ef4444",
              }}
            >
              <Trash2 size={14} /> Borrar historial de sesiones
            </button>
          </div>
        </section>

        <section
          className="rounded-2xl border p-5"
          style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}
        >
          <h2 className="text-main font-semibold text-sm mb-3 flex items-center gap-2">
            <BookOpen size={14} className="text-blue-500" />
            Últimas sesiones ({sessions.length})
          </h2>

          {sessions.length === 0 ? (
            <p className="text-muted2 text-sm">Sin sesiones de estudio</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-soft bg-card-soft-theme"
                >
                  <span className="text-xs">{session.status === "completed" ? "✅" : "📁"}</span>
                  <span className="text-main text-xs flex-1 truncate">{session.topic}</span>
                  {session.score != null && (
                    <span className="text-amber-500 text-xs font-bold">{session.score}%</span>
                  )}
                  <span className="text-muted2 text-[10px]">
                    {new Date(session.created_at).toLocaleDateString("es-CL")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {reports.length > 0 && (
          <section
            className="rounded-2xl border p-5"
            style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}
          >
            <h2 className="text-main font-semibold text-sm mb-3">
              Reportes enviados por este usuario
            </h2>

            <div className="space-y-3">
              {reports.map(report => (
                <div
                  key={report.id}
                  className="rounded-xl border border-soft bg-card-soft-theme p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-main text-xs font-semibold">{report.subject}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                      {report.status}
                    </span>
                  </div>

                  {report.admin_reply && (
                    <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                      <p className="text-[10px] font-semibold text-emerald-600 mb-1">
                        Respuesta del administrador
                      </p>
                      <p className="text-xs text-sub">{report.admin_reply}</p>
                    </div>
                  )}

                  {report.status !== "cerrado" && (
                    <div className="space-y-2">
                      <textarea
                        value={adminReply[report.id] || ""}
                        onChange={e =>
                          setAdminReply(prev => ({ ...prev, [report.id]: e.target.value }))
                        }
                        placeholder="Escribe tu respuesta al usuario..."
                        rows={2}
                        className="w-full bg-app border border-soft rounded-xl px-3 py-2 text-xs text-sub placeholder-gray-400 focus:outline-none focus:border-purple-500/30 resize-none transition-all"
                      />

                      <div className="flex gap-2">
                        <select
                          value={replyStatus[report.id] || "resuelto"}
                          onChange={e =>
                            setReplyStatus(prev => ({
                              ...prev,
                              [report.id]: e.target.value,
                            }))
                          }
                          className="bg-app border border-soft rounded-xl px-3 py-1.5 text-xs focus:outline-none flex-1"
                        >
                          <option value="resuelto">Marcar resuelto</option>
                          <option value="en_revision">Marcar en revisión</option>
                          <option value="cerrado">Cerrar</option>
                        </select>

                        <button
                          onClick={() => sendReply(report.id)}
                          disabled={!adminReply[report.id]?.trim()}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all bg-purple-600"
                        >
                          Enviar respuesta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-soft bg-card-soft-theme px-4 py-3">
          <div className="flex items-start gap-2 text-xs text-muted2">
            <Clock3 size={13} className="mt-0.5 flex-shrink-0" />
            <p>
              Los cambios de correo, permisos y contraseña se ejecutan en el servidor con la
              credencial administrativa de Supabase; esa clave no se expone al navegador.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
