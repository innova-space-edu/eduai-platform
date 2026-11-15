"use client";
import ExamMathText from "@/components/ui/ExamMathText";
import { correctionSignature } from "@/lib/exam/correction-review.mjs";
import type { PythonResult } from "@/lib/exam/use-exam-python-verification";
export default function ExamCorrectionPanel({q,issues,result,required,busy,onVerify,onApply,onConfirm,qualityReady}:{q:any;issues:string[];result?:{signature:string;data:PythonResult};required:boolean;busy:boolean;qualityReady:boolean;onVerify:()=>void;onApply:(fields:NonNullable<PythonResult["proposal"]>["fields"])=>void;onConfirm:()=>void}){
 const current=result?.signature===correctionSignature(q)?result.data:undefined;
 const confirmed=q.correctionReview?.confirmedSignature===correctionSignature(q)&&!issues.length;
 const canConfirm=required&&qualityReady&&!issues.length&&current&&current.status!=="incorrect";
 const problem=required||issues.length>0||current?.status==="incorrect";
 const status=confirmed?"Corrección confirmada":busy&&!current?"Verificando con Python…":current?.status==="unsupported"?"Sin comprobación matemática aplicable":current?.status==="partial"?"Comprobaciones disponibles correctas · alcance parcial":"Verificación pendiente";
 if(!problem)return <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600" role="status"><span>{status}</span><div className="flex items-center gap-2">{current?.checks.length?<details><summary className="cursor-pointer text-blue-700">Detalles</summary>{current.checks.map((c,i)=><div key={i}><b>{c.label}:</b> <ExamMathText text={c.message}/></div>)}</details>:null}<button type="button" disabled={busy} onClick={onVerify} className="rounded-lg border px-2 py-1 text-blue-700 disabled:opacity-50">Verificar</button></div></div>;
 return <div className="mb-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
 <div className="flex flex-wrap items-center justify-between gap-2"><strong>Corrección pendiente · bloquea publicación</strong><button type="button" disabled={busy} onClick={onVerify} className="rounded-lg border border-indigo-200 bg-white px-2 py-1 font-semibold text-indigo-800 disabled:opacity-50">{busy?"Verificando…":"Verificar con Python"}</button></div>
 {issues.map(issue=><p key={issue} className="text-xs text-amber-900">{issue}</p>)}
 {current?.checks.filter(c=>c.valid===false).map((c,i)=><div key={i} className={"text-xs "+(c.valid===false?"text-red-800":"text-slate-700")}><b>{c.valid===false?"✕":c.valid===true?"✓":"?"} {c.label}:</b> <ExamMathText text={c.message}/></div>)}
 {current?.proposal&&<div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4"><strong>Propuesta calculada por Python</strong><div className="text-xs"><b>Resultado actual</b><ExamMathText text={q.expectedLatex||q.modelAnswer||"Sin respuesta"}/></div><div className="text-sm"><b>Resultado propuesto</b><ExamMathText text={current.proposal.fields.expectedLatex}/></div><ol className="list-decimal space-y-2 pl-5">{current.proposal.fields.solutionSteps.map((s,i)=><li key={i}><ExamMathText text={s}/></li>)}</ol>{current.proposal.notes.map(n=><p key={n} className="text-xs text-slate-600">{n}</p>)}<button type="button" disabled={busy} onClick={()=>onApply(current.proposal!.fields)} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white">Aplicar propuesta</button></div>}
 {required&&!current?.proposal&&<p className="text-xs text-slate-700">{!current?"Se verificará al editar.":canConfirm?"Revisa la pauta y confirma la corrección.":"Edita los campos indicados; Python comprobará el cambio automáticamente."}</p>}
 {required&&<button type="button" disabled={!canConfirm||busy} onClick={onConfirm} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Corregido</button>}
 {required&&<p className="text-xs text-slate-600">La confirmación se invalida al editar. Python verifica únicamente los casos admitidos.</p>}
 </div>
}
