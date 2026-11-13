"use client";
import { useEffect, useRef, useState } from "react";
import { Calculator, LoaderCircle } from "lucide-react";
import type { LabExactVerification } from "@/lib/ai/model-lab/exact-verification";

type Checked={question:string;result:LabExactVerification};
export default function LabExactVerifier({prompt,onPromptChange}:{prompt:string;onPromptChange:(value:string)=>void}){
  const [candidate,setCandidate]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [checked,setChecked]=useState<Checked|null>(null);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function verify(){
    if(busy||!prompt.trim())return;
    const question=prompt.trim(),value=candidate.trim().replace(/−/g,"-");
    if(value&&!/^[+-]?\d{1,13}$/.test(value)){setError("Escribe un candidato entero, por ejemplo 74 o -5.");return}
    const controller=new AbortController();request.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),18000);
    setBusy(true);setError("");setChecked(null);
    try{
      const response=await fetch("/api/admin/model-lab-playground/verify",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:question,candidate:value||null}),signal:controller.signal,
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No se pudo comprobar la resta.");
      setChecked({question,result:payload as LabExactVerification});
    }catch(e){setError(controller.signal.aborted?"No llegó la comprobación del Dell. La respuesta queda sin verificar.":e instanceof Error?e.message:"No se pudo comprobar la resta.")}
    finally{window.clearTimeout(timeout);setBusy(false);request.current=null}
  }
  const result=checked?.result;
  return <section className="rounded-2xl border border-emerald-400/20 bg-[#0b1924] p-4 sm:p-5" aria-labelledby="exact-verifier-title">
    <h4 id="exact-verifier-title" className="flex items-center gap-2 text-sm font-black text-emerald-200"><Calculator className="h-4 w-4"/> Verificador exacto de restas</h4>
    <p className="mt-2 text-xs leading-5 text-slate-300">Comprueba con Python en el Dell, sin cargar modelos. El resultado y los pasos son un cálculo independiente de Nano y Lite.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
      <label className="block text-xs text-slate-300" htmlFor="exact-question">Enunciado original
        <input id="exact-question" value={prompt} onChange={e=>onPromptChange(e.target.value)} maxLength={2500} placeholder="Resta (35) de (39)." className="mt-1 block w-full rounded-lg border border-white/15 bg-slate-950/50 p-2.5 text-sm text-white"/>
      </label>
      <label className="block text-xs text-slate-300" htmlFor="exact-candidate">Candidato (opcional)
        <input id="exact-candidate" type="text" value={candidate} onChange={e=>setCandidate(e.target.value)} maxLength={14} placeholder="Por ejemplo: 74" className="mt-1 block w-full rounded-lg border border-white/15 bg-slate-950/50 p-2.5 text-sm text-white"/>
      </label>
      <button type="button" onClick={()=>void verify()} disabled={busy||!prompt.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40">
        {busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Calculator className="h-4 w-4"/>}{busy?"Comprobando…":"Comprobar resta"}
      </button>
    </div>
    <p className="mt-2 text-[11px] leading-5 text-slate-400">Sin candidato, muestra la solución. Con candidato, comprueba si es correcto. No certifica una explicación libre del modelo.</p>
    <button type="button" onClick={()=>{onPromptChange("Resta (35) de (39).");setCandidate("74");setChecked(null);setError("")}} disabled={busy} className="mt-2 text-xs font-bold text-emerald-200 underline underline-offset-4">Cargar ejemplo: 39 − 35, candidato 74</button>
    <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer">Ver formatos admitidos</summary>
      <p className="mt-2 leading-5">Resta (B) de (A). · Quita (B) a (A). · A (A) réstale (B). · Parte de (A) y resta (B). · Sustrae (B) del número (A). · Disminuye (A) en (B).</p>
      <p className="mt-1 leading-5">Usa enteros entre paréntesis y punto final. Admite signos y cero. Fracciones, ecuaciones y otras redacciones quedan sin verificar.</p>
    </details>
    {error?<p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>:null}
    {checked&&result?<div role="status" className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
      <p className="text-xs text-slate-400">Enunciado comprobado: {checked.question}</p>
      {result.verified?<>
        <p className="mt-2 font-black text-emerald-200">Resultado exacto: {result.answer}</p>
        {result.candidate!==null?<p className={"mt-2 font-bold "+(result.candidateCorrect?"text-emerald-200":"text-amber-200")}>Candidato {result.candidate}: {result.candidateCorrect?"correcto":"incorrecto"}</p>:null}
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">{result.steps?.map((step,i)=><li key={i}>{step}</li>)}</ol>
      </>:<p className="mt-2 text-amber-200">Sin verificar. {result.reason}</p>}
    </div>:null}
  </section>;
}
