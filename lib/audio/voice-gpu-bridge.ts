import { randomBytes, createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

const BUCKET = "generated-voice-audio"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_SECONDS = 2 * 60 * 60
const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "private, no-store" } })

async function owner() {
  const session = await validateVoiceSecuritySession()
  if (!session.valid) return { ...session, userId: "" }
  const { data: { user } } = await session.supabase.auth.getUser()
  const { data: mfa, error } = await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!user || error || mfa?.currentLevel !== "aal2") return { ...session, valid: false, userId: "" }
  return { ...session, userId: user.id }
}

type Supabase = Awaited<ReturnType<typeof validateVoiceSecuritySession>>["supabase"]

async function ownVoice(db: Supabase, uid: string, id: string) {
  const { data, error } = await db.from("audio_voice_profiles")
    .select("id,sample_path,canonical_audio_path,consent_audio_path,consent_confirmed,authorization_confirmed,source_kind")
    .eq("id", id).eq("user_id", uid).is("deleted_at", null).maybeSingle()
  return !error && data && data.source_kind === "self" && data.sample_path &&
    data.consent_audio_path && data.consent_confirmed && data.authorization_confirmed ? data : null
}

async function worker(body: Record<string,unknown>) {
  const sessionId = body.session_id
  const token = body.token
  if (typeof sessionId !== "string" || !UUID.test(sessionId) ||
      typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    return fail("Credenciales temporales inválidas", 403)
  // The notebook has no EDUAI cookie and no Supabase credentials. Each RPC is
  // SECURITY DEFINER and checks the SHA256 token, expiry, profile and job scope.
  const db = (await validateVoiceSecuritySession()).supabase
  if (body.operation === "poll") {
    const { data, error } = await db.rpc("eduai_voice_worker_claim", {
      p_session_id: sessionId, p_token: token,
    })
    if (error) return fail("La cola de GPU no respondió", 503)
    return NextResponse.json(data || { ok: false }, { headers: { "Cache-Control": "private, no-store" } })
  }
  if (body.operation === "finish") {
    if (typeof body.job_id !== "string" || !UUID.test(body.job_id)) return fail("Trabajo inválido", 400)
    const { data, error } = await db.rpc("eduai_voice_worker_finish", {
      p_session_id: sessionId, p_token: token, p_job_id: body.job_id,
      p_error: typeof body.error === "string" && body.error ? body.error.slice(0,240) : null,
    })
    if (error) return fail("No se pudo registrar el resultado de GPU", 503)
    return NextResponse.json(data || { ok: false }, { headers: { "Cache-Control": "private, no-store" } })
  }
  return fail("Operación no autorizada", 400)
}

/** Reuses the existing profiles function (Vercel Hobby 12-function cap). */
export async function postVoiceGpuBridge(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail("Se requiere JSON",415)
  const body = await req.json().catch(()=>null) as Record<string,unknown>|null
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Solicitud inválida",400)
  if (body.operation === "poll" || body.operation === "finish") return worker(body)

  const origin = req.headers.get("origin")
  if (origin && origin !== new URL(req.url).origin) return fail("Origen no autorizado",403)
  const ctx = await owner()
  if (!ctx.valid || !ctx.userId) return fail("Requiere administrador adulto y MFA AAL2",403)
  const db = ctx.supabase
  const profileId = body.profile_id
  if (typeof profileId !== "string" || !UUID.test(profileId)) return fail("Perfil inválido",400)
  const profile = await ownVoice(db,ctx.userId,profileId)
  if (!profile) return fail("Se requiere voz propia con muestra y consentimiento grabados",403)

  if (body.operation === "connect") {
    if (body.provider !== "kaggle" && body.provider !== "colab") return fail("Selecciona Kaggle o Colab",400)
    await db.from("audio_voice_render_jobs").update({
      status:"failed",stage:"worker_replaced",error:"Se creó otra sesión GPU",
    }).eq("user_id",ctx.userId).eq("voice_profile_id",profileId)
      .in("provider",["kaggle-voice-bridge","colab-voice-bridge"]).eq("status","starting")
    const secret = randomBytes(32).toString("hex")
    const expires = new Date(Date.now()+SESSION_SECONDS*1000).toISOString()
    const {data: row,error} = await db.from("audio_voice_render_jobs").insert({
      user_id:ctx.userId,voice_profile_id:profileId,text:"Vinculación GPU temporal",
      status:"starting",stage:"worker_waiting",progress:0,
      provider:String(body.provider)+"-voice-bridge",engine:"chatterbox-multilingual-v3",
      metadata:{token_hash:createHash("sha256").update(secret).digest("hex"),
        expires_at:expires,scope:"own-profile-only"},
    }).select("id").single()
    if(error||!row) return fail("No se pudo crear la vinculación temporal",503)
    return NextResponse.json({ok:true,provider:body.provider,session_id:row.id,
      pairing_code:row.id+"."+secret,expires_at:expires},{
      headers:{"Cache-Control":"private, no-store"}})
  }

  const sessionId = body.session_id
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) return fail("Vincula primero un notebook",400)
  const {data:session} = await db.from("audio_voice_render_jobs")
    .select("id,provider,status,metadata")
    .eq("id",sessionId).eq("user_id",ctx.userId).eq("voice_profile_id",profileId)
    .in("provider",["kaggle-voice-bridge","colab-voice-bridge"]).maybeSingle()
  if(!session) return fail("La sesión no existe o no es tuya",404)
  if(body.operation==="disconnect"){
    await db.from("audio_voice_render_jobs").update({status:"failed",stage:"worker_disconnected"})
      .eq("id",sessionId).eq("user_id",ctx.userId)
    return NextResponse.json({ok:true})
  }
  if(body.operation!=="queue") return fail("Operación no permitida",400)
  if(session.status!=="starting" ||
     new Date(String(session.metadata?.expires_at||0)).getTime()<=Date.now())
    return fail("La sesión caducó. Vuelve a vincular tu notebook.",409)
  const spokenText=typeof body.text==="string"?body.text.trim():""
  if(spokenText.length<1||spokenText.length>450) return fail("El texto debe tener entre 1 y 450 caracteres",400)

  const {count} = await db.from("audio_voice_render_jobs").select("id",{count:"exact",head:true})
    .eq("user_id",ctx.userId).eq("voice_profile_id",profileId).eq("status","queued")
    .eq("metadata->>worker_session_id",sessionId)
  if((count||0)>=3) return fail("Ya tienes tres trabajos pendientes",429)

  const src=profile.canonical_audio_path||profile.sample_path
  const {data:reference,error:refError}=await db.storage.from("voice-clones").createSignedUrl(src,3600)
  if(refError||!reference?.signedUrl) return fail("No se pudo obtener la muestra vocal",503)

  const path=ctx.userId+"/"+profileId+"/gpu-"+randomUUID()+".wav"
  const {data:upload,error:uploadError}=await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if(uploadError||!upload?.signedUrl) return fail("La biblioteca no autorizó el audio de salida",503)

  const provider=session.provider.startsWith("colab")?"colab-voice-worker":"kaggle-voice-worker"
  const {data:job,error} = await db.from("audio_voice_render_jobs").insert({
    user_id:ctx.userId,voice_profile_id:profileId,text:spokenText,
    status:"queued",progress:0,stage:"waiting_for_gpu",
    provider,engine:"chatterbox-multilingual-v3",audio_bucket:BUCKET,audio_path:path,
    metadata:{worker_session_id:sessionId,reference_url:reference.signedUrl,
      upload_url:upload.signedUrl,model_kind:"zero-shot-reference"},
  }).select("id").single()
  if(error||!job) return fail("No se pudo crear el trabajo de voz",503)
  return NextResponse.json({ok:true,job_id:job.id,status:"queued"},{
    headers:{"Cache-Control":"private, no-store"}})
}

