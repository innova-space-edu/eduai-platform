"use client"

import Link from "next/link"

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Códigos</p>
        <h1 className="mt-2 text-3xl font-black">Códigos temporales de examen</h1>
        <p className="mt-3 text-sm text-slate-600">La API segura está en /api/exam-access. Usa el parche local para instalar la interfaz completa.</p>
        <Link href="/admin/exam-security" className="mt-5 inline-flex rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">Volver</Link>
      </div>
    </main>
  )
}
