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
    const { error } = await supabase.auth.updateUser({
      data: { name, avatar_url: avatar }
    })
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

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">
            ←
          </button>
          <div>
            <h1 className="text-white font-semibold text-sm">Configuración de perfil</h1>
            <p className="text-gray-500 text-xs">Edita tu información personal</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Avatar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-medium text-sm mb-4">🖼️ Avatar</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-4xl">
              {avatar || "🧑‍🎓"}
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">{name || "Sin nombre"}</p>
              <p className="text-gray-600 text-xs">{email}</p>
            </div>
          </div>
          <p className="text-gray-600 text-xs mb-3">Elige un emoji como avatar:</p>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)}
                className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110 ${
                  avatar === a ? "bg-blue-500/20 border border-blue-500/40 scale-110" : "bg-gray-800 hover:bg-gray-700"
                }`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-medium text-sm mb-4">👤 Información personal</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Nombre de usuario</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Correo electrónico</label>
              <input value={email} disabled
                className="w-full bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-600 text-sm cursor-not-allowed" />
              <p className="text-gray-700 text-xs mt-1">El correo no se puede cambiar</p>
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : saved ? (
              <><span>✓</span> Guardado</>
            ) : "Guardar cambios"}
          </button>
        </div>

        {/* Contraseña */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-medium text-sm mb-4">🔒 Cambiar contraseña</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
            {pwSaved && <p className="text-green-400 text-xs">✓ Contraseña actualizada</p>}
          </div>
          <button onClick={savePassword} disabled={!newPassword}
            className="mt-4 w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            Cambiar contraseña
          </button>
        </div>

        {/* Zona peligrosa */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <h2 className="text-red-400 font-medium text-sm mb-2">⚠️ Zona peligrosa</h2>
          <p className="text-gray-600 text-xs mb-4">Estas acciones son irreversibles.</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login") }}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Cerrar sesión en todos los dispositivos
          </button>
        </div>
      </div>
    </div>
  )
}
