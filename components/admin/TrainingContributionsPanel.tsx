"use client"
import {useEffect,useState} from "react"
type Candidate={id:string;source_module:string;origin:string;rating:string|null;status:string;messages:Array<{role:string;content:string}>}
type Run={id:string;status:string;kaggle_url:string;report:Record<string,unknown>}
export default function TrainingContributionsPanel(){
  const [rows,setRows]=useState<Candidate[]>([]),[runs,setRuns]=useState<Run[]>([]),[notice,setNotice]=useState("")
  const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false)
  async function load(){try{const r=await fetch("/api/admin/ai-core/training",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.candidates);setRuns(d.runs)}catch(e){setNotice(e instanceof Error?e.message:"Error")}}
  useEffect(()=>{void load()},[])
  async function action(body:Record<string,unknown>){setBusy(true);try{const r=await fetch("/api/admin/ai-core/training",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);if(body.action==="export"){const url=URL.createObjectURL(new Blob([JSON.stringify(d)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="eduai-reviewed-training.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`Exportados ${d.train.length} ejemplos para entrenamiento y ${d.validation.length} para validación.`)}else{setNotice("Revisión guardada");await load()}}catch(e){setNotice(e instanceof Error?e.message:"Error")}finally{setBusy(false)}}
  return <section className="mt-5 space-y-3 rounded-2xl border border-white/10 p-4"><h3 className="font-bold">Aprendizaje con aportes y correcciones</h3>
    <p className="text-sm opacity-70">Textos de adultos que autorizaron participar. Las generaciones y votos positivos requieren revisión; las respuestas incorrectas se excluyen. Se muestran los 50 candidatos más recientes.</p>
    <a className="text-sm underline" href="/training-contribution">Gestionar mi aportación</a>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>void load()}>Actualizar</button><button type="button" disabled={busy} onClick={()=>void action({action:"export"})}>Exportar aprobados para Kaggle</button></div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} />Antes de aprobar, comprobé exactitud pedagógica, ausencia de datos personales y derechos de uso.</label>
    {rows.map(row=><details key={row.id} className="rounded border border-white/10 p-2"><summary>{row.source_module} · {row.status} · {row.rating||row.origin}</summary><div className="space-y-2 whitespace-pre-wrap p-2 text-xs">{Array.isArray(row.messages)&&row.messages.map((m,i)=><p key={i}><strong>{m?.role}: </strong>{typeof m?.content==="string"?m.content:"Contenido inválido"}</p>)}</div><div className="flex gap-3"><button type="button" disabled={busy||!reviewed||row.rating==="incorrect"} onClick={()=>void action({action:"review",id:row.id,status:"approved",reviewedSafe:true})}>Aprobar</button><button type="button" disabled={busy} onClick={()=>void action({action:"review",id:row.id,status:"rejected",reviewedSafe:true})}>Excluir</button></div></details>)}
    {!rows.length&&<p className="text-sm">Todavía no hay candidatos. Activa tu aportación y usa los chats o el planificador.</p>}
    {runs.map(run=><p key={run.id} className="text-xs"><a className="underline" href={run.kaggle_url} target="_blank" rel="noopener noreferrer">Kaggle · {run.status}</a> · {String(run.report.stage||"piloto")}</p>)}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>
}
