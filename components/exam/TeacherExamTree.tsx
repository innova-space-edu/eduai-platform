"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { BookOpen, CalendarDays, ChevronDown, ChevronRight, Folder, FolderOpen, GraduationCap } from "lucide-react"
import TeacherExamRow from "@/components/exam/TeacherExamRow"
import { type CourseGroup, countCourse, countSubject } from "@/lib/exam/teacher-exam-browser"

type Props = {
  groups:CourseGroup[]
  autoExpand:boolean
  copiedId:string|null
  onCopy:(exam:any)=>void
  onDelete:(id:string)=>void
  onRestore:(id:string)=>void
  onPermanentDelete:(id:string)=>void
  onSaveMetadata:(exam:any,course:string,subject:string)=>Promise<boolean>
}

export default function TeacherExamTree({ groups, autoExpand, copiedId, onCopy, onDelete, onRestore, onPermanentDelete, onSaveMetadata }:Props) {
  const [openCourses,setOpenCourses] = useState<Set<string>>(new Set())
  const [openSubjects,setOpenSubjects] = useState<Set<string>>(new Set())
  const [openDates,setOpenDates] = useState<Set<string>>(new Set())

  function allKeys() {
    const courses=new Set(groups.map(group => group.course))
    const subjects=new Set(groups.flatMap(group => group.subjects.map(subject => `${group.course}::${subject.subject}`)))
    const dates=new Set(groups.flatMap(group => group.subjects.flatMap(subject => subject.dates.map(date => `${group.course}::${subject.subject}::${date.dateKey}`))))
    return { courses, subjects, dates }
  }

  function expandAll() {
    const keys=allKeys()
    setOpenCourses(keys.courses); setOpenSubjects(keys.subjects); setOpenDates(keys.dates)
  }

  function collapseAll() {
    setOpenCourses(new Set()); setOpenSubjects(new Set()); setOpenDates(new Set())
  }

  function toggle(setter:Dispatch<SetStateAction<Set<string>>>,key:string) {
    setter(current => {
      const next=new Set(current)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (autoExpand) expandAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpand, groups])

  return <>
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted2"><Folder size={14}/><span>Curso → Asignatura → Fecha</span></div>
      <div className="flex items-center gap-1">
        <button onClick={expandAll} className="rounded-lg px-2.5 py-1.5 text-[11px] text-sub hover:bg-card-soft-theme">Desplegar todo</button>
        <button onClick={collapseAll} className="rounded-lg px-2.5 py-1.5 text-[11px] text-sub hover:bg-card-soft-theme">Contraer todo</button>
      </div>
    </div>

    <div className="border-t border-soft">
      {groups.map(group => {
        const courseOpen=openCourses.has(group.course)
        return <div key={group.course} className="border-b border-soft">
          <button onClick={() => toggle(setOpenCourses,group.course)} className="flex w-full items-center gap-2 px-2 py-3 text-left transition hover:bg-card-soft-theme/60 sm:px-3">
            {courseOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            {courseOpen ? <FolderOpen size={18} className="text-blue-500"/> : <Folder size={18} className="text-blue-500"/>}
            <GraduationCap size={14} className="text-blue-500"/>
            <span className="font-semibold text-main">{group.course}</span>
            <span className="ml-auto text-xs text-muted2">{countCourse(group)} evaluaciones</span>
          </button>

          {courseOpen && <div className="ml-5 border-l border-soft sm:ml-7">
            {group.subjects.map(subjectGroup => {
              const subjectKey=`${group.course}::${subjectGroup.subject}`
              const subjectOpen=openSubjects.has(subjectKey)
              return <div key={subjectKey} className="border-t border-soft first:border-t-0">
                <button onClick={() => toggle(setOpenSubjects,subjectKey)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-card-soft-theme/60 sm:px-4">
                  {subjectOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                  {subjectOpen ? <FolderOpen size={16} className="text-violet-500"/> : <Folder size={16} className="text-violet-500"/>}
                  <BookOpen size={13} className="text-violet-500"/>
                  <span className="text-sm font-medium text-main">{subjectGroup.subject}</span>
                  <span className="ml-auto text-[11px] text-muted2">{countSubject(subjectGroup)}</span>
                </button>

                {subjectOpen && <div className="ml-5 border-l border-soft sm:ml-7">
                  {subjectGroup.dates.map(dateGroup => {
                    const dateKey=`${group.course}::${subjectGroup.subject}::${dateGroup.dateKey}`
                    const dateOpen=openDates.has(dateKey)
                    return <div key={dateKey} className="border-t border-soft first:border-t-0">
                      <button onClick={() => toggle(setOpenDates,dateKey)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-card-soft-theme/60 sm:px-4">
                        {dateOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        <CalendarDays size={15} className="text-emerald-600"/>
                        <span className="text-sm text-main">{dateGroup.label}</span>
                        <span className="ml-auto text-[11px] text-muted2">{dateGroup.items.length}</span>
                      </button>

                      {dateOpen && <div className="ml-4 border-l border-soft sm:ml-6">
                        {dateGroup.items.map(exam => <TeacherExamRow key={exam.id} exam={exam} copied={copiedId===exam.id} onCopy={onCopy} onDelete={onDelete} onRestore={onRestore} onPermanentDelete={onPermanentDelete} onSaveMetadata={onSaveMetadata}/>) }
                      </div>}
                    </div>
                  })}
                </div>}
              </div>
            })}
          </div>}
        </div>
      })}
    </div>
  </>
}
