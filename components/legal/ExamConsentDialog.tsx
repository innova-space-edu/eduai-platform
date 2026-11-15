"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { EMPTY_OPTIONAL_PRIVACY_CHOICES, PRIVACY_TERMS_VERSION, PrivacyPreferences, type OptionalPrivacyChoices } from "@/components/legal/PrivacyConsentPanel"

export default function ExamConsentDialog({onClose,onComplete,retryPublish=false}:{onClose:()=>void;onComplete:()=>void;retryPublish?:boolean}) {
 const dialog=useRef<HTMLDialogElement>(null)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("")
 const [terms,setTerms]=useState(false),[warning,setWarning]=useState(false),[restricted,setRestricted]=useState(true)
 const [choices,setChoices]=useState<OptionalPrivacyChoices>({...EMPTY_OPTIONAL_PRIVACY_CHOICES})
 const [alreadyAccepted,setAlreadyAccepted]=useState(false),[statusReady,setStatusReady]=useState(false)
 useEffect(()=>{
   const node=dialog.current;node?.showModal()
   let live=true
   void (async()=>{
     try{
       const res=await fetch("/api/privacy/self",{cache:"no-store"})
       const data=await res.json()
       if(!res.ok)throw Error(data.error||"No se pudieron consultar las condiciones.")
       if(live){setRestricted(data.minorRestricted===true);setChoices({...EMPTY_OPTIONAL_PRIVACY_CHOICES,...data.choices});setAlreadyAccepted(data.accepted===true);setStatusReady(true)}
     }catch(e){if(live)setError(e instanceof Error?e.message:"No se pudo consultar la aceptación.")}
     finally{if(live)setLoading(false)}
   })()
   return ()=>{live=false;node?.close()}
 },[])
 async function save(){
   if(saving||loading||!statusReady||(!alreadyAccepted&&(!terms||!warning)))return
   setSaving(true);setError("")
   try{
     if(!alreadyAccepted){
       const {error:rpcError}=await createClient().rpc("record_eduai_privacy_choices",{
         p_policy_version:PRIVACY_TERMS_VERSION,p_terms_acknowledged:true,p_data_warning_acknowledged:true,
         p_choices:restricted?EMPTY_OPTIONAL_PRIVACY_CHOICES:choices
       })
       if(rpcError)throw Error("No se pudo registrar la aceptación. Revisa tus permisos en Configuración del perfil.")
     }
     const res=await fetch("/api/privacy/self",{cache:"no-store"})
     const data=await res.json()
     if(!res.ok||data.accepted!==true)throw Error("No se pudo confirmar el registro. Tu borrador sigue guardado.")
     onComplete()
   }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la aceptación.")}
   finally{setSaving(false)}
 }
 return <dialog ref={dialog} aria-labelledby="exam-consent-title" onCancel={e=>{e.preventDefault();if(!saving)onClose()}} className="m-auto max-h-[90dvh] w-[min(94vw,560px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
  <div className="flex items-start justify-between gap-3"><h2 id="exam-consent-title" className="text-lg font-bold">Condiciones para publicar</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg border px-2 py-1 text-sm">✕</button></div>
  <p className="my-3 text-sm text-slate-600">Registra las condiciones vigentes una sola vez en tu cuenta. El examen no se pierde.</p>
  {loading?<p role="status" className="text-sm">Consultando aceptación…</p>:alreadyAccepted?<p className="text-sm text-emerald-700">Tu cuenta ya tiene las condiciones vigentes registradas.</p>:<>
    <p className="mb-3 text-xs text-slate-600">Consulta las <Link href="/terminos" target="_blank" className="text-blue-700 underline">condiciones de uso</Link>, la <Link href="/privacidad" target="_blank" className="text-blue-700 underline">política de privacidad</Link> y las <Link href="/gobernanza-ia" target="_blank" className="text-blue-700 underline">reglas de IA</Link>.</p>
    <label className="my-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} className="mt-1"/><span>He leído y acepto las condiciones necesarias del servicio (versión {PRIVACY_TERMS_VERSION}).</span></label>
    <label className="my-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={warning} onChange={e=>setWarning(e.target.checked)} className="mt-1"/><span>Comprendo que no debo enviar RUT, diagnósticos, expedientes, notas identificables ni otros datos sensibles innecesarios a la IA. Este reconocimiento no implica renunciar a mis derechos.</span></label>
    {!restricted&&<details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Permisos opcionales de IA y estadísticas</summary><div className="mt-3"><PrivacyPreferences value={choices} onChange={setChoices}/></div></details>}
    {restricted&&<p className="text-xs text-slate-600">Los permisos opcionales requieren edad registrada y las autorizaciones correspondientes. No son necesarios para publicar manualmente.</p>}
  </>}
  {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
  <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-3 py-2 text-sm">Volver al examen</button><button type="button" disabled={loading||saving||!statusReady||(!alreadyAccepted&&(!terms||!warning))} onClick={()=>void save()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving?"Registrando…":retryPublish?"Guardar y publicar":"Guardar condiciones"}</button></div>
 </dialog>
}
