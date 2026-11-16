import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const HEADERS = { "Cache-Control": "private, no-store, max-age=0" }
const PROFILES = ["personal", "school", "university", "teacher", "professional", "languages", "certification"]
const MODES = ["normal", "theory", "examples", "exercises", "summary", "socratic"]
const FIELDS = "id, topic, created_at, updated_at, score, status, study_mode, correct_answers, total_questions, current_level, duration_seconds, study_profile, objective, area, favorite, archived_at, subtopic, study_route, completed_at"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS })
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0,max) : ""
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return reply({ error: "Unauthorized" },401)
  const [{data,error}, preferences] = await Promise.all([supabase.from("study_sessions").select(FIELDS).eq("user_id",user.id).order("updated_at",{ascending:false}),supabase.from("study_preferences").select("weekly_session_goal").eq("user_id",user.id).maybeSingle()])
  if (error) { console.error("[sessions]",error); return reply({ error:"No se pudieron cargar las sesiones." },500) }
  const sessions = data || []
  const completed = sessions.filter(s=>s.status==="completed").length
  const scored = sessions.filter(s=>Number(s.total_questions)>0 && typeof s.score==="number")
  return reply({ sessions, weeklyGoal:preferences.data?.weekly_session_goal ?? 0, summary:{total:sessions.length, completed, avgScore:scored.length?Math.round(scored.reduce((sum,s)=>sum+Number(s.score),0)/scored.length):null}, syncedAt:new Date().toISOString() })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return reply({error:"Unauthorized"},401)
  const body = await req.json().catch(()=>null)
  if (!body || !clean(body.topic,200)) return reply({error:"Escribe un tema de estudio."},400)
  const {data,error}=await supabase.from("study_sessions").insert({
    user_id:user.id, topic:clean(body.topic,200),
    study_mode:MODES.includes(body.study_mode)?body.study_mode:"normal",
    study_profile:PROFILES.includes(body.study_profile)?body.study_profile:"personal",
    objective:clean(body.objective,1000), area:clean(body.area,120),
    study_route:clean(body.study_route,100)||null,
    status:"active", current_level:1,
  }).select(FIELDS).single()
  if(error){console.error("[sessions] create",error);return reply({error:"No se pudo crear la sesión."},500)}
  return reply(data,201)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if(!user) return reply({error:"Unauthorized"},401)
  const body=await req.json().catch(()=>null)
  if(body && Object.hasOwn(body,"weekly_session_goal")){
    const goal=body.weekly_session_goal
    if(!Number.isInteger(goal)||goal<0||goal>30)return reply({error:"Meta inválida."},400)
    const {error}=await supabase.from("study_preferences").upsert({user_id:user.id,weekly_session_goal:goal,updated_at:new Date().toISOString()})
    return error?reply({error:"No se pudo guardar la meta."},500):reply({weeklyGoal:goal})
  }
  if(!body || !validId(body.session_id)) return reply({error:"Sesión inválida."},400)
  const updates:Record<string,unknown>={}
  if(typeof body.topic==="string" && clean(body.topic,200)) updates.topic=clean(body.topic,200)
  if(typeof body.objective==="string") updates.objective=clean(body.objective,1000)
  if(typeof body.area==="string") updates.area=clean(body.area,120)
  if(PROFILES.includes(body.study_profile)) updates.study_profile=body.study_profile
  if(MODES.includes(body.study_mode)) updates.study_mode=body.study_mode
  if(typeof body.subtopic==="string") updates.subtopic=clean(body.subtopic,200)||null
  if(typeof body.favorite==="boolean") updates.favorite=body.favorite
  if(typeof body.archived==="boolean") updates.archived_at=body.archived?new Date().toISOString():null
  if(["active","completed","paused"].includes(body.status)){
    updates.status=body.status
    if(body.status==="completed"){
      const {data:prior,error}=await supabase.from("study_sessions").select("status,completed_at").eq("id",body.session_id).eq("user_id",user.id).maybeSingle()
      if(error||!prior)return reply({error:"Sesión no encontrada."},404)
      updates.completed_at=prior.status==="completed"&&prior.completed_at?prior.completed_at:new Date().toISOString()
    }else if(body.status==="active"){updates.completed_at=null}
  }
  for(const field of ["correct_answers","total_questions","score","duration_seconds"]){
    const value=body[field]
    if(typeof value==="number" && Number.isFinite(value) && value>=0) updates[field]=Math.min(field==="score"?100:field==="duration_seconds"?31536000:100000,Math.round(value))
  }
  if(Array.isArray(body.messages)){
    if(body.messages.length>300 || JSON.stringify(body.messages).length>1500000 || !body.messages.every((m: any)=>m && ["ai","user"].includes(m.role) && typeof m.content==="string")) return reply({error:"La conversación supera el límite de guardado."},400)
    updates.messages=body.messages.map((m: any)=>({role:m.role,content:m.content}))
  }
  if(!Object.keys(updates).length) return reply({error:"No hay cambios válidos."},400)
  const {data,error}=await supabase.from("study_sessions").update({...updates,updated_at:new Date().toISOString()}).eq("id",body.session_id).eq("user_id",user.id).select(FIELDS).maybeSingle()
  if(error){console.error("[sessions] update",error);return reply({error:"No se pudo guardar la sesión."},500)}
  return data?reply(data):reply({error:"Sesión no encontrada."},404)
}
