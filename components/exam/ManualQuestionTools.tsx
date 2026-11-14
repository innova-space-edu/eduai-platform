"use client";

import { useRef, useState } from "react";
import ExamVisualEditor from "@/components/exam/ExamVisualEditor";

const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
type QuestionMeta = {
  id: string; type: string; question: string; imageUrl?: string; optionImageUrls?: string[];
  options?: string[]; correctAnswer?: number; explanation?: string; solutionSteps?: string[];
  distractorRationales?: string[]; modelAnswer?: string; expectedLatex?: string;
  oaCodes?: string[]; pedagogicalMode?: string; skill?: string; evidence?: string;
  stimulusKind?: string; stimulusTitle?: string; stimulusText?: string; showStimulusToStudent?: boolean;
};
type Option = { id: string; label: string };
type Patch = Partial<QuestionMeta>;
type ManualType = "multiple_choice" | "mixed_choice_development" | "true_false" | "development";
type ResponseMode = "short_text" | "long_text" | "math" | "text_math" | "math_steps";

export function ExamImageEditor({ value, onChange, label = "Imagen de la pregunta" }: {value?: string; onChange: (url: string) => void; label?: string}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [failed,setFailed]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const request=useRef(0);
  const upload=async(file?:File)=>{
    if(!file || busy)return;
    if(file.size>4*1024*1024 || !["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)){setError("Usa PNG, JPEG, WebP o GIF de hasta 4 MB.");return;}
    const token=++request.current;
    setBusy(true);setError("");
    try{
      const form=new FormData();form.append("file",file);
      const res=await fetch("/api/assets/exam-image",{method:"POST",body:form});
      const result=await res.json();
      if(!res.ok||!result.url)throw new Error(result.error||"No se pudo cargar la imagen.");
      if(request.current===token){setFailed(false);onChange(result.url);}
    }catch(e){if(request.current===token)setError(e instanceof Error?e.message:"Error de carga.");}
    finally{if(request.current===token)setBusy(false);}
  };
  return <div className="space-y-2 rounded-xl border border-slate-200 bg-white/70 p-3">
    <label className="block text-xs font-semibold text-slate-700">{label}</label>
    <div className="flex flex-wrap gap-2">
      <input aria-label={label+" URL"} className={field+" flex-1 min-w-[160px]"} value={value||""} placeholder="https://… o imagen cargada" disabled={busy} onChange={e=>{setFailed(false);onChange(e.target.value)}}/>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";void upload(file)}}/>
      <button type="button" disabled={busy} onClick={()=>input.current?.click()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?"Subiendo…":"Subir imagen"}</button>
      {value&&<button type="button" disabled={busy} className="rounded-lg border px-3 py-2 text-xs" onClick={()=>{setFailed(false);onChange("")}}>Quitar</button>}
    </div>
    <p className="text-[10px] text-slate-500">PNG, JPG, WebP o GIF · hasta 4 MB. Las imágenes cargadas quedan accesibles a quienes tengan el enlace de la imagen; no subas datos personales.</p>
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {value&&!failed&&(/^https?:\/\//i.test(value)||value.startsWith("/api/assets/exam-image?id="))&&<img src={value} alt={label} className="max-h-48 w-full object-contain rounded-lg" onError={()=>setFailed(true)}/>}
    {failed&&<p className="text-xs text-amber-700">No se pudo visualizar la imagen. Comprueba el enlace.</p>}
  </div>
}

export function ManualQuestionTools({q,patch,oaOptions,modes,requireOA,onReuse,onCopyTo,targets,recommendedModes}:{
  q:QuestionMeta;patch:(value:Patch)=>void;oaOptions:Option[];modes:Option[];requireOA:boolean;
  onReuse:(type:ManualType,mode:ResponseMode)=>void;onCopyTo:(ids:string[])=>void;targets:Option[];recommendedModes:string[];
}){
  const [chosen,setChosen]=useState<string[]>([]);
  const [reuseType,setReuseType]=useState<ManualType>("development");
  const [reuseMode,setReuseMode]=useState<ResponseMode>("long_text");
  const hasStimulus=Boolean(q.stimulusText?.trim());
  const selected=q.oaCodes||[];
  return <div className="mb-4 space-y-3">
    <details className="rounded-xl border border-violet-200 bg-white p-3">
      <summary className="cursor-pointer text-xs font-bold text-violet-900">OA y planificación pedagógica {selected.length? "· "+selected.join(", "): "· Sin OA asignado"}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-600">{requireOA?"Selecciona al menos un OA de la evaluación para esta pregunta.":"Puedes asociar los OA seleccionados de forma opcional."}</p>
        <div className="flex flex-wrap gap-2">
          {oaOptions.map(oa=><label key={oa.id} className="flex items-center gap-1 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-xs" title={oa.label}><input type="checkbox" checked={selected.includes(oa.id)} onChange={e=>patch({oaCodes:e.target.checked?[...new Set([...selected,oa.id])]:selected.filter(id=>id!==oa.id)})}/>{oa.id}</label>)}
          {!oaOptions.length&&<p className="text-xs text-slate-500">Selecciona los OA en el paso 2.</p>}
        </div>
        {selected.some(id=>!oaOptions.some(oa=>oa.id===id))&&<button type="button" className="text-xs text-red-700 underline" onClick={()=>patch({oaCodes:selected.filter(id=>oaOptions.some(oa=>oa.id===id))})}>Quitar OA que ya no están seleccionados</button>}
        <label className="block text-xs font-semibold">Modo pedagógico<select className={field} value={q.pedagogicalMode||""} onChange={e=>patch({pedagogicalMode:e.target.value})}><option value="">Sin especificar</option>{modes.map(m=><option key={m.id} value={m.id}>{m.label}{recommendedModes.includes(m.id)?" (recomendado)":""}</option>)}</select></label>
        <label className="block text-xs font-semibold">Habilidad<input className={field} value={q.skill||""} onChange={e=>patch({skill:e.target.value})}/></label>
        <label className="block text-xs font-semibold">Evidencia de aprendizaje<ExamVisualEditor className={field} value={q.evidence||""} onChange={e=>patch({evidence:e.target.value})}/></label>
      </div>
    </details>
    <details className="rounded-xl border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-xs font-bold text-slate-800">Pauta ampliada · procedimiento esperado</summary>
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-semibold">Pasos o fundamentos esperados (uno por línea)<ExamVisualEditor className={field+" min-h-24"} value={(q.solutionSteps||[]).join("\n")} onChange={e=>patch({solutionSteps:e.target.value.split("\n")})}/></label>
      </div>
    </details>
    {hasStimulus&&<details className="rounded-xl border border-sky-200 bg-sky-50 p-3">
      <summary className="cursor-pointer text-xs font-bold text-sky-900">Reutilizar esta lectura, fuente o contexto</summary>
      <p className="my-2 text-xs text-sky-800">Crea otra pregunta con el mismo material, o copia el texto completo a preguntas existentes. Las copias son editables de forma independiente.</p>
      <div className="flex flex-wrap gap-2"><select aria-label="Tipo de nueva pregunta" className={field+" flex-1"} value={reuseType} onChange={e=>setReuseType(e.target.value as ManualType)}><option value="development">Respuesta construida</option><option value="multiple_choice">Alternativas</option><option value="true_false">Verdadero/Falso</option><option value="mixed_choice_development">Alternativa + respuesta construida</option></select>{(reuseType==="development"||reuseType==="mixed_choice_development")&&<select aria-label="Forma de respuesta" className={field+" flex-1"} value={reuseMode} onChange={e=>setReuseMode(e.target.value as ResponseMode)}><option value="long_text">Respuesta abierta</option><option value="short_text">Respuesta corta</option><option value="math">Matemática</option><option value="text_math">Texto + matemática</option><option value="math_steps">Procedimiento</option></select>}<button type="button" onClick={()=>onReuse(reuseType,reuseMode)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white">+ Pregunta con este material</button></div>
      {targets.length>0&&<div className="mt-3 space-y-1">{targets.map(target=><label key={target.id} className="flex gap-2 text-xs"><input type="checkbox" checked={chosen.includes(target.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,target.id]:old.filter(id=>id!==target.id))}/>{target.label}</label>)}<button type="button" disabled={!chosen.length} onClick={()=>{onCopyTo(chosen);setChosen([])}} className="mt-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Aplicar material a seleccionadas</button></div>}
    </details>}
  </div>;
}
