import { NextRequest } from "next/server"
import { createClient as sessionClient } from "@/lib/supabase/server"
import { createFamilyAdminClient, createInvitationToken, privateResponse, safeEmail } from "@/lib/family-consent/server"
import { sendGuardianConsentEmail } from "@/lib/family-consent/email"
import { FAMILY_CONSENT_VERSION } from "@/lib/family-consent/config"

export const runtime = "nodejs"
const PLATFORM = "eduai" as const
export async function POST(req: NextRequest) {
 try {
   const auth = await sessionClient()
   const { data: { user }, error } = await auth.auth.getUser()
   if (error || !user) return privateResponse({ error: "Inicia sesión para solicitar la autorización familiar." }, 401)
   const db = createFamilyAdminClient()
   const { data: lockedAge, error: lockedError } = await db.from("family_age_status")
     .select("declared_birth_date").eq("user_id",user.id).maybeSingle()
   if (lockedError) return privateResponse({error:"No se pudo verificar la edad de la cuenta."},503)
   const rawDOB = String(lockedAge?.declared_birth_date || "")
   const dob = new Date(rawDOB + "T00:00:00")
   const today = new Date()
   const minor = rawDOB && !Number.isNaN(dob.getTime()) &&
      dob > new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
   if (!minor) return privateResponse({ error: "No se puede confirmar que la cuenta corresponda a un menor." }, 409)
   const email = safeEmail(user.user_metadata?.guardian_email)
   if (!email || email === user.email?.toLowerCase()) return privateResponse({ error: "Falta un correo diferente del estudiante para el representante legal." }, 400)
   // Never claim dispatch success if a verified transactional sender is unavailable.
   if (!process.env.RESEND_API_KEY || !process.env.FAMILY_CONSENT_FROM_EMAIL) {
     return privateResponse({ error: "Envío pendiente: correo institucional no configurado." }, 503)
   }
   const { data: previous, error: previousError } = await db.from("family_authorization_requests")
     .select("id,status,issued_at,expires_at,guardian_email")
     .eq("student_user_id",user.id).eq("platform",PLATFORM)
     .order("issued_at",{ascending:false}).limit(1).maybeSingle()
   if (previousError) return privateResponse({ error: "No se pudo verificar el estado de la autorización." }, 503)
   if (previous?.status === "approved" && previous.guardian_email === email)
     return privateResponse({ status:"approved", message:"Existe autorización institucional vigente." })
   if (previous && ["invited","submitted"].includes(previous.status) &&
       previous.guardian_email === email && Date.now()-Date.parse(previous.issued_at)<24*3600000 &&
       Date.parse(previous.expires_at)>Date.now())
     return privateResponse({ status:previous.status, message:"Existe una invitación reciente o un documento en revisión. Solicita ayuda a administración si no fue recibido." })
   const {token,tokenHash} = createInvitationToken()
   const expiry = new Date(Date.now()+7*86400000).toISOString()
   const {data:created,error:createError} = await db.from("family_authorization_requests")
     .insert({student_user_id:user.id,platform:PLATFORM,
       institution_name: PLATFORM==="sello"?"Colegio Providencia":"Innova Space Edu SpA",
       guardian_email:email,token_sha256:tokenHash,document_version:FAMILY_CONSENT_VERSION,
       status:"invited",expires_at:expiry,issued_by:user.id,
     }).select("id").single()
   if(createError||!created) return privateResponse({error:"No se pudo crear la solicitud familiar."},503)
   const link = new URL("/autorizacion-familiar/"+encodeURIComponent(token),req.url).toString()
   try {
     await sendGuardianConsentEmail(email,link,PLATFORM)
   } catch {
     await db.from("family_authorization_requests").update({status:"rejected",decision_note:"Fallo técnico de entrega; reintentar nueva solicitud",updated_at:new Date().toISOString()}).eq("id",created.id).eq("status","invited")
     return privateResponse({error:"No se confirmó el envío. La cuenta permanecerá bloqueada; reintenta más tarde."},503)
   }
   await db.from("family_authorization_events").insert({
     request_id:created.id,event_type:"guardian_email_provider_accepted",
     evidence_json:{sent_at:new Date().toISOString(),channel:"email",provider:"resend",delivery_verified:false},
   })
   return privateResponse({status:"invited",message:"El proveedor de correo aceptó la invitación. El menor seguirá sin acceso hasta la firma, entrega y validación institucional."})
 } catch {
   return privateResponse({error:"No se pudo tramitar la invitación."},503)
 }
}
