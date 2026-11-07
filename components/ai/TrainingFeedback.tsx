"use client"
import { useState } from "react"
type Props={answer:string;prompt?:string;module?:string}
export default function TrainingFeedback({answer,prompt="",module="chat"}:Props) {
  const [rating,setRating]=useState<"useful"|"incorrect"|"corrected"|null>(null)
  const [question,setQuestion]=useState(prompt)
  const [correction,setCorrection]=useState("")
  const [confirmed,setConfirmed]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState("")
  async function submit() {
    if(!rating||!confirmed) return
    setBusy(true);setNotice("")
    try {
      const response=await fetch("/api/ai/training",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"feedback",rating,prompt:question,answer,correction,module})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||"No se pudo enviar")
      setNotice(rating==="incorrect"?"Respuesta descartada para entrenamiento.":"Aporte recibido. Queda pendiente de revisión.");setRating(null)
    } catch(error){setNotice(error instanceof Error?error.message:"No se pudo enviar")}
    finally{setBusy(false)}
  }
  if(!answer.trim()) return null
  return <div className="mt-2 border-t border-slate-400/15 pt-2 text-xs" aria-label="Valorar respuesta para mejorar EDUAI">
    <div className="flex flex-wrap gap-3"><span className="opacity-60">Mejorar EDUAI:</span>
      <button type="button" onClick={()=>setRating("useful")}>Útil</button>
      <button type="button" onClick={()=>setRating("incorrect")}>Incorrecta</button>
      <button type="button" onClick={()=>setRating("corrected")}>Corregir respuesta</button>
    </div>
    {rating&&<div className="mt-2 grid gap-2">
      <label>Pregunta o instrucción, sin datos personales<textarea className="mt-1 w-full rounded border border-slate-400/30 bg-transparent p-2" value={question} maxLength={24000} onChange={e=>setQuestion(e.target.value)} /></label>
      {rating==="corrected"&&<label>Respuesta correcta<textarea className="mt-1 w-full rounded border border-slate-400/30 bg-transparent p-2" value={correction} maxLength={24000} onChange={e=>setCorrection(e.target.value)} /></label>}
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />Revisé el contenido: no incluye datos personales ni material que no pueda aportar.</label>
      <p>Participación voluntaria de adultos. <a className="underline" href="/training-contribution" target="_blank" rel="noopener noreferrer">Autorizar o retirar aportes al entrenamiento</a>.</p>
      <div className="flex gap-3"><button type="button" disabled={busy||!confirmed||question.trim().length<8||(rating==="corrected"&&correction.trim().length<12)} onClick={()=>void submit()}>{busy?"Enviando…":"Enviar valoración"}</button><button type="button" onClick={()=>setRating(null)}>Cancelar</button></div>
    </div>}
    {notice&&<p role="status" className="mt-2">{notice}</p>}
  </div>
}
