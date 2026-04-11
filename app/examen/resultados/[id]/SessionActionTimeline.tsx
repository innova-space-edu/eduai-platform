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
        badge: "border-red-400/30 bg-red-500/15 text-red-700",
        label: "Intento terminado",
      }
    case "block":
      return {
        dot: "bg-red-500",
        badge: "border-red-400/30 bg-red-500/15 text-red-700",
        label: "Bloqueo",
      }
    case "flag_review":
      return {
        dot: "bg-fuchsia-500",
        badge: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-700",
        label: "Revisión obligatoria",
      }
    case "freeze":
      return {
        dot: "bg-orange-500",
        badge: "border-orange-400/30 bg-orange-500/15 text-orange-700",
        label: "Bloqueo temporal",
      }
    case "warn":
      return {
        dot: "bg-amber-500",
        badge: "border-yellow-400/30 bg-yellow-500/15 text-yellow-700",
        label: "Advertencia",
      }
    case "teacher_override":
      return {
        dot: "bg-blue-500",
        badge: "border-sky-400/30 bg-sky-500/15 text-sky-700",
        label: "Intervención docente",
      }
    case "clear_state":
      return {
        dot: "bg-emerald-500",
        badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
        label: "Cierre / limpieza",
      }
    default:
      return {
        dot: "bg-slate-200",
        badge: "border-soft bg-card-soft-theme text-main",
        label: actionType || "Acción",
      }
  }
}

export default function SessionActionTimeline({
  actions,
  title = "Timeline de acciones",
}: Props) {
  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-main">{title}</h3>
        <span className="text-xs uppercase tracking-[0.18em] text-sub">
          {actions.length} acciones
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="mt-4 text-sm text-sub">
          No hay acciones registradas para esta sesión.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {actions.map((action, index) => {
            const tone = getActionTone(action.action_type)

            return (
              <div key={action.id} className="relative pl-8">
                {index < actions.length - 1 ? (
                  <span className="absolute left-[9px] top-6 h-full w-px bg-card-soft-theme" />
                ) : null}

                <span
                  className={[
                    "absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border border-soft",
                    tone.dot,
                  ].join(" ")}
                />

                <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
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
                      <span className="inline-flex rounded-full border border-soft bg-card-soft-theme px-2.5 py-1 text-xs text-sub">
                        {action.applied_by}
                      </span>
                    ) : null}

                    {typeof action.duration_seconds === "number" &&
                    action.duration_seconds > 0 ? (
                      <span className="inline-flex rounded-full border border-soft bg-card-soft-theme px-2.5 py-1 text-xs text-sub">
                        {action.duration_seconds}s
                      </span>
                    ) : null}
                  </div>

                  {action.reason ? (
                    <p className="mt-3 text-sm leading-6 text-main">
                      {action.reason}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-sub">
                      Sin motivo adicional registrado.
                    </p>
                  )}

                  <p className="mt-3 text-xs text-muted2">{action.created_at}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
