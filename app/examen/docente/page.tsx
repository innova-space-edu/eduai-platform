"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Archive, BarChart2, BookOpen, Check, ClipboardList, Clock, Filter, GraduationCap, Link2, Pencil, Plus, RotateCcw, Save, Search, Tags, Trash2, X } from "lucide-react"

type StatusFilter = "all" | "active" | "closed"
const COURSE_OPTIONS = ["Sala cuna menor","Sala cuna mayor","Medio menor","Medio mayor","NT1","NT2","1° básico","2° básico","3° básico","4° básico","5° básico","6° básico","7° básico","8° básico","1° medio","2° medio","3° medio","4° medio"]
const SUBJECT_OPTIONS = ["Matemática","Lenguaje","Ciencias Naturales","Física","Química","Biología","Historia","Geografía y Ciencias Sociales","Educación Ciudadana","Ciencias para la Ciudadanía","Inglés","Tecnología","Filosofía","Artes Visuales","Música","Educación Física y Salud","Orientación","Otra"]
const UNKNOWN_COURSE = "Sin curso"
const UNKNOWN_SUBJECT = "Sin asignatura"
const getCourse = (exam:any) => String(exam?.settings?.curriculum?.curso || exam?.settings?.course || "").trim() || UNKNOWN_COURSE
const getSubject = (exam:any) => String(exam?.settings?.subject || "").trim() || UNKNOWN_SUBJECT
const normalize = (value:unknown) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
const courseRank = (course:string) => course === UNKNOWN_COURSE ? 9999 : Math.max(0, COURSE_OPTIONS.indexOf(course))

