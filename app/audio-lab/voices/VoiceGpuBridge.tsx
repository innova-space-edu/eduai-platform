"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardCopy, ExternalLink, Loader2, Mic2, RefreshCw, Wifi, X } from "lucide-react"

type GpuProvider = "kaggle" | "colab"
type VoiceJob = {
  id:string; provider:GpuProvider; status:string; stage:string|null; progress:number
  error:string|null; text:string; created_at:string; audio_url:string|null
}
const ENDPOINT = "/api/agents/audio/voices/profiles?mode=compute"
const WORKERS = {
  kaggle:{
    label:"Kaggle · GPU T4",
    url:"https://www.kaggle.com/code/new",
    notebook:"https://github.com/innova-space-edu/eduai-platform/blob/main/notebooks/eduai_chatterbox_kaggle_bridge.ipynb",
    notes:"Settings → Accelerator → GPU T4 x2; Turn on internet",
  },
  colab:{
    label:"Google Colab · GPU T4",
    url:"https://colab.research.google.com/",
    notebook:"https://github.com/innova-space-edu/eduai-platform/blob/main/notebooks/eduai_chatterbox_colab_bridge.ipynb",
    notes:"Entorno de ejecución → Cambiar tipo → T4 GPU",
  },
}
export default function VoiceGpuBridge({profileId,profileName}:{profileId:string;profileName:string}) {
  const [provider,setProvider]=useState<GpuProvider>("kaggle")
  const [sessionId,setSessionId]=useState("")
  const [pairingCode,setPairingCode]=useState("")
  const [expires,setExpires]=useState("")
  const [text,setText]=useState("Hola. Esta es una prueba de mi voz usando Chatterbox V3 desde EDUAI.")
  const [busy,setBusy]=useState("")
  const [error,setError]=useState("")
  const [message,setMessage]=useState("")
  const [jobs,setJobs]=useState<VoiceJob[]>([])
  const [sessions,setSessions]=useState<{id:string;provider:GpuProvider;active:boolean}[]>([])
  const settings=WORKERS[provider]

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch(ENDPOINT+"&profile_id="+encodeURIComponent(profileId),{cache:"no-store"})
      if(!response.ok) return
      const data=await response.json()
      if(data?.ok){
        setJobs(Array.isArray(data.jobs)?data.jobs:[])
        setSessions(Array.isArray(data.sessions)?data.sessions:[])
      }
    }catch{
      // GPU status is optional; avoid clearing a working UI during brief disconnects.
    }
  },[profileId])
  useEffect(()=>{
    void refresh()
    const timer=window.setInterval(()=>void refresh(),10000)
    return()=>window.clearInterval(timer)
  },[refresh])
  useEffect(()=>{
    setSessionId("")
    setPairingCode("")
    setExpires("")
    setJobs([])
  },[profileId])

  async function command(operation:"connect"|"queue"|"disconnect"){
    setError("")
    setMessage("")
    setBusy(operation)
    try{
      const response=await fetch(ENDPOINT,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({operation,profile_id:profileId,provider,session_id:sessionId,text}),
      })
      const result=await response.json().catch(()=>({}))
      if(!response.ok||!result.ok) throw new Error(result.error||"No se pudo realizar la operación")
      if(operation==="connect"){
        setSessionId(String(result.session_id))
        setPairingCode(String(result.pairing_code))
        setExpires(String(result.expires_at))
        setMessage("Vinculación creada. Copia el código en el notebook y ejecuta su celda de trabajador GPU.")
      }else if(operation==="queue"){
        setMessage("Texto enviado a la cola privada. Mantén el notebook GPU ejecutándose para generar el WAV.")
      }else{
        setSessionId("")
        setPairingCode("")
        setExpires("")
        setMessage("Sesión desconectada; los perfiles y audios guardados se conservan.")
      }
      await refresh()
    }catch(reason){
      setError(reason instanceof Error?reason.message:"No fue posible contactar EDUAI")
    }finally{setBusy("")}
  }

  const active=sessions.find(s=>s.id===sessionId)?.active!==false &&
    !!sessionId && new Date(expires).getTime()>Date.now()
  return <section className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3" aria-label={"Chatterbox GPU de "+profileName}>
    <div>
      <h3 className="text-sm font-bold flex gap-2 items-center"><Mic2 size={15}/> Generar audio desde EDUAI con mi voz</h3>
      <p className="mt-1 text-xs text-muted2">
        Chatterbox V3 usa la muestra del perfil «{profileName}»; no necesita entrenar un modelo por frase.
        El notebook se ejecuta solo mientras tú mantengas encendida la GPU. Acceso administrativo con MFA.
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      {(["kaggle","colab"] as GpuProvider[]).map(item=>
        <button key={item} type="button" onClick={()=>{if(item!==provider){setProvider(item);setSessionId("");setPairingCode("");setExpires("");}}}
          className={"rounded-xl border px-3 py-2 text-xs font-semibold "+(provider===item?"border-purple-500 bg-purple-500/15":"border-soft")}>
          {WORKERS[item].label}
        </button>)}
    </div>
    <p className="text-xs text-muted2">{settings.notes}. Guarda el cuaderno como privado.</p>
    <div className="flex flex-wrap gap-2">
      <a className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-1"
        target="_blank" rel="noopener noreferrer" href={settings.url}><ExternalLink size={13}/> Abrir {provider==="kaggle"?"Kaggle":"Colab"}</a>
      <a className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-1"
        target="_blank" rel="noopener noreferrer" href={settings.notebook}><ExternalLink size={13}/> Notebook EDUAI {provider}</a>
      <button type="button" onClick={()=>void command("connect")} disabled={!!busy}
        className="rounded-xl bg-purple-600 px-3 py-2 text-white text-xs font-semibold disabled:opacity-50 flex gap-1 items-center">
        {busy==="connect"?<Loader2 size={13} className="animate-spin"/>:<Wifi size={13}/>} Crear código de conexión
      </button>
    </div>
    {pairingCode&&active&&<div className="rounded-xl border border-purple-500/20 p-3 space-y-2">
      <p className="text-xs font-semibold">Código temporal del notebook (caduca en dos horas)</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Código temporal privado" className="flex-1 min-w-0 rounded-lg border border-soft bg-app px-2 py-2 text-xs"
          value={pairingCode} readOnly/>
        <button type="button" onClick={()=>void navigator.clipboard.writeText(pairingCode)}
          className="rounded-lg border border-soft px-3 py-2 text-xs flex items-center gap-1"><ClipboardCopy size={13}/> Copiar</button>
      </div>
      <p className="text-xs text-muted2">Pega el código en la celda que lo solicita, no en el código fuente del notebook. No publiques el cuaderno ni compartas este código.</p>
    </div>}
    <div className="space-y-2">
      <label htmlFor={"voice-text-"+profileId} className="text-xs font-semibold">¿Qué quieres que diga tu voz?</label>
      <textarea id={"voice-text-"+profileId} value={text} maxLength={450} rows={3}
        onChange={e=>setText(e.target.value)}
        className="w-full resize-y rounded-xl bg-app border border-soft p-3 text-sm"/>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted2">{text.length}/450 caracteres</span>
        <div className="flex gap-2">
          {active&&<button type="button" onClick={()=>void command("disconnect")} disabled={!!busy}
            className="rounded-xl border border-soft px-3 py-2 text-xs flex gap-1 items-center"><X size={13}/> Desconectar</button>}
          <button type="button" disabled={!active||!!busy||!text.trim()} onClick={()=>void command("queue")}
            className="rounded-xl bg-purple-600 px-3 py-2 text-white font-semibold text-xs disabled:opacity-50 flex gap-1 items-center">
            {busy==="queue"?<Loader2 size={13} className="animate-spin"/>:<Mic2 size={13}/>} Generar audio
          </button>
        </div>
      </div>
    </div>
    {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
    {message&&<p className="text-xs text-emerald-700">{message}</p>}
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <h4 className="font-semibold text-xs">Generaciones recientes</h4>
        <button type="button" onClick={()=>void refresh()} className="text-xs underline flex gap-1 items-center">
          <RefreshCw size={12}/> Actualizar</button>
      </div>
      {jobs.length===0?<p className="text-xs text-muted2">Todavía no hay audios generados desde la página.</p>:
        jobs.map(job=><div key={job.id} className="rounded-xl border border-soft p-3 space-y-2">
          <div className="flex justify-between flex-wrap text-xs gap-2">
            <span className="font-semibold">{job.provider==="kaggle"?"Kaggle":"Colab"} · {job.status==="completed"?"Terminado":
              job.status==="queued"?"En espera de GPU":job.status==="generating"?"Generando":job.status==="failed"?"Error":job.status}</span>
            <span className="text-muted2">{new Date(job.created_at).toLocaleString("es-CL")}</span>
          </div>
          <p className="text-xs text-muted2">{job.text}</p>
          {job.error&&<p className="text-xs text-red-600">{job.error}</p>}
          {job.audio_url&&<div className="space-y-1">
            <audio controls src={job.audio_url} preload="none" className="w-full h-9"/>
            <a href={job.audio_url} target="_blank" rel="noopener noreferrer"
              className="text-xs underline text-purple-700">Abrir WAV para descargar</a>
          </div>}
        </div>)}
    </div>
  </section>
}
