"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

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
