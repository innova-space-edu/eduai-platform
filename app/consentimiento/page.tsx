"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import PrivacyConsentPanel, { EMPTY_OPTIONAL_PRIVACY_CHOICES, PRIVACY_TERMS_VERSION,
  type OptionalPrivacyChoices } from "@/components/legal/PrivacyConsentPanel"
import LegalFooter from "@/components/legal/LegalFooter"

export default function FirstConsentPage() {
  const router = useRouter()
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState("")
  const [acceptedTerms,setAcceptedTerms] = useState(false)
  const [acknowledgedDataWarning,setAcknowledgedDataWarning] = useState(false)
  const [optionalChoices,setOptionalChoices] = useState<OptionalPrivacyChoices>({...EMPTY_OPTIONAL_PRIVACY_CHOICES})
  const [minor,setMinor] = useState(true)

  useEffect(()=>{
    let active=true
    const check = async () => {
      const supabase=createClient()
      const { data:{ user }, error: authError }=await supabase.auth.getUser()
      if (!user || authError) {router.replace("/login");return}
      const birth=String(user.user_metadata?.birth_date||"")
      const date=new Date(birth+"T00:00:00")
      const today=new Date()
      const isMinor=!birth||Number.isNaN(date.getTime())||
        date>new Date(today.getFullYear()-18,today.getMonth(),today.getDate())
      if(active)setMinor(isMinor)
      const {data:existing,error:readError}=await supabase.from("eduai_privacy_choices")
        .select("policy_version,terms_acknowledged_at,data_warning_acknowledged_at")
        .eq("user_id",user.id).maybeSingle()
      if (!active)return
      if(readError){setError("No fue posible verificar el consentimiento anterior. Intenta recargar.");setLoading(false);return}
      if(existing?.policy_version===PRIVACY_TERMS_VERSION&&existing.terms_acknowledged_at&&existing.data_warning_acknowledged_at){
        router.replace(isMinor?"/autorizacion-pendiente":"/dashboard")
        return
      }
      setLoading(false)
    }
    void check()
    return ()=>{active=false}
  },[router])

  async function saveConsent(event:React.FormEvent) {
    event.preventDefault()
    if(!acceptedTerms||!acknowledgedDataWarning){
      setError("Debes reconocer las condiciones necesarias y la advertencia de datos.")
      return
    }
    setSaving(true);setError("")
    const supabase=createClient()
    const { error:rpcError }=await supabase.rpc("record_eduai_privacy_choices",{
      p_policy_version:PRIVACY_TERMS_VERSION,
      p_terms_acknowledged:true,
      p_data_warning_acknowledged:true,
      p_choices:minor?EMPTY_OPTIONAL_PRIVACY_CHOICES:optionalChoices
    })
    if(rpcError){
      setError("No se pudo guardar la aceptación. No se activó ningún permiso. Intenta nuevamente.")
      setSaving(false)
      return
    }
    router.replace(minor?"/autorizacion-pendiente":"/dashboard")
    router.refresh()
  }

  return <main className="min-h-screen bg-app px-4 py-8 text-main">
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Condiciones y preferencias de privacidad</h1>
      <p className="text-sm text-sub">
        Este formulario se solicita una sola vez por versión vigente. Tus preferencias opcionales
        se guardarán en tu cuenta y podrás modificarlas después desde Configuración del perfil.
        Una nueva sesión no cambia tus decisiones ni la fecha de aceptación.
      </p>
      {loading?<p>Cargando preferencias…</p>:<form onSubmit={saveConsent} className="space-y-4">
        <PrivacyConsentPanel
          acceptedTerms={acceptedTerms} onAcceptedTerms={setAcceptedTerms}
          acknowledgedDataWarning={acknowledgedDataWarning}
          onAcknowledgedDataWarning={setAcknowledgedDataWarning}
          value={optionalChoices} onChange={setOptionalChoices} minorRestricted={minor}/>
        {error&&<p role="alert" className="rounded-xl border border-red-300 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={saving||!acceptedTerms||!acknowledgedDataWarning}
          className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40">
          {saving?"Registrando…":"Guardar decisiones y continuar"}
        </button>
      </form>}
      {loading&&error&&<p role="alert" className="text-red-700">{error}</p>}
      <Link href="/privacidad" className="text-sm text-blue-600 underline">Consultar política de privacidad</Link>
      <LegalFooter compact/>
    </div>
  </main>
}
