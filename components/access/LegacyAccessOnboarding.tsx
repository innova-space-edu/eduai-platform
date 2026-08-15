"use client"

import { useMemo, useState } from "react"
import { CalendarDays, GraduationCap, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type AccountType = "teacher" | "university_student" | "researcher" | "professional" | "other"

type Props = {
  userId: string
  open: boolean
  onCompleted: () => void
}

function isUnder18(birthDate: string) {
  if (!birthDate) return false
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return false
  const today = new Date()
  const threshold = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return birth > threshold
}

export default function LegacyAccessOnboarding({ userId, open, onCompleted }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [birthDate, setBirthDate] = useState("")
  const [accountType, setAccountType] = useState<AccountType>("teacher")
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  if (!open) return null

  const restricted = isUnder18(birthDate)

  async function save() {
    setError("")
    if (!birthDate) return setError("Debes indicar tu fecha de nacimiento.")
    const parsed = new Date(`${birthDate}T00:00:00`)
    if (Number.isNaN(parsed.getTime()) || parsed > new Date()) return setError("La fecha de nacimiento no es válida.")
    if (!accepted) return setError("Debes confirmar los datos y aceptar los términos y la política de privacidad.")

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const { error: upsertError } = await supabase.from("eduai_user_access").upsert({
        user_id: userId,
        birth_date: birthDate,
        age_band: restricted ? "under_18" : "adult",
        account_type: accountType,
        access_tier: restricted ? "restricted" : "standard",
        country_code: "CL",
        age_self_declared: true,
        terms_version: "2026-08",
        terms_accepted_at: now,
        privacy_version: "2026-08",
        privacy_accepted_at: now,
      }, { onConflict: "user_id" })

      if (upsertError) throw upsertError
      onCompleted()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar tu perfil de acceso.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-violet-600">
            <ShieldCheck size={18} />
            <span className="text-xs font-black uppercase tracking-[0.18em]">Actualización de cuenta</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Completa tu perfil de acceso</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            EduAI ahora adapta las funciones disponibles según edad y tipo de usuario. Esta actualización se solicita una sola vez a las cuentas creadas antes del nuevo sistema de acceso.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Fecha de nacimiento</label>
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Perfil principal</label>
            <div className="relative">
              <GraduationCap size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as AccountType)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="teacher">Docente</option>
                <option value="university_student">Estudiante universitario</option>
                <option value="researcher">Investigador/a</option>
                <option value="professional">Profesional</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          {birthDate && (
            <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${restricted ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {restricted
                ? "Esta cuenta quedará en modo restringido. Las capacidades generativas cloud no autorizadas para este perfil se bloquearán también en el servidor."
                : "Cuenta adulta: se habilitarán las capacidades disponibles para tu perfil y configuración de EduAI."}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" />
            <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              Confirmo que los datos son correctos y acepto los términos de uso y la política de privacidad vigentes de EduAI.
            </span>
          </label>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>

          <p className="text-center text-[11px] leading-5 text-slate-400">
            La edad se declara por el usuario. EduAI guarda la fecha para calcular el tramo de acceso; no se muestra públicamente.
          </p>
        </div>
      </section>
    </div>
  )
}
