"use client"

import { useEffect, useRef, useState } from "react"
import { LEGACY_CONSENT_DEADLINE_MS } from "@/lib/family-consent/transition"

export default function LegacyConsentCountdown({ policyHref }: { policyHref: string }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const bannerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, LEGACY_CONSENT_DEADLINE_MS - Date.now()))
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])

  // El banner puede ocupar una o más líneas según el ancho; la altura
  // medida evita empujar los paneles de altura fija fuera de la pantalla.
  useEffect(() => {
    const element = bannerRef.current
    const root = document.documentElement
    if (!element) {
      root.style.setProperty("--legacy-consent-banner-height", "0px")
      return
    }
    const syncHeight = () => {
      root.style.setProperty("--legacy-consent-banner-height", `${Math.ceil(element.getBoundingClientRect().height)}px`)
    }
    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.setProperty("--legacy-consent-banner-height", "0px")
    }
  }, [remainingMs !== null && remainingMs > 0])

  if (remainingMs === null || remainingMs <= 0) return null

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  return (
    <aside ref={bannerRef} aria-label="Aviso de transición de autorizaciones familiares" className="relative z-30 w-full border-b border-amber-300/60 bg-amber-50 px-2 py-1 text-amber-950 print:hidden sm:px-3">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center text-[11px] leading-snug sm:text-xs">
        <span><strong>Nuevo proceso de autorizaciones:</strong> cuentas inscritas hasta el 11 de octubre de 2026 conservan su acceso durante la transición. Regularización exigible desde el <strong>15 de noviembre de 2026, 00:00 (Chile)</strong>.</span>
        <span className="whitespace-nowrap font-semibold tabular-nums" aria-label="Tiempo restante">
          {days} d · {String(hours).padStart(2, "0")} h · {String(minutes).padStart(2, "0")} min
        </span>
        <a href={policyHref} className="font-semibold underline underline-offset-2 hover:no-underline">Ver información</a>
      </div>
    </aside>
  )
}
