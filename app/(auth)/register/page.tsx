"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Zap, User, Mail, Lock, Eye, EyeOff, AlertCircle, CalendarDays, GraduationCap } from "lucide-react"

type AccountType = "teacher" | "university_student" | "researcher" | "professional" | "other"

function isUnder18(birthDate: string) {
  if (!birthDate) return false
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return false
  const today = new Date()
  const threshold = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return birth > threshold
}

export default function RegisterPage() {
  const [name,             setName]             = useState("")
  const [email,            setEmail]            = useState("")
  const [password,         setPassword]         = useState("")
  const [birthDate,        setBirthDate]        = useState("")
  const [accountType,      setAccountType]      = useState<AccountType>("teacher")
  const [acceptedTerms,    setAcceptedTerms]    = useState(false)
  const [showPass,         setShowPass]         = useState(false)
  const [error,            setError]            = useState("")
  const [loading,          setLoading]          = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [,                 setUserCount]        = useState(0)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkCapacity() {
      const { data } = await supabase
        .from("platform_config").select("key, value").in("key", ["registration_open","current_users","max_users"])
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
    setLoading(true); setError("")
    if (!registrationOpen) { setError("La plataforma ha alcanzado su capacidad máxima de 200 usuarios."); setLoading(false); return }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); setLoading(false); return }
    if (!birthDate) { setError("Debes indicar tu fecha de nacimiento"); setLoading(false); return }
    const parsedBirth = new Date(`${birthDate}T00:00:00`)
    if (Number.isNaN(parsedBirth.getTime()) || parsedBirth > new Date()) {
      setError("La fecha de nacimiento no es válida"); setLoading(false); return
    }
    if (!acceptedTerms) { setError("Debes aceptar los términos y la política de privacidad"); setLoading(false); return }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          birth_date: birthDate,
          account_type: accountType,
          country_code: "CL",
          terms_accepted: true,
          terms_version: "2026-08",
          privacy_accepted: true,
          privacy_version: "2026-08",
        },
      },
    })
    if (error) { setError(error.message); setLoading(false); return }

    if (signUpData.user) {
      const userCode = (Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6)).toUpperCase().slice(0, 8)
      await supabase.from("profiles").upsert({
        id: signUpData.user.id, name, email, user_code: userCode,
        is_online: false, last_seen: new Date().toISOString(), created_at: new Date().toISOString(),
      }, { onConflict: "id" })

      // El trigger de Auth crea eduai_user_access incluso si aún no hay sesión.
      // Cuando sí existe sesión, este upsert actúa como respaldo idempotente.
      if (signUpData.session) {
        await supabase.from("eduai_user_access").upsert({
          user_id: signUpData.user.id,
          birth_date: birthDate,
          age_band: isUnder18(birthDate) ? "under_18" : "adult",
          account_type: accountType,
          access_tier: isUnder18(birthDate) ? "restricted" : "standard",
          country_code: "CL",
          age_self_declared: true,
          terms_version: "2026-08",
          terms_accepted_at: new Date().toISOString(),
          privacy_version: "2026-08",
          privacy_accepted_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
      }
    }

    if (!signUpData.session) {
      router.push("/login?registered=1")
    } else {
      router.push("/dashboard")
    }
    router.refresh()
  }

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-medium)",
    color: "var(--text-primary)",
  }

  if (!registrationOpen) {
    return (
      <main className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl p-8 border"
            style={{ background: "rgba(220,38,38,0.05)", borderColor: "rgba(220,38,38,0.20)" }}>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-main mb-2">Capacidad máxima alcanzada</h2>
            <p className="text-muted2 text-sm">La plataforma ha alcanzado el límite de 200 usuarios. Contacta al administrador.</p>
          </div>
        </div>
      </main>
    )
  }

  const restricted = isUnder18(birthDate)

  return (
    <main className="min-h-screen bg-app flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 8px 32px rgba(124,58,237,0.28)" }}>
            <Zap size={28} className="text-main" />
          </div>
          <h1 className="text-3xl font-bold text-main">
            Edu<span style={{ color: "var(--accent-blue)" }}>AI</span>
          </h1>
          <p className="text-muted2 text-sm mt-1">Crea tu cuenta</p>
        </div>

        <div className="rounded-2xl p-6 border"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "var(--border-soft)",
            boxShadow: "var(--shadow-lg)",
          }}>
          <h2 className="text-xl font-bold text-main mb-2">Crear cuenta</h2>
          <p className="text-muted2 text-xs mb-6">El acceso se adapta automáticamente según tu perfil y edad.</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-sub text-sm mb-2 block font-medium">Nombre</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre" required
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all focus:outline-none"
                  style={inputStyle} />
              </div>
            </div>

            <div>
              <label className="text-sub text-sm mb-2 block font-medium">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all focus:outline-none"
                  style={inputStyle} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sub text-sm mb-2 block font-medium">Fecha de nacimiento</label>
                <div className="relative">
                  <CalendarDays size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl pl-10 pr-3 py-3 text-sm transition-all focus:outline-none"
                    style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="text-sub text-sm mb-2 block font-medium">Perfil principal</label>
                <div className="relative">
                  <GraduationCap size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2 pointer-events-none" />
                  <select value={accountType} onChange={e => setAccountType(e.target.value as AccountType)}
                    className="w-full rounded-xl pl-10 pr-3 py-3 text-sm transition-all focus:outline-none appearance-none"
                    style={inputStyle}>
                    <option value="teacher">Docente</option>
                    <option value="university_student">Estudiante universitario</option>
                    <option value="researcher">Investigador/a</option>
                    <option value="professional">Profesional</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>
            </div>

            {birthDate && (
              <div className="rounded-xl border px-3.5 py-3 text-xs"
                style={{
                  borderColor: restricted ? "rgba(245,158,11,0.30)" : "rgba(34,197,94,0.25)",
                  background: restricted ? "rgba(245,158,11,0.06)" : "rgba(34,197,94,0.05)",
                  color: "var(--text-secondary)",
                }}>
                {restricted
                  ? "Tu cuenta se creará con acceso restringido. Algunas capacidades de IA y herramientas estarán deshabilitadas."
                  : "Cuenta adulta: tendrás acceso a las capacidades disponibles para tu perfil."}
              </div>
            )}

            <div>
              <label className="text-sub text-sm mb-2 block font-medium">Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required
                  className="w-full rounded-xl pl-10 pr-10 py-3 text-sm transition-all focus:outline-none"
                  style={inputStyle} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted2 hover:text-sub transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer rounded-xl p-3 border" style={{ borderColor: "var(--border-soft)" }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4" />
              <span className="text-xs text-muted2 leading-relaxed">
                Confirmo que los datos ingresados son correctos y acepto los términos de uso y la política de privacidad de EduAI.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border"
                style={{ background: "rgba(220,38,38,0.07)", borderColor: "rgba(220,38,38,0.20)" }}>
                <AlertCircle size={14} className="flex-shrink-0" style={{ color: "var(--accent-red)" }} />
                <p className="text-sm" style={{ color: "var(--accent-red)" }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: !loading ? "0 4px 16px rgba(124,58,237,0.28)" : "none",
              }}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-purple-300/40 border-t-purple-500 animate-spin" />
                    Creando cuenta...
                  </span>
                : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-muted2 text-sm mt-5">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium transition-colors"
              style={{ color: "var(--accent-blue)" }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
