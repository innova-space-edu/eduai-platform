// components/exam-security/SecurityOverlay.tsx

"use client"

import React from "react"
import type { SecurityActionType } from "@/lib/exam-security/types"

type Props = {
  visible: boolean
  actionType: SecurityActionType | "none"
  title?: string
  message?: string
  countdown?: number
}

function getDefaultTitle(actionType: SecurityActionType | "none") {
  switch (actionType) {
    case "warn":
      return "Advertencia de seguridad"
    case "freeze":
      return "Examen bloqueado temporalmente"
    case "block":
      return "Sesión bloqueada"
    case "flag_review":
      return "Sesión marcada para revisión"
    case "terminate_attempt":
      return "Intento finalizado"
    default:
      return "Seguridad del examen"
  }
}

function getAccentClasses(actionType: SecurityActionType | "none") {
  switch (actionType) {
    case "warn":
      return {
        ring: "ring-yellow-400/40",
        border: "border-yellow-400/30",
        glow: "shadow-yellow-500/20",
        badge: "bg-yellow-500/15 text-yellow-200 border-yellow-400/30",
      }
    case "freeze":
      return {
        ring: "ring-orange-400/40",
        border: "border-orange-400/30",
        glow: "shadow-orange-500/20",
        badge: "bg-orange-500/15 text-orange-200 border-orange-400/30",
      }
    case "block":
      return {
        ring: "ring-red-400/40",
        border: "border-red-400/30",
        glow: "shadow-red-500/20",
        badge: "bg-red-500/15 text-red-200 border-red-400/30",
      }
    case "flag_review":
      return {
        ring: "ring-fuchsia-400/40",
        border: "border-fuchsia-400/30",
        glow: "shadow-fuchsia-500/20",
        badge: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30",
      }
    case "terminate_attempt":
      return {
        ring: "ring-red-500/50",
        border: "border-red-500/40",
        glow: "shadow-red-600/30",
        badge: "bg-red-600/20 text-red-100 border-red-400/40",
      }
    default:
      return {
        ring: "ring-sky-400/40",
        border: "border-sky-400/30",
        glow: "shadow-sky-500/20",
        badge: "bg-sky-500/15 text-sky-200 border-sky-400/30",
      }
  }
}

export default function SecurityOverlay({
  visible,
  actionType,
  title,
  message,
  countdown,
}: Props) {
  if (!visible) return null

  const accent = getAccentClasses(actionType)
  const finalTitle = title || getDefaultTitle(actionType)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div
        className={[
          "w-full max-w-xl rounded-3xl border bg-slate-900/95 p-8 text-white shadow-2xl ring-1",
          accent.border,
          accent.ring,
          accent.glow,
        ].join(" ")}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <span
            className={[
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
              accent.badge,
            ].join(" ")}
          >
            Exam Guardian
          </span>

          {typeof countdown === "number" && actionType === "freeze" ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white/90">
              {countdown}s
            </span>
          ) : null}
        </div>

        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {finalTitle}
        </h2>

        <p className="mt-4 text-base leading-7 text-slate-200 md:text-lg">
          {message ||
            "Se detectó una acción no permitida durante la rendición del examen."}
        </p>

        {actionType === "freeze" && typeof countdown === "number" ? (
          <div className="mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-orange-400 transition-all duration-1000"
                style={{
                  width: `${Math.max(0, Math.min(100, (countdown / 30) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              El tiempo del examen continúa corriendo durante este bloqueo.
            </p>
          </div>
        ) : null}

        {actionType === "terminate_attempt" ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            Tu intento fue finalizado por política de seguridad. El docente podrá
            revisar este caso.
          </div>
        ) : null}
      </div>
    </div>
  )
}