export default function ExamenesDocentePage() {
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
  const [statusFilter,setStatusFilter] = useState<StatusFilter>("all")
  const [editingId,setEditingId] = useState<string|null>(null)
  const [draft,setDraft] = useState({ course:"", subject:"" })
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState("")
  const supabase = createClient()
  const router = useRouter()

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
    const data = await fetch(`/api/agents/examen-docente?teacherId=${uid}`).then(r => r.json())
    setExams(data.exams || [])
  }
  async function loadTrash(uid:string) {
    setLoadingTrash(true)
    const data = await fetch(`/api/agents/examen-docente?teacherId=${uid}&showDeleted=true`).then(r => r.json())
    setDeletedExams(data.exams || [])
    setLoadingTrash(false)
  }
  async function mutate(action:string, examId:string) {
    if (!user) return false
    const data = await fetch("/api/agents/examen-docente", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action, examId, teacherId:user.id }) }).then(r => r.json())
    if (!data.success) setError(data.error || "No se pudo completar la acción")
    return Boolean(data.success)
  }
  async function deleteExam(id:string) { setConfirmDelete(null); if (await mutate("delete",id)) setExams(v => v.filter(e => e.id !== id)) }
  async function restoreExam(id:string) { if (await mutate("restore",id)) { const restored = deletedExams.find(e => e.id === id); setDeletedExams(v => v.filter(e => e.id !== id)); if (restored) setExams(v => [{...restored,deleted_at:null},...v]) } }
  async function permanentDelete(id:string) { setConfirmPerm(null); if (await mutate("permanent_delete",id)) setDeletedExams(v => v.filter(e => e.id !== id)) }
  async function copyLink(exam:any) { try { await navigator.clipboard.writeText(`${window.location.origin}/examen/p/${exam.code}`); setCopiedId(exam.id); setTimeout(() => setCopiedId(null),2000) } catch { setError("No se pudo copiar el enlace") } }

  function editMetadata(exam:any) {
    setEditingId(exam.id)
    setDraft({ course:getCourse(exam) === UNKNOWN_COURSE ? "" : getCourse(exam), subject:getSubject(exam) === UNKNOWN_SUBJECT ? "" : getSubject(exam) })
    setError("")
  }
  async function saveMetadata(exam:any) {
    if (!user || !draft.course || !draft.subject) { setError("Selecciona curso y asignatura"); return }
    setSaving(true)
    const settings = { ...(exam.settings || {}), subject:draft.subject, curriculum:{ ...(exam.settings?.curriculum || {}), curso:draft.course } }
    const data = await fetch("/api/agents/examen-docente", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"update", examId:exam.id, teacherId:user.id, settings }) }).then(r => r.json())
    if (data.success) { setExams(v => v.map(e => e.id === exam.id ? {...e,settings} : e)); setEditingId(null) } else setError(data.error || "No se pudo guardar")
    setSaving(false)
  }

  const courses = useMemo(() => Array.from(new Set<string>(exams.map(getCourse))).sort((a,b) => courseRank(a)-courseRank(b) || a.localeCompare(b,"es")), [exams])
  const subjects = useMemo(() => Array.from(new Set<string>(exams.map(getSubject))).sort((a,b) => a === UNKNOWN_SUBJECT ? 1 : b === UNKNOWN_SUBJECT ? -1 : a.localeCompare(b,"es")), [exams])
  const summary = useMemo(() => ({ total:exams.length, active:exams.filter(e => e.status === "active").length, closed:exams.filter(e => e.status === "closed").length, pending:exams.filter(e => getCourse(e) === UNKNOWN_COURSE || getSubject(e) === UNKNOWN_SUBJECT).length }), [exams])
  const filtered = useMemo(() => exams.filter(exam => {
    const haystack = normalize([exam.title,exam.topic,exam.code,getCourse(exam),getSubject(exam)].join(" "))
    return (!search || haystack.includes(normalize(search))) && (courseFilter === "all" || getCourse(exam) === courseFilter) && (subjectFilter === "all" || getSubject(exam) === subjectFilter) && (statusFilter === "all" || exam.status === statusFilter)
  }), [exams,search,courseFilter,subjectFilter,statusFilter])
  const groups = useMemo(() => {
    const map = new Map<string,Map<string,any[]>>()
    filtered.forEach(exam => { const c=getCourse(exam), s=getSubject(exam); if (!map.has(c)) map.set(c,new Map()); const subjects=map.get(c)!; if (!subjects.has(s)) subjects.set(s,[]); subjects.get(s)!.push(exam) })
    return Array.from(map.entries()).sort(([a],[b]) => courseRank(a)-courseRank(b) || a.localeCompare(b,"es")).map(([course,subjectMap]) => ({ course, subjects:Array.from(subjectMap.entries()).sort(([a],[b]) => a === UNKNOWN_SUBJECT ? 1 : b === UNKNOWN_SUBJECT ? -1 : a.localeCompare(b,"es")) }))
  }, [filtered])

  function ExamCard({ exam, trash=false }:{ exam:any; trash?:boolean }) {
    const course=getCourse(exam), subject=getSubject(exam), incomplete=course===UNKNOWN_COURSE || subject===UNKNOWN_SUBJECT
    return <article className="rounded-2xl border border-soft bg-card-soft-theme p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-main">{exam.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${trash ? "bg-red-500/10 text-red-500" : exam.status === "active" ? "bg-green-500/10 text-green-500" : "bg-slate-500/10 text-slate-500"}`}>{trash ? "En papelera" : exam.status === "active" ? "Activo" : "Cerrado"}</span></div><p className="mt-1 truncate text-xs text-muted2">{exam.topic}</p></div>
        <div className="text-center"><p className="text-xl font-bold text-blue-500">{exam.submissionCount}</p><p className="text-[10px] text-muted2">respuestas</p></div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${course===UNKNOWN_COURSE ? "border-amber-500/20 bg-amber-500/10 text-amber-500" : "border-blue-500/20 bg-blue-500/10 text-blue-500"}`}><GraduationCap size={11} className="mr-1 inline"/>{course}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${subject===UNKNOWN_SUBJECT ? "border-amber-500/20 bg-amber-500/10 text-amber-500" : "border-violet-500/20 bg-violet-500/10 text-violet-500"}`}><BookOpen size={11} className="mr-1 inline"/>{subject}</span>{!trash && <button onClick={() => editMetadata(exam)} className="rounded-full border border-soft px-2.5 py-1 text-[11px] text-sub"><Tags size={11} className="mr-1 inline"/>{incomplete ? "Clasificar" : "Cambiar"}</button>}</div>
      {editingId===exam.id && !trash && <div className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3"><div className="grid gap-2 sm:grid-cols-2"><select value={draft.course} onChange={e => setDraft(v => ({...v,course:e.target.value}))} className="rounded-xl border border-soft bg-app px-3 py-2 text-xs text-main"><option value="">Seleccionar curso</option>{COURSE_OPTIONS.map(v => <option key={v}>{v}</option>)}</select><select value={draft.subject} onChange={e => setDraft(v => ({...v,subject:e.target.value}))} className="rounded-xl border border-soft bg-app px-3 py-2 text-xs text-main"><option value="">Seleccionar asignatura</option>{SUBJECT_OPTIONS.map(v => <option key={v}>{v}</option>)}</select></div><div className="mt-2 flex justify-end gap-2"><button onClick={() => setEditingId(null)} className="rounded-xl border border-soft px-3 py-2 text-xs text-sub">Cancelar</button><button onClick={() => saveMetadata(exam)} disabled={saving} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={12} className="mr-1 inline"/>{saving ? "Guardando..." : "Guardar"}</button></div></div>}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted2"><span><ClipboardList size={10} className="mr-1 inline"/>{exam.settings?.questionCount || "?"} preguntas</span><span><Clock size={10} className="mr-1 inline"/>{exam.settings?.timeLimit || "?"} min</span><span>{new Date(exam.created_at).toLocaleDateString("es-CL")}</span><span className="ml-auto font-mono">{exam.code}</span></div>
      {!trash ? <div className="flex flex-wrap gap-2"><button onClick={() => copyLink(exam)} className="rounded-xl border border-violet-500/20 bg-violet-500/[0.08] px-3 py-2 text-xs text-violet-600">{copiedId===exam.id ? <><Check size={12} className="mr-1 inline"/>Copiado</> : <><Link2 size={12} className="mr-1 inline"/>Link</>}</button><Link href={`/examen/resultados/${exam.id}`} className="flex-1 rounded-xl border border-blue-500/20 bg-blue-500/[0.08] px-3 py-2 text-center text-xs text-blue-600"><BarChart2 size={12} className="mr-1 inline"/>Ver resultados</Link><Link href={`/examen/editar/${exam.id}`} className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-center text-xs text-amber-600"><Pencil size={12} className="mr-1 inline"/>Editar</Link>{exam.status==="closed" && <button onClick={() => setConfirmDelete(exam.id)} className="w-9 rounded-xl border border-red-500/20 text-red-500"><Trash2 size={13} className="mx-auto"/></button>}</div> : <div className="flex gap-2"><button onClick={() => restoreExam(exam.id)} className="flex-1 rounded-xl border border-green-500/20 bg-green-500/[0.08] px-3 py-2 text-xs text-green-500"><RotateCcw size={12} className="mr-1 inline"/>Restaurar</button><button onClick={() => setConfirmPerm(exam.id)} className="flex-1 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs text-red-500"><Trash2 size={12} className="mr-1 inline"/>Eliminar definitivo</button></div>}
    </article>
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-2 border-soft border-t-blue-400"/></div>

  return <div className="min-h-screen bg-app">
    <header className="sticky top-0 z-20 border-b border-soft bg-app backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl bg-card-soft-theme text-sub"><ArrowLeft size={15}/></Link><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-500"><ClipboardList size={17} className="text-white"/></div><div><h1 className="text-sm font-bold text-main">Exámenes para Docentes</h1><p className="hidden text-[11px] text-muted2 sm:block">Evaluaciones organizadas por curso y asignatura</p></div></div><div className="flex gap-2"><button onClick={() => { const next=!showTrash; setShowTrash(next); setEditingId(null); if (next && user) loadTrash(user.id) }} className="rounded-xl border border-soft px-3 py-2 text-xs text-sub"><Archive size={13} className="mr-1 inline"/>{showTrash ? "Volver" : "Papelera"}</button>{!showTrash && <Link href="/examen/crear" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline"/>Crear examen</Link>}</div></div></header>
    <main className="mx-auto max-w-6xl px-4 py-6">
      {error && <div className="mb-4 flex justify-between rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-500"><span>{error}</span><button onClick={() => setError("")}><X size={14}/></button></div>}
      {!showTrash && <><section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"Total",value:summary.total},{label:"Activos",value:summary.active},{label:"Cerrados",value:summary.closed},{label:"Por clasificar",value:summary.pending}].map(item => <div key={item.label} className="rounded-2xl border border-soft bg-card-soft-theme p-4"><p className="text-[11px] uppercase tracking-wide text-muted2">{item.label}</p><p className="mt-1 text-2xl font-bold text-main">{item.value}</p></div>)}</section>
      <section className="mb-6 rounded-2xl border border-soft bg-card-soft-theme p-4"><div className="mb-3 flex items-center gap-2"><Filter size={14} className="text-blue-500"/><h2 className="text-sm font-semibold text-main">Buscar y filtrar evaluaciones</h2><span className="ml-auto text-xs text-muted2">{filtered.length} resultados</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><div className="relative xl:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, tema o código..." className="w-full rounded-xl border border-soft bg-app py-2.5 pl-9 pr-3 text-xs text-main"/></div><select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="rounded-xl border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todos los cursos</option>{courses.map(v => <option key={v}>{v}</option>)}</select><select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="rounded-xl border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todas las asignaturas</option>{subjects.map(v => <option key={v}>{v}</option>)}</select><div className="flex gap-2"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="min-w-0 flex-1 rounded-xl border border-soft bg-app px-3 py-2.5 text-xs text-main"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="closed">Cerrados</option></select><button onClick={() => {setSearch("");setCourseFilter("all");setSubjectFilter("all");setStatusFilter("all")}} className="w-10 rounded-xl border border-soft text-muted2"><X size={14} className="mx-auto"/></button></div></div></section>
      {exams.length===0 ? <div className="rounded-2xl border border-soft bg-card-soft-theme py-16 text-center"><h3 className="font-bold text-main">Sin exámenes aún</h3><p className="mt-1 text-sm text-muted2">Crea tu primer examen con IA</p></div> : groups.length===0 ? <div className="rounded-2xl border border-soft bg-card-soft-theme py-14 text-center"><Search size={28} className="mx-auto mb-2 text-muted2"/><h3 className="font-semibold text-main">No se encontraron evaluaciones</h3></div> : <div className="space-y-7">{groups.map(group => <section key={group.course} className="overflow-hidden rounded-3xl border border-soft bg-card-soft-theme"><div className="flex items-center gap-3 border-b border-soft px-5 py-4"><GraduationCap size={18} className="text-blue-500"/><div><h2 className="font-bold text-main">{group.course}</h2><p className="text-xs text-muted2">{group.subjects.reduce((n,[,items]) => n+items.length,0)} evaluaciones</p></div></div><div className="space-y-5 p-4 sm:p-5">{group.subjects.map(([subject,items]) => <div key={subject}><div className="mb-3 flex items-center gap-2"><BookOpen size={14} className="text-violet-500"/><h3 className="text-sm font-semibold text-main">{subject}</h3><span className="rounded-full border border-soft px-2 py-0.5 text-[10px] text-muted2">{items.length}</span></div><div className="grid gap-3 lg:grid-cols-2">{items.sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).map(exam => <ExamCard key={exam.id} exam={exam}/>)}</div></div>)}</div></section>)}</div>}</>}
      {showTrash && <section><div className="mb-4 flex items-center gap-2"><Archive size={16} className="text-red-400"/><h2 className="text-sm font-semibold text-main">Papelera de exámenes</h2></div>{loadingTrash ? <div className="py-12 text-center text-muted2">Cargando...</div> : deletedExams.length===0 ? <div className="rounded-2xl border border-soft py-16 text-center text-muted2">Papelera vacía</div> : <div className="grid gap-3 lg:grid-cols-2">{deletedExams.map(exam => <ExamCard key={exam.id} exam={exam} trash/>)}</div>}</section>}
    </main>
    {confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-app p-6"><h3 className="text-center font-bold text-main">¿Mover a la papelera?</h3><p className="my-4 text-center text-sm text-sub">Podrás restaurar esta evaluación.</p><div className="flex gap-3"><button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-soft py-2.5 text-sub">Cancelar</button><button onClick={() => deleteExam(confirmDelete)} className="flex-1 rounded-xl bg-red-600 py-2.5 text-white">Mover</button></div></div></div>}
    {confirmPerm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-app p-6"><h3 className="text-center font-bold text-main">¿Eliminar definitivamente?</h3><p className="my-4 text-center text-sm text-sub">Se eliminarán el examen y sus respuestas.</p><div className="flex gap-3"><button onClick={() => setConfirmPerm(null)} className="flex-1 rounded-xl border border-soft py-2.5 text-sub">Cancelar</button><button onClick={() => permanentDelete(confirmPerm)} className="flex-1 rounded-xl bg-red-900 py-2.5 text-white">Eliminar</button></div></div></div>}
  </div>
}
