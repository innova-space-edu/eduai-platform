"use client";
import {useEffect,useRef,useState} from "react";
type Q={id:string;question:string;modelAnswer?:string;expectedLatex?:string;explanation?:string;solutionSteps?:string[]};
type Result={id:string;status:"incorrect"|"partial"|"unsupported";checks:{label:string;valid:boolean|null;message:string}[]};
export default function ExamPythonReview({questions}:{questions:Q[]}){
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),request=useRef(0),snapshot=useRef("");
 const [busy,setBusy]=useState(false),[results,setResults]=useState<Result[]>([]),[error,setError]=useState(""),[selected,setSelected]=useState("all");
 const signature=JSON.stringify(questions.map(q=>({id:q.id,question:q.question,modelAnswer:q.modelAnswer,expectedLatex:q.expectedLatex,explanation:q.explanation,solutionSteps:q.solutionSteps})));
 useEffect(()=>()=>{worker.current?.terminate();if(timer.current)clearTimeout(timer.current)},[]);
 const run=()=>{
  if(busy)return;setError("");setResults([]);setBusy(true);snapshot.current=signature;
  try{
   if(!worker.current)worker.current=new Worker("/exam-python-worker.js");
   const id=++request.current;
   const finish=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setBusy(false)};
   worker.current.onmessage=e=>{if(e.data?.id!==id)return;finish();if(e.data.error)setError(e.data.error);else setResults(Array.isArray(e.data.results)?e.data.results:[])};
   worker.current.onerror=()=>{finish();worker.current?.terminate();worker.current=null;setError("No se pudo iniciar Python en el navegador.")};
   timer.current=setTimeout(()=>{request.current++;worker.current?.terminate();worker.current=null;finish();setError("Python excedió el tiempo de carga. Intenta nuevamente.")},45000);
   const data=JSON.parse(signature) as Q[];worker.current.postMessage({id,questions:selected==="all"?data:data.filter(q=>q.id===selected)});
  }catch{setBusy(false);setError("El navegador no pudo iniciar el verificador.")}
 };
 const stale=results.length>0&&snapshot.current!==signature;
 return <details className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><summary className="cursor-pointer text-sm font-bold text-indigo-950">Verificador matemático · Python exacto</summary><p className="mt-2 text-xs leading-relaxed text-slate-600">El control automático de consistencia se aplica al generar y publicar. Este motor independiente comprueba igualdades numéricas y casos reconocidos de Tales con fracciones exactas, sin ejecutar código de la IA. No certifica razonamientos, geometría general ni toda la pauta. La primera carga necesita Internet.</p>
 <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Pregunta a verificar" value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-xs"><option value="all">Todas las preguntas</option>{questions.map((q,i)=><option key={q.id} value={q.id}>Pregunta {i+1}</option>)}</select><button type="button" disabled={busy||!questions.length} onClick={run} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?"Comprobando con Python…":"Verificar pasos y resultados"}</button></div>
 {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
 {stale&&<p className="mt-3 text-xs text-amber-800">Las preguntas cambiaron. Vuelve a verificar; los resultados anteriores ya no corresponden a la versión actual.</p>}
 {!stale&&results.map(result=><div key={result.id} className="mt-3 rounded-xl border bg-white p-3 text-xs"><strong className={result.status==="incorrect"?"text-red-700":"text-slate-800"}>Pregunta {questions.findIndex(q=>q.id===result.id)+1} · {result.status==="incorrect"?"Se detectó una contradicción":result.status==="partial"?"Comprobación parcial":"Sin comprobaciones automáticas disponibles"}</strong>{result.checks.map((check,i)=><p key={i} className={"mt-1 "+(check.valid===false?"text-red-700":"text-slate-600")}>{check.valid===false?"✕":check.valid===true?"✓":"?"} {check.label}: {check.message}</p>)}</div>)}
 </details>;
}
