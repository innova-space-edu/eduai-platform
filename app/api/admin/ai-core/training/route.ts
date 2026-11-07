import { NextResponse } from "next/server"
import { trainingAdminClient, trainingUser } from "@/lib/ai/training/server"
import { validatedTrainingPair, TRAINING_POLICY_VERSION } from "@/lib/ai/training/safety"
export const dynamic = "force-dynamic"
const headers={"Cache-Control":"no-store"}
export async function GET() {
  if(!await trainingUser(true)) return NextResponse.json({error:"Acceso denegado"},{status:403,headers})
  const db=trainingAdminClient()
  await db.from("ai_training_candidates").delete().lte("expires_at",new Date().toISOString())
  const {data,error}=await db.from("ai_training_candidates").select("id,source_module,origin,rating,status,messages,created_at")
    .gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(50)
  if(error) return NextResponse.json({error:"Cola no disponible"},{status:500,headers})
  const {data:runs}=await db.from("ai_training_runs").select("id,status,kaggle_url,report,created_at").order("created_at",{ascending:false}).limit(5)
  return NextResponse.json({candidates:data||[],runs:runs||[],limit:50,productionRouterEnabled:false},{headers})
}
export async function POST(request: Request) {
  const auth=await trainingUser(true)
  if(!auth) return NextResponse.json({error:"Acceso denegado"},{status:403,headers})
  const body=await request.json().catch(()=>({}));const db=trainingAdminClient()
  if(body.action==="review") {
    if(!["approved","rejected"].includes(body.status)||typeof body.id!=="string"||body.reviewedSafe!==true) return NextResponse.json({error:"Confirma revisión pedagógica, privacidad y derechos de uso"},{status:400,headers})
    const {data:row}=await db.from("ai_training_candidates").select("messages,rating").eq("id",body.id).single()
    const messages=validatedTrainingPair(row?.messages)
    if(body.status==="approved"&&(!messages||row?.rating==="incorrect")) return NextResponse.json({error:"Ejemplo no apto"},{status:422,headers})
    const {error}=await db.from("ai_training_candidates").update({status:body.status,...(messages?{messages}:{}),reviewed_by:auth.user.id,reviewed_at:new Date().toISOString()}).eq("id",body.id)
    return NextResponse.json(error?{error:"No se pudo revisar"}:{saved:true},{status:error?500:200,headers})
  }
  if(body.action!=="export") return NextResponse.json({error:"Acción inválida"},{status:400,headers})
  const {data,error}=await db.rpc("export_eduai_training_dataset",{p_actor:auth.user.id,p_policy:TRAINING_POLICY_VERSION})
  if(error||!data) return NextResponse.json({error:"No se pudo exportar el lote; límite 5000 ejemplos"},{status:409,headers})
  return NextResponse.json(data,{headers:{...headers,"Content-Disposition":"attachment; filename=eduai-reviewed-training.json"}})
}
