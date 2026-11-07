"use client"
import {useState,useEffect} from "react"
export default function TrainingContributionPage(){
  const [state,setState]=useState<{enabled:boolean;eligible:boolean;policyVersion:string}|null>(null)
  const [accepted,setAccepted]=useState(false),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false)
  useEffect(()=>{void fetch("/api/ai/training",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setState(d)}).catch(e=>setNotice(e.message))},[])
  async function save(enabled:boolean){setBusy(true);try{const r=await fetch("/api/ai/training",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"consent",enabled,accepted,policyVersion:state?.policyVersion})});const d=await r.json();if(!r.ok)throw new Error(d.error);setState(s=>s?{...s,enabled}:s);setNotice(enabled?"Aportación activada.":"Aportación retirada. Se eliminaron los candidatos y se invalidaron las exportaciones vinculadas.")}catch(e){setNotice(e instanceof Error?e.message:"Error")}finally{setBusy(false)}}
  return <main className="mx-auto max-w-2xl space-y-5 p-8"><a href="/dashboard" className="underline">Volver a EDUAI</a><h1 className="text-2xl font-bold">Ayuda a mejorar EDUAI</h1>
    <p>Si eres adulto, puedes autorizar el uso de tus próximas preguntas y respuestas de texto como candidatos para entrenar los modelos propios de EDUAI. También puedes aportar correcciones desde los chats. Es opcional y no cambia tu acceso al servicio.</p>
    <p>Los candidatos pasan por filtros y revisión antes de exportarlos a un notebook privado en Kaggle. No se recogen archivos adjuntos, voces, conversaciones entre personas ni el historial completo. No incluyas nombres, datos de estudiantes, salud, credenciales o contenidos de terceros sin autorización.</p>
    <p>Los candidatos caducan a los 90 días. Puedes retirar tu autorización y eliminar los candidatos pendientes. La retirada invalida futuras exportaciones; no puede deshacer una descarga ya realizada ni retirar por sí sola lo aprendido en un modelo anterior. Esos modelos deben revisarse antes de reutilizarlos.</p>
    {state&&<><p>Estado: {state.enabled?"Activado":"Desactivado"}</p>{!state.eligible&&<p>Para aportar necesitas tener al menos 18 años y tu fecha de nacimiento registrada en el perfil.</p>}
    {!state.enabled&&<label className="flex gap-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Autorizo voluntariamente esta finalidad y la transferencia de ejemplos revisados a Kaggle para entrenar modelos de EDUAI.</label>}
    <button className="rounded border p-3" disabled={busy||(!state.enabled&&(!state.eligible||!accepted))} onClick={()=>void save(!state.enabled)}>{state.enabled?"Retirar autorización y eliminar aportes":"Activar aportación"}</button></>}
    {notice&&<p role="status">{notice}</p>}
  </main>
}
