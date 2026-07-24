"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquareWarning } from "lucide-react"

const HIDDEN_PREFIXES = [
  "/examen/p/",
  "/privacidad",
  "/seguridad",
  "/gobernanza-ia",
  "/terminos",
  "/soporte",
]

export default function SupportLinkButton() {
  const pathname = usePathname()
  if (HIDDEN_PREFIXES.some(prefix => pathname?.startsWith(prefix))) return null

  return (
    <Link
      href="/soporte"
      className="fixed bottom-6 left-5 z-40 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-app/90 px-4 py-2.5 text-xs font-semibold text-blue-600 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:text-blue-500 sm:inline-flex"
      title="Enviar un reporte de falla al administrador"
    >
      <MessageSquareWarning size={15} />
      Reportar una falla
    </Link>
  )
}
