"use client"

import { useState } from "react"
import Link from "next/link"
import { BarChart2, Check, FileText, Link2, Pencil, RotateCcw, Save, Tags, Trash2 } from "lucide-react"
import { COURSE_OPTIONS, SUBJECT_OPTIONS, UNKNOWN_COURSE, UNKNOWN_SUBJECT, formatExamTime, getCourse, getSubject } from "@/lib/exam/teacher-exam-browser"

type Props = {
  exam:any
  trash?:boolean
  copied?:boolean
  onCopy:(exam:any)=>void
  onDelete:(id:string)=>void
  onRestore:(id:string)=>void
  onPermanentDelete:(id:string)=>void
  onSaveMetadata:(exam:any,course:string,subject:string)=>Promise<boolean>
}

export default function TeacherExamRow({ exam, trash=false, copied=false, onCopy, onDelete, onRestore, onPermanentDelete, onSaveMetadata }:Props) {
  const [editing,setEditing] = useState(false)
  const [course,setCourse] = useState("")
  const [subject,setSubject] = useState("")
  const [saving,setSaving] = useState(false)
  const currentCourse=getCourse(exam), currentSubject=getSubject(exam)
  const incomplete=currentCourse===UNKNOWN_COURSE || currentSubject===UNKNOWN_SUBJECT

  function startEditing() {
    setCourse(currentCourse===UNKNOWN_COURSE ? "" : currentCourse)
    setSubject(currentSubject===UNKNOWN_SUBJECT ? "" : currentSubject)
    setEditing(true)
  }

  async function save() {
    if (!course || !subject) return
    setSaving(true)
    const ok=await onSaveMetadata(exam,course,subject)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return <div className="border-b border-soft last:border-b-0">
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FileText size={17} className="mt-0.5 shrink-0 text-muted2"/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="max-w-full truncate text-sm font-semibold text-main">{exam.title}</h4>
            <span className={`text-[10px] font-semibold ${trash ? "text-red-500" : exam.status==="active" ? "text-green-500" : "text-muted2"}`}>
              {trash ? "En papelera" : exam.status==="active" ? "Activo" : "Cerrado"}
            </span>
          </div>
          {exam.topic && <p className="mt-0.5 truncate text-xs text-muted2">{exam.topic}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted2">
            <span>{exam.settings?.questionCount || "?"} preguntas</span>
            <span>{exam.settings?.timeLimit || "?"} min</span>
            <span>{Number(exam.submissionCount || 0)} respuestas</span>
            {formatExamTime(exam) && <span>{formatExamTime(exam)}</span>}
            <span className="font-mono">{exam.code}</span>
          </div>
        </div>
      </div>

      {!trash ? <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        <button onClick={startEditing} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-card-soft-theme ${incomplete ? "text-amber-500" : "text-sub"}`}>
          <Tags size={12}/>{incomplete ? "Clasificar" : "Cambiar"}
        </button>
        <button onClick={() => onCopy(exam)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-violet-600 transition hover:bg-violet-500/[0.08]">
          {copied ? <Check size={12}/> : <Link2 size={12}/>} {copied ? "Copiado" : "Link"}
        </button>
        <Link href={`/examen/resultados/${exam.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-blue-600 transition hover:bg-blue-500/[0.08]">
          <BarChart2 size={12}/>Resultados
        </Link>
        <Link href={`/examen/editar/${exam.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-amber-600 transition hover:bg-amber-500/[0.08]">
          <Pencil size={12}/>Editar
        </Link>
        {exam.status==="closed" && <button onClick={() => onDelete(exam.id)} className="inline-flex items-center rounded-lg p-1.5 text-red-500 transition hover:bg-red-500/[0.08]" title="Mover a la papelera"><Trash2 size={13}/></button>}
      </div> : <div className="flex shrink-0 flex-wrap gap-2">
        <button onClick={() => onRestore(exam.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-green-600 transition hover:bg-green-500/[0.08]"><RotateCcw size={12}/>Restaurar</button>
        <button onClick={() => onPermanentDelete(exam.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-500 transition hover:bg-red-500/[0.08]"><Trash2 size={12}/>Eliminar definitivo</button>
      </div>}
    </div>

    {editing && !trash && <div className="border-t border-soft px-4 py-3 sm:pl-10">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
        <select value={course} onChange={e => setCourse(e.target.value)} className="rounded-lg border border-soft bg-app px-3 py-2 text-xs text-main">
          <option value="">Seleccionar curso</option>{COURSE_OPTIONS.map(v => <option key={v}>{v}</option>)}
        </select>
        <select value={subject} onChange={e => setSubject(e.target.value)} className="rounded-lg border border-soft bg-app px-3 py-2 text-xs text-main">
          <option value="">Seleccionar asignatura</option>{SUBJECT_OPTIONS.map(v => <option key={v}>{v}</option>)}
        </select>
        <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-xs text-sub hover:bg-card-soft-theme">Cancelar</button>
        <button onClick={save} disabled={saving || !course || !subject} className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={12}/>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </div>}
  </div>
}
