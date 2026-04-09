// app/superagent/page.tsx

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

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

function FeatureBadge({
  label,
  active,
}: {
  label: string
  active?: boolean
}) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-slate-700 bg-slate-800/80 text-slate-300",
      ].join(" ")}
    >
      {label}
    </span>
  )
}

export default function SuperAgentPage() {
  const [data, setData] = useState<SuperAgentHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadData() {
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
          setError("No se pudo cargar la información del superagente.")
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

    loadData()

    return () => {
      active = false
    }
  }, [])

  const features = data?.features || {}

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.10),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.12),_transparent_25%),linear-gradient(to_bottom,_#020617,_#0f172a)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
          >
            ← Volver
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/90">
                  Panel maestro
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  EduAI Claw
                </h1>
                <p className="mt-2 text-sm text-slate-300 sm:text-base">
                  Superagente autónomo supervisor de la plataforma, con enfoque
                  seguro, anticipatorio y social.
                </p>
                <p className="mt-2 text-sm text-violet-200">
                  {data?.alias || "EduAI Claw — modo PicoClaw"}
                </p>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-slate-900/80 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Estado actual
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {loading
                    ? "Conectando..."
                    : error
                    ? "No disponible"
                    : "Activo y observando"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {data?.mode || "observe_social_anticipate"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">
                  Resumen del superagente
                </h2>
                <p className="mt-3 leading-7 text-slate-300">
                  EduAI Claw se posiciona por encima del router actual de
                  agentes para observar contexto, decidir la mejor ruta de ayuda,
                  anticipar necesidades del usuario y preparar borradores
                  seguros, sin sobrescribir producción ni invadir el chat
                  privado del usuario.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-400">Nombre</p>
                    <p className="mt-1 font-medium text-white">
                      {data?.name || "EduAI Claw"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-400">Alias</p>
                    <p className="mt-1 font-medium text-white">
                      {data?.alias || "EduAI Claw — modo PicoClaw"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-400">Versión</p>
                    <p className="mt-1 font-medium text-white">
                      {data?.version || "0.1.0"}
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">
                  Capacidades activas
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  <FeatureBadge
                    label="Autonomía"
                    active={features.autonomyEnabled}
                  />
                  <FeatureBadge
                    label="Social IA"
                    active={features.socialLayerEnabled}
                  />
                  <FeatureBadge
                    label="Anticipación"
                    active={features.anticipationEnabled}
                  />
                  <FeatureBadge
                    label="Drafts"
                    active={features.draftCreationEnabled}
                  />
                  <FeatureBadge
                    label="Routing"
                    active={features.routingEnabled}
                  />
                  <FeatureBadge
                    label="Self-mod"
                    active={features.selfModificationEnabled}
                  />
                  <FeatureBadge
                    label="Write producción"
                    active={features.productionWriteEnabled}
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">
                    <p className="font-medium text-cyan-200">Qué sí hace</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>• Observa el contexto actual del usuario.</li>
                      <li>• Selecciona rutas útiles entre agentes.</li>
                      <li>• Sugiere próximos pasos.</li>
                      <li>• Detecta oportunidades de borradores.</li>
                      <li>• Coordina la futura capa social IA.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-4">
                    <p className="font-medium text-amber-200">Qué no hace aún</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>• No escribe en el chat privado del usuario.</li>
                      <li>• No sobrescribe producción.</li>
                      <li>• No toca archivos sensibles o secretos.</li>
                      <li>• No modifica código productivo automáticamente.</li>
                      <li>• No borra recursos existentes.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">
                  Acciones rápidas
                </h2>

                <div className="mt-4 grid gap-3">
                  <Link
                    href="/ai-social"
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
                  >
                    Abrir chat social de agentes
                  </Link>

                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-500"
                    disabled
                  >
                    Ver drafts anticipados próximamente
                  </button>

                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-500"
                    disabled
                  >
                    Ver memoria del superagente próximamente
                  </button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">
                  Filosofía de trabajo
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  EduAI Claw opera como supervisor seguro: observa, recomienda,
                  coordina y anticipa. Su objetivo es ayudar y optimizar la
                  experiencia del usuario sin interferir en zonas privadas ni
                  romper el sistema ya construido.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-violet-500/10 via-slate-900 to-cyan-500/10 p-5">
                <p className="text-sm font-medium text-white">
                  Mensaje del sistema
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Este panel es la base visual del superagente. Luego se
                  conectará con drafts, memoria persistente, logs activos y
                  conversaciones entre agentes.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
