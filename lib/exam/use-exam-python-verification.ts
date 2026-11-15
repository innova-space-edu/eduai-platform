import { useRef, useState, useEffect } from "react";
export type CorrectionReview = {required:true;confirmedSignature?:string};
export type PythonProposal = {source:string;fields:{modelAnswer:string;expectedLatex:string;explanation:string;solutionSteps:string[]};notes:string[]};
export type PythonResult = {id:string;status:"incorrect"|"partial"|"unsupported";checks:{label:string;valid:boolean|null;message:string}[];proposal?:PythonProposal|null};
export function useExamPythonVerification(){
 const worker=useRef<Worker|null>(null),pending=useRef(false),sequence=useRef(0),[busy,setBusy]=useState(false);
 useEffect(()=>()=>{worker.current?.terminate();worker.current=null;},[]);
 const verify=async(questions:unknown[]):Promise<PythonResult[]>=>{
  if(pending.current)throw Error("Hay una comprobación en curso.");
  pending.current=true;setBusy(true);
  try{
   const w=worker.current??new Worker("/exam-python-worker.js?v=2");worker.current=w;
   const id=++sequence.current;
   return await new Promise<PythonResult[]>((resolve,reject)=>{
    const fail=(message:string)=>{clearTimeout(timer);w.terminate();if(worker.current===w)worker.current=null;reject(Error(message));};
    const timer=setTimeout(()=>fail("Python excedió el tiempo de carga."),45000);
    w.onmessage=e=>{if(e.data?.id!==id)return;clearTimeout(timer);if(e.data?.error)fail(e.data.error);else if(Array.isArray(e.data?.results)&&e.data.results.length===questions.length)resolve(e.data.results);else fail("Comprobación incompleta.");};
    w.onerror=()=>fail("No se pudo iniciar Python.");
    w.postMessage({id,questions});
   });
  }finally{pending.current=false;setBusy(false)}
 };
 return {verify,busy};
}
