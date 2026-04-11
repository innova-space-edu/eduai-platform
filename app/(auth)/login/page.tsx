"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError("Email o contraseña incorrectos"); setLoading(false) }
    else router.push("/dashboard")
  }

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-medium)",
    color: "var(--text-primary)",
  }

  return (
    <main className="min-h-screen bg-app flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Soft background orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)" }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-in-scale">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 8px 32px rgba(37,99,235,0.28)" }}>
            <Zap size={28} className="text-main" />
          </div>
          <h1 className="text-3xl font-bold text-main">
            Edu<span style={{ color: "var(--accent-blue)" }}>AI</span>
          </h1>
          <p className="text-muted2 text-sm mt-1">Tu tutor personal con IA</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "var(--border-soft)",
            boxShadow: "var(--shadow-lg)",
          }}>
          <h2 className="text-xl font-bold text-main mb-6">Iniciar sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="text-sub text-sm mb-2 block font-medium">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all focus:outline-none"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sub text-sm mb-2 block font-medium">Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full rounded-xl pl-10 pr-10 py-3 text-sm transition-all focus:outline-none"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted2 hover:text-sub transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border"
                style={{ background: "rgba(220,38,38,0.07)", borderColor: "rgba(220,38,38,0.20)" }}>
                <AlertCircle size={14} className="flex-shrink-0" style={{ color: "var(--accent-red)" }} />
                <p className="text-sm" style={{ color: "var(--accent-red)" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50"
              style={{
                background: loading ? "var(--border-medium)" : "linear-gradient(135deg, #1d4ed8, #2563eb)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(37,99,235,0.28)",
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-blue-300/40 border-t-blue-500 animate-spin" />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>

          <p className="text-center text-muted2 text-sm mt-5">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-medium transition-colors"
              style={{ color: "var(--accent-blue)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1d4ed8")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--accent-blue)")}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
