"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import LabExactVerifier from "./LabExactVerifier";
import {
  Activity, AlertCircle, ArrowUpRight, BrainCircuit, Calculator, Check, CheckCircle2,
  Clock3, Copy, Download, FlaskConical, LoaderCircle, Play, RefreshCw, RotateCcw,
  Send, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, WifiOff,
} from "lucide-react";

type ModelId = "nano-r2"|"lite-r2"|"nano-r5"|"lite-r5";
type Selection = "nano"|"lite"|"compare";
type Version = "r2"|"r5";
type LabMode = "raw"|"exact";
type ModelStatus = {
  id:ModelId;name:string;version:"R2"|"R5";parameters:string;
  available:boolean;approved:boolean;loaded:boolean;
};
type Status = {online:boolean;reason?:string|null;serviceConfigured:boolean;models:ModelStatus[]};
type Answer = {model:ModelId;ok:boolean;text?:string;error?:string;latencyMs?:number;promptTokens?:number|null;completionTokens?:number|null;engine?:string};
type Reference = {supported:boolean;verified:boolean;answer?:string;steps?:string[];reason?:string};
type Turn = {id:string;prompt:string;version:Version;mode:LabMode;responses:Answer[];reference:Reference|null;at:string};
type Feedback = {key:string;model:ModelId;prompt:string;answer:string;rating:"useful"|"incorrect";at:string;source:"admin-model-lab"};
const HISTORY_KEY = "eduai-model-lab-r2-session-v1";
const FEEDBACK_KEY = "eduai-model-lab-manual-feedback-v1";
const EXAMPLES = [
  {name:"Álgebra",question:"Resuelve 3x + 7 = 22 y explica el procedimiento."},
  {name:"Porcentajes",question:"Calcula 20% de 146."},
  {name:"Razonamiento",question:"¿Por qué un sistema de ecuaciones puede tener infinitas soluciones?"},
  {name:"Química",question:"Explica la diferencia entre átomo, ion y molécula con ejemplos."},
];
const MODEL_ORDER:ModelId[]=["nano-r2","lite-r2","nano-r5","lite-r5"];
function title(id:ModelId){return id.startsWith("nano")?"EDUAI Nano":"EDUAI Lite"}
function color(id:ModelId){return id.startsWith("nano")?"cyan":"violet"}
function cls(id:ModelId){return color(id)==="cyan"?"border-cyan-400/25 bg-cyan-400/5":"border-violet-400/25 bg-violet-400/5"}
function answerKey(turnId:string,model:ModelId){return turnId+":"+model}
function exportJson(filename:string,value:unknown){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function NanoLitePlayground() {
  const [status,setStatus]=useState<Status|null>(null);
  const [checking,setChecking]=useState(false);
  const [selection,setSelection]=useState<Selection>("compare");
  const [version,setVersion]=useState<Version>("r2");
  const [mode,setMode]=useState<LabMode>("raw");
  const [prompt,setPrompt]=useState(EXAMPLES[0].question);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [turns,setTurns]=useState<Turn[]>([]);
  const [feedback,setFeedback]=useState<Feedback[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [copied,setCopied]=useState("");
  const scrollRef=useRef<HTMLDivElement>(null);
  const controller=useRef<AbortController|null>(null);

  const refresh=useCallback(async()=>{
    setChecking(true);
    try{
      const res=await fetch("/api/admin/model-lab-playground",{cache:"no-store"});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"No se puede consultar Model Lab.");
      setStatus(data as Status);
    }catch(e){setStatus({online:false,serviceConfigured:false,models:[],reason:e instanceof Error?e.message:"No disponible"})}
    finally{setChecking(false)}
  },[]);

  useEffect(()=>{
    try{
      const stored=sessionStorage.getItem(HISTORY_KEY);
      if(stored){const v=JSON.parse(stored);if(Array.isArray(v))setTurns(v.slice(-10))}
      const saved=localStorage.getItem(FEEDBACK_KEY);
      if(saved){const v=JSON.parse(saved);if(Array.isArray(v))setFeedback(v.slice(-150))}
    }catch{}
    setHydrated(true);
    void refresh();
    return ()=>controller.current?.abort();
  },[refresh]);
  useEffect(()=>{
    if(!hydrated)return;
    try{sessionStorage.setItem(HISTORY_KEY,JSON.stringify(turns.slice(-10)))}catch{}
  },[turns,hydrated]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"})},[turns,busy]);

  const activeIds=useMemo<ModelId[]>(()=>{
    const ids=version==="r2"?["nano-r2","lite-r2"]:["nano-r5","lite-r5"];
    return selection==="compare"?ids as ModelId[]: [ids[selection==="nano"?0:1] as ModelId];
  },[selection,version]);
  const onlineIds=new Set((status?.models||[]).filter(m=>m.available&&m.approved).map(m=>m.id));
  const ready=Boolean(status?.online&&activeIds.every(id=>onlineIds.has(id)));
  const r5Ready=Boolean(status?.online&&status.models.filter(m=>m.version==="R5"&&m.approved&&m.available).length===2);

  function historyForModel(id:ModelId){
    const messages:Array<{role:"user"|"assistant";content:string}>=[];
    for(const turn of turns.slice(-3)){
      if(turn.version!==(id.endsWith("r2")?"r2":"r5"))continue;
      const item=turn.responses.find(r=>r.model===id&&r.ok);
      if(item?.text){messages.push({role:"user",content:turn.prompt},{role:"assistant",content:item.text.slice(0,1500)})}
    }
    return messages.slice(-6);
  }
  async function send(){
    if(busy||!prompt.trim()||!ready)return;
    const question=prompt.trim();
    const myController=new AbortController();
    controller.current=myController;
    setBusy(true);setError("");
    try{
      const history:Record<string,Array<{role:"user"|"assistant";content:string}>>={};
      activeIds.forEach(id=>{history[id]=historyForModel(id)});
      const response=await fetch("/api/admin/model-lab-playground",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:question,selection,version,mode,history,async:true}),
        signal:myController.signal,
      });
      const payload=await response.json().catch(()=>({error:"Respuesta inválida."}));
      if(!response.ok)throw new Error(String(payload.error||"No se pudo iniciar la prueba."));
      type Ticket={model:ModelId;jobId?:string;error?:string};
      if(!Array.isArray(payload.jobs))throw new Error("El servidor no devolvió tareas de inferencia.");
      const tickets=payload.jobs as Ticket[];
      async function poll(ticket:Ticket):Promise<Answer>{
        if(!ticket.jobId||!/^[A-Za-z0-9_-]{24,64}$/.test(ticket.jobId))
          return {model:ticket.model,ok:false,error:ticket.error||"No se recibió la tarea de inferencia."};
        for(let attempt=0;attempt<150;attempt++){
          if(myController.signal.aborted)throw new Error("POLLING_CANCELLED");
          await new Promise<void>(resolve=>window.setTimeout(resolve,2000));
          if(myController.signal.aborted)throw new Error("POLLING_CANCELLED");
          const params=new URLSearchParams({job:ticket.jobId,model:ticket.model});
          const check=await fetch("/api/admin/model-lab-playground?"+params.toString(),{
            cache:"no-store",signal:myController.signal,
          });
          const state=await check.json().catch(()=>({error:"Error al consultar tarea."}));
          if(!check.ok)return {model:ticket.model,ok:false,error:String(state.error||"La consulta falló.")};
          if(state.state==="running")continue;
          if(state.state==="error")return {model:ticket.model,ok:false,error:String(state.error||"Error de inferencia.")};
          if(state.state==="completed"&&state.result?.text){
            const result=state.result;
            return {model:ticket.model,ok:true,text:String(result.text),
              latencyMs:typeof result.latencyMs==="number"?result.latencyMs:undefined,
              promptTokens:typeof result.promptTokens==="number"?result.promptTokens:null,
              completionTokens:typeof result.completionTokens==="number"?result.completionTokens:null,
              engine:typeof result.engine==="string"?result.engine:"transformers-peft"};
          }
          return {model:ticket.model,ok:false,error:"La tarea terminó sin una respuesta válida."};
        }
        return {model:ticket.model,ok:false,error:"Tiempo de espera agotado (5 minutos). Revisa la inferencia del Dell."};
      }
      const answers=await Promise.all(tickets.map(poll));
      if(myController.signal.aborted)return;
      setTurns(current=>[...current,{
        id:typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():String(Date.now()),
        prompt:question,version,mode,
        responses:answers,
        reference:payload.reference||null,at:new Date().toISOString(),
      }].slice(-10));
      setPrompt("");
    }catch(e){
      if(!myController.signal.aborted)setError(e instanceof Error?e.message:"No se pudo completar la consulta.");
    }finally{setBusy(false);controller.current=null}
  }
  function evaluate(turn:Turn,item:Answer,rating:Feedback["rating"]){
    if(!item.ok||!item.text)return;
    const entry:Feedback={key:answerKey(turn.id,item.model),model:item.model,
      prompt:turn.prompt,answer:item.text,rating,at:new Date().toISOString(),source:"admin-model-lab"};
    const next=[entry,...feedback.filter(f=>f.key!==entry.key)].slice(0,150);
    setFeedback(next);
    try{localStorage.setItem(FEEDBACK_KEY,JSON.stringify(next))}catch{}
  }
  async function copy(text:string,id:string){
    try{await navigator.clipboard.writeText(text);setCopied(id);setTimeout(()=>setCopied(""),1500)}catch{}
  }
  function clear(){
    if(busy)return;
    setTurns([]);setError("");
    try{sessionStorage.removeItem(HISTORY_KEY)}catch{}
  }

  return (
    <div className="space-y-5 text-slate-100">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_10%_0%,rgba(34,211,238,0.14),transparent_43%),radial-gradient(ellipse_at_95%_0%,rgba(139,92,246,0.1),transparent_40%),#0a1525] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
              <FlaskConical className="h-4 w-4"/> Laboratorio de modelos
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Nano <span className="text-cyan-300">vs.</span> Lite</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Conversa con los adaptadores reales R2, compara respuestas y califica resultados. R5 aparecerá aquí únicamente después de aprobar las evaluaciones.
            </p>
          </div>
          <button type="button" onClick={()=>void refresh()} disabled={checking}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={"h-4 w-4 "+(checking?"animate-spin":"")}/> Comprobar conexión
          </button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Servicio de inferencia</p>
            <p className={"mt-2 flex items-center gap-2 text-sm font-bold "+(status?.online?"text-emerald-300":"text-amber-200")}>
              {status?.online?<Activity className="h-4 w-4"/>:<WifiOff className="h-4 w-4"/>}
              {status?.online?"Conectado":"Sin conexión"}
            </p>
          </div>
          {MODEL_ORDER.slice(0,2).map(id=>{
            const model=status?.models.find(m=>m.id===id);
            return <div key={id} className={"rounded-2xl border p-3 "+cls(id)}>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">{title(id)} · R2</p>
              <p className="mt-2 text-sm font-bold">{model?.available?"Adaptador disponible":"A la espera del Dell"}</p>
              <p className="mt-1 text-xs text-slate-400">{id.startsWith("nano")?"350 millones":"1.200 millones"} de parámetros</p>
            </div>
          })}
        </div>
        {!status?.online&&<p role="status" className="mt-3 flex gap-2 text-xs text-amber-200/90">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
          {status?.reason||"Comprobando conexión…"} · La interfaz está preparada, pero necesita el servicio privado de inferencia en el Dell.
        </p>}
      </section>

      <LabExactVerifier prompt={prompt} onPromptChange={setPrompt}/>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-4">
            <h4 className="flex items-center gap-2 text-sm font-black"><BrainCircuit className="h-4 w-4 text-cyan-300"/> Modelos</h4>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["r2","r5"] as const).map(v=><button type="button" key={v} disabled={v==="r5"&&!r5Ready}
                onClick={()=>setVersion(v)} className={"rounded-xl px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 "+(version===v?"bg-cyan-400 text-slate-950":"border border-white/10 bg-white/5 text-slate-300")}>
                {v.toUpperCase()}{v==="r5"&&!r5Ready?" · bloqueado":""}
              </button>)}
            </div>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Seleccionar modelo</legend>
              {([{id:"nano",label:"EDUAI Nano",detail:"350M · liviano"},
                 {id:"lite",label:"EDUAI Lite",detail:"1.2B · mayor capacidad"},
                 {id:"compare",label:"Comparar ambos",detail:"Misma pregunta, respuestas separadas"}] as const).map(option=>
                <label key={option.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition "+(selection===option.id?"border-cyan-400/45 bg-cyan-400/10":"border-white/10 bg-white/[0.02] hover:bg-white/5")}>
                  <input type="radio" className="mt-1 accent-cyan-400" name="lab-model" checked={selection===option.id} onChange={()=>setSelection(option.id)}/>
                  <span><span className="block text-xs font-bold">{option.label}</span><span className="mt-1 block text-[11px] text-slate-400">{option.detail}</span></span>
                </label>)}
            </fieldset>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-4">
            <h4 className="flex items-center gap-2 text-sm font-black"><Calculator className="h-4 w-4 text-violet-300"/> Modo de evaluación</h4>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-300">
                <input type="radio" className="mt-1 accent-cyan-400" checked={mode==="raw"} onChange={()=>setMode("raw")}/>
                <span><strong className="block text-white">Solo modelo</strong>Medir lo que responde sin herramientas.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-300">
                <input type="radio" className="mt-1 accent-cyan-400" checked={mode==="exact"} onChange={()=>setMode("exact")}/>
                <span><strong className="block text-white">Con referencia matemática</strong>Mostrar un cálculo exacto independiente, sin atribuírselo al modelo.</span>
              </label>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-4">
            <h4 className="text-sm font-black">Preguntas rápidas</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map(item=><button type="button" key={item.name} onClick={()=>setPrompt(item.question)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-cyan-400/30 hover:text-cyan-100">{item.name}</button>)}
            </div>
          </section>
        </aside>

        <section className="flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#071221]">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
            <div><h4 className="text-sm font-black">Consola de experimentación</h4>
              <p className="mt-1 text-[11px] text-slate-400">Las respuestas provienen del adaptador seleccionado. No hay simulaciones.</p></div>
            <div className="flex gap-2">
              <button type="button" disabled={!turns.length||busy} onClick={()=>exportJson("eduai-model-lab-session.json",{source:"EDUAI Model Lab",exportedAt:new Date().toISOString(),turns})}
                className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30" title="Exportar conversación"><Download className="h-4 w-4"/></button>
              <button type="button" disabled={!turns.length||busy} onClick={clear}
                className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30" title="Nueva conversación"><Trash2 className="h-4 w-4"/></button>
            </div>
          </header>
          <div ref={scrollRef} className="min-h-[180px] flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
            {!turns.length&&<div className="flex min-h-52 flex-col items-center justify-center text-center">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4"><FlaskConical className="h-7 w-7 text-cyan-300"/></div>
              <h5 className="mt-4 font-black">Primer experimento</h5>
              <p className="mt-2 max-w-md text-xs leading-6 text-slate-400">Escribe una pregunta y ejecuta Nano, Lite o ambos. Se mostrará la respuesta real, latencia y consumo de tokens cuando el servidor los informe.</p>
            </div>}
            {turns.map((turn,index)=><article key={turn.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="max-w-[93%] rounded-2xl rounded-tl-sm bg-slate-800/70 px-4 py-3 text-sm leading-6">{turn.prompt}</div>
                <span className="mt-1 shrink-0 text-[10px] text-slate-500">#{index+1}</span>
              </div>
              <div className={"grid gap-3 "+(turn.responses.length===2?"lg:grid-cols-2":"")}>
                {turn.responses.map(item=>{
                  const rated=feedback.find(f=>f.key===answerKey(turn.id,item.model))?.rating;
                  return <div key={item.model} className={"min-w-0 overflow-hidden rounded-2xl border "+cls(item.model)}>
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
                      <div className="flex items-center gap-2"><span className={"flex h-7 w-7 items-center justify-center rounded-lg "+(color(item.model)==="cyan"?"bg-cyan-400/15 text-cyan-300":"bg-violet-400/15 text-violet-300")}><BrainCircuit className="h-4 w-4"/></span>
                        <span className="text-xs font-black">{title(item.model)} · {item.model.split("-")[1].toUpperCase()}</span></div>
                      {item.ok?<CheckCircle2 className="h-4 w-4 text-emerald-300"/>:<AlertCircle className="h-4 w-4 text-red-300"/>}
                    </div>
                    <div className="min-h-24 overflow-x-auto p-4">
                      {item.ok?
                        <div className="prose prose-sm prose-invert max-w-none break-words text-sm leading-relaxed prose-p:text-slate-200 prose-headings:text-white prose-strong:text-white prose-code:text-cyan-200">
                          <ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex]}>{item.text||""}</ReactMarkdown>
                        </div>:
                        <p className="text-xs text-red-200">{item.error||"Error sin respuesta"}</p>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                        {item.latencyMs!=null&&<span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{(item.latencyMs/1000).toFixed(1)} s</span>}
                        {item.completionTokens!=null&&<span>{item.completionTokens} tokens</span>}
                      </div>
                      {item.ok&&<div className="flex gap-1">
                        <button type="button" title="Copiar respuesta" aria-label="Copiar respuesta" onClick={()=>void copy(item.text||"",answerKey(turn.id,item.model))}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">{copied===answerKey(turn.id,item.model)?<Check className="h-3.5 w-3.5"/>:<Copy className="h-3.5 w-3.5"/>}</button>
                        <button type="button" title="Respuesta útil" aria-label="Respuesta útil" onClick={()=>evaluate(turn,item,"useful")}
                          className={"rounded-lg p-1.5 hover:bg-white/10 "+(rated==="useful"?"text-emerald-300":"text-slate-400")}><ThumbsUp className="h-3.5 w-3.5"/></button>
                        <button type="button" title="Respuesta incorrecta" aria-label="Respuesta incorrecta" onClick={()=>evaluate(turn,item,"incorrect")}
                          className={"rounded-lg p-1.5 hover:bg-white/10 "+(rated==="incorrect"?"text-red-300":"text-slate-400")}><ThumbsDown className="h-3.5 w-3.5"/></button>
                      </div>}
                    </div>
                  </div>;
                })}
              </div>
              {turn.reference&&<div className={"rounded-2xl border p-4 text-xs "+(turn.reference.verified?"border-emerald-400/20 bg-emerald-950/15":"border-white/10 bg-white/5")}>
                <div className="flex items-center gap-2 font-black"><Calculator className="h-4 w-4 text-emerald-300"/> Referencia independiente · cálculo exacto</div>
                {turn.reference.verified?<><p className="mt-3 text-sm font-black text-emerald-200">{turn.reference.answer}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-300">{(turn.reference.steps||[]).map((s,i)=><li key={i}>{s}</li>)}</ol></>:
                  <p className="mt-2 text-slate-400">Esta familia de ejercicio no está soportada por el verificador integrado. No se inventó una respuesta de referencia.</p>}
                <p className="mt-3 text-[10px] text-slate-500">Este resultado no forma parte de la respuesta generada por Nano o Lite.</p>
              </div>}
            </article>)}
            {busy&&<div role="status" className="flex items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-950/15 p-3 text-xs text-cyan-200">
              <LoaderCircle className="h-4 w-4 animate-spin"/> Procesando tareas en el Dell. La primera carga de pesos o el uso de CPU puede tardar varios minutos…
            </div>}
          </div>
          <div className="space-y-3 border-t border-white/10 bg-[#0b192a] p-4 sm:p-5">
            {error&&<p role="alert" className="rounded-xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">{error}</p>}
            <label htmlFor="lab-question" className="block text-xs font-bold text-slate-200">Pregunta para el modelo</label>
            <textarea id="lab-question" rows={3} value={prompt} maxLength={2500} onChange={e=>setPrompt(e.target.value)}
              onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();void send()}}}
              placeholder="Escribe una pregunta o una tarea…" className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/50 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"/>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-5 text-slate-500">Ctrl + Enter para enviar · {prompt.length}/2500</p>
              <div className="flex items-center gap-2">
                {busy&&<button type="button" onClick={()=>controller.current?.abort()} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10">Cancelar espera</button>}
                <button type="button" disabled={!ready||busy||!prompt.trim()} onClick={()=>void send()}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}
                  {busy?"Consultando":"Probar modelo"+(selection==="compare"?"s":"")}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#0b1728] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/>
          <div><h4 className="text-sm font-black">Evaluación privada y controlada</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">Solo administradores. El historial de esta pestaña se guarda temporalmente en tu navegador. Tus valoraciones se guardan localmente y no se envían automáticamente para entrenar modelos; puedes exportarlas cuando decidas revisarlas.</p></div>
        </div>
        <button type="button" disabled={!feedback.length} onClick={()=>exportJson("eduai-model-lab-feedback.json",{consent:"manual-export",source:"admin-model-lab",feedback})}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-40">
          <Download className="h-4 w-4"/> Exportar valoraciones ({feedback.length})
        </button>
      </section>
    </div>
  );
}
