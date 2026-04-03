// app/examen/resultados/[id]/IncidentSummaryCard.tsx

"use client"

import {
  getActionBadgeTone,
  getActionLabel,
  getRiskBadgeTone,
  getTopIncidentTypes,
  summarizeIncidents,
  type ResultIncident,
} from "@/lib/exam-security/result-utils"

type Props = {
  incidents: ResultIncident[]
  title?: string
}

export default function IncidentSummaryCard({
  incidents,
  title = "Resumen de seguridad",
}: Props) {
  const summary = summarizeIncidents(incidents)
  const topTypes = getTopIncidentTypes(incidents, 4)

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-300">
            Vista rápida del comportamiento de seguridad detectado durante la rendición.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
              getRiskBadgeTone(summary.topSeverity),
            ].join(" ")}
          >
            Riesgo: {summary.topSeverity.toUpperCase()}
          </span>

          <span
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
              getActionBadgeTone(summary.topAction),
            ].join(" ")}
          >
            {getActionLabel(summary.topAction)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Total incidentes
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Score estimado
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {summary.estimatedRiskScore}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Low
          </p>
          <p className="mt-2 text-2xl font-bold text-sky-300">
            {summary.severity.low}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Medium
          </p>
          <p className="mt-2 text-2xl font-bold text-yellow-300">
            {summary.severity.medium}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            High / Critical
          </p>
          <p className="mt-2 text-2xl font-bold text-orange-300">
            {summary.severity.high + summary.severity.critical}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-white">Incidentes más frecuentes</p>

        {topTypes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No se registraron incidentes de seguridad.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {topTypes.map((item) => (
              <span
                key={item.eventType}
                className="inline-flex rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-xs text-slate-200"
              >
                {item.eventType} · {item.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
