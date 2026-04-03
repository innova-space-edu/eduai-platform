// app/examen/resultados/[id]/SessionActionTimeline.tsx

"use client"

type SessionActionItem = {
  id: string
  action_type: string
  reason?: string | null
  applied_by?: string | null
  created_at: string
  duration_seconds?: number | null
}

type Props = {
  actions: SessionActionItem[]
  title?: string
}

function getActionTone(actionType: string) {
  switch (actionType) {
    case "terminate_attempt":
      return {
        dot: "bg-red-500",
        badge: "border-red-400/30 bg-red-500/15 text-red-200",
        label: "Intento terminado",
      }
    case "block":
      return {
        dot: "bg-red-400",
        badge: "border-red-400/30 bg-red-500/15 text-red-200",
        label: "Bloqueo",
      }
    case "flag_review":
      return {
        dot: "bg-fuchsia-400",
        badge: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200",
        label: "Revisión obligatoria",
      }
    case "freeze":
      return {
        dot: "bg-orange-400",
        badge: "border-orange-400/30 bg-orange-500/15 text-orange-200",
        label: "Bloqueo temporal",
      }
    case "warn":
      return {
        dot: "bg-yellow-400",
        badge: "border-yellow-400/30 bg-yellow-500/15 text-yellow-200",
        label: "Advertencia",
      }
    case "teacher_override":
      return {
        dot: "bg-sky-400",
        badge: "border-sky-400/30 bg-sky-500/15 text-sky-200",
        label: "Intervención docente",
      }
    case "clear_state":
      return {
        dot: "bg-emerald-400",
        badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
        label: "Cierre / limpieza",
      }
    default:
      return {
        dot: "bg-slate-400",
        badge: "border-white/10 bg-white/5 text-slate-200",
        label: actionType || "Acción",
      }
  }
}

export default function SessionActionTimeline({
  actions,
  title = "Timeline de acciones",
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
          {actions.length} acciones
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No hay acciones registradas para esta sesión.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {actions.map((action, index) => {
            const tone = getActionTone(action.action_type)

            return (
              <div key={action.id} className="relative pl-8">
                {index < actions.length - 1 ? (
                  <span className="absolute left-[9px] top-6 h-full w-px bg-white/10" />
                ) : null}

                <span
                  className={[
                    "absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border border-white/10",
                    tone.dot,
                  ].join(" ")}
                />

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        tone.badge,
                      ].join(" ")}
                    >
                      {tone.label}
                    </span>

                    {action.applied_by ? (
                      <span className="inline-flex rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {action.applied_by}
                      </span>
                    ) : null}

                    {typeof action.duration_seconds === "number" &&
                    action.duration_seconds > 0 ? (
                      <span className="inline-flex rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {action.duration_seconds}s
                      </span>
                    ) : null}
                  </div>

                  {action.reason ? (
                    <p className="mt-3 text-sm leading-6 text-slate-200">
                      {action.reason}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      Sin motivo adicional registrado.
                    </p>
                  )}

                  <p className="mt-3 text-xs text-slate-500">{action.created_at}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
