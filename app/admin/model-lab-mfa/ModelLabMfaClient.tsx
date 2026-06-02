"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Step = "loading" | "scan" | "verify" | "done"

export default function ModelLabMfaClient() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>("loading")
  const [factorId, setFactorId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void prepare()
  }, [])

  async function prepare() {
    setBusy(true)
    setError("")

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace("/login")
      return
    }

    const { data: allowed } = await supabase.rpc("has_model_lab_admin_access")
    if (allowed !== true) {
      router.replace("/admin")
      return
    }

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assurance?.currentLevel === "aal2") {
      router.replace("/admin/model-lab")
      router.refresh()
      return
    }

    const { data: listed, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      setError(listError.message)
      setBusy(false)
      return
    }

    const verified = listed.totp.find((factor) => factor.status === "verified")
    if (verified) {
      setFactorId(verified.id)
      setStep("verify")
      setBusy(false)
      return
    }

    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "EduAI Model Lab",
    })

    if (enrollError || !enrolled) {
      setError(enrollError?.message || "No fue posible iniciar MFA")
      setBusy(false)
      return
    }

    setFactorId(enrolled.id)
    setQrCode(enrolled.totp.qr_code)
    setStep("scan")
    setBusy(false)
  }

  async function verify() {
    if (!factorId || code.trim().length !== 6) {
      setError("Ingresa el código temporal de 6 dígitos")
      return
    }

    setBusy(true)
    setError("")

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge) {
      setError(challengeError?.message || "No fue posible generar el desafío")
      setBusy(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })

    if (verifyError) {
      setError("Código inválido o vencido")
      setBusy(false)
      return
    }

    await supabase.auth.refreshSession()
    setStep("done")
    router.replace("/admin/model-lab")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-md rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Admin only</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Verificación en dos pasos</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Model Lab requiere MFA mediante una app autenticadora antes de permitir pruebas experimentales.
        </p>

        {step === "scan" && qrCode && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-300">Escanea el código QR y escribe el código temporal.</p>
            <div className="rounded-2xl bg-white p-4">
              <img src={qrCode} alt="Código QR para configurar MFA" className="mx-auto h-52 w-52" />
            </div>
          </div>
        )}

        {(step === "scan" || step === "verify") && (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-bold text-slate-200">Código temporal</label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-xl tracking-[0.35em] outline-none transition focus:border-amber-300/70"
            />
            <button
              onClick={verify}
              disabled={busy}
              className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
            >
              {busy ? "Verificando..." : "Verificar y entrar"}
            </button>
          </div>
        )}

        {step === "loading" && <p className="mt-6 text-sm text-slate-400">Preparando verificación segura...</p>}
        {step === "done" && <p className="mt-6 text-sm text-emerald-300">Acceso verificado. Redirigiendo...</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      </section>
    </main>
  )
}
