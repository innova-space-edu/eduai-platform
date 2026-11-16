import {createClient} from "@/lib/supabase/server"
import {createClient as createAdmin} from "@supabase/supabase-js"
const bucket="collab-private-files"
const mime:Record<string,string>={pdf:"application/pdf",txt:"text/plain",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation"}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
async function access(code:string){
 const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return null
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)throw Error("Configuración incompleta.")
 const db=createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:room}=await db.from("collab_spaces").select("id").eq("code",code.toUpperCase()).maybeSingle();if(!room)return null
 const {data:member}=await db.from("collab_people").select("status").eq("room_id",room.id).eq("user_id",user.id).maybeSingle()
 return member?.status==="approved"?{db,room,user}:null
}
export async function POST(req:Request){
 try{
  if(Number(req.headers.get("content-length")||0)>3400000)return reply({error:"Archivo demasiado grande. Máximo 3 MB."},413)
  const form=await req.formData(),code=String(form.get("code")||""),file=form.get("file")
  if(!/^[A-Z0-9]{6,8}$/i.test(code)||!(file instanceof File))return reply({error:"Archivo inválido."},400)
  const ctx=await access(code);if(!ctx)return reply({error:"Acceso no autorizado."},403)
  const extension=file.name.split(".").pop()?.toLowerCase()||"",type=mime[extension]
  if(!type||file.size<=0||file.size>3145728||file.type&&file.type!==type&&file.type!=="application/octet-stream")return reply({error:"Formato no permitido o superior a 3 MB."},400)
  const name=file.name.replace(/[\\/\u0000-\u001f]/g,"_").slice(0,180)
  const path=ctx.room.id+"/"+crypto.randomUUID()+"."+extension
  const {error}=await ctx.db.storage.from(bucket).upload(path,file,{contentType:type,upsert:false})
  if(error)return reply({error:"No se pudo subir el archivo."},500)
  const {data,error:saveError}=await ctx.db.from("collab_tools").insert({room_id:ctx.room.id,kind:"file",title:name,content:"storage:"+path,created_by:ctx.user.id}).select("*").single()
  if(saveError){await ctx.db.storage.from(bucket).remove([path]);return reply({error:"No se pudo guardar el archivo."},500)}
  return reply({tool:data},201)
 }catch{return reply({error:"No se pudo cargar el archivo."},500)}
}
export async function GET(req:Request){
 try{
  const params=new URL(req.url).searchParams,code=params.get("code")||"",id=params.get("id")||""
  if(!/^[A-Z0-9]{6,8}$/i.test(code)||!/^[-a-f0-9]{36}$/i.test(id))return reply({error:"Archivo inválido."},400)
  const ctx=await access(code);if(!ctx)return reply({error:"Acceso no autorizado."},403)
  const {data}=await ctx.db.from("collab_tools").select("title,content").eq("room_id",ctx.room.id).eq("id",id).eq("kind","file").maybeSingle()
  if(!data?.content.startsWith("storage:"+ctx.room.id+"/"))return reply({error:"Archivo no encontrado."},404)
  const {data:download,error}=await ctx.db.storage.from(bucket).createSignedUrl(data.content.slice(8),60,{download:data.title})
  if(error||!download)return reply({error:"No se pudo abrir el archivo."},500)
  return new Response(null,{status:302,headers:{Location:download.signedUrl,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}})
 }catch{return reply({error:"No se pudo descargar el archivo."},500)}
}
