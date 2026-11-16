import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}})
const clean=(v:unknown,max=200)=>typeof v==="string"?v.trim().slice(0,max):""
const uuid=(v:unknown)=>typeof v==="string"&&/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const codeOf=(v:unknown)=>clean(v,12).toUpperCase()
const activeSince=()=>new Date(Date.now()-30000).toISOString()
const requireOk=(r:{error:unknown})=>{if(r.error)throw Error("No se pudo guardar o cargar la información.")}
function admin(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error("Almacenamiento de colaboración no configurado.");return createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
async function identity(){const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return null;const db=admin();const {data}=await db.from("profiles").select("name").eq("id",user.id).maybeSingle();return {user,db,name:clean(data?.name,80)||"Participante"}}
function publicRoom(room:any,host:boolean){const {invite_token,...rest}=room;return {...rest,...(host?{invite_token}:{})}}
function iceServers(){const result:RTCIceServer[]=[{urls:"stun:stun.l.google.com:19302"}];if(process.env.COLLAB_TURN_URL&&process.env.COLLAB_TURN_USERNAME&&process.env.COLLAB_TURN_CREDENTIAL)result.push({urls:process.env.COLLAB_TURN_URL.split(",").map(x=>x.trim()),username:process.env.COLLAB_TURN_USERNAME,credential:process.env.COLLAB_TURN_CREDENTIAL});return result}
async function handle(req:Request,method:string){
 try{
  const ctx=await identity();if(!ctx)return response({error:"Inicia sesión para continuar."},401)
  const {db,user,name}=ctx;const url=new URL(req.url);const body=method==="GET"?Object.fromEntries(url.searchParams):await req.json().catch(()=>null)
  if(!body)return response({error:"Solicitud inválida."},400)
  const action=body.action||(method==="PATCH"?"join":method==="GET"?"list":"create")
  if(action==="list"){
   const {data:members,error}=await db.from("collab_people").select("room_id,status").eq("user_id",user.id).in("status",["approved","pending"]);if(error)throw Error("No se pudieron cargar las salas.")
   const ids=(members||[]).map(m=>m.room_id)
   if(!ids.length)return response({rooms:[]})
   const {data,error:e}=await db.from("collab_spaces").select("id,code,topic,host_id,access_mode,created_at").in("id",ids).order("created_at",{ascending:false}).limit(100);if(e)throw Error("No se pudieron cargar las salas.")
   return response({rooms:(data||[]).map(r=>({...r,status:members?.find(m=>m.room_id===r.id)?.status}))})
  }
  if(action==="create"){
   const topic=clean(body.topic,200);if(!topic)return response({error:"Escribe el tema de la sala."},400)
   const code=randomBytes(5).toString("hex").slice(0,8).toUpperCase()
   const {data:room,error}=await db.from("collab_spaces").insert({code,topic,host_id:user.id}).select("*").single();if(error)throw Error("No se pudo crear la sala.")
   const membership=await db.from("collab_people").insert({room_id:room.id,user_id:user.id,name,status:"approved"})
   if(membership.error){await db.from("collab_spaces").delete().eq("id",room.id);throw Error("No se pudo crear la membresía.")}
   return response({room:publicRoom(room,true),code:room.code},201)
  }
  const code=codeOf(body.code)
  if(!/^[A-Z0-9]{6,8}$/.test(code))return response({error:"Código inválido."},400)
  const {data:room,error:roomError}=await db.from("collab_spaces").select("*").eq("code",code).maybeSingle()
  if(roomError)throw Error("No se pudo consultar la sala.")
  if(!room)return response({error:"Sala no encontrada."},404)
  const host=room.host_id===user.id
  const {data:member,error:memberError}=await db.from("collab_people").select("*").eq("room_id",room.id).eq("user_id",user.id).maybeSingle();if(memberError)throw Error("No se pudo consultar el acceso.")
  if(action==="join"){
   if(member?.status==="denied")return response({error:"El anfitrión no ha autorizado tu acceso."},403)
   const invited=typeof body.token==="string"&&body.token===room.invite_token
   const status=host||member?.status==="approved"||invited||room.access_mode==="open"?"approved":"pending"
   requireOk(await db.from("collab_people").upsert({room_id:room.id,user_id:user.id,name,status,last_seen:new Date().toISOString()},{onConflict:"room_id,user_id"}))
   return response({code,status})
  }
  if(!host&&member?.status!=="approved")return response({status:member?.status||"not_joined",error:"Necesitas autorización del anfitrión."},403)
  if(action==="state"){
   requireOk(await db.from("collab_people").update({last_seen:new Date().toISOString()}).eq("room_id",room.id).eq("user_id",user.id))
   const [people,chat,tools]=await Promise.all([db.from("collab_people").select("user_id,name,status,last_seen,peer_id,call_seen,mic,camera,hand").eq("room_id",room.id).in("status",host?["approved","pending","denied"]:["approved"]),db.from("collab_chat").select("*").eq("room_id",room.id).order("created_at",{ascending:false}).limit(150),db.from("collab_tools").select("*").eq("room_id",room.id).order("updated_at",{ascending:false}).limit(200)])
   requireOk(people);requireOk(chat);requireOk(tools)
   return response({room:publicRoom(room,host),userId:user.id,userName:name,people:people.data,messages:(chat.data||[]).reverse(),tools:tools.data})
  }
  if(action==="access"||action==="rotate"||action==="admit"){
   if(!host)return response({error:"Solo el anfitrión puede gestionar accesos."},403)
   if(action==="access"){if(!["invited","open"].includes(body.mode))return response({error:"Permiso inválido."},400);requireOk(await db.from("collab_spaces").update({access_mode:body.mode}).eq("id",room.id))}
   if(action==="rotate")requireOk(await db.from("collab_spaces").update({invite_token:crypto.randomUUID()}).eq("id",room.id))
   if(action==="admit"){if(!uuid(body.userId)||body.userId===user.id||!["approved","denied"].includes(body.status))return response({error:"Participante inválido."},400);requireOk(await db.from("collab_people").update({status:body.status,...(body.status==="denied"?{peer_id:null,call_seen:null}: {})}).eq("room_id",room.id).eq("user_id",body.userId))}
   return response({ok:true})
  }
  if(action==="message"||action==="ai-message"){
   const content=clean(body.content,16000);if(!content)return response({error:"Escribe un mensaje."},400)
   // AI output is inserted exclusively by the authenticated AI endpoint.
   if(action!=="message")return response({error:"Acción inválida."},400)
   const {data,error}=await db.from("collab_chat").insert({room_id:room.id,user_id:user.id,user_name:name,content,type:"chat"}).select("*").single();if(error)throw Error("No se pudo enviar el mensaje.")
   return response({message:data})
  }
  if(action==="tool"){
   const kind=clean(body.kind,20),title=clean(body.title,200),content=clean(body.content,40000)
   if(!["note","event","task","file","activity","board"].includes(kind)||!title)return response({error:"Recurso inválido."},400)
   if(kind==="file"&&!/^https:\/\//i.test(content))return response({error:"Comparte un enlace HTTPS válido."},400)
   const due=typeof body.due_at==="string"&&!Number.isNaN(Date.parse(body.due_at))?new Date(body.due_at).toISOString():null
   const values={kind,title,content,due_at:due,done:body.done===true,updated_at:new Date().toISOString()}
   if(body.id){
    if(!uuid(body.id)||!Number.isInteger(body.revision))return response({error:"Versión inválida."},400)
    const {data,error}=await db.from("collab_tools").update({...values,revision:body.revision+1}).eq("id",body.id).eq("room_id",room.id).eq("revision",body.revision).select("*").maybeSingle()
    if(error||!data)return response({error:"Otra persona modificó este recurso. Actualiza y vuelve a editar."},409)
    return response({tool:data})
   }
   const {data,error}=await db.from("collab_tools").insert({...values,room_id:room.id,created_by:user.id}).select("*").single();if(error)throw Error("No se pudo crear el recurso.");return response({tool:data})
  }
  if(action==="delete-tool"){
   if(!uuid(body.id))return response({error:"Recurso inválido."},400)
   let q=db.from("collab_tools").delete().eq("room_id",room.id).eq("id",body.id)
   if(!host)q=q.eq("created_by",user.id)
   requireOk(await q);return response({ok:true})
  }
  if(action==="call-join"){
   if(!uuid(body.peer))return response({error:"Identificador inválido."},400)
   const {data,error}=await db.rpc("collab_enter_call",{p_room:room.id,p_user:user.id,p_peer:body.peer})
   if(error||!data)return response({error:"La videollamada está llena (máximo 6 participantes) o no tienes acceso."},409)
   return response({iceServers:iceServers(),turnConfigured:iceServers().length>1})
  }
  if(["call-poll","call-leave","signal"].includes(action)){
   if(!uuid(body.peer)||member?.peer_id!==body.peer)return response({error:"Vuelve a entrar a la llamada."},409)
   if(action==="call-leave"){requireOk(await db.from("collab_people").update({peer_id:null,call_seen:null,mic:false,camera:false,hand:false}).eq("room_id",room.id).eq("user_id",user.id).eq("peer_id",body.peer));return response({ok:true})}
   if(!member.call_seen||member.call_seen<activeSince())return response({error:"La conexión caducó. Vuelve a entrar."},409)
   if(action==="signal"){
    if(!uuid(body.to)||body.to===body.peer||!body.payload||!["offer","answer","candidate"].includes(body.payload.type)||JSON.stringify(body.payload).length>80000)return response({error:"Señal inválida."},400)
    const {data:target}=await db.from("collab_people").select("user_id").eq("room_id",room.id).eq("peer_id",body.to).eq("status","approved").gt("call_seen",activeSince()).maybeSingle()
    if(!target)return response({error:"El participante salió."},409)
    requireOk(await db.from("collab_signals").insert({room_id:room.id,sender:body.peer,receiver:body.to,payload:body.payload}))
    return response({ok:true})
   }
   requireOk(await db.from("collab_people").update({call_seen:new Date().toISOString(),mic:body.mic===true,camera:body.camera===true,hand:body.hand===true}).eq("room_id",room.id).eq("user_id",user.id).eq("peer_id",body.peer))
   const after=Math.max(0,Number(body.after)||0)
   const [people,signals]=await Promise.all([db.from("collab_people").select("user_id,name,peer_id,mic,camera,hand").eq("room_id",room.id).eq("status","approved").not("peer_id","is",null).gt("call_seen",activeSince()),db.from("collab_signals").select("id,sender,payload").eq("room_id",room.id).eq("receiver",body.peer).gt("id",after).order("id").limit(300)])
   requireOk(people);requireOk(signals)
   await db.from("collab_signals").delete().eq("room_id",room.id).lt("created_at",new Date(Date.now()-120000).toISOString())
   return response({people:people.data,signals:signals.data})
  }
  return response({error:"Acción no válida."},400)
 }catch(error){console.error("[collab]",error instanceof Error?error.message:"error");return response({error:"No se pudo completar la operación. Intenta nuevamente."},500)}
}
export const GET=(req:Request)=>handle(req,"GET")
export const POST=(req:Request)=>handle(req,"POST")
export const PATCH=(req:Request)=>handle(req,"PATCH")
