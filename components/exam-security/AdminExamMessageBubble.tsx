// components/exam-security/AdminExamMessageBubble.tsx

"use client"

import { useEffect, useMemo } from "react"

export type AdminExamBubbleMessage = {
  id: string
  action?: string
  kind?: "notification" | "message"
  title?: string
  message?: string
  created_at?: string
}

type Props = {
  item: AdminExamBubbleMessage | null
  pendingCount?: number
  onDismiss: () => void
}

export default function AdminExamMessageBubble({
  item,
  pendingCount = 0,
  onDismiss,
}: Props) {
  const durationMs = item?.kind === "notification" ? 12000 : 20000

  useEffect(() => {
    if (!item?.id) return
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [item?.id, durationMs, onDismiss])

  const visual = useMemo(() => {
    if (item?.kind === "notification") {
      return {
        icon: "🔔",
        eyebrow: "NOTIFICACIÓN DEL ADMINISTRADOR",
        shell: "border-amber-300 bg-amber-50/95",
        iconBox: "bg-amber-100 text-amber-800",
        title: "text-amber-950",
        body: "text-amber-900",
        button: "border-amber-300 bg-white text-amber-900 hover:bg-amber-100",
        progress: "bg-amber-500",
      }
    }

    return {
      icon: "💬",
      eyebrow: "MENSAJE DEL ADMINISTRADOR",
      shell: "border-sky-300 bg-sky-50/95",
      iconBox: "bg-sky-100 text-sky-800",
      title: "text-sky-950",
      body: "text-sky-900",
      button: "border-sky-300 bg-white text-sky-900 hover:bg-sky-100",
      progress: "bg-sky-500",
    }
  }, [item?.kind])

  if (!item?.id || !item.message?.trim()) return null

  return (
    <aside
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={[
        "fixed right-4 top-4 z-[10050] w-[min(92vw,26rem)] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md",
        visual.shell,
      ].join(" ")}
    >
      <div className="flex gap-3 p-4">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-sm",
            visual.iconBox,
          ].join(" ")}
        >
          {visual.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-slate-600">
                {visual.eyebrow}
              </p>
              <h3 className={["mt-1 text-base font-black", visual.title].join(" ")}>
                {item.title ||
                  (item.kind === "notification"
                    ? "Notificación importante"
                    : "Mensaje del administrador")}
              </h3>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/80 text-lg font-black text-slate-700 transition hover:bg-white"
              aria-label="Cerrar mensaje"
              title="Cerrar"
            >
              ×
            </button>
          </div>

          <p className={["mt-3 whitespace-pre-wrap text-sm font-semibold leading-6", visual.body].join(" ")}>
            {item.message}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className={[
                "rounded-xl border px-3 py-1.5 text-xs font-black transition",
                visual.button,
              ].join(" ")}
            >
              Entendido
            </button>

            {pendingCount > 0 ? (
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-slate-700">
                +{pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="h-1 w-full bg-white/60">
        <div
          key={item.id}
          className={["h-full origin-left", visual.progress].join(" ")}
          style={{ animation: `admin-message-progress ${durationMs}ms linear forwards` }}
        />
      </div>

      <style jsx>{`
        @keyframes admin-message-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </aside>
  )
}
