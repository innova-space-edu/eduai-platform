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
  const [adminReturn,setAdminReturn] = useState(false)
  const [alreadyAccepted,setAlreadyAccepted] = useState(false)
  const [statusReady,setStatusReady] = useState(false)

  useEffect(()=>{
    let active=true
    const check = async () => {
      const supabase=createClient()
      const { data:{ user }, error: authError }=await supabase.auth.getUser()
      if (!user || authError) {router.replace("/login");return}
      try{
        const res=await fetch("/api/privacy/self",{cache:"no-store"})
        const status=await res.json()
        if(!active)return
        if(!res.ok)throw Error(status.error||"No fue posible verificar el consentimiento anterior.")
        const isAdmin=status.isAdmin===true
        const isMinor=status.minorRestricted===true
        setMinor(isMinor)
        setAdminReturn(isAdmin&&(isMinor||new URLSearchParams(window.location.search).get("return")==="admin"))
        setOptionalChoices({...EMPTY_OPTIONAL_PRIVACY_CHOICES,...status.choices})
        setStatusReady(true)
        if(status.accepted===true){
          if(isAdmin&&new URLSearchParams(window.location.search).get("return")==="admin"){
            setAlreadyAccepted(true);setLoading(false);return
          }
          router.replace(isAdmin&&isMinor?"/admin":isMinor?"/autorizacion-pendiente":"/dashboard")
          return
        }
      }catch(e){
        if(active)setError(e instanceof Error?e.message:"No fue posible consultar tus condiciones.")
      }
      setLoading(false)
    }
    void check()
    return ()=>{active=false}
  },[router])

  async function saveConsent(event:React.FormEvent) {
    event.preventDefault()
    if(!statusReady||!acceptedTerms||!acknowledgedDataWarning){
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
    const verification=await fetch("/api/privacy/self",{cache:"no-store"}).then(async res=>res.ok?res.json():null).catch(()=>null)
    if(verification?.accepted!==true){setError("No fue posible confirmar el registro. Recarga para comprobarlo.");setSaving(false);return}
    router.replace(adminReturn?"/admin":minor?"/autorizacion-pendiente":"/dashboard")
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
      {loading?<p>Cargando preferencias…</p>:alreadyAccepted?<div className="space-y-3 rounded-xl border border-emerald-300 p-4"><p className="font-semibold text-emerald-700">Tu cuenta tiene las condiciones vigentes registradas.</p><Link href="/admin" className="block text-sm text-blue-600 underline">Volver a Administración</Link><Link href="/profile/settings" className="block text-sm text-blue-600 underline">Consultar preferencias e historial</Link></div>:<form onSubmit={saveConsent} className="space-y-4">
        <PrivacyConsentPanel
          acceptedTerms={acceptedTerms} onAcceptedTerms={setAcceptedTerms}
          acknowledgedDataWarning={acknowledgedDataWarning}
          onAcknowledgedDataWarning={setAcknowledgedDataWarning}
          value={optionalChoices} onChange={setOptionalChoices} minorRestricted={minor}/>
        {error&&<p role="alert" className="rounded-xl border border-red-300 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={saving||!statusReady||!acceptedTerms||!acknowledgedDataWarning}
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
