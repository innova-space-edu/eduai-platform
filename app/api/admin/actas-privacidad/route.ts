import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"

export const dynamic="force-dynamic"
export async function GET(request:NextRequest){
 try{
  const auth=await createClient()
  const {data:{user},error}=await auth.auth.getUser()
  if(error||!user?.email)return privateResponse({error:"Inicia sesión."},401)
  const db=createFamilyAdminClient()
  const role=await db.from("admin_emails").select("email").eq("email",user.email).maybeSingle()
  if(role.error||!role.data)return privateResponse({error:"Acceso exclusivo para administración."},403)
  const raw=request.nextUrl.searchParams.get("before")
  if(raw&&!/^\d{1,18}$/.test(raw))return privateResponse({error:"Paginación inválida."},400)
  let query=db.from("eduai_privacy_choice_events").select("id,user_id,policy_version,choices,event_type,recorded_at").in("event_type",["signup_declarations","preferences_recorded"]).order("id",{ascending:false}).limit(101)
  if(raw)query=query.lt("id",raw)
  const {data,error:readError}=await query
  if(readError)return privateResponse({error:"No se pudieron consultar las actas."},503)
  const rows=(data||[]).slice(0,100)
  const ids=[...new Set(rows.map(r=>r.user_id))]
  const profiles=ids.length?await db.from("profiles").select("id,name,email").in("id",ids):{data:[],error:null}
  if(profiles.error)return privateResponse({error:"No se pudieron consultar los titulares."},503)
  const byId=new Map((profiles.data||[]).map(p=>[p.id,p]))
  return privateResponse({acts:rows.map(r=>({folio:"ACTA-PRIV-"+r.id,accountId:r.user_id,name:byId.get(r.user_id)?.name||"Titular registrado",email:byId.get(r.user_id)?.email||null,version:r.policy_version,date:r.recorded_at,origin:r.event_type,choices:r.choices})),next:(data||[]).length>100?String(rows.at(-1)?.id):null})
 }catch{return privateResponse({error:"No se pudo consultar el archivo privado."},503)}
}
