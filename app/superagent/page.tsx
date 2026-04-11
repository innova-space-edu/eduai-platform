// app/superagent/page.tsx

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import DraftCreatorCard from "@/components/superagent/DraftCreatorCard"

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
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-700"
          : "border-medium bg-card-soft-theme text-sub",
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
    <main className="min-h-screen bg-gradient-to-b from-white via-violet-50/30 to-cyan-50/20 text-main">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-soft bg-card-theme px-4 py-2 text-sm text-main transition hover:border-cyan-400/30 hover:text-main"
          >
            ← Volver
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-soft bg-app shadow-2xl backdrop-blur-xl">
          <div className="border-b border-soft bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-700/90">
                  Panel maestro
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  EduAI Claw
                </h1>
                <p className="mt-2 text-sm text-sub sm:text-base">
                  Superagente autónomo supervisor de la plataforma, con enfoque
                  seguro, anticipatorio y social.
                </p>
                <p className="mt-2 text-sm text-violet-700">
                  {data?.alias || "EduAI Claw — modo PicoClaw"}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/20 bg-card-theme px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sub">
                  Estado actual
                </p>
                <p className="mt-2 text-lg font-semibold text-main">
                  {loading
                    ? "Conectando..."
                    : error
                    ? "No disponible"
                    : "Activo y observando"}
                </p>
                <p className="mt-1 text-sm text-sub">
                  {data?.mode || "observe_social_anticipate"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-[1.75rem] border border-soft bg-card-soft-theme p-5">
                <h2 className="text-lg font-semibold text-main">
                  Resumen del superagente
                </h2>
                <p className="mt-3 leading-7 text-sub">
                  EduAI Claw se posiciona por encima del router actual de
                  agentes para observar contexto, decidir la mejor ruta de ayuda,
                  anticipar necesidades del usuario y preparar borradores
                  seguros, sin sobrescribir producción ni invadir el chat
                  privado del usuario.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-soft bg-card-theme p-4">
                    <p className="text-sm text-sub">Nombre</p>
                    <p className="mt-1 font-medium text-main">
                      {data?.name || "EduAI Claw"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-soft bg-card-theme p-4">
                    <p className="text-sm text-sub">Alias</p>
                    <p className="mt-1 font-medium text-main">
                      {data?.alias || "EduAI Claw — modo PicoClaw"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-soft bg-card-theme p-4">
                    <p className="text-sm text-sub">Versión</p>
                    <p className="mt-1 font-medium text-main">
                      {data?.version || "0.1.0"}
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-soft bg-card-soft-theme p-5">
                <h2 className="text-lg font-semibold text-main">
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
                    <p className="font-medium text-cyan-700">Qué sí hace</p>
                    <ul className="mt-3 space-y-2 text-sm text-sub">
                      <li>• Observa el contexto actual del usuario.</li>
                      <li>• Selecciona rutas útiles entre agentes.</li>
                      <li>• Sugiere próximos pasos.</li>
                      <li>• Detecta oportunidades de borradores.</li>
                      <li>• Coordina la futura capa social IA.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-4">
                    <p className="font-medium text-amber-700">Qué no hace aún</p>
                    <ul className="mt-3 space-y-2 text-sm text-sub">
                      <li>• No escribe en el chat privado del usuario.</li>
                      <li>• No sobrescribe producción.</li>
                      <li>• No toca archivos sensibles o secretos.</li>
                      <li>• No modifica código productivo automáticamente.</li>
                      <li>• No borra recursos existentes.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Creador de borradores anticipados */}
              <DraftCreatorCard />
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-[1.75rem] border border-soft bg-card-soft-theme p-5">
                <h2 className="text-lg font-semibold text-main">
                  Acciones rápidas
                </h2>

                <div className="mt-4 grid gap-3">
                  <Link
                    href="/ai-social"
                    className="rounded-2xl border border-soft bg-card-theme px-4 py-3 text-sm text-main transition hover:border-cyan-400/30 hover:text-main"
                  >
                    Abrir chat social de agentes
                  </Link>

                  <button
                    type="button"
                    className="rounded-2xl border border-soft bg-card-theme px-4 py-3 text-left text-sm text-muted2"
                    disabled
                  >
                    Ver drafts anticipados próximamente
                  </button>

                  <button
                    type="button"
                    className="rounded-2xl border border-soft bg-card-theme px-4 py-3 text-left text-sm text-muted2"
                    disabled
                  >
                    Ver memoria del superagente próximamente
                  </button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-soft bg-card-soft-theme p-5">
                <h2 className="text-lg font-semibold text-main">
                  Filosofía de trabajo
                </h2>
                <p className="mt-3 text-sm leading-7 text-sub">
                  EduAI Claw opera como supervisor seguro: observa, recomienda,
                  coordina y anticipa. Su objetivo es ayudar y optimizar la
                  experiencia del usuario sin interferir en zonas privadas ni
                  romper el sistema ya construido.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-soft bg-gradient-to-br from-violet-500/8 via-white to-cyan-500/8 p-5">
                <p className="text-sm font-medium text-main">
                  Mensaje del sistema
                </p>
                <p className="mt-3 text-sm leading-7 text-sub">
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
