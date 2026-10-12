"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
export default function FamilyAuthorizationPending() {
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState("")
 const router=useRouter()
 const automaticRequestStarted=useRef(false)
 const verifyOrSend = useCallback(async () => {
  setBusy(true);setMessage("")
  try {
   const result=await fetch("/api/family-consent/self/invite",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store"})
   const data=await result.json().catch(()=>({}))
   if(!result.ok){setMessage(data.error||"No se pudo solicitar el envío.");return}
   if(data.status==="approved"){router.push("/dashboard");router.refresh();return}
   setMessage(data.message||"El formulario está pendiente de firma y aprobación institucional.")
  } catch {setMessage("No se pudo contactar al servidor. Intenta nuevamente.")} finally{setBusy(false)}
 }, [router])
 useEffect(() => {
  if (automaticRequestStarted.current) return
  automaticRequestStarted.current = true
  void verifyOrSend()
 }, [verifyOrSend])
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
  <div className="w-full max-w-xl space-y-4 rounded-3xl border bg-white p-8 shadow-sm">
   <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Protección de estudiantes</p>
   <h1 className="text-2xl font-bold">Acceso restringido hasta autorización familiar</h1>
   <p className="text-sm leading-6">
    No podrás entrar a la plataforma hasta que un representante con facultades legales
    reciba el cuestionario, lo firme y envíe, y la institución compruebe su identidad y
    representación y apruebe expresamente el acceso.
   </p>
   <p className="text-sm leading-6">
    La firma enviada se registra inicialmente como pendiente, no como autorización
    aprobada. Al ingresar se intenta enviar el correo automáticamente. Si no llegó, puedes revisarlo o solicitar un reintento con el botón.
    El enlace no sustituye la verificación institucional.
   </p>
   <button type="button" onClick={verifyOrSend} disabled={busy}
    className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
    {busy?"Verificando…":"Verificar autorización o solicitar correo"}
   </button>
   {message && <p role="status" className="rounded-xl border bg-slate-100 p-3 text-sm">{message}</p>}
   <p className="text-xs text-slate-600">
    El envío requiere el servicio de correo institucional. El establecimiento puede
    ayudarte a confirmar el destinatario y comprobar la autorización.
    Si no existe un fundamento legal para tratar cierta información, la institución
    debe ofrecer la alternativa correspondiente.
   </p>
   <a href="mailto:contacto@innova-space-edu.cl?subject=Autorizacion%20familiar%20pendiente"
    className="inline-flex text-sm font-semibold text-blue-700 underline">Contactar soporte Innova</a>
  </div>
 </main>
}