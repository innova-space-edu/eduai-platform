"use client";
import ExamMathText from "@/components/ui/ExamMathText";
import { correctionSignature } from "@/lib/exam/correction-review.mjs";
import type { PythonResult } from "@/lib/exam/use-exam-python-verification";
export default function ExamCorrectionPanel({q,issues,result,required,busy,onVerify,onApply,onConfirm}:{q:any;issues:string[];result?:{signature:string;data:PythonResult};required:boolean;busy:boolean;onVerify:()=>void;onApply:(fields:NonNullable<PythonResult["proposal"]>["fields"])=>void;onConfirm:()=>void}){
 const current=result?.signature===correctionSignature(q)?result.data:undefined;
 const confirmed=q.correctionReview?.confirmedSignature===correctionSignature(q)&&!issues.length;
 const canConfirm=required&&!issues.length&&current&&current.status!=="incorrect";
 if(!required&&!issues.length&&!confirmed&&!current)return <button type="button" disabled={busy} onClick={onVerify} className="mb-3 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-800 disabled:opacity-50">Verificar esta pregunta con Python</button>;
 return <div className="mb-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
 <div className="flex flex-wrap justify-between gap-2"><strong>{confirmed?"✓ Corrección confirmada":required||issues.length?"Corrección pendiente · bloquea publicación":"Resultado de verificación"}</strong><button type="button" disabled={busy} onClick={onVerify} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?"Verificando…":"Verificar y proponer corrección"}</button></div>
 {issues.map(issue=><p key={issue} className="text-xs text-amber-900">{issue}</p>)}
 {current?.checks.map((c,i)=><div key={i} className={"text-xs "+(c.valid===false?"text-red-800":"text-slate-700")}><b>{c.valid===false?"✕":c.valid===true?"✓":"?"} {c.label}:</b> {c.message}</div>)}
 {current?.proposal&&<div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4"><strong>Propuesta calculada por Python</strong><div className="text-xs"><b>Resultado actual</b><ExamMathText text={q.expectedLatex||q.modelAnswer||"Sin respuesta"}/></div><div className="text-sm"><b>Resultado propuesto</b><ExamMathText text={current.proposal.fields.expectedLatex}/></div><ol className="list-decimal space-y-2 pl-5">{current.proposal.fields.solutionSteps.map((s,i)=><li key={i}><ExamMathText text={s}/></li>)}</ol>{current.proposal.notes.map(n=><p key={n} className="text-xs text-slate-600">{n}</p>)}<button type="button" disabled={busy} onClick={()=>onApply(current.proposal!.fields)} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white">Aplicar propuesta</button></div>}
 {required&&!current?.proposal&&<p className="text-xs text-slate-700">Edita los campos indicados. Si no hay propuesta exacta, revisa manualmente el procedimiento y vuelve a verificar.</p>}
 {required&&<button type="button" disabled={!canConfirm||busy} onClick={onConfirm} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Corregido</button>}
 {required&&<p className="text-xs text-slate-600">Confirma solo después de revisar la pauta y la rúbrica. Python comprueba los casos admitidos; una comprobación parcial no certifica toda la pregunta. Si editas la pregunta, se invalida la confirmación.</p>}
 </div>
}
