import {readFileSync,writeFileSync} from "node:fs";
function patch(s){
 if(s.includes("EXAM_CORRECTION_REVIEW_V1"))return s;
 const R=(a,b)=>{if(!s.includes(a))throw Error("correction missing "+a.slice(0,100));s=s.replace(a,b)};
 R('import ExamPythonReview from "@/components/exam/ExamPythonReview";','import ExamCorrectionPanel from "@/components/exam/ExamCorrectionPanel";\nimport {useExamPythonVerification,type PythonResult,type CorrectionReview} from "@/lib/exam/use-exam-python-verification";\nimport {correctionSignature,needsCorrectionConfirmation} from "@/lib/exam/correction-review.mjs";\nimport {examAnswerConsistencyIssues} from "@/lib/exam/answer-consistency.mjs";\n// EXAM_CORRECTION_REVIEW_V1');
 R(') & QuestionPedagogyMeta & ConstructedResponseMeta;',') & QuestionPedagogyMeta & ConstructedResponseMeta & {correctionReview?:CorrectionReview};');
 R('  const updateQuestion = (id: string, updater: (q: Question) => Question) =>\n    setQuestions((p) => p.map((q) => (q.id === id ? updater(q) : q)));',`  const {verify:verifyPython,busy:pythonBusy}=useExamPythonVerification();
  const [pythonResults,setPythonResults]=useState<Record<string,{signature:string;data:PythonResult}>>({});
  const [pythonError,setPythonError]=useState("");
  const reviewQuestionsRef=useRef(questions);reviewQuestionsRef.current=questions;
  const mathReviewSubject=/matem[aá]tica|f[ií]sica|qu[ií]mica|ciencias/i.test(subject);
  const updateQuestion = (id:string,updater:(q:Question)=>Question) => setQuestions(p=>p.map(q=>{
    if(q.id!==id)return q;
    const next=updater(q);
    if(q.correctionReview?.required||examAnswerConsistencyIssues(q).length||examAnswerConsistencyIssues(next).length){
      return {...next,correctionReview:{required:true as const,confirmedSignature:correctionSignature(next)===correctionSignature(q)?q.correctionReview?.confirmedSignature:undefined}};
    }
    return next;
  }));
  const autoAttempted=useRef<Record<string,string>>({});
  const verificationInFlight=useRef(false);
  const verifyQuestions=async(items:Question[])=>{
    if(verificationInFlight.current)return null;
    verificationInFlight.current=true;
    for(const item of items)autoAttempted.current[item.id]=correctionSignature(item);
    setPythonError("");
    try{
      const results:PythonResult[]=[];
      for(let i=0;i<items.length;i+=100)results.push(...await verifyPython(items.slice(i,i+100)));
      if(results.some((data,i)=>data.id!==items[i].id))throw Error("Python devolvió resultados que no corresponden a las preguntas.");
      const records=Object.fromEntries(results.map((data,i)=>[items[i].id,{signature:correctionSignature(items[i]),data}]));
      setPythonResults(old=>({...old,...records}));
      setQuestions(old=>old.map(q=>records[q.id]?.signature===correctionSignature(q)&&records[q.id].data.status==="incorrect"?{...q,correctionReview:{required:true as const}}:q));
      return results;
    }catch(e){setPythonError(e instanceof Error?e.message:"No se pudo verificar con Python.");return null;}
    finally{verificationInFlight.current=false;}
  };
  useEffect(()=>{
    if(activeStep!==3||pythonBusy||saving||verificationInFlight.current)return;
    const timer=window.setTimeout(()=>{
      const pending=reviewQuestionsRef.current.filter(q=>q.question.trim()&&autoAttempted.current[q.id]!==correctionSignature(q));
      if(pending.length&&!verificationInFlight.current)void verifyQuestions(pending);
    },850);
    return ()=>window.clearTimeout(timer);
  },[questions,activeStep,pythonBusy,saving]);
  const applyPythonProposal=(id:string,fields:NonNullable<PythonResult["proposal"]>["fields"])=>{
    const q=reviewQuestionsRef.current.find(q=>q.id===id);
    const record=pythonResults[id];
    if(!q||!record||record.signature!==correctionSignature(q)||q.type!=="development")return;
    if(!window.confirm("¿Aplicar la propuesta calculada? Se conservarán el enunciado, la rúbrica y el puntaje."))return;
    const corrected={...q,...fields,correctionReview:{required:true as const}};
    setQuestions(old=>old.map(item=>item.id===id&&correctionSignature(item)===record.signature?corrected:item));
    // The changed signature schedules automatic Python verification.
  };
  const confirmCorrection=(id:string)=>{
    setQuestions(old=>old.map(q=>{
      if(q.id!==id||examAnswerConsistencyIssues(q).length||enrichQuestionAnswerKey(q).qualityStatus==="review")return q;
      const record=pythonResults[id],signature=correctionSignature(q);
      if(!record||record.signature!==signature||record.data.status==="incorrect")return q;
      return {...q,correctionReview:{required:true as const,confirmedSignature:signature}};
    }));
  };`);
 R('      const quality = enrichQuestionAnswerKey(q);','      if(needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)))return "La pregunta "+(i+1)+" tiene una corrección pendiente. Revísala y presiona Corregido.";\n      const quality = enrichQuestionAnswerKey(q);');
 R('    const ve = validateExam();','    if(pythonBusy||verificationInFlight.current)return;\n    const pending=questions.find(q=>needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)));\n    if(pending){setActiveStep(3);setExpandAllQuestions(false);setOpenQuestionId(pending.id);setQuestionFilter("all");setQuestionSearch("");setErrorMsg("Hay una corrección pendiente. Revisa la pregunta y presiona Corregido.");requestAnimationFrame(()=>document.getElementById("exam-question-"+pending.id)?.scrollIntoView({block:"start"}));return;}\n    const ve = validateExam();');
 R('    setSaving(true);\n    try {\n      const payloadQuestions','    setSaving(true);\n    try {\n      if(mathReviewSubject||questions.some(q=>isMathResponseMode(q.responseMode))){\n        const snapshot=questions;\n        const checked=await verifyQuestions(snapshot);\n        if(!checked){setErrorMsg("No se pudo ejecutar la verificación Python. Vuelve a Revisión e inténtalo nuevamente.");setActiveStep(3);return;}\n        if(checked.some(r=>r.status==="incorrect")){const first=checked.find(r=>r.status==="incorrect")!;setErrorMsg("Python detectó errores. Revisa las preguntas marcadas y presiona Corregido antes de publicar.");setActiveStep(3);setExpandAllQuestions(false);setOpenQuestionId(first.id);setQuestionSearch("");setQuestionFilter("all");requestAnimationFrame(()=>document.getElementById("exam-question-"+first.id)?.scrollIntoView({block:"start"}));return;}\n        if(JSON.stringify(snapshot.map(correctionSignature))!==JSON.stringify(reviewQuestionsRef.current.map(correctionSignature))){setErrorMsg("Las preguntas cambiaron durante la verificación. Vuelve a publicar.");return;}\n      }\n      const payloadQuestions');
 R('          questions: payloadQuestions,','          questions: payloadQuestions.map((payload,index)=>{const q=questions[index];return q.correctionReview?.required?{...payload,correctionReview:{required:true,confirmedSignature:q.correctionReview.confirmedSignature===correctionSignature(q)?correctionSignature(payload):undefined}}:payload;}),');
 R('{(/matem[aá]tica|f[ií]sica|qu[ií]mica|ciencias/i.test(subject))&&<ExamPythonReview questions={questions}/>}','{mathReviewSubject&&<div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs"><button type="button" disabled={pythonBusy||saving} onClick={()=>void verifyQuestions(questions)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-50">{pythonBusy?"Verificando…":"Verificar todas con Python"}</button> <span>Se comprueban los resultados admitidos antes de publicar.</span></div>}{pythonError&&<p role="alert" className="mb-3 text-xs text-red-700">{pythonError}</p>}');
 const start=s.indexOf('{enrichQuestionAnswerKey(q).qualityStatus==="review"&&<div role="alert"');
 const end=s.indexOf('<div hidden={!expandAllQuestions',start);
 if(start<0||end<0)throw Error("panel");
 s=s.slice(0,start)+`{(mathReviewSubject||examAnswerConsistencyIssues(q).length>0||q.correctionReview?.required)&&<ExamCorrectionPanel q={q} issues={examAnswerConsistencyIssues(q)} result={pythonResults[q.id]} required={needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q))} busy={pythonBusy||saving} onVerify={()=>void verifyQuestions([q])} onApply={fields=>applyPythonProposal(q.id,fields)} qualityReady={enrichQuestionAnswerKey(q).qualityStatus!=="review"} onConfirm={()=>confirmCorrection(q.id)}/>}
                    {enrichQuestionAnswerKey(q).qualityStatus==="review"&&<p className="mb-3 text-xs text-amber-900">{enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")}</p>}`+s.slice(end);
 s=s.replace('questionFilter==="pending" && (!q.question.trim()','questionFilter==="pending" && (needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)) || !q.question.trim()');
 s=s.replaceAll('distractorRationales: q.distractorRationales || [],','');
 s=s.replace("{...copy,id:uid()}","{...copy,id:uid(),correctionReview:copy.correctionReview?.required?{required:true as const}:undefined}");
 // EXAM_COMPACT_EDITOR_V1: preserve metadata and move secondary tools into one disclosure.
 const metaStart=s.indexOf('{(q.oaCodes?.length || q.pedagogicalMode || q.skill || q.evidence) && (');
 const outerEnd=s.indexOf('\n                        )}',metaStart);
 if(metaStart<0||outerEnd<0)throw Error("compact metadata");
 s=s.slice(0,metaStart)+s.slice(outerEnd+'\n                        )}'.length);
 R('<div hidden={!expandAllQuestions&&openQuestionId!==q.id} className="space-y-5 pt-4">','<div hidden={!expandAllQuestions&&openQuestionId!==q.id} className="space-y-3 pt-3">');
 R('                    {/* Material base / estímulo visible */}','                    <details className="rounded-xl border border-slate-200 bg-white px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Opciones adicionales · material, imagen y configuración</summary><div className="mt-3 space-y-2">{/* Material base / estímulo visible */}');
 R('                    {/* ── Alternativas','                    </div></details>\n                    <details className="rounded-xl border border-slate-200 bg-white px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Pauta ampliada · editar procedimiento</summary><div className="mt-2"><ExamVisualEditor className="w-full min-h-20 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-main" placeholder="Pasos o fundamentos, uno por línea" value={(q.solutionSteps||[]).join("\\n")} onChange={e=>updateQuestion(q.id,prev=>({...prev,solutionSteps:e.target.value.split("\\n")}))}/></div></details>\n                    {/* ── Alternativas');
 R('{enrichQuestionAnswerKey(q).qualityStatus==="review"&&<p className="mb-3 text-xs text-amber-900">{enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")}</p>}','{enrichQuestionAnswerKey(q).qualityStatus==="review"&&examAnswerConsistencyIssues(q).length===0&&<p className="mb-2 text-xs text-amber-900">{enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")}</p>}');
 R('{(mathReviewSubject||examAnswerConsistencyIssues(q).length>0||q.correctionReview?.required)&&<ExamCorrectionPanel','{(expandAllQuestions||openQuestionId===q.id)&&<ExamCorrectionPanel');
 R('className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs"','className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600"');
 R('Se comprueban los resultados admitidos antes de publicar.','Verificación automática al editar · sin IA.');
 s=s.replaceAll('RESULTADO FINAL EN LATEX (OPCIONAL)','RESULTADO FINAL (OPCIONAL)').replaceAll('RESULTADO FINAL (OPCIONAL, SOLO SI CORRESPONDE)','RESULTADO FINAL (OPCIONAL)');
 return s;
}
const p="app/examen/crear/page.tsx";writeFileSync(p,patch(readFileSync(p,"utf8")));
console.log("[exam-correction] corrección confirmada");
