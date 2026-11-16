import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import StudyClient from "./StudyClient"
import type { StudySession } from "@/hooks/useStudySession"
import { ArrowLeft, BookOpen } from "lucide-react"

interface Props { params: Promise<{topic:string}>; searchParams:Promise<{subtopic?:string;session?:string}> }

export default async function StudyPage({params,searchParams}:Props){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)redirect("/login")
  const {topic}=await params
  const {subtopic,session}=await searchParams
  let saved:StudySession|null=null
  if(session){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session))notFound()
    const {data,error}=await supabase.from("study_sessions").select("id,topic,status,study_mode,current_level,score,total_questions,correct_answers,duration_seconds,messages,study_profile,objective,area,subtopic,archived_at").eq("id",session).eq("user_id",user.id).maybeSingle()
    if(error)throw Error("No se pudo cargar la sesión.")
    if(!data)notFound()
    if(data.archived_at)redirect("/sessions")
    saved=data as StudySession
  }
  const title=saved?.topic||topic
  return <main className="min-h-screen bg-app text-main" style={{backgroundImage:"radial-gradient(ellipse at 5% 0%,rgba(167,139,250,.13),transparent 50%),radial-gradient(ellipse at 98% 0%,rgba(45,212,191,.09),transparent 50%)"}}>
    <nav className="border-b border-soft bg-card-theme px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <Link href="/sessions" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-semibold text-sub hover:border-violet-400"><ArrowLeft size={16}/> Sesiones</Link>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><BookOpen size={21}/></div>
        <div className="min-w-0"><p className="text-xs text-muted2">EduAI · Espacio de estudio</p><h1 className="truncate font-bold">{title}</h1></div>
      </div>
    </nav>
    <StudyClient key={saved?.id||title} topic={title} subtopic={saved?.subtopic||subtopic||null} initialSession={saved}/>
  </main>
}
