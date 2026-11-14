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
      return {...next,correctionReview:{required:true,confirmedSignature:q.correctionReview?.confirmedSignature}};
    }
    return next;
  }));
  const verifyQuestions=async(items:Question[])=>{
    setPythonError("");
    try{
      const results:PythonResult[]=[];
      for(let i=0;i<items.length;i+=100)results.push(...await verifyPython(items.slice(i,i+100)));
      const records=Object.fromEntries(results.map((data,i)=>[items[i].id,{signature:correctionSignature(items[i]),data}]));
      setPythonResults(old=>({...old,...records}));
      setQuestions(old=>old.map(q=>records[q.id]?.signature===correctionSignature(q)&&records[q.id].data.status==="incorrect"?{...q,correctionReview:{required:true}}:q));
      return results;
    }catch(e){setPythonError(e instanceof Error?e.message:"No se pudo verificar con Python.");return null;}
  };
  const applyPythonProposal=(id:string,fields:NonNullable<PythonResult["proposal"]>["fields"])=>{
    const q=reviewQuestionsRef.current.find(q=>q.id===id);
    const record=pythonResults[id];
    if(!q||!record||record.signature!==correctionSignature(q)||q.type!=="development")return;
    if(!window.confirm("¿Aplicar la propuesta calculada? Se conservarán el enunciado, la rúbrica y el puntaje."))return;
    const corrected={...q,...fields,correctionReview:{required:true as const}};
    setQuestions(old=>old.map(item=>item.id===id&&correctionSignature(item)===record.signature?corrected:item));
    void verifyQuestions([corrected]);
  };
  const confirmCorrection=(id:string)=>{
    setQuestions(old=>old.map(q=>{
      if(q.id!==id||examAnswerConsistencyIssues(q).length||enrichQuestionAnswerKey(q).qualityStatus==="review")return q;
      const record=pythonResults[id],signature=correctionSignature(q);
      if(!record||record.signature!==signature||record.data.status==="incorrect")return q;
      return {...q,correctionReview:{required:true,confirmedSignature:signature}};
    }));
  };`);
 R('      const quality = enrichQuestionAnswerKey(q);','      if(needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)))return "La pregunta "+(i+1)+" tiene una corrección pendiente. Revísala y presiona Corregido.";\n      const quality = enrichQuestionAnswerKey(q);');
 R('    const ve = validateExam();','    if(pythonBusy)return;\n    const ve = validateExam();');
 R('    setSaving(true);\n    try {\n      const payloadQuestions','    setSaving(true);\n    try {\n      if(mathReviewSubject){\n        const snapshot=questions;\n        const checked=await verifyQuestions(snapshot);\n        if(!checked){setErrorMsg("No se pudo ejecutar la verificación Python. Vuelve a Revisión e inténtalo nuevamente.");setActiveStep(3);return;}\n        if(checked.some(r=>r.status==="incorrect")){setErrorMsg("Python detectó errores. Revisa las preguntas marcadas y presiona Corregido antes de publicar.");setActiveStep(3);return;}\n        if(JSON.stringify(snapshot.map(correctionSignature))!==JSON.stringify(reviewQuestionsRef.current.map(correctionSignature))){setErrorMsg("Las preguntas cambiaron durante la verificación. Vuelve a publicar.");return;}\n      }\n      const payloadQuestions');
 R('          questions: payloadQuestions,','          questions: payloadQuestions.map((payload,index)=>{const q=questions[index];return q.correctionReview?.required?{...payload,correctionReview:{required:true,confirmedSignature:q.correctionReview.confirmedSignature===correctionSignature(q)?correctionSignature(payload):undefined}}:payload;}),');
 R('{(/matem[aá]tica|f[ií]sica|qu[ií]mica|ciencias/i.test(subject))&&<ExamPythonReview questions={questions}/>}','{mathReviewSubject&&<div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs"><button type="button" disabled={pythonBusy||saving} onClick={()=>void verifyQuestions(questions)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-50">{pythonBusy?"Verificando…":"Verificar todas con Python"}</button> <span>Se comprueban los resultados admitidos antes de publicar.</span></div>}{pythonError&&<p role="alert" className="mb-3 text-xs text-red-700">{pythonError}</p>}');
 const start=s.indexOf('{enrichQuestionAnswerKey(q).qualityStatus==="review"&&<div role="alert"');
 const end=s.indexOf('<div hidden={!expandAllQuestions',start);
 if(start<0||end<0)throw Error("panel");
 s=s.slice(0,start)+`{(mathReviewSubject||examAnswerConsistencyIssues(q).length>0||q.correctionReview?.required)&&<ExamCorrectionPanel q={q} issues={examAnswerConsistencyIssues(q)} result={pythonResults[q.id]} required={needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q))} busy={pythonBusy||saving} onVerify={()=>void verifyQuestions([q])} onApply={fields=>applyPythonProposal(q.id,fields)} onConfirm={()=>confirmCorrection(q.id)}/>}
                    {enrichQuestionAnswerKey(q).qualityStatus==="review"&&<p className="mb-3 text-xs text-amber-900">{enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")}</p>}`+s.slice(end);
 s=s.replace('questionFilter==="pending" && (!q.question.trim()','questionFilter==="pending" && (needsCorrectionConfirmation(q,examAnswerConsistencyIssues(q)) || !q.question.trim()');
 s=s.replaceAll('distractorRationales: q.distractorRationales || [],','');
 return s;
}
const p="app/examen/crear/page.tsx";writeFileSync(p,patch(readFileSync(p,"utf8")));
console.log("[exam-correction] corrección confirmada");
