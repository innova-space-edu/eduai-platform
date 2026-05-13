// components/exam/ExamThemeProvider.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Inyecta fuente (Google Fonts) + variables CSS del tema en el examen del
// estudiante. No rompe nada — solo agrega un <style> y <link> en el DOM.
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import { useEffect, useRef } from "react"
import { resolveExamStyle, buildExamStyleTag } from "@/lib/exam/theme-utils"
import type { ExamStyleSettings } from "@/lib/exam/theme-utils"

interface ExamThemeProviderProps {
  settings?: ExamStyleSettings
  children: React.ReactNode
}

export default function ExamThemeProvider({
  settings,
  children,
}: ExamThemeProviderProps) {
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const linkRef  = useRef<HTMLLinkElement  | null>(null)

  useEffect(() => {
    const resolved = resolveExamStyle(settings)

    // ── Inyectar <style> con CSS vars ──────────────────────────────────────
    if (!styleRef.current) {
      styleRef.current = document.createElement("style")
      styleRef.current.id = "exam-theme-vars"
      document.head.appendChild(styleRef.current)
    }
    styleRef.current.textContent = buildExamStyleTag(resolved)

    // ── Inyectar <link> de Google Fonts si es necesario ───────────────────
    if (resolved.fontUrl) {
      // Verificar si ya existe el link
      const existing = document.querySelector<HTMLLinkElement>(
        `link[data-exam-font]`
      )

      if (existing && existing.href !== resolved.fontUrl) {
        existing.href = resolved.fontUrl
        linkRef.current = existing
      } else if (!existing) {
        const link = document.createElement("link")
        link.rel  = "stylesheet"
        link.href = resolved.fontUrl
        link.dataset.examFont = "1"
        document.head.appendChild(link)
        linkRef.current = link
      }
    }

    return () => {
      // Limpieza al desmontar (seguridad, examen cerrado)
      styleRef.current?.remove()
      styleRef.current = null
    }
  }, [settings])

  return <>{children}</>
}
