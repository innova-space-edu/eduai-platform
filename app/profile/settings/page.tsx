"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PrivacyPreferences, EMPTY_OPTIONAL_PRIVACY_CHOICES, PRIVACY_TERMS_VERSION, type OptionalPrivacyChoices } from "@/components/legal/PrivacyConsentPanel"

export default function ProfileSettings() {
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatar, setAvatar] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwSaved, setPwSaved] = useState(false)
  const [privacyChoices, setPrivacyChoices] = useState<OptionalPrivacyChoices>({ ...EMPTY_OPTIONAL_PRIVACY_CHOICES })
  const [privacyMinor, setPrivacyMinor] = useState(false)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [privacyStatus, setPrivacyStatus] = useState("")
  const [privacyAcceptedAt,setPrivacyAcceptedAt] = useState<string|null>(null)
  const [privacyUpdatedAt,setPrivacyUpdatedAt] = useState<string|null>(null)
  const [privacyEvents,setPrivacyEvents] = useState<Array<{recorded_at:string;event_type:string;choices:OptionalPrivacyChoices}>>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUser(user)
      setName(user.user_metadata?.name || "")
      setEmail(user.email || "")
      setAvatar(user.user_metadata?.avatar_url || "")
      const dob = String(user.user_metadata?.birth_date || "")
      const d = new Date(`${dob}T00:00:00`)
      const today = new Date()
      setPrivacyMinor(!dob || Number.isNaN(d.getTime()) || d > new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()))
      const { data: existing, error: loadError } = await supabase.from("eduai_privacy_choices")
        .select("policy_version, terms_acknowledged_at, data_warning_acknowledged_at, updated_at, ai_generation, ai_documents, ai_voice, optional_analytics")
        .eq("user_id", user.id).maybeSingle()
      if (loadError) setPrivacyStatus("Aún no se pudieron cargar tus permisos. Comprueba que la actualización de privacidad esté habilitada.")
      if (existing) {
        setPrivacyAcceptedAt(existing.terms_acknowledged_at || null)
        setPrivacyUpdatedAt(existing.updated_at || null)
        setPrivacyAcknowledged(Boolean(existing.terms_acknowledged_at && existing.data_warning_acknowledged_at && existing.policy_version === PRIVACY_TERMS_VERSION))
        setPrivacyChoices({
          ai_generation: existing.ai_generation === true,
          ai_documents: existing.ai_documents === true,
          ai_voice: existing.ai_voice === true,
          optional_analytics: existing.optional_analytics === true,
        })
      }
      const { data: privacyAudit } = await supabase.from("eduai_privacy_choice_events")
        .select("recorded_at,event_type,choices").eq("user_id",user.id)
        .order("recorded_at",{ascending:false}).limit(12)
      if (privacyAudit) setPrivacyEvents(privacyAudit as Array<{recorded_at:string;event_type:string;choices:OptionalPrivacyChoices}>)
    }
    init()
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { name, avatar_url: avatar } })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  async function savePassword() {
    setPwError("")
    if (newPassword.length < 6) { setPwError("Mínimo 6 caracteres"); return }
    if (newPassword !== confirmPassword) { setPwError("Las contraseñas no coinciden"); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwError(error.message); return }
    setPwSaved(true)
    setNewPassword("")
    setConfirmPassword("")
    setTimeout(() => setPwSaved(false), 3000)
  }

  async function savePrivacyChoices() {
    if (!privacyAcknowledged) {
      setPrivacyStatus("Para cambiar permisos debes reconocer antes las condiciones actuales y la advertencia de privacidad en el inicio de sesión.")
      return
    }
    setPrivacyStatus("")
    setPrivacySaving(true)
    const { error } = await supabase.rpc("record_eduai_privacy_choices", {
      p_policy_version: PRIVACY_TERMS_VERSION,
      p_terms_acknowledged: true,
      p_data_warning_acknowledged: true,
      p_choices: privacyMinor ? EMPTY_OPTIONAL_PRIVACY_CHOICES : privacyChoices,
    })
    setPrivacySaving(false)
    if (!error) {
      const { data:latest } = await supabase.from("eduai_privacy_choices")
        .select("terms_acknowledged_at,updated_at").eq("user_id",user.id).maybeSingle()
      if (latest) {
        setPrivacyAcceptedAt(latest.terms_acknowledged_at || null)
        setPrivacyUpdatedAt(latest.updated_at || null)
      }
      const {data:audit}=await supabase.from("eduai_privacy_choice_events")
        .select("recorded_at,event_type,choices").eq("user_id",user.id)
        .order("recorded_at",{ascending:false}).limit(12)
      if(audit)setPrivacyEvents(audit as Array<{recorded_at:string;event_type:string;choices:OptionalPrivacyChoices}>)
    }
    setPrivacyStatus(error ? "No fue posible registrar tus preferencias. Contacta soporte si continúa el problema." : "Preferencias actualizadas. La fecha original de aceptación se conserva.")
  }

  const AVATARS = ["🧑‍🎓","👩‍🎓","🧑‍🏫","👩‍🏫","🧑‍💻","👩‍💻","🧑‍🔬","👩‍🔬","🦊","🐼","🦁","🐯","🌟","🚀","🎯","🏆"]

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-medium)",
    color: "var(--text-primary)",
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <div className="border-b sticky top-0 z-10 backdrop-blur-xl"
        style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}>
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm text-sub hover:text-main"
            style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}>
            ←
          </button>
          <div>
            <h1 className="text-main font-semibold text-sm">Configuración de perfil</h1>
            <p className="text-muted2 text-xs">Edita tu información personal</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Avatar */}
        <div className="rounded-2xl p-5 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-main font-medium text-sm mb-4">🖼️ Avatar</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl border"
              style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.18)" }}>
              {avatar || "🧑‍🎓"}
            </div>
            <div>
              <p className="text-sub text-sm font-medium">{name || "Sin nombre"}</p>
              <p className="text-muted2 text-xs">{email}</p>
            </div>
          </div>
          <p className="text-muted2 text-xs mb-3">Elige un emoji como avatar:</p>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)}
                className="w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: avatar === a ? "rgba(37,99,235,0.12)" : "var(--bg-card-soft)",
                  border: `1px solid ${avatar === a ? "rgba(37,99,235,0.30)" : "var(--border-soft)"}`,
                  transform: avatar === a ? "scale(1.1)" : undefined,
                }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div className="rounded-2xl p-5 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-main font-medium text-sm mb-4">👤 Información personal</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-muted2 text-xs mb-1.5 block">Nombre de usuario</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")} />
            </div>
            <div>
              <label className="text-muted2 text-xs mb-1.5 block">Correo electrónico</label>
              <input value={email} disabled
                className="w-full rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)", color: "var(--text-muted)" }} />
              <p className="text-muted2 text-xs mt-1">El correo no se puede cambiar</p>
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : saved ? <><span>✓</span> Guardado</> : "Guardar cambios"}
          </button>
        </div>

        {/* Contraseña */}
        <div className="rounded-2xl p-5 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-main font-medium text-sm mb-4">🔒 Cambiar contraseña</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-muted2 text-xs mb-1.5 block">Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")} />
            </div>
            <div>
              <label className="text-muted2 text-xs mb-1.5 block">Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")} />
            </div>
            {pwError && <p className="text-red-600 text-xs">{pwError}</p>}
            {pwSaved && <p className="text-emerald-600 text-xs">✓ Contraseña actualizada</p>}
          </div>
          <button onClick={savePassword} disabled={!newPassword}
            className="mt-4 w-full disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "var(--accent-blue)" }}
            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = "#1d4ed8")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--accent-blue)")}>
            Cambiar contraseña
          </button>
        </div>

        {/* Preferencias de tratamiento opcional */}
        <div className="rounded-2xl p-5 border" style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)" }}>
          <h2 className="text-main font-medium text-sm mb-3">Privacidad y permisos de herramientas</h2>
          {privacyAcceptedAt && <p className="mb-2 rounded-lg border border-soft p-3 text-xs leading-5 text-sub">
            Condiciones aceptadas: <strong>{new Date(privacyAcceptedAt).toLocaleString("es-CL",{timeZone:"America/Santiago",dateStyle:"medium",timeStyle:"short"})}</strong>
            {" · "}Versión {PRIVACY_TERMS_VERSION}
            {privacyUpdatedAt && <span className="block">Última actualización de permisos: {new Date(privacyUpdatedAt).toLocaleString("es-CL",{timeZone:"America/Santiago",dateStyle:"medium",timeStyle:"short"})}</span>}
          </p>}
          <p className="mb-4 text-xs leading-5 text-sub">Consulta las finalidades y cambia tus permisos. Los tratamientos necesarios para mantener la cuenta se rigen por las condiciones del servicio y las bases legales aplicables.</p>
          <PrivacyPreferences value={privacyChoices} onChange={setPrivacyChoices} minorRestricted={privacyMinor} />
          {privacyStatus && <p className="mt-3 text-xs text-sub" role="status">{privacyStatus}</p>}
          <button type="button" onClick={savePrivacyChoices} disabled={privacySaving || !user || !privacyAcknowledged}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
            {privacySaving ? "Guardando..." : "Guardar preferencias y revocaciones"}
          </button>
          {privacyEvents.length > 0 && <details className="mt-4 rounded-xl border border-soft p-3 text-xs text-sub">
            <summary className="cursor-pointer font-semibold">Historial de decisiones guardadas ({privacyEvents.length} recientes)</summary>
            <div className="mt-3 space-y-3">
              {privacyEvents.map((ev,index)=><div key={index} className="border-b border-soft pb-2">
                <p className="font-semibold">{new Date(ev.recorded_at).toLocaleString("es-CL",{timeZone:"America/Santiago",dateStyle:"medium",timeStyle:"short"})}</p>
                <p>IA: {ev.choices?.ai_generation?"Sí":"No"} · Documentos: {ev.choices?.ai_documents?"Sí":"No"} · Voz: {ev.choices?.ai_voice?"Sí":"No"} · Analítica: {ev.choices?.optional_analytics?"Sí":"No"}</p>
              </div>)}
            </div>
          </details>}
        </div>

        {/* Zona peligrosa */}
        <div className="rounded-2xl p-5 border" style={{ background: "rgba(220,38,38,0.04)", borderColor: "rgba(220,38,38,0.18)" }}>
          <h2 className="font-medium text-sm mb-2" style={{ color: "var(--accent-red)" }}>⚠️ Zona peligrosa</h2>
          <p className="text-muted2 text-xs mb-4">Estas acciones son irreversibles.</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login") }}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "var(--accent-red)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.14)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(220,38,38,0.08)")}>
            Cerrar sesión en todos los dispositivos
          </button>
        </div>
      </div>
    </div>
  )
}
