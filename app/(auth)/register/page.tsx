"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [userCount, setUserCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkCapacity() {
      const { data } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["registration_open", "current_users", "max_users"])

      if (data) {
        const config = Object.fromEntries(data.map((r) => [r.key, r.value]))
        setRegistrationOpen(config.registration_open === "true")
        setUserCount(parseInt(config.current_users || "0"))
      }
    }
    checkCapacity()
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!registrationOpen) {
      setError("La plataforma ha alcanzado su capacidad máxima de 200 usuarios.")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  // Capacidad llena
  if (!registrationOpen) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-blue-400 mb-4">EduAI</h1>
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8">
            <div className="text-red-400 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-white mb-2">Capacidad máxima alcanzada</h2>
            <p className="text-gray-400 text-sm">
              La plataforma ha alcanzado el límite de 200 usuarios. Contacta al administrador para más información.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-400">EduAI</h1>
          <p className="text-gray-400 mt-2">Tu tutor personal con IA</p>
        </div>

        {/* Barra de capacidad */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Usuarios registrados</span>
            <span className={userCount >= 160 ? "text-amber-400" : "text-green-400"}>
              {userCount} / 200
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                userCount >= 160 ? "bg-amber-400" : "bg-green-500"
              }`}
              style={{ width: `${(userCount / 200) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Crear cuenta</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
