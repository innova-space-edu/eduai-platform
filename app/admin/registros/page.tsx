"use client"
import Link from "next/link"
import { useState } from "react"
import { Download, FileSpreadsheet, FileText, ShieldCheck, Archive, FolderOpen } from "lucide-react"

const categories=[
  {name:"Actas institucionales",description:"Folios ACTA, estudiante, apoderado, fecha, revisión y estado de acceso"},
  {name:"Solicitudes familiares",description:"Invitaciones, formularios presentados, aprobaciones, rechazos y revocaciones"},
  {name:"Respuestas por finalidad",description:"Cada decisión Sí/No del formulario, sin confundir ausencia de respuesta con rechazo"},
  {name:"Preferencias actuales",description:"Aceptación de términos y permisos de IA, documentos, voz y analítica"},
  {name:"Historial de privacidad",description:"Cuándo se registró o modificó cada preferencia de cada cuenta"},
  {name:"Eventos familiares",description:"Cronología de actividad del proceso de autorización"},
  {name:"Historial de descargas",description:"Fecha, formato y responsable de informes administrativos anteriores"},
]
type FileFormat="xlsx"|"pdf"
export default function AdminConsolidatedExportsPage(){
  const [busy,setBusy]=useState<FileFormat|null>(null)
  const [error,setError]=useState("")
  async function download(format:FileFormat){
    if(busy)return
    setBusy(format);setError("")
    try{
      const response=await fetch("/api/admin/exportar-registros?formato="+format,{cache:"no-store",credentials:"same-origin"})
      if(!response.ok){
        const data=await response.json().catch(()=>({}))
        throw new Error(data.error||"El informe no se pudo generar. Intenta nuevamente.")
      }
      const blob=await response.blob()
      if(!blob.size)throw new Error("El archivo generado está vacío")
      const contentDisposition=response.headers.get("Content-Disposition")||""
      const filename=contentDisposition.match(/filename="([^"]+)"/)?.[1]||
        "EDUAI-registros-completos."+format
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement("a")
      anchor.href=url
      anchor.download=filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(()=>URL.revokeObjectURL(url),30000)
    }catch(caught){
      setError(caught instanceof Error?caught.message:"No fue posible descargar el registro completo")
    }finally{setBusy(null)}
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex flex-wrap gap-4 text-sm text-blue-700">
        <Link href="/admin">← Administración</Link>
        <Link href="/admin/actas-familiares">Archivo de actas</Link>
        <Link href="/admin/autorizaciones-familiares">Autorizaciones</Link>
      </nav>
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-3"><Archive size={28} className="text-cyan-300"/>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Administración · EDUAI</p>
            <h1 className="mt-1 text-2xl font-bold">Exportación completa de registros</h1></div></div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
          Descarga todos los registros disponibles en un solo Excel organizado por hojas o
          en un solo PDF ordenado por secciones. No necesitas descargar cada acta por separado.
        </p>
      </header>
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold">Descargar archivo consolidado</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={()=>void download("xlsx")} disabled={busy!==null}
            className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-left text-emerald-900 hover:bg-emerald-100 disabled:opacity-60">
            <FileSpreadsheet size={32}/>
            <span className="flex-1"><strong className="block">Excel completo (.xlsx)</strong>
              <span className="mt-1 block text-sm">Un libro, ocho hojas: resumen y categorías</span></span>
            <Download size={20}/>
          </button>
          <button type="button" onClick={()=>void download("pdf")} disabled={busy!==null}
            className="flex items-center gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 text-left text-blue-900 hover:bg-blue-100 disabled:opacity-60">
            <FileText size={32}/>
            <span className="flex-1"><strong className="block">PDF completo (.pdf)</strong>
              <span className="mt-1 block text-sm">Un documento, índice, secciones y páginas numeradas</span></span>
            <Download size={20}/>
          </button>
        </div>
        {busy&&<p role="status" className="mt-4 text-sm text-blue-800">Preparando {busy.toUpperCase()} con todas las categorías. No cierres la página mientras se genera.</p>}
        {error&&<p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600">
          <ShieldCheck size={17} className="shrink-0"/> Informes confidenciales. Solo administradores autorizados;
          los archivos no se almacenan públicamente y cada descarga queda registrada.
          El informe conserva toda la información disponible o muestra un error; nunca recorta filas en silencio.
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2"><FolderOpen size={22} className="text-blue-700"/>
          <h2 className="text-lg font-bold">Clasificación incluida</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {categories.map((c,i)=><article key={c.name} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-blue-700">{String(i+1).padStart(2,"0")} · {c.name}</p>
            <p className="mt-2 text-sm leading-5 text-slate-600">{c.description}</p>
          </article>)}
        </div>
        <p className="mt-4 text-xs text-slate-600">Fechas mostradas en horario de Chile. La hoja «Resumen» incluye los totales y los estados. Los registros de autorizaciones revocadas se conservan como historial.</p>
      </section>
    </div>
  </main>
}
