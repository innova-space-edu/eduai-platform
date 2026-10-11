"use client"

import { useEffect, useState } from "react"
import { LEGACY_CONSENT_DEADLINE_MS } from "@/lib/family-consent/transition"

export default function LegacyConsentCountdown({ policyHref }: { policyHref: string }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, LEGACY_CONSENT_DEADLINE_MS - Date.now()))
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])

  if (remainingMs === null || remainingMs <= 0) return null

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  return (
    <aside aria-label="Aviso de transición de autorizaciones familiares" className="w-full border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-amber-950 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs sm:text-sm">
        <span><strong>Nuevo proceso de autorizaciones:</strong> cuentas inscritas hasta el 11 de octubre de 2026 conservan su acceso durante la transición. Regularización exigible desde el <strong>15 de noviembre de 2026, 00:00 (Chile)</strong>.</span>
        <span className="whitespace-nowrap font-semibold tabular-nums" aria-label="Tiempo restante">
          {days} d · {String(hours).padStart(2, "0")} h · {String(minutes).padStart(2, "0")} min
        </span>
        <a href={policyHref} className="font-semibold underline underline-offset-2 hover:no-underline">Ver información</a>
      </div>
    </aside>
  )
}
