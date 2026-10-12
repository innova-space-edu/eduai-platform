"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type Act = {
  request_id: string; folio: string; student_name: string | null; guardian_name: string
  guardian_relationship: string | null; institution_name: string; reviewer_name: string
  approved_at: string; archived_at: string; identity_verified_at: string
  legal_capacity_verified_at: string; verified_method: string; evidence_reference: string | null
  document_version: string; authorization_status: string; revoked_at: string | null
  decisions: Record<string,boolean>
}
function timeCL(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("es-CL", { timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}
export default function FamilyActsPage() {
  const [records,setRecords]=useState<Act[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [term,setTerm]=useState("")
  const [hasMore,setHasMore]=useState(false)
  useEffect(() => {
    let active=true
    fetch("/api/admin/actas-familiares",{cache:"no-store"})
      .then(async r => { const body=await r.json(); if(!r.ok)throw new Error(body.error||"Acceso denegado"); return body })
      .then(body => {if(active){setRecords(body.acts||[]);setHasMore(body.hasMore===true)}})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:"No fue posible cargar actas")})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[])
  const shown=useMemo(()=>records.filter(a=>
    [a.folio,a.student_name,a.guardian_name,a.reviewer_name]
      .some(value=>String(value||"").toLocaleLowerCase("es-CL").includes(term.toLocaleLowerCase("es-CL")))
  ),[records,term])
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <nav className="flex flex-wrap gap-4 text-sm text-blue-700">
        <Link href="/admin">← Administración</Link>
        <Link href="/admin/autorizaciones-familiares">Revisar autorizaciones</Link>
      </nav>
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Archivo privado · EDUAI</p>
        <h1 className="mt-2 text-2xl font-bold">Actas de autorización familiar</h1>
        <p className="mt-2 text-sm text-slate-200">Actas administrativas con folio único, fecha y hora de aprobación, estudiante, firmante y revisor responsable. Solo accesibles para administración.</p>
        <p className="mt-2 text-xs text-slate-300">El acta registra la declaración y la verificación informada por el administrador. No sustituye el respaldo de identidad o representación conservado en un archivo privado.</p>
      </header>
      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <p className="text-sm"><strong>{records.length}</strong> acta(s) disponibles</p>
          <input aria-label="Buscar actas" placeholder="Buscar folio, estudiante o responsable"
            value={term} onChange={e=>setTerm(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm sm:w-80"/>
        </div>
        {hasMore && <p className="mt-3 text-xs text-amber-700">Se muestran las 300 actas más recientes. Los registros anteriores permanecen guardados.</p>}
        {loading && <p className="mt-4 text-sm">Cargando actas…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && shown.length===0 && <p className="mt-4 text-sm text-slate-500">Sin actas que coincidan.</p>}
        <div className="mt-4 grid gap-3">
          {shown.map(a=><article key={a.request_id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-blue-900">{a.folio}</h2>
                <p className="text-sm text-slate-600">Aprobado: {timeCL(a.approved_at)} (hora de Chile)</p></div>
              <span className={a.authorization_status==="approved"?"rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800":"rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"}>
                {a.authorization_status==="approved"?"Acceso aprobado":a.authorization_status==="revoked"?"Autorización revocada":a.authorization_status}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Estudiante</dt><dd>{a.student_name||"No declarado"}</dd></div>
              <div><dt className="text-xs text-slate-500">Apoderado firmante</dt><dd>{a.guardian_name} · {a.guardian_relationship||"Relación no declarada"}</dd></div>
              <div><dt className="text-xs text-slate-500">Administrador que aprobó</dt><dd>{a.reviewer_name}</dd></div>
              <div><dt className="text-xs text-slate-500">Método de verificación</dt><dd>{a.verified_method==="manual_institution"?"Verificación institucional":a.verified_method}</dd></div>
              <div><dt className="text-xs text-slate-500">Referencia de verificación</dt><dd className="break-all">{a.evidence_reference||"Sin folio externo"}</dd></div>
              <div><dt className="text-xs text-slate-500">Versión de formulario</dt><dd>{a.document_version}</dd></div>
            </dl>
            {a.authorization_status==="revoked" && <p className="mt-2 text-xs text-red-700">Revocación: {timeCL(a.revoked_at)}. El acta histórica se conserva.</p>}
          </article>)}
        </div>
      </section>
    </div>
  </main>
}
