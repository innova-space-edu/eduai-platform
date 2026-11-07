import { NextResponse } from "next/server"
import { trainingAdminClient, trainingUser, isAdult } from "@/lib/ai/training/server"
import { prepareTrainingPair, trainingFingerprint, TRAINING_POLICY_VERSION } from "@/lib/ai/training/safety"
export const dynamic = "force-dynamic"
const headers = {"Cache-Control":"no-store"}
export async function GET() {
  const auth = await trainingUser()
  if (!auth) return NextResponse.json({error:"Inicia sesión"},{status:401,headers})
  const admin = trainingAdminClient()
  const [{data:consent},{data:profile}] = await Promise.all([
    admin.from("ai_training_consents").select("enabled,policy_version").eq("owner_id",auth.user.id).maybeSingle(),
    admin.from("profiles").select("birth_date").eq("id",auth.user.id).maybeSingle(),
  ])
  return NextResponse.json({enabled:consent?.enabled===true&&consent.policy_version===TRAINING_POLICY_VERSION,eligible:isAdult(profile?.birth_date),policyVersion:TRAINING_POLICY_VERSION},{headers})
}
export async function POST(request: Request) {
  const auth = await trainingUser()
  if (!auth) return NextResponse.json({error:"Inicia sesión"},{status:401,headers})
  if (Number(request.headers.get("content-length")||0)>60000) return NextResponse.json({error:"Contenido demasiado extenso"},{status:413,headers})
  const raw = await request.text()
  if(raw.length>60000) return NextResponse.json({error:"Contenido demasiado extenso"},{status:413,headers})
  let body; try {body=JSON.parse(raw)} catch{return NextResponse.json({error:"JSON inválido"},{status:400,headers})}
  const admin = trainingAdminClient()
  if (body.action === "consent") {
    if (typeof body.enabled!=="boolean") return NextResponse.json({error:"Indica tu decisión"},{status:400,headers})
    if (body.enabled) {
      const {data:profile}=await admin.from("profiles").select("birth_date").eq("id",auth.user.id).maybeSingle()
      if(!isAdult(profile?.birth_date)||body.accepted!==true||body.policyVersion!==TRAINING_POLICY_VERSION) return NextResponse.json({error:"Solo adultos con fecha de nacimiento registrada y autorización expresa pueden aportar contenido"},{status:403,headers})
    }
    const {error}=await admin.from("ai_training_consents").upsert({owner_id:auth.user.id,enabled:body.enabled,policy_version:TRAINING_POLICY_VERSION,updated_at:new Date().toISOString()})
    if(error) return NextResponse.json({error:"No se pudo guardar la autorización"},{status:500,headers})
    return NextResponse.json({enabled:body.enabled},{headers})
  }
  if(body.action!=="feedback" || !["useful","incorrect","corrected"].includes(body.rating)) return NextResponse.json({error:"Feedback inválido"},{status:400,headers})
  const {data:consent}=await admin.from("ai_training_consents").select("owner_id").eq("owner_id",auth.user.id).eq("enabled",true).eq("policy_version",TRAINING_POLICY_VERSION).maybeSingle()
  if(!consent) return NextResponse.json({error:"Activa primero tu aportación voluntaria al entrenamiento"},{status:403,headers})
  const answer=body.rating==="corrected"?body.correction:body.answer
  const messages=typeof body.prompt==="string"&&typeof answer==="string"?prepareTrainingPair(body.prompt,answer):null
  if(!messages) return NextResponse.json({error:"Ejemplo bloqueado: elimina datos personales, enlaces o credenciales y aporta una pregunta y respuesta completas"},{status:422,headers})
  if(body.rating==="corrected" && typeof body.answer==="string") {
    const original=prepareTrainingPair(body.prompt,body.answer)
    if(original) {
      const {error:excludeError}=await admin.from("ai_training_candidates").update({status:"rejected",rating:"incorrect",reviewed_by:null,reviewed_at:null})
        .eq("owner_id",auth.user.id).eq("fingerprint",trainingFingerprint(original))
      if(excludeError) return NextResponse.json({error:"No se pudo excluir la respuesta anterior"},{status:500,headers})
    }
  }
  const {error}=await admin.from("ai_training_candidates").upsert({owner_id:auth.user.id,source_module:typeof body.module==="string"?body.module.slice(0,120):"chat",
    messages,fingerprint:trainingFingerprint(messages),origin:"feedback",rating:body.rating,status:body.rating==="incorrect"?"rejected":"pending",policy_version:TRAINING_POLICY_VERSION,
    reviewed_by:null,reviewed_at:null,expires_at:new Date(Date.now()+90*86400000).toISOString(),
  },{onConflict:"owner_id,fingerprint"})
  if(error) return NextResponse.json({error:"No se pudo registrar"},{status:500,headers})
  return NextResponse.json({saved:true,status:body.rating==="incorrect"?"rejected":"pending"},{headers})
}
