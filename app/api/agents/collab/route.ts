import {createClient} from "@/lib/supabase/server"
import {createClient as createAdmin} from "@supabase/supabase-js"
import {runAIText} from "@/lib/ai/gateway"
export const maxDuration=60
export async function POST(req:Request){
 const auth=await createClient()
 const {data:{user}}=await auth.auth.getUser()
 if(!user)return Response.json({error:"Inicia sesión."},{status:401})
 const body=await req.json().catch(()=>null)
 const code=typeof body?.code==="string"?body.code.toUpperCase():""
 const question=typeof body?.question==="string"?body.question.trim().slice(0,4000):""
 if(!/^[A-Z0-9]{6,8}$/.test(code)||!question)return Response.json({error:"Escribe una pregunta explícita."},{status:400})
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)return Response.json({error:"Servicio no configurado."},{status:503})
 const db=createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:room}=await db.from("collab_spaces").select("id,topic,host_id").eq("code",code).maybeSingle()
 if(!room)return Response.json({error:"Sala no encontrada."},{status:404})
 const {data:member}=await db.from("collab_people").select("status").eq("room_id",room.id).eq("user_id",user.id).maybeSingle()
 if(member?.status!=="approved")return Response.json({error:"Acceso no autorizado."},{status:403})
 try{
  const result=await runAIText({messages:[{role:"system",content:"Eres ACo, asistente de estudio colaborativo EduAI. Responde solo a la pregunta explícita, con claridad, sin asumir edad escolar, sin inventar fuentes y con LaTeX si aporta. No solicites datos personales. El grupo verá tu respuesta."},{role:"user",content:"Tema de la sala: "+room.topic+"\nPregunta: "+question}],capability:"text",maxOutputTokens:650,lite:true,preferredProvider:"groq",fallbackToDefault:true,captureTraining:false,context:{userId:user.id,module:"collab",reusePolicy:"never",visibility:"private"},supabase:auth})
  const {data:still}=await db.from("collab_people").select("status").eq("room_id",room.id).eq("user_id",user.id).maybeSingle()
  if(still?.status!=="approved")return Response.json({error:"Acceso revocado."},{status:403})
  const {data,error}=await db.from("collab_chat").insert({room_id:room.id,user_id:user.id,user_name:"ACo · EduAI",type:"agent",content:result.data}).select("*").single()
  if(error)throw Error("No se pudo guardar la respuesta.")
  return Response.json({message:data})
 }catch{return Response.json({error:"La IA no pudo responder. Intenta nuevamente."},{status:503})}
}
