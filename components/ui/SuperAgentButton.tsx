"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type SuperAgentHealthResponse = {
  ok: boolean
  name: string
  alias: string
  internalName: string
  version: string
  mode: string
  features?: Record<string, boolean>
  limits?: Record<string, unknown>
  message?: string
}

type SuperAgentButtonProps = {
  className?: string
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={[
        "inline-block h-2.5 w-2.5 rounded-full",
        online ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" : "bg-slate-400",
      ].join(" ")}
    />
  )
}

export default function SuperAgentButton({
  className = "",
}: SuperAgentButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SuperAgentHealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadHealth() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/superagent", {
          method: "GET",
          cache: "no-store",
        })

        const json = (await response.json()) as SuperAgentHealthResponse

        if (!active) return

        if (!response.ok) {
          setError("No se pudo obtener el estado de EduAI Claw.")
          setData(null)
          return
        }

        setData(json)
      } catch {
        if (!active) return
        setError("EduAI Claw no está disponible en este momento.")
        setData(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHealth()
    const interval = setInterval(loadHealth, 30000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const isOnline = useMemo(() => Boolean(data?.ok && !error), [data, error])

  return (
    <div className={`fixed right-5 top-5 z-[70] ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Abrir EduAI Claw"
          title="EduAI Claw — modo PicoClaw"
          className={[
            "group relative flex h-14 w-14 items-center justify-center rounded-full",
            "border border-cyan-400/30 bg-slate-950/85 backdrop-blur-xl",
            "shadow-[0_0_30px_rgba(34,211,238,0.16)]",
            "transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.28)]",
            "focus:outline-none focus:ring-2 focus:ring-cyan-400/60",
          ].join(" ")}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/20 via-violet-500/15 to-fuchsia-500/20 opacity-100" />
          <div className="relative flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/90">
              <span className="text-lg font-bold text-cyan-300">✦</span>
            </div>
          </div>

          <span className="absolute -bottom-1 -right-1 rounded-full border border-slate-900 bg-slate-950 p-1">
            <StatusDot online={isOnline} />
          </span>
        </button>

        {open && (
          <div
            className={[
              "absolute right-0 mt-3 w-[340px] overflow-hidden rounded-3xl border border-white/10",
              "bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-2xl",
            ].join(" ")}
          >
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/90">
                    Superagente
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    {data?.name || "EduAI Claw"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {data?.alias || "EduAI Claw — modo PicoClaw"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Estado
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {loading
                        ? "Conectando..."
                        : isOnline
                        ? "Activo y observando"
                        : "Pausado o no disponible"}
                    </p>
                  </div>
                  <StatusDot online={isOnline} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-slate-400">Modo</p>
                    <p className="mt-1 font-medium text-slate-100">
                      {data?.mode || "observe_social_anticipate"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-slate-400">Versión</p>
                    <p className="mt-1 font-medium text-slate-100">
                      {data?.version || "0.1.0"}
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Capacidades base
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                    Observación
                  </span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                    Routing
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-200">
                    Social IA
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    Anticipación
                  </span>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                    Drafts
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Próximos accesos
                </p>

                <div className="mt-3 grid gap-2">
                  <Link
                    href="/ai-social"
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-slate-900 hover:text-white"
                  >
                    Ir al chat social de agentes
                  </Link>

                  <Link
                    href="/superagent"
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 transition hover:border-violet-400/30 hover:bg-slate-900 hover:text-white"
                  >
                    Abrir panel completo de EduAI Claw
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-violet-500/10 p-4">
                <p className="text-sm font-medium text-white">
                  Rol actual
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  EduAI Claw supervisa, observa, propone mejoras y anticipa
                  borradores sin intervenir directamente en el chat privado del
                  usuario ni sobrescribir producción.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
