import {readFileSync,writeFileSync} from "node:fs";
function patchWizard(s){
 if(s.includes("EXAM_CREATOR_WIZARD_V1"))return s;
 const R=(a,b)=>{if(!s.includes(a))throw Error("missing "+a.slice(0,100));s=s.replace(a,b)};
 R('const EXAM_CREATOR_STEPS = [','// EXAM_CREATOR_WIZARD_V1\nconst EXAM_CREATOR_STEPS = [');
 const a=s.indexOf("const EXAM_CREATOR_STEPS = ["),b=s.indexOf("] as const;",a)+11;
 s=s.slice(0,a)+`const EXAM_CREATOR_STEPS = [
  { id: "datos", label: "1. Datos", icon: "📝" },
  { id: "objetivos", label: "2. OA y diseño", icon: "🎯" },
  { id: "archivo", label: "3. Creación", icon: "✨" },
  { id: "preguntas", label: "4. Revisión", icon: "📋" },
  { id: "publicar", label: "5. Publicar", icon: "🚀" },
] as const;`+s.slice(b);
 const x=s.indexOf("function getExamCreatorStepIndex()"),y=s.indexOf("function normalizeTextForSearch",x);s=s.slice(0,x)+s.slice(y);
 R('  const [activeStep, setActiveStep] = useState(0);',`  const [activeStep, setActiveStep] = useState(0);
  const [creationMethod, setCreationMethod] = useState<"none" | "ia" | "archivo" | "manual">("none");
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionFilter, setQuestionFilter] = useState("all");
  const restoredSubjectRef = useRef<string | null>(null);`);
 const e=s.indexOf('  useEffect(() => {\n    const onScroll = () => setActiveStep'),g=s.indexOf('  const toggleOA',e);if(e<0||g<0)throw Error("scroll");s=s.slice(0,e)+s.slice(g);
 const j=s.indexOf('  const jumpToSection = '),k=s.indexOf('  // ── Preguntas manuales',j);if(j<0||k<0)throw Error("jump");
 s=s.slice(0,j)+`  const jumpToSection = (sectionId: string) => {
    const target = sectionId==="datos"?0:["objetivos","diseno"].includes(sectionId)?1:["archivo","ia"].includes(sectionId)?2:sectionId==="preguntas"?3:4;
    if(sectionId==="ia"){setCreationMethod("ia");setAiOpen(true);}
    setActiveStep(target);
    setErrorMsg("");
    window.scrollTo({top:0,behavior:"auto"});
  };

`+s.slice(k);
 R('    setAiModeIds(getSubjectPedagogyProfile(subject).preferredModes);','    if(restoredSubjectRef.current===subject){restoredSubjectRef.current=null;return;}\n    setAiModeIds(getSubjectPedagogyProfile(subject).preferredModes);');
 R('  const applyDocumentImport = ',`  const stepDataError = () => !curriculumCurso || !subject ? "Selecciona curso y asignatura." : !rosterCourse.trim() ? "Indica curso y sección." : !title.trim() ? "Ingresa el título." : !topic.trim() ? "Ingresa el tema." : "";
  const goStep = (next: number, chosenMethod = creationMethod) => {
    if(saving)return;
    if(next>activeStep){
      const invalid=stepDataError();
      if(invalid){setActiveStep(0);setErrorMsg(invalid);window.scrollTo(0,0);return;}
      if(next>=2&&aiRequireOA&&!selectedOAs.length){setActiveStep(1);setOaOpen(true);setErrorMsg("Selecciona al menos un OA o desactiva el requisito.");window.scrollTo(0,0);return;}
    }
    if(next>=3&&chosenMethod==="none"&&!questions.some(q=>q.question.trim())){setActiveStep(2);setErrorMsg("Elige cómo crear las preguntas.");window.scrollTo(0,0);return;}
    setErrorMsg("");setActiveStep(Math.max(0,Math.min(4,next)));window.scrollTo({top:0,behavior:"auto"});
  };
  const chooseCreationMethod=(method:"ia"|"archivo"|"manual")=>{
    setCreationMethod(method);
    if(method==="ia")setAiOpen(true);
    if(method==="manual"){setOpenQuestionId(old=>old||questions[0]?.id||null);goStep(3,method);}
  };
  const applyDocumentImport = `);
 R('    setQuestions((current) => appendExamQuestions(current, imported));','    setQuestions((current) => appendExamQuestions(current, imported));\n    setOpenQuestionId(imported[0].id);\n    jumpToSection("preguntas");');
 R('    setQuestions((prev) => appendExamQuestions(prev, aiPreview));','    setQuestions((prev) => appendExamQuestions(prev, aiPreview));\n    setOpenQuestionId(aiPreview[0].id);\n    jumpToSection("preguntas");');
 R('    setQuestions((p) => appendExamQuestions(p, [nextQuestion]));','    setQuestions((p) => appendExamQuestions(p, [nextQuestion]));\n    setOpenQuestionId(nextQuestion.id);setQuestionFilter("all");setQuestionSearch("");');
 R('grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7','grid grid-cols-2 gap-2 sm:grid-cols-5');
 R('onClick={() => jumpToSection(step.id)}','onClick={()=>goStep(index)}\n                aria-current={activeStep===index?"step":undefined}');
 R('        <div className="grid xl:grid-cols-[1fr_330px] gap-6">',`        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-4 py-3 text-xs">
          <strong>Paso {activeStep+1} de 5 · {questions.filter(q=>q.question.trim()).length} preguntas · {totalPoints} pts</strong>
          <span role="status">{autosaveState==="saved"?"✓ Borrador guardado":autosaveState==="error"?"No se pudo guardar":"Autoguardado activo"}</span>
        </div>
        {draftRestored&&<p className="mb-3 text-xs text-sky-700">Borrador anterior recuperado automáticamente.</p>}
        {errorMsg&&<p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</p>}
        {successMsg&&<p role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMsg}</p>}
        <div className="grid gap-6">`);
 for(const [id,condition] of [["datos","activeStep !== 0"],["objetivos","activeStep !== 1"],["diseno","activeStep !== 1"],["ia",'activeStep !== 2 || creationMethod !== "ia"'],["preguntas","activeStep !== 3"]])R('id="exam-section-'+id+'"','id="exam-section-'+id+'"\n              style={{display: '+condition+' ? "none" : undefined}}');
 R('            <section id="exam-section-archivo" className="scroll-mt-32">',`            <section hidden={activeStep!==2} className="rounded-[28px] border border-blue-200 bg-white p-5">
              <h2 className="text-lg font-black">¿Cómo quieres crear las preguntas?</h2>
              <p className="mb-4 text-sm text-slate-600">Puedes combinar los tres métodos sin reemplazar preguntas.</p>
              <div className="grid gap-3 sm:grid-cols-3">{([{id:"ia",icon:"✨",label:"Generar con IA",desc:"Desde OA, tema y perfil pedagógico"},{id:"archivo",icon:"📄",label:"Importar PDF / Word",desc:"Usar una evaluación existente"},{id:"manual",icon:"✏️",label:"Crear manualmente",desc:"Abrir el editor de preguntas"}] as const).map(method=><button key={method.id} type="button" aria-pressed={creationMethod===method.id} onClick={()=>chooseCreationMethod(method.id)} className={"rounded-2xl border p-4 text-left "+(creationMethod===method.id?"border-blue-500 bg-blue-50":"border-slate-200 bg-slate-50")}><span className="text-2xl">{method.icon}</span><strong className="mt-2 block text-sm">{method.label}</strong><span className="block text-xs text-slate-600">{method.desc}</span></button>)}</div>
              {aiStatus==="generating"&&<p className="mt-3 text-xs text-violet-700">{aiProgressLabel || "Generación en curso"}</p>}
              {aiPreview.length>0&&<p className="mt-3 text-xs text-amber-700">Hay preguntas IA pendientes de incorporar.</p>}
            </section>
            <section id="exam-section-archivo" style={{display:activeStep!==2||creationMethod!=="archivo"?"none":undefined}} className="scroll-mt-32">`);
 R('              <div className="space-y-5">\n                {questions.map((q, index) => (',`              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input aria-label="Buscar preguntas" value={questionSearch} onChange={e=>setQuestionSearch(e.target.value)} placeholder="Buscar enunciado…" className="min-w-[160px] flex-1 rounded-xl border px-3 py-2 text-sm"/>
                <select aria-label="Filtrar preguntas" value={questionFilter} onChange={e=>setQuestionFilter(e.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="all">Todos los tipos</option><option value="multiple_choice">Alternativas</option><option value="mixed_choice_development">Mixtas</option><option value="true_false">V/F</option><option value="development">Construidas</option><option value="pending">Pendientes</option></select>
                <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={()=>setOpenQuestionId(null)}>Plegar todas</button>
                <button type="button" className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700" onClick={()=>goStep(2)}>+ IA o PDF</button>
              </div>
              <div className="mb-4 flex flex-wrap gap-1">{questions.map((q,index)=><button key={q.id} type="button" title={"Pregunta "+(index+1)} onClick={()=>{setQuestionSearch("");setQuestionFilter("all");setOpenQuestionId(q.id);requestAnimationFrame(()=>document.getElementById("exam-question-"+q.id)?.scrollIntoView({block:"center"}));}} className={"rounded-lg border px-2 py-1 text-xs "+(openQuestionId===q.id?"bg-blue-600 text-white":"bg-white")}>{index+1}</button>)}</div>
              <div className="space-y-3">
                {questions.map((q, index) => (`);
 R('                    key={q.id}\n                    className="rounded-2xl border border-medium bg-card-soft-theme p-4 md:p-5"','                    key={q.id}\n                    id={"exam-question-"+q.id}\n                    style={{display: ((questionFilter==="all" || questionFilter===q.type || (questionFilter==="pending" && (!q.question.trim() || enrichQuestionAnswerKey(q).qualityStatus==="review" || (aiRequireOA && (!q.oaCodes?.length || q.oaCodes.some(code=>!selectedOAIds.includes(code)))) || (q.type!=="development" && (!Number.isInteger(q.correctAnswer)||q.correctAnswer<0))))) && normalizeTextForSearch(q.question).includes(normalizeTextForSearch(questionSearch))) ? undefined : "none"}}\n                    className="rounded-2xl border border-medium bg-card-soft-theme p-4 md:p-5"');
 R('                    {/* Enunciado */}','                    <button type="button" aria-expanded={openQuestionId===q.id} onClick={()=>setOpenQuestionId(old=>old===q.id?null:q.id)} className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm"><span className="line-clamp-2">{q.question || "Enunciado pendiente"}</span><span className="shrink-0 text-xs font-bold text-blue-700">{openQuestionId===q.id?"Plegar ↑":"Editar ↓"}</span></button>\n                    <div hidden={openQuestionId!==q.id}>\n                    {/* Enunciado */}');
 const ce=s.indexOf('                ))}\n              </div>\n\n              <div className="mt-8 rounded-3xl');if(ce<0)throw Error("card end");const ld=s.lastIndexOf('                  </div>',ce);s=s.slice(0,ld)+'                    </div>\n'+s.slice(ld);
 R('<aside className="space-y-6">','<aside style={{display:activeStep===4?undefined:"none"}} className="space-y-6">');
 R('className="rounded-[28px] border border-blue-200 bg-white/95 p-5 sticky top-28 shadow-sm ring-1 ring-white/80"','className="rounded-[28px] border border-blue-200 bg-white/95 p-5 shadow-sm ring-1 ring-white/80"');
 R('<h2 className="text-lg font-bold mb-4">Resumen</h2>',`<h2 className="text-lg font-bold mb-4">Revisión final y publicación</h2>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">{[{label:"Datos y seguridad",step:0},{label:"OA y diseño",step:1},{label:"Método de creación",step:2},{label:"Preguntas y pauta",step:3}].map(item=><button type="button" key={item.step} onClick={()=>goStep(item.step)} className="rounded-xl border p-3 text-left text-sm font-semibold">{item.label} · Revisar →</button>)}</div>
              <details className="mb-4 rounded-xl border border-emerald-200 p-3"><summary className="cursor-pointer font-semibold text-sm">Vista previa del contenido (sin respuestas)</summary><div className="mt-3 space-y-3"><div className="rounded-xl border bg-slate-50 p-3"><p className="text-lg font-bold">{title || "Evaluación"}</p><p className="text-xs text-slate-600">{subject} · {curriculumCurso} · {timeLimit} min</p><div className="mt-2 whitespace-pre-wrap"><ExamMathText text={instructions}/></div></div>{questions.map((q,index)=><div key={q.id} className="rounded-xl border p-3 text-sm"><p className="font-bold">Pregunta {index+1} · {getQuestionPoints(q)} pts</p>{q.showStimulusToStudent&&q.stimulusText&&<div className="my-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2"><strong>{q.stimulusTitle}</strong><ExamMathText text={q.stimulusText}/></div>}<ExamMathText text={q.question}/>{q.imageUrl&&<img src={q.imageUrl} alt="Imagen de pregunta" className="max-h-48 object-contain"/>}{(q.type==="multiple_choice"||q.type==="mixed_choice_development")&&q.options.map((option,i)=><div key={i} className="mt-1"><ExamMathText text={String.fromCharCode(65+i)+". "+option}/>{q.optionImageUrls?.[i]&&<img src={q.optionImageUrls[i]} alt={"Alternativa "+(i+1)} className="max-h-32 object-contain"/>}</div>)}{q.type==="true_false"&&<p>○ Verdadero · ○ Falso</p>}{(q.type==="development"||q.type==="mixed_choice_development")&&<div className="mt-2 rounded-lg border border-dashed p-4 text-slate-500">Espacio de respuesta</div>}</div>)}</div></details>`);
 R('          </aside>\n        </div>','          </aside>\n        </div>\n        <nav aria-label="Navegación de etapas" className="sticky bottom-2 z-30 mt-6 flex items-center justify-between gap-2 rounded-2xl border bg-white/95 p-3 shadow-lg"><button type="button" onClick={()=>goStep(activeStep-1)} disabled={activeStep===0||saving} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">← Anterior</button><button type="button" onClick={()=>{persistExamCreatorDraft();router.push("/examen/docente")}} disabled={saving} className="text-xs font-semibold text-slate-600">Guardar y salir</button>{activeStep<4?<button type="button" disabled={saving} onClick={()=>goStep(activeStep+1)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Guardar y continuar →</button>:<span className="text-xs text-slate-600">Publica desde el resumen</span>}</nav>');
 // Keep a visible OA opt-out in step 2.
 R('              id="exam-section-objetivos"\n              style={{display: activeStep !== 1 ? "none" : undefined}}','              id="exam-section-objetivos"\n              style={{display: activeStep !== 1 ? "none" : undefined}}');
 R('                    Paso 2 · OA MINEDUC','                    Paso 2 · OA MINEDUC');
 return s;
}
const p="app/examen/crear/page.tsx";writeFileSync(p,patchWizard(readFileSync(p,"utf8")));
console.log("[exam-wizard] cinco etapas");
