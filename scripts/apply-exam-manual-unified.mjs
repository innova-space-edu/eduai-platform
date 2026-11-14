import { readFileSync, writeFileSync } from "node:fs";
const path="app/examen/crear/page.tsx";
let s=readFileSync(path,"utf8");
if(!s.includes("EXAM_MANUAL_UNIFIED_V1")){
  const replace=(a,b)=>{if(!s.includes(a))throw new Error("[exam-manual] missing "+a.slice(0,100));s=s.replace(a,b)};
  replace('import ExamMathText from "@/components/ui/ExamMathText";','import ExamMathText from "@/components/ui/ExamMathText";\nimport { ExamImageEditor, ManualQuestionTools } from "@/components/exam/ManualQuestionTools";\n// EXAM_MANUAL_UNIFIED_V1');
  // All generated, imported and manual questions live in the same array.
  replace('  const removeQuestion = (id: string) =>\n    setQuestions((p) => p.filter((q) => q.id !== id));',`  const removeQuestion = (id: string) => {
    if (!window.confirm("¿Eliminar esta pregunta del examen?")) return;
    setQuestions((p) => p.filter((q) => q.id !== id));
  };
  const moveQuestion = (id: string, direction: number) => setQuestions(current => {
    const index = current.findIndex(q => q.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= current.length) return current;
    const copy = [...current];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    return copy;
  });
  const duplicateQuestion = (id: string) => setQuestions(current => {
    const index = current.findIndex(q => q.id === id);
    if(index < 0) return current;
    const copy = JSON.parse(JSON.stringify(current[index])) as Question;
    return [...current.slice(0,index+1), {...copy,id:uid()}, ...current.slice(index+1)];
  });
  const reuseStimulus = (q: Question, type: QuestionType, responseMode: ResponseMode) => {
    const next = defaultQuestion(type);
    setQuestions(current => [...current, {...next, stimulusKind:q.stimulusKind, stimulusTitle:q.stimulusTitle, stimulusText:q.stimulusText, showStimulusToStudent:true, oaCodes:[...(q.oaCodes||[])], ...((next.type==="development"||next.type==="mixed_choice_development")?{responseMode}: {})} as Question]);
    if ((type==="development"||type==="mixed_choice_development") && isMathResponseMode(responseMode)) {
      setDevelopmentNotebookEnabled(true);setDevelopmentNotebookMode("development_only");
    }
  };
  const copyStimulusTo = (q: Question, ids: string[]) => {
    if(!window.confirm("¿Copiar el material completo a las preguntas seleccionadas? Solo se sustituirá su contexto, no sus enunciados ni respuestas."))return;
    setQuestions(current => current.map(item => ids.includes(item.id)?{...item,stimulusKind:q.stimulusKind,stimulusTitle:q.stimulusTitle,stimulusText:q.stimulusText,showStimulusToStudent:true}:item));
  };`);
  replace('                      <button\n                        onClick={() => removeQuestion(q.id)}',`                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button type="button" onClick={()=>moveQuestion(q.id,-1)} disabled={index===0} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30" title="Subir pregunta">↑</button>
                        <button type="button" onClick={()=>moveQuestion(q.id,1)} disabled={index===questions.length-1} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30" title="Bajar pregunta">↓</button>
                        <button type="button" onClick={()=>duplicateQuestion(q.id)} className="rounded-lg border px-2 py-1 text-xs">Duplicar</button>
                      <button
                        onClick={() => removeQuestion(q.id)}`);
  replace('                        disabled={questions.length === 1}\n','');
  replace('                        Eliminar\n                      </button>\n                    </div>', '                        Eliminar\n                      </button>\n                      </div>\n                    </div>');
  // Keep context compact and show populated content by default, with visible-by-default text on manual entry.
  replace('                    <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">','                    <details open={Boolean(q.stimulusText?.trim()) || undefined} className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">\n                      <summary className="cursor-pointer mb-3 text-xs font-bold text-sky-900">Material de apoyo · lectura, fuente, datos, caso o experimento</summary>');
  replace('onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, stimulusText: e.target.value }))}','onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, stimulusText: e.target.value, showStimulusToStudent: prev.stimulusText?.trim() ? prev.showStimulusToStudent : Boolean(e.target.value.trim()) }))}');
  replace('                    </div>\n\n                    {(q.type === "development" || q.type === "mixed_choice_development") && (','                    </details>\n\n                    {(q.type === "development" || q.type === "mixed_choice_development") && (');
  const imageStart=s.indexOf('                    {/* Imagen opcional */}');
  const imageEnd=s.indexOf('                    {/* ── Alternativas',imageStart);
  if(imageStart<0||imageEnd<0)throw new Error("[exam-manual] image section");
  s=s.slice(0,imageStart)+`                    <ExamImageEditor value={q.imageUrl} onChange={url=>updateQuestion(q.id,prev=>({...prev,imageUrl:url}))}/>
                    <ManualQuestionTools q={q} patch={patch=>updateQuestion(q.id,prev=>({...prev,...patch} as Question))}
                      oaOptions={selectedOAs.map(oa=>({id:getOASelectionKey(oa),label:oa.texto||getOASelectionKey(oa)}))}
                      modes={PEDAGOGICAL_MODES.map(mode=>({id:mode.id,label:mode.label}))} requireOA={aiRequireOA} recommendedModes={subjectProfile.preferredModes}
                      onReuse={(type,mode)=>reuseStimulus(q,type,mode)} onCopyTo={ids=>copyStimulusTo(q,ids)}
                      targets={questions.filter(item=>item.id!==q.id).map(item=>({id:item.id,label:"Pregunta "+(questions.findIndex(other=>other.id===item.id)+1)+" · "+(item.question||"Sin enunciado").slice(0,65)}))}/>
                    `+s.slice(imageEnd);
  const optionStart='                              {q.optionImageUrls?.[optIndex] && (';
  const optionEnd='                            </div>\n                            <label className="flex items-center gap-2 text-sm text-sub whitespace-nowrap">';
  let count=0;
  while(s.includes(optionStart)){
    const start=s.indexOf(optionStart),end=s.indexOf(optionEnd,start);
    if(end<0)throw new Error("[exam-manual] option image end");
    s=s.slice(0,start)+`                              <details open={Boolean(q.optionImageUrls?.[optIndex]) || undefined} className="mt-2">
                                <summary className="cursor-pointer text-xs font-semibold text-blue-700">Imagen de alternativa {optIndex+1}</summary>
                                <ExamImageEditor label={"Imagen alternativa "+(optIndex+1)} value={q.optionImageUrls?.[optIndex]} onChange={url=>updateQuestion(q.id,prev=>{
                                  if(prev.type!=="multiple_choice"&&prev.type!=="mixed_choice_development")return prev;
                                  const urls=prev.options.map((_,i)=>prev.optionImageUrls?.[i]||"");urls[optIndex]=url;
                                  return {...prev,optionImageUrls:urls};
                                })}/>
                              </details>
`+s.slice(end);count++;
  }
  // The mixed-choice card has a different indentation from the original alternatives card.
  const mixedRadio=s.indexOf('name={`mixed-correct-${q.id}`}');
  if(mixedRadio<0)throw new Error("[exam-manual] mixed radio missing");
  const mixedInput=s.lastIndexOf('<input',s.lastIndexOf('placeholder={`Alternativa ${optIndex + 1}`}',mixedRadio));
  const mixedEnd=s.indexOf('/>',s.lastIndexOf('placeholder={`Alternativa ${optIndex + 1}`}',mixedRadio))+2;
  if(mixedInput<0||mixedEnd<=mixedInput)throw new Error("[exam-manual] mixed input missing");
  s=s.slice(0,mixedInput)+`<div className="min-w-0">`+s.slice(mixedInput,mixedEnd)+`
    <details open={Boolean(q.optionImageUrls?.[optIndex]) || undefined} className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-blue-700">Imagen de alternativa {optIndex+1}</summary>
      <ExamImageEditor label={"Imagen alternativa "+(optIndex+1)} value={q.optionImageUrls?.[optIndex]} onChange={url=>updateQuestion(q.id,prev=>{
        if(prev.type!=="mixed_choice_development")return prev;
        const urls=prev.options.map((_,i)=>prev.optionImageUrls?.[i]||"");urls[optIndex]=url;
        return {...prev,optionImageUrls:urls};
      })}/>
    </details></div>`+s.slice(mixedEnd);
  if(count!==1)throw new Error("[exam-manual] expected one original choice image editor");
  const defaultStart=s.indexOf("function defaultQuestion("), defaultEnd=s.indexOf("function appendExamQuestions(",defaultStart);
  if(defaultStart<0||defaultEnd<0)throw new Error("[exam-manual] default question block");
  s=s.slice(0,defaultStart)+s.slice(defaultStart,defaultEnd).replaceAll("correctAnswer: 0,","correctAnswer: -1,").replaceAll('answerText: "Verdadero",','answerText: "",')+s.slice(defaultEnd);
  // Single empty starter must not hide manually entered stimuli, metadata or images.
  replace('!starter.explanation?.trim() && !starter.answerText?.trim()', '(starter.correctAnswer === -1 || starter.correctAnswer === 0) && !starter.stimulusText?.trim() && !starter.stimulusTitle?.trim() && !starter.oaCodes?.length && !starter.pedagogicalMode && !starter.skill?.trim() && !starter.evidence?.trim() && !starter.optionImageUrls?.some(Boolean) && !starter.explanation?.trim() && !starter.answerText?.trim()');
  replace('    setQuestions((p) => [...p, nextQuestion]);','    setQuestions((p) => appendExamQuestions(p, [nextQuestion]));');
  // Explicit manual curriculum check only when OA policy is active and selection exists; allow teacher opt-out.
  replace('      if (!q.question.trim()) return `La pregunta ${i + 1} no tiene enunciado.`;','      if (!q.question.trim()) return `La pregunta ${i + 1} no tiene enunciado.`;\n      if ((q.type === "multiple_choice" || q.type === "mixed_choice_development" || q.type === "true_false") && (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= (q.type === "true_false" ? 2 : q.options.length))) return `Selecciona explícitamente la respuesta correcta de la pregunta ${i+1}.`;\n      if (aiRequireOA && (!selectedOAs.length || !q.oaCodes?.length || q.oaCodes.some(code=>!selectedOAs.some(oa=>getOASelectionKey(oa)===code)))) return `La pregunta ${i+1} necesita un OA seleccionado en el paso 2. Asócialo en su perfil o desactiva el requisito de OA.`;\n      if (q.stimulusText?.trim() && !q.showStimulusToStudent && !window.confirm(`La pregunta ${i+1} tiene material oculto al estudiante. ¿Publicar de todos modos?`)) return `Revisa la visibilidad del material de la pregunta ${i+1}.`;');
  replace('                <h2 className="text-lg font-bold">Preguntas del examen</h2>','                <div><h2 className="text-lg font-bold">Preguntas del examen</h2><p className="mt-1 text-xs text-slate-600">Editor único: crea manualmente, revisa las preguntas de IA o PDF, duplica, ordena y elimina.</p></div>');
  replace('              <div className="space-y-5">\n                {questions.map','              {questions.length===0&&<p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-slate-600">No hay preguntas. Agrega una manualmente, importa un archivo o genera con IA.</p>}\n              <div className="space-y-5">\n                {questions.map');
  replace('              {questions.length===0&&', '              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900"><label className="flex gap-2 items-center font-semibold"><input type="checkbox" checked={aiRequireOA} onChange={e=>setAiRequireOA(e.target.checked)}/> Vincular OA obligatoriamente (manual e IA)</label><span>{selectedOAs.length} OA seleccionados en el paso 2</span></div>\n              {questions.length===0&&');
  writeFileSync(path,s);
}
console.log("[exam-manual] editor manual integrado");
