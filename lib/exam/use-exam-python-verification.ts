import { useRef, useState, useEffect } from "react";
export type CorrectionReview = {required:true;confirmedSignature?:string};
export type PythonProposal = {source:string;fields:{modelAnswer:string;expectedLatex:string;explanation:string;solutionSteps:string[]};notes:string[]};
export type PythonResult = {id:string;status:"incorrect"|"partial"|"unsupported";checks:{label:string;valid:boolean|null;message:string}[];proposal?:PythonProposal|null};
export function useExamPythonVerification(){
 const active=useRef<Worker|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>()=>active.current?.terminate(),[]);
 const verify=async(questions:unknown[]):Promise<PythonResult[]>=>{
  if(active.current)throw Error("Hay una comprobación en curso.");
  setBusy(true);
  try{
   const w=new Worker("/exam-python-worker.js?v=2");active.current=w;
   return await new Promise<PythonResult[]>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("Python excedió el tiempo de carga.")),45000);
    w.onmessage=e=>{clearTimeout(timer);if(e.data?.error)reject(Error(e.data.error));else if(Array.isArray(e.data?.results)&&e.data.results.length===questions.length)resolve(e.data.results);else reject(Error("Comprobación incompleta."))};
    w.onerror=()=>{clearTimeout(timer);reject(Error("No se pudo iniciar Python."))};
    w.postMessage({id:1,questions});
   });
  }finally{active.current?.terminate();active.current=null;setBusy(false)}
 };
 return {verify,busy};
}