export async function getVoiceGpuBridge(req: Request) {
  const ctx=await owner()
  if(!ctx.valid||!ctx.userId) return fail("Se requiere MFA y permiso administrativo",403)
  const profileId=new URL(req.url).searchParams.get("profile_id")
  if(!profileId||!UUID.test(profileId)) return fail("Selecciona un perfil vocal",400)
  if(!await ownVoice(ctx.supabase,ctx.userId,profileId)) return fail("Perfil no autorizado",403)
  const {data:rows,error}=await ctx.supabase.from("audio_voice_render_jobs")
    .select("id,provider,status,stage,progress,error,audio_path,created_at,text,metadata")
    .eq("user_id",ctx.userId).eq("voice_profile_id",profileId)
    .in("provider",["kaggle-voice-bridge","colab-voice-bridge","kaggle-voice-worker","colab-voice-worker"])
    .order("created_at",{ascending:false}).limit(25)
  if(error) return fail("La biblioteca no respondió",503)
  const sessions=(rows||[]).filter(r=>r.provider.endsWith("-voice-bridge")).slice(0,4).map(r=>({
    id:r.id,provider:r.provider.startsWith("kaggle")?"kaggle":"colab",
    active:r.status==="starting"&&new Date(String(r.metadata?.expires_at||0)).getTime()>Date.now(),
  }))
  const jobs=await Promise.all((rows||[]).filter(r=>r.provider.endsWith("-voice-worker")).slice(0,12).map(async r=>{
    let audio_url:string|null=null
    if(r.status==="completed"&&r.audio_path){
      const {data}=await ctx.supabase.storage.from(BUCKET).createSignedUrl(r.audio_path,600)
      audio_url=data?.signedUrl||null
    }
    return {id:r.id,provider:r.provider.startsWith("kaggle")?"kaggle":"colab",
      status:r.status,stage:r.stage,progress:r.progress,error:r.error,
      text:r.text,created_at:r.created_at,audio_url}
  }))
  return NextResponse.json({ok:true,sessions,jobs},{
    headers:{"Cache-Control":"private, no-store"}})
}
