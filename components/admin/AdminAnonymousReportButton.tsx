"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileSpreadsheet, ShieldCheck } from "lucide-react"

export default function AdminAnonymousReportButton() {
  const pathname = usePathname()
  if (pathname !== "/admin" && pathname !== "/admin/reporte") return null

  return (
    <Link
      href="/admin/reporte/anonimo"
      className="fixed bottom-20 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-app/95 px-4 py-2.5 text-xs font-semibold text-emerald-600 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-500/50"
      title="Descargar reporte anónimo detallado en PDF o Excel"
    >
      <span className="relative">
        <FileSpreadsheet size={16} />
        <ShieldCheck size={9} className="absolute -bottom-1 -right-1" />
      </span>
      Reporte anónimo PDF/Excel
    </Link>
  )
}
