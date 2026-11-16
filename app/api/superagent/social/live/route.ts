import { createClient } from "@/lib/supabase/server"
import { prepareLiveConversation, selectLiveSpeakers, streamLiveParticipant, summarizeConversation, type SocialRoomSlug, type SocialMessage } from "@/lib/superagent/social-engine"
import type { SocialSession } from "@/lib/superagent/social-session-store"
import { detectActionFromUserMessage } from "@/lib/superagent/action-router"
import { executeSuggestedAction } from "@/lib/superagent/action-executor"

export const maxDuration = 60
const TABLE = "eduai_social_conversations"
const rooms = new Set(["ideas","research","teaching-lab","creative-studio","user-support","anticipation"])
const headers = {"Cache-Control":"private, no-store"}
const reply = (value:unknown,status=200)=>Response.json(value,{status,headers})
const uuid=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const text=(value:unknown)=>typeof value==="string"?value.trim().slice(0,6000):""
const lock=()=>new Date(Date.now()+45000).toISOString()
type Row={id:string;state:SocialSession;revision:number;busy_until:string|null}
type DB=Awaited<ReturnType<typeof createClient>>
const busy=(row:Row)=>!!row.busy_until&&new Date(row.busy_until).getTime()>Date.now()
async function load(db:DB,userId:string,id:string){
  const {data,error}=await db.from(TABLE).select("id,state,revision,busy_until").eq("id",id).eq("user_id",userId).maybeSingle()
  if(error)throw Error("No se pudo cargar la conversación.")
  return data as Row|null
}
async function save(db:DB,userId:string,row:Row,state:SocialSession,roundBusy:string|null,revision=row.revision){
  const {data,error}=await db.from(TABLE).update({state,revision,busy_until:roundBusy,updated_at:new Date().toISOString()}).eq("id",row.id).eq("user_id",userId).eq("revision",row.revision).select("id").maybeSingle()
  if(error||!data)throw Error("La conversación cambió o no pudo guardarse.")
}
export async function GET(request:Request){
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)return reply({ok:false,error:"Inicia sesión."},401)
  const id=new URL(request.url).searchParams.get("sessionId")
  try{
    if(id){
      if(!uuid(id))return reply({ok:false,error:"Identificador inválido."},400)
      const row=await load(db,user.id,id)
      return row?reply({ok:true,session:row.state,busy:busy(row)}):reply({ok:false,error:"Conversación no encontrada."},404)
    }
    const {data,error}=await db.from(TABLE).select("id,state,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(12)
    if(error)throw Error("No se pudo cargar el historial.")
    return reply({ok:true,sessions:(data||[]).map(row=>({id:row.id,title:row.state.room.title,topic:row.state.room.topic,updatedAt:row.updated_at}))})
  }catch{return reply({ok:false,error:"No se pudo cargar EduAI Social."},500)}
}
export async function POST(request:Request){
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)return reply({ok:false,error:"Inicia sesión."},401)
  const body=await request.json().catch(()=>null)
  if(!body)return reply({ok:false,error:"Solicitud inválida."},400)
  const action=body.action
  try{
    let row:Row
    let session:SocialSession
    let prompt:string
    if(action==="create"){
      prompt=text(body.topic)
      if(!prompt)return reply({ok:false,error:"Escribe un tema."},400)
      const room=rooms.has(body.room)?body.room as SocialRoomSlug:undefined
      session=prepareLiveConversation(prompt,user.id,room)
      row={id:session.sessionId,state:session,revision:1,busy_until:lock()}
      const {error}=await db.from(TABLE).insert({...row,user_id:user.id})
      if(error)throw Error("No se pudo crear la conversación.")
    }else{
      if(!uuid(body.sessionId))return reply({ok:false,error:"Conversación inválida."},400)
      const existing=await load(db,user.id,body.sessionId)
      if(!existing)return reply({ok:false,error:"Conversación no encontrada."},404)
      row=existing;session=row.state
      if(busy(row))return reply({ok:false,error:"Hay agentes respondiendo. Espera a que termine la ronda."},409)
      if(action==="pause"||action==="resume"){
        session={...session,status:action==="pause"?"paused":"active",updatedAt:new Date().toISOString()}
        await save(db,user.id,row,session,null,row.revision+1)
        return reply({ok:true,session})
      }
      if(action==="delete"){
        const {error}=await db.from(TABLE).delete().eq("id",row.id).eq("user_id",user.id).eq("revision",row.revision)
        if(error)throw Error("No se pudo eliminar.")
        return reply({ok:true})
      }
      if(action==="execute-suggested-action"){
        const last=session.messages.filter(m=>m.authorId==="user").at(-1)
        const suggestion=detectActionFromUserMessage(last?.content||"")
        if(!suggestion.detected)return reply({ok:false,error:"No hay una acción disponible."},400)
        const result=await executeSuggestedAction({suggestion,context:{userId:user.id,currentPage:"/ai-social",activeAgent:"social",userGoal:suggestion.suggestedGoal||session.room.topic,tags:["social","executed-action"],metadata:{sessionId:session.sessionId}}})
        return reply({ok:result.ok,result})
      }
      if(session.status!=="active")return reply({ok:false,error:"Reanuda la conversación."},409)
      if(action==="retry"){
        const last=session.messages.at(-1)
        if(!last||last.authorId!=="user")return reply({ok:false,error:"No hay un mensaje pendiente de respuesta."},409)
        prompt=last.content
      }else if(action==="turn"){
        prompt=text(body.content)
        if(!prompt)return reply({ok:false,error:"Escribe un mensaje."},400)
        if(session.messages.length>=180)return reply({ok:false,error:"Esta conversación alcanzó su límite. Abre una nueva para continuar."},400)
        const stamp=new Date().toISOString()
        const message:SocialMessage={id:crypto.randomUUID(),authorId:"user",authorName:"Usuario",role:"assistant",content:prompt,createdAt:stamp}
        session={...session,messages:[...session.messages,message],lastUserActivityAt:stamp,updatedAt:stamp}
      }else return reply({ok:false,error:"Acción no soportada."},400)
      const nextRevision=row.revision+1
      const busyUntil=lock()
      await save(db,user.id,row,session,busyUntil,nextRevision)
      row={...row,revision:nextRevision,state:session,busy_until:busyUntil}
    }
    const initial=session
    const speakers=selectLiveSpeakers(initial.room.slug,prompt,initial.participants)
    const encoder=new TextEncoder()
    let disconnected=false
    const stream=new ReadableStream<Uint8Array>({
      async start(controller){
        const emit=(event:unknown)=>{if(!disconnected){try{controller.enqueue(encoder.encode(JSON.stringify(event)+"\n"))}catch{disconnected=true}}}
        emit({type:"session",session:initial})
        emit({type:"speakers",speakers})
        let current=initial
        let savedCount=0
        let writes:Promise<void>=Promise.resolve()
        const failures:string[]=[]
        try{
          await Promise.all(speakers.map(async participant=>{
            try{
              const message=await streamLiveParticipant({participant,room:initial.room.slug,topic:initial.room.topic,userMessage:prompt,history:initial.messages,userId:user.id,supabase:db,signal:request.signal,onDelta:content=>emit({type:"delta",authorId:participant.id,content})})
              const persist=writes.catch(()=>{}).then(async()=>{
                const stamp=new Date().toISOString()
                const messages=[...current.messages,message]
                const next={...current,messages,summary:summarizeConversation(current.room.topic,messages),updatedAt:stamp,lastAgentActivityAt:stamp}
                await save(db,user.id,row,next,row.busy_until)
                current=next;savedCount++
                emit({type:"message",message})
              })
              writes=persist
              await persist
            }catch{
              failures.push(participant.name)
              emit({type:"agent-error",authorId:participant.id,name:participant.name})
            }
          }))
          await writes.catch(()=>{})
          await save(db,user.id,row,current,null)
          emit({type:"done",session:current,actionSuggestion:detectActionFromUserMessage(prompt),warning:failures.length?(savedCount?"No todos los agentes pudieron responder. Puedes continuar la conversación.":"Los agentes no pudieron responder. Reintenta el mismo mensaje."):""})
        }catch{
          emit({type:"error",error:"No se pudo finalizar el guardado. Abre el historial para recuperar lo que se guardó."})
        }finally{if(!disconnected){try{controller.close()}catch{}}}
      },
      cancel(){disconnected=true},
    })
    return new Response(stream,{headers:{...headers,"Content-Type":"application/x-ndjson; charset=utf-8","X-Accel-Buffering":"no"}})
  }catch(e){return reply({ok:false,error:e instanceof Error?e.message:"No se pudo procesar la conversación."},500)}
}
