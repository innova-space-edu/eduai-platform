"use client"
import { useState,useEffect,useRef,useCallback } from "react"
export type StudyMessage={role:"ai"|"user";content:string}
export interface StudySession {
 id:string;topic:string;status:string;study_mode:string;current_level:number;score:number;total_questions:number;correct_answers:number;
 duration_seconds?:number;messages?:StudyMessage[];study_profile?:string;objective?:string;area?:string;subtopic?:string|null;archived_at?:string|null
}
export function useStudySession(topic:string,studyMode="normal",initial:StudySession|null=null){
 const [session,setSession]=useState<StudySession|null>(initial)
 const [saveError,setSaveError]=useState("")
 const [saving,setSaving]=useState(false)
 const current=useRef<StudySession|null>(initial)
 const creating=useRef<Promise<StudySession>|null>(null)
 const queue=useRef<Promise<unknown>>(Promise.resolve())
 const ensure=useCallback(async()=>{
  if(current.current)return current.current
  if(!creating.current){
   creating.current=(async()=>{
    const res=await fetch("/api/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,study_mode:studyMode})})
    const data=await res.json()
    if(!res.ok)throw Error(data.error||"No se pudo crear la sesión.")
    current.current=data;setSession(data);return data as StudySession
   })()
  }
  try{return await creating.current}finally{creating.current=null}
 },[topic,studyMode])
 useEffect(()=>{if(topic)void ensure().catch(e=>setSaveError(e.message))},[topic,ensure])
 const updateSession=useCallback((updates:Record<string,unknown>)=>{
  const task=queue.current.catch(()=>{}).then(async()=>{
   setSaving(true)
   try{
    const existing=await ensure()
    const res=await fetch("/api/sessions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:existing.id,...updates})})
    const data=await res.json()
    if(!res.ok)throw Error(data.error||"No se pudo guardar.")
    const next={...current.current,...data} as StudySession
    current.current=next;setSession(next);setSaveError("");return true
   }catch(e){setSaveError(e instanceof Error?e.message:"No se pudo guardar.");return false}finally{setSaving(false)}
  })
  queue.current=task
  return task
 },[ensure])
 const completeSession=useCallback((correct:number,total:number,messages:StudyMessage[])=>updateSession({status:"completed",correct_answers:correct,total_questions:total,score:total?Math.round(correct/total*100):0,messages}),[updateSession])
 return {session,updateSession,completeSession,saving,saveError}
}
