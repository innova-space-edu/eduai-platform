"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, ArrowLeft, ClipboardList, Filter, Plus, Search, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import TeacherExamRow from "@/components/exam/TeacherExamRow"
import TeacherExamTree from "@/components/exam/TeacherExamTree"
import {
  type StatusFilter,
  UNKNOWN_COURSE,
  UNKNOWN_DATE,
  UNKNOWN_SUBJECT,
  buildExamGroups,
  courseRank,
  formatDateKey,
  getCourse,
  getDateKey,
  getExamTimestamp,
  getSubject,
  normalizeExamSearch,
} from "@/lib/exam/teacher-exam-browser"

export default function TeacherExamBrowser() {
  const [user,setUser] = useState<any>(null)
  const [exams,setExams] = useState<any[]>([])
  const [deletedExams,setDeletedExams] = useState<any[]>([])
  const [loading,setLoading] = useState(true)
  const [loadingTrash,setLoadingTrash] = useState(false)
  const [showTrash,setShowTrash] = useState(false)
  const [copiedId,setCopiedId] = useState<string|null>(null)
  const [confirmDelete,setConfirmDelete] = useState<string|null>(null)
  const [confirmPerm,setConfirmPerm] = useState<string|null>(null)
  const [search,setSearch] = useState("")
  const [courseFilter,setCourseFilter] = useState("all")
  const [subjectFilter,setSubjectFilter] = useState("all")
  const [dateFilter,setDateFilter] = useState("all")
  const [statusFilter,setStatusFilter] = useState<StatusFilter>("all")
  const [error,setError] = useState("")
  const supabase=createClient()
  const router=useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data:{ user } }) => {
      if (!user) { router.push("/login"); return }
      setUser(user)
      await loadExams(user.id)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadExams(uid:string) {
    const data=await fetch(`/api/agents/examen-docente?teacherId=${uid}`).then(r => r.json())
    setExams(data.exams || [])
  }

  async function loadTrash(uid:string) {
    setLoadingTrash(true)
    const data=await fetch(`/api/agents/examen-docente?teacherId=${uid}&showDeleted=true`).then(r => r.json())
    setDeletedExams(data.exams || [])
    setLoadingTrash(false)
  }

  async function mutate(action:string,examId:string) {
    if (!user) return false
    const data=await fetch("/api/agents/examen-docente", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action, examId, teacherId:user.id }),
    }).then(r => r.json())
    if (!data.success) setError(data.error || "No se pudo completar la acción")
    return Boolean(data.success)
  }

  async function deleteExam(id:string) {
    setConfirmDelete(null)
    if (await mutate("delete",id)) setExams(value => value.filter(exam => exam.id!==id))
  }

  async function restoreExam(id:string) {
    if (!(await mutate("restore",id))) return
    const restored=deletedExams.find(exam => exam.id===id)
    setDeletedExams(value => value.filter(exam => exam.id!==id))
    if (restored) setExams(value => [{...restored,deleted_at:null},...value])
  }

  async function permanentDelete(id:string) {
    setConfirmPerm(null)
    if (await mutate("permanent_delete",id)) setDeletedExams(value => value.filter(exam => exam.id!==id))
  }

  async function copyLink(exam:any) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/examen/p/${exam.code}`)
      setCopiedId(exam.id); setTimeout(() => setCopiedId(null),2000)
    } catch { setError("No se pudo copiar el enlace") }
  }

  async function saveMetadata(exam:any,course:string,subject:string) {
    if (!user || !course || !subject) { setError("Selecciona curso y asignatura"); return false }
    const settings={ ...(exam.settings || {}), subject, curriculum:{ ...(exam.settings?.curriculum || {}), curso:course } }
    const data=await fetch("/api/agents/examen-docente", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"update", examId:exam.id, teacherId:user.id, settings }),
    }).then(r => r.json())
    if (!data.success) { setError(data.error || "No se pudo guardar"); return false }
    setExams(value => value.map(item => item.id===exam.id ? {...item,settings} : item))
    return true
  }

  const courses=useMemo(() => Array.from(new Set<string>(exams.map(getCourse))).sort((a,b) => courseRank(a)-courseRank(b) || a.localeCompare(b,"es")),[exams])
  const subjects=useMemo(() => Array.from(new Set<string>(exams.map(getSubject))).sort((a,b) => a===UNKNOWN_SUBJECT ? 1 : b===UNKNOWN_SUBJECT ? -1 : a.localeCompare(b,"es")),[exams])
  const dates=useMemo(() => Array.from(new Set<string>(exams.map(getDateKey))).sort((a,b) => a===UNKNOWN_DATE ? 1 : b===UNKNOWN_DATE ? -1 : b.localeCompare(a)),[exams])
  const summary=useMemo(() => ({
    total:exams.length,
    active:exams.filter(exam => exam.status==="active").length,
    closed:exams.filter(exam => exam.status==="closed").length,
    pending:exams.filter(exam => getCourse(exam)===UNKNOWN_COURSE || getSubject(exam)===UNKNOWN_SUBJECT).length,
  }),[exams])

  const filtered=useMemo(() => exams.filter(exam => {
    const haystack=normalizeExamSearch([exam.title,exam.topic,exam.code,getCourse(exam),getSubject(exam),formatDateKey(getDateKey(exam))].join(" "))
    return (!search || haystack.includes(normalizeExamSearch(search)))
      && (courseFilter==="all" || getCourse(exam)===courseFilter)
      && (subjectFilter==="all" || getSubject(exam)===subjectFilter)
      && (dateFilter==="all" || getDateKey(exam)===dateFilter)
      && (statusFilter==="all" || exam.status===statusFilter)
  }),[exams,search,courseFilter,subjectFilter,dateFilter,statusFilter])

  const groups=useMemo(() => buildExamGroups(filtered),[filtered])
  const autoExpand=Boolean(search) || courseFilter!=="all" || subjectFilter!=="all" || dateFilter!=="all" || statusFilter!=="all"

  function resetFilters() {
    setSearch(""); setCourseFilter("all"); setSubjectFilter("all"); setDateFilter("all"); setStatusFilter("all")
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-2 border-soft border-t-blue-400"/></div>

  return <div className="min-h-screen bg-app">
    <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl bg-card-soft-theme text-sub"><ArrowLeft size={15}/></Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-500"><ClipboardList size={17} className="text-white"/></div>
          <div><h1 className="text-sm font-bold text-main">Exámenes para Docentes</h1><p className="hidden text-[11px] text-muted2 sm:block">Evaluaciones organizadas por curso, asignatura y fecha</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const next=!showTrash; setShowTrash(next); if (next && user) loadTrash(user.id) }} className="rounded-xl border border-soft px-3 py-2 text-xs text-sub"><Archive size={13} className="mr-1 inline"/>{showTrash ? "Volver" : "Papelera"}</button>
          {!showTrash && <Link href="/examen/crear" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline"/>Crear examen</Link>}
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-6">
      {error && <div className="mb-4 flex items-center justify-between border-y border-red-500/20 py-3 text-sm text-red-500"><span>{error}</span><button onClick={() => setError("")} className="p-1"><X size={14}/></button></div>}

      {!showTrash && <>
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted2">
          <span><strong className="text-main">{summary.total}</strong> evaluaciones</span>
          <span><strong className="text-green-600">{summary.active}</strong> activas</span>
          <span><strong className="text-main">{summary.closed}</strong> cerradas</span>
          <span><strong className={summary.pending ? "text-amber-500" : "text-main"}>{summary.pending}</strong> por clasificar</span>
        </div>

        <section className="mb-5 border-y border-soft py-3">
          <div className="mb-3 flex items-center gap-2"><Filter size={14} className="text-blue-500"/><h2 className="text-sm font-semibold text-main">Buscar y filtrar</h2><span className="ml-auto text-xs text-muted2">{filtered.length} resultados</span></div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, tema, código o fecha..." className="w-full rounded-lg border border-soft bg-app py-2.5 pl-9 pr-3 text-xs text-main"/></div>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="rounded-lg border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todos los cursos</option>{courses.map(value => <option key={value}>{value}</option>)}</select>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="rounded-lg border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todas las asignaturas</option>{subjects.map(value => <option key={value}>{value}</option>)}</select>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="rounded-lg border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todas las fechas</option>{dates.map(value => <option key={value} value={value}>{formatDateKey(value)}</option>)}</select>
            <div className="flex gap-2"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="min-w-0 flex-1 rounded-lg border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="closed">Cerrados</option></select><button onClick={resetFilters} className="w-10 rounded-lg border border-soft text-muted2 hover:text-main" title="Limpiar filtros"><X size={14} className="mx-auto"/></button></div>
          </div>
        </section>

        {exams.length===0 ? <div className="border-y border-soft py-16 text-center"><ClipboardList size={28} className="mx-auto mb-2 text-muted2"/><h3 className="font-bold text-main">Sin exámenes aún</h3><p className="mt-1 text-sm text-muted2">Crea tu primer examen con IA</p></div>
        : groups.length===0 ? <div className="border-y border-soft py-14 text-center"><Search size={28} className="mx-auto mb-2 text-muted2"/><h3 className="font-semibold text-main">No se encontraron evaluaciones</h3></div>
        : <TeacherExamTree groups={groups} autoExpand={autoExpand} copiedId={copiedId} onCopy={copyLink} onDelete={setConfirmDelete} onRestore={restoreExam} onPermanentDelete={setConfirmPerm} onSaveMetadata={saveMetadata}/>} 
      </>}

      {showTrash && <section>
        <div className="mb-4 flex items-center gap-2 border-b border-soft pb-3"><Archive size={16} className="text-red-400"/><h2 className="text-sm font-semibold text-main">Papelera de exámenes</h2><span className="ml-auto text-xs text-muted2">{deletedExams.length}</span></div>
        {loadingTrash ? <div className="py-12 text-center text-muted2">Cargando...</div>
        : deletedExams.length===0 ? <div className="border-y border-soft py-16 text-center text-muted2">Papelera vacía</div>
        : <div className="border-t border-soft">{[...deletedExams].sort((a,b) => getExamTimestamp(b)-getExamTimestamp(a)).map(exam => <TeacherExamRow key={exam.id} exam={exam} trash copied={false} onCopy={copyLink} onDelete={setConfirmDelete} onRestore={restoreExam} onPermanentDelete={setConfirmPerm} onSaveMetadata={saveMetadata}/>)}</div>}
      </section>}
    </main>

    {confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-app p-6"><h3 className="text-center font-bold text-main">¿Mover a la papelera?</h3><p className="my-4 text-center text-sm text-sub">Podrás restaurar esta evaluación.</p><div className="flex gap-3"><button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-soft py-2.5 text-sub">Cancelar</button><button onClick={() => deleteExam(confirmDelete)} className="flex-1 rounded-xl bg-red-600 py-2.5 text-white">Mover</button></div></div></div>}
    {confirmPerm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-app p-6"><h3 className="text-center font-bold text-main">¿Eliminar definitivamente?</h3><p className="my-4 text-center text-sm text-sub">Se eliminarán el examen y sus respuestas.</p><div className="flex gap-3"><button onClick={() => setConfirmPerm(null)} className="flex-1 rounded-xl border border-soft py-2.5 text-sub">Cancelar</button><button onClick={() => permanentDelete(confirmPerm)} className="flex-1 rounded-xl bg-red-900 py-2.5 text-white">Eliminar</button></div></div></div>}
  </div>
}
