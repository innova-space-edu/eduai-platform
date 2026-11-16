"use client"
import { useId,useState } from "react"
import { cleanCourses,normalizeCourse } from "@/lib/exam/course-assignment.mjs"
import { COURSE_OPTIONS } from "@/lib/exam/teacher-exam-browser"

export default function CourseAssignmentPicker({value,onChange,disabled=false}:{value:string[];onChange:(courses:string[])=>void;disabled?:boolean}){
 const [entry,setEntry]=useState("")
 const id=useId()
 const courses=cleanCourses(value)
 const suggestions=COURSE_OPTIONS.flatMap(level=>["A","B","C","D"].map(section=>level+" "+section))
 function add(){
  const next=cleanCourses([...courses,...cleanCourses(entry)])
  if(next.length>courses.length)onChange(next)
  setEntry("")
 }
 return <div className="space-y-2">
  <label htmlFor={id} className="block text-xs font-semibold text-sub">CURSOS Y SECCIONES AUTORIZADOS</label>
  <p className="text-xs text-muted2">Agrega uno o varios cursos tal como aparecen en la nómina. El nivel curricular de las preguntas no cambia.</p>
  <div className="flex flex-wrap gap-2">
   {courses.map((course:string)=><span key={normalizeCourse(course)} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{course}<button type="button" disabled={disabled} aria-label={"Quitar "+course} onClick={()=>onChange(courses.filter((c:string)=>normalizeCourse(c)!==normalizeCourse(course)))} className="text-blue-800">×</button></span>)}
  </div>
  <div className="flex gap-2">
   <input id={id} list={id+"-suggestions"} value={entry} onChange={e=>setEntry(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add()}}} disabled={disabled||courses.length>=40} placeholder="Ej.: 1° medio A" maxLength={60} className="min-w-0 flex-1 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main"/>
   <datalist id={id+"-suggestions"}>{suggestions.map(course=><option key={course} value={course}/>)}</datalist>
   <button type="button" disabled={disabled||!entry.trim()||courses.length>=40} onClick={add} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">+ Agregar curso</button>
  </div>
  {!courses.length&&<p className="text-xs text-amber-700">Selecciona al menos un curso para habilitar el acceso.</p>}
  {courses.length>0&&<p className="text-xs text-muted2">{courses.length} curso(s) asignados · un único examen y enlace.</p>}
 </div>
}
