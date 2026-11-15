import { createClient } from "@/lib/supabase/server"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"
import { hasLegacyConsentGrace } from "@/lib/family-consent/transition"

export async function GET() {
  const session = await createClient()
  const { data: { user }, error } = await session.auth.getUser()
  if (error || !user) return privateResponse({ error: "Debes iniciar sesión." }, 401)
  try {
    const admin = createFamilyAdminClient()
    const [privacy, age, role] = await Promise.all([
      session.from("eduai_privacy_choices").select("policy_version,terms_acknowledged_at,data_warning_acknowledged_at,ai_generation,ai_documents,ai_voice,optional_analytics").eq("user_id",user.id).maybeSingle(),
      admin.from("family_age_status").select("declared_birth_date").eq("user_id",user.id).maybeSingle(),
      user.email ? admin.from("admin_emails").select("email").eq("email",user.email).maybeSingle() : Promise.resolve({data:null,error:null}),
    ])
    if (privacy.error || age.error || role.error) return privateResponse({error:"No fue posible consultar tus condiciones."},503)
    const birth=String(age.data?.declared_birth_date||"")
    const date=new Date(birth+"T00:00:00")
    const now=new Date()
    const minorRestricted=!birth||Number.isNaN(date.getTime())||date>new Date(now.getFullYear()-18,now.getMonth(),now.getDate())
    const row=privacy.data
    const accepted=row?.policy_version==="2026-10-11-v1"&&Boolean(row.terms_acknowledged_at&&row.data_warning_acknowledged_at)
    // The original event is an immutable receipt, not a new acceptance on every login.
    const receipt=accepted?await session.from("eduai_privacy_choice_events").select("id,recorded_at").eq("user_id",user.id).eq("policy_version",row!.policy_version).in("event_type",["signup_declarations","preferences_recorded"]).order("recorded_at",{ascending:true}).order("id",{ascending:true}).limit(1).maybeSingle():null
    if(receipt?.error)return privateResponse({error:"No fue posible consultar el acta de aceptación."},503)
    return privateResponse({acta:receipt?.data?{folio:"ACTA-PRIV-"+receipt.data.id,recordedAt:receipt.data.recorded_at}:null,acceptedAt:row?.terms_acknowledged_at||null,accepted,required:!accepted&&!hasLegacyConsentGrace(user.created_at),minorRestricted,isAdmin:Boolean(role.data),choices:{ai_generation:row?.ai_generation===true,ai_documents:row?.ai_documents===true,ai_voice:row?.ai_voice===true,optional_analytics:row?.optional_analytics===true}})
  } catch {
    return privateResponse({error:"No fue posible consultar tus condiciones."},503)
  }
}
