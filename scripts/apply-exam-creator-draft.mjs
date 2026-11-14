import {readFileSync,writeFileSync} from "node:fs";
function patchDraft(s){
 if(s.includes("EXAM_CREATOR_HYBRID_DRAFT_V1"))return s;
 const R=(a,b)=>{if(!s.includes(a))throw Error("draft missing "+a.slice(0,100));s=s.replace(a,b)};
 R('import ExamMathText from "@/components/ui/ExamMathText";','import ExamMathText from "@/components/ui/ExamMathText";\nimport { useExamCreatorDraft } from "@/lib/exam/use-exam-creator-draft";\n// EXAM_CREATOR_HYBRID_DRAFT_V1');
 const start=s.indexOf('  const [autosaveState, setAutosaveState]'),end=s.indexOf('  const stepDataError',start);if(start<0||end<0)throw Error("draft block");
 const old=s.slice(start,end);
 const dataStart=old.indexOf('    data: {')+'    data: {'.length,dataEnd=old.indexOf('    },\n  });',dataStart);
 const restoreStart=old.indexOf('          if (typeof draft.title'),restoreEnd=old.indexOf('          setDraftRestored(true);',restoreStart);
 if(dataStart<0||dataEnd<0||restoreStart<0||restoreEnd<0)throw Error("draft anchors");
 const dataFields=old.slice(dataStart,dataEnd);
 const restore=old.slice(restoreStart,restoreEnd).replace('if (typeof draft.subject === "string") setSubject(draft.subject);','if (typeof draft.subject === "string") { if(draft.subject!==subject) restoredSubjectRef.current=draft.subject; setSubject(draft.subject); }');
 s=s.slice(0,start)+`  const [documentPreview,setDocumentPreview]=useState<ExamDocumentImportResult|null>(null);
  const [documentInferAnswers,setDocumentInferAnswers]=useState(false);
  const [documentAnalyzing,setDocumentAnalyzing]=useState(false);
  const draftData = {${dataFields}
    activeStep,creationMethod,openQuestionId,aiPrompt,aiModeIds,aiSkillFocus,aiSourceContext,aiAuthenticContext,
    aiMC,aiTF,aiDev,aiMixed,aiResponseModes,aiShowSourceToStudent,aiDiff,aiPreview,aiProvider,
    aiPreviewScope:aiPreviewScopeRef.current,generationCache:generationCacheRef.current,
    documentPreview,documentInferAnswers,questionAddType,questionAddResponseMode,
  };
  const {ready:draftReady,draftRestored,autosaveAt,autosaveState,cloudState,persistExamCreatorDraft,clearExamCreatorDraft,saveNow}=useExamCreatorDraft(userId,draftData,draft=>{
${restore}
    if(Number.isInteger(draft.activeStep)&&draft.activeStep>=0&&draft.activeStep<=4)setActiveStep(draft.activeStep);
    if(["none","ia","archivo","manual"].includes(draft.creationMethod)){setCreationMethod(draft.creationMethod);setAiOpen(draft.creationMethod==="ia");}
    if(typeof draft.openQuestionId==="string")setOpenQuestionId(draft.openQuestionId);
    if(typeof draft.aiPrompt==="string")setAiPrompt(draft.aiPrompt);
    if(Array.isArray(draft.aiModeIds))setAiModeIds(draft.aiModeIds.filter((id:string)=>PEDAGOGICAL_MODES.some(m=>m.id===id)));
    if(typeof draft.aiSkillFocus==="string")setAiSkillFocus(draft.aiSkillFocus);
    if(typeof draft.aiSourceContext==="string")setAiSourceContext(draft.aiSourceContext);
    if(typeof draft.aiAuthenticContext==="boolean")setAiAuthenticContext(draft.aiAuthenticContext);
    if(Number.isInteger(draft.aiMC))setAiMC(Math.max(0,Math.min(AI_TOTAL_LIMIT,draft.aiMC)));
    if(Number.isInteger(draft.aiTF))setAiTF(Math.max(0,Math.min(AI_TOTAL_LIMIT,draft.aiTF)));
    if(Number.isInteger(draft.aiDev))setAiDev(Math.max(0,Math.min(AI_TOTAL_LIMIT,draft.aiDev)));
    if(Number.isInteger(draft.aiMixed))setAiMixed(Math.max(0,Math.min(AI_TOTAL_LIMIT,draft.aiMixed)));
    if(Array.isArray(draft.aiResponseModes))setAiResponseModes(draft.aiResponseModes.filter((id:string)=>["short_text","long_text","math","text_math","math_steps"].includes(id)));
    if(typeof draft.aiShowSourceToStudent==="boolean")setAiShowSourceToStudent(draft.aiShowSourceToStudent);
    if(["facil","medio","dificil","mixto"].includes(draft.aiDiff))setAiDiff(draft.aiDiff);
    if(Array.isArray(draft.aiPreview)&&draft.aiPreview.length&&typeof draft.aiPreviewScope==="string"){setAiPreview(draft.aiPreview);aiPreviewScopeRef.current=draft.aiPreviewScope;setAiStatus("done");}
    if(["groq","openrouter","cloudflare","multiple",""].includes(draft.aiProvider))setAiProvider(draft.aiProvider);
    if(draft.generationCache&&typeof draft.generationCache.key==="string"&&Number.isInteger(draft.generationCache.completed)&&Array.isArray(draft.generationCache.questions))generationCacheRef.current=draft.generationCache;
    if(draft.documentPreview?.success&&Array.isArray(draft.documentPreview.questions)&&draft.documentPreview.preview)setDocumentPreview(draft.documentPreview);
    if(typeof draft.documentInferAnswers==="boolean")setDocumentInferAnswers(draft.documentInferAnswers);
    if(["multiple_choice","mixed_choice_development","true_false","development"].includes(draft.questionAddType))setQuestionAddType(draft.questionAddType);
    if(["short_text","long_text","math","text_math","math_steps"].includes(draft.questionAddResponseMode))setQuestionAddResponseMode(draft.questionAddResponseMode);
  });
  const [leavingForAgents,setLeavingForAgents]=useState(false);
  const leaveForAgents=async()=>{
    if(saving||leavingForAgents)return;
    if((documentAnalyzing||aiStatus==="generating"||aiRegenIdx!==null)&&!window.confirm("Hay un proceso activo. Se guardará el avance disponible, pero el proceso se interrumpirá al salir. ¿Volver a Agentes?"))return;
    setLeavingForAgents(true);
    try{await saveNow();router.push("/agentes");}catch{setLeavingForAgents(false);setErrorMsg("No se pudo guardar el borrador. Intenta nuevamente antes de salir.");}
  };
  const draftStatusText=cloudState==="synced"?"✓ Guardado en tu cuenta":cloudState==="syncing"?"Sincronizando…":cloudState==="conflict"?"Conflicto de borradores · copia local conservada":cloudState==="error"?"Sin conexión a la nube · guardado local":"Guardado local";
  // Borrador anterior recuperado automáticamente · eduai:exam-creator:draft:v1

`+s.slice(end);
 R('    if(saving)return;','    if(saving||!draftReady)return;');
 R('    setOpenQuestionId(imported[0].id);','    setDocumentPreview(null);\n    setOpenQuestionId(imported[0].id);');
 R('      clearExamCreatorDraft();\n      setCreatedExam({','      await clearExamCreatorDraft();\n      setCreatedExam({');
 R('  return (\n    <div className="min-h-screen bg-[radial-gradient','  if(!draftReady)return <div className="p-8 text-center text-sm text-slate-600" role="status">Recuperando tu último borrador…</div>;\n\n  return (\n    <div className="min-h-screen bg-[radial-gradient');
 R('<span role="status">{autosaveState==="saved"?"✓ Borrador guardado":autosaveState==="error"?"No se pudo guardar":"Autoguardado activo"}</span>',`<div className="flex flex-wrap items-center gap-2"><span role="status">{autosaveState==="error"&&cloudState!=="synced"?"No se pudo guardar localmente":draftStatusText}{autosaveAt?" · "+new Date(autosaveAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}</span>
          <button type="button" disabled={saving} onClick={()=>void saveNow()} className="rounded-lg border px-2 py-1 font-semibold">Guardar ahora</button>
          {(cloudState==="conflict"||cloudState==="error")&&<button type="button" disabled={saving||documentAnalyzing||aiStatus==="generating"||aiRegenIdx!==null} onClick={()=>{persistExamCreatorDraft();window.location.reload()}} className="underline">Recuperar / sincronizar</button>}
          <button type="button" disabled={saving||documentAnalyzing||aiStatus==="generating"||aiRegenIdx!==null} onClick={async()=>{if(window.confirm("¿Descartar el borrador e iniciar una evaluación nueva?")){await clearExamCreatorDraft();window.location.reload()}}} className="rounded-lg border px-2 py-1 text-red-700">Nueva evaluación</button></div>`);
 R('<ExamDocumentImporter onApply={applyDocumentImport} />','<ExamDocumentImporter onApply={applyDocumentImport} result={documentPreview} onResultChange={setDocumentPreview} inferAnswers={documentInferAnswers} onInferAnswersChange={setDocumentInferAnswers} onBusyChange={setDocumentAnalyzing} />');
 R('      {aiPreview.length>0&&<p className="mt-3 text-xs text-amber-700">Hay preguntas IA pendientes de incorporar.</p>}','      {documentAnalyzing&&<p className="mt-3 text-xs text-sky-700">Análisis de archivo en curso.</p>}{(aiPreview.length>0||documentPreview)&&<div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-700"><span>Hay preguntas pendientes de incorporar.</span>{aiPreview.length>0&&<button type="button" disabled={aiRegenIdx!==null} className="font-bold underline" onClick={()=>{if(window.confirm("¿Descartar únicamente las preguntas IA pendientes?")){setAiPreview([]);setAiStatus("idle");generationCacheRef.current=null;}}}>Descartar vista IA</button>}{documentPreview&&<button type="button" className="font-bold underline" onClick={()=>{if(window.confirm("¿Descartar únicamente el análisis del archivo?"))setDocumentPreview(null)}}>Descartar análisis PDF/Word</button>}</div>}');
 R('onClick={clearExamCreatorDraft}','disabled={saving||documentAnalyzing||aiStatus==="generating"||aiRegenIdx!==null} onClick={async()=>{if(window.confirm("¿Descartar el borrador completo?")){await clearExamCreatorDraft();window.location.reload()}}}');
 R('onClick={()=>{persistExamCreatorDraft();router.push("/examen/docente")}}','onClick={async()=>{await saveNow();router.push("/examen/docente")}}');
 R('onClick={() => router.push("/examen/docente")}\n                  className="w-full py-3 rounded-2xl','onClick={async()=>{await saveNow();router.push("/examen/docente")}}\n                  className="w-full py-3 rounded-2xl');
 R('          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">','          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 pt-1"><button type="button" onClick={()=>void leaveForAgents()} disabled={saving||leavingForAgents} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50">{leavingForAgents?"Guardando…":"← Volver a Agentes"}</button><span className="text-[11px] text-slate-500">Tu borrador se conserva al salir</span></div>\n          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">');
 // All users must have access to OA opt-out in step 2.
 const pos=s.indexOf('id="exam-section-objetivos"'),inner=s.indexOf('              <div className="flex flex-col gap-3',pos);
 if(pos<0||inner<0)throw Error("OA section");
 s=s.slice(0,inner)+`              <label className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-emerald-900"><input type="checkbox" checked={aiRequireOA} onChange={e=>setAiRequireOA(e.target.checked)}/> Vincular OA obligatoriamente · manual e IA</label>
`+s.slice(inner);
 // Do not let pending previews be lost by publishing.
 R('    const ve = validateExam();','    if(documentAnalyzing||aiStatus==="generating"||aiRegenIdx!==null||aiPreview.length||documentPreview){setErrorMsg("Hay preguntas pendientes de incorporar o una generación activa. Regresa a Creación antes de publicar.");return;}\n    const ve = validateExam();');
 return s;
}
const p="app/examen/crear/page.tsx";writeFileSync(p,patchDraft(readFileSync(p,"utf8")));
console.log("[exam-draft] guardado híbrido");
