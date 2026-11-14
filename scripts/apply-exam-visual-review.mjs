import {readFileSync,writeFileSync} from "node:fs";
function patchVisual(s){
 if(s.includes("EXAM_VISUAL_REVIEW_V1"))return s;
 const R=(a,b)=>{if(!s.includes(a))throw Error("visual missing "+a.slice(0,110));s=s.replace(a,b)};
 R('import ExamMathText from "@/components/ui/ExamMathText";','import ExamMathText from "@/components/ui/ExamMathText";\nimport ExamVisualEditor from "@/components/exam/ExamVisualEditor";\nimport ExamPythonReview from "@/components/exam/ExamPythonReview";\n// EXAM_VISUAL_REVIEW_V1');
 R('  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);','  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);\n  const [expandAllQuestions,setExpandAllQuestions]=useState(false);');
 s=s.replaceAll('setOpenQuestionId(imported[0].id);','setOpenQuestionId(null);setExpandAllQuestions(false);').replaceAll('setOpenQuestionId(aiPreview[0].id);','setOpenQuestionId(null);setExpandAllQuestions(false);').replace('setOpenQuestionId(old=>old||questions[0]?.id||null);','setOpenQuestionId(null);setExpandAllQuestions(false);').replace('if(typeof draft.openQuestionId==="string")setOpenQuestionId(draft.openQuestionId);','setOpenQuestionId(null);setExpandAllQuestions(false);');
 R('onClick={()=>setOpenQuestionId(null)}>Plegar todas</button>','onClick={()=>{setExpandAllQuestions(false);setOpenQuestionId(null)}}>Plegar todas</button><button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={()=>setExpandAllQuestions(true)}>Abrir todas</button>');
 R('<div className="mb-4 flex flex-wrap gap-1">{questions.map','<div className="sticky top-[176px] sm:top-[116px] z-20 mb-5 flex max-h-28 flex-wrap gap-2 overflow-auto rounded-xl border border-blue-100 bg-white p-3 shadow-sm"><span className="mr-1 self-center text-xs font-bold text-slate-600">Preguntas</span>{questions.map');
 R('setQuestionFilter("all");setOpenQuestionId(q.id);requestAnimationFrame','setQuestionFilter("all");setExpandAllQuestions(false);setOpenQuestionId(q.id);requestAnimationFrame');
 R('scrollIntoView({block:"center"})','scrollIntoView({block:"start"})');
 R('className="rounded-2xl border border-medium bg-card-soft-theme p-4 md:p-5"','className="scroll-mt-56 rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm"');
 R('aria-expanded={openQuestionId===q.id} onClick={()=>setOpenQuestionId(old=>old===q.id?null:q.id)}','aria-expanded={expandAllQuestions||openQuestionId===q.id} onClick={()=>{setOpenQuestionId(old=>expandAllQuestions?null:old===q.id?null:q.id);setExpandAllQuestions(false)}}');
 R('<span className="line-clamp-2">{q.question || "Enunciado pendiente"}</span>','<span className="line-clamp-2 min-w-0 flex-1"><ExamMathText text={q.question || "Enunciado pendiente"}/></span>');
 R('{openQuestionId===q.id?"Plegar ↑":"Editar ↓"}','{expandAllQuestions||openQuestionId===q.id?"Plegar ↑":"Editar ↓"}');
 R('<div hidden={openQuestionId!==q.id}>','<div hidden={!expandAllQuestions&&openQuestionId!==q.id} className="space-y-5 pt-4">');
 // Only the actual question editor, not unrelated general inputs. Existing change handlers remain intact.
 R('<div hidden={!expandAllQuestions&&openQuestionId!==q.id} className="space-y-5 pt-4">','{enrichQuestionAnswerKey(q).qualityStatus==="review"&&<div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Revisión necesaria:</strong> {enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")}</div>}<div hidden={!expandAllQuestions&&openQuestionId!==q.id} className="space-y-5 pt-4">');
 const start=s.indexOf('id="exam-section-preguntas"'),end=s.indexOf('          </div>\n\n          {/*',start);
 const finish=s.indexOf('<aside',start);if(start<0||finish<0)throw Error("review region");
 let region=s.slice(start,finish);
 region=region.replace(/<textarea\b/g,"<ExamVisualEditor").replace(/<input(\s+value=\{(?:option|item\.criteria|q\.stimulusTitle \|\| "")\})/g,"<ExamVisualEditor$1").replace(/<input(\s+value=\{\(q\.acceptedAnswers \|\| \[\]\)\.join\("\s*\|\s*"\)\})/g,"<ExamVisualEditor$1");
 region=region.replace('RESULTADO FINAL EN LATEX (OPCIONAL, SOLO SI CORRESPONDE)','RESULTADO FINAL (OPCIONAL, SOLO SI CORRESPONDE)').replace('placeholder="Ejemplo: $$x=4$$"','placeholder="Ejemplo: x = 4"');
 region=region.replace('<div className="mb-4 flex flex-wrap items-center gap-2">','{(/matem[aá]tica|f[ií]sica|qu[ií]mica|ciencias/i.test(subject))&&<ExamPythonReview questions={questions}/>}<div className="mb-4 flex flex-wrap items-center gap-2">');
 region=region.replace('className="space-y-3">\n                {questions.map((q, index) => (','className="space-y-5">\n                {questions.map((q, index) => (');
 region=region.replace('open={Boolean(q.stimulusText?.trim()) || undefined}','').replaceAll('open={Boolean(q.optionImageUrls?.[optIndex]) || undefined}','');
 // Single editable question surface, consolidated answer key stays hidden unless explicitly requested.
 region=region.replace('<div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-5">','<details className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-5"><summary className="cursor-pointer font-bold text-emerald-900">Consultar clave de respuestas completa (opcional)</summary>');
 const keyEnd=region.lastIndexOf('              </div>\n            </section>');if(keyEnd<0)throw Error("key end");
 region=region.slice(0,keyEnd)+region.slice(keyEnd).replace('              </div>\n            </section>','              </details>\n            </section>');
 region=region.replace('Array.isArray(q.qualityWarnings) &&\n                            q.qualityWarnings.length > 0','Array.isArray(enrichQuestionAnswerKey(q).qualityWarnings) &&\n                            enrichQuestionAnswerKey(q).qualityWarnings.length > 0').replace('q.qualityWarnings.join(" · ")','enrichQuestionAnswerKey(q).qualityWarnings.join(" · ")');
 s=s.slice(0,start)+region+s.slice(finish);
 const indexStart=s.indexOf('<div className="sticky top-[176px] sm:top-[116px] z-20');
 const indexEnd=s.indexOf('</div>',indexStart)+6;
 if(indexStart<0||indexEnd<=indexStart)throw Error("question index");
 const index=s.slice(indexStart,indexEnd).replace('sticky top-[176px] sm:top-[116px] z-20 mb-5 flex max-h-28 flex-wrap gap-2 overflow-auto rounded-xl border border-blue-100 bg-white p-3 shadow-sm','mt-2 flex max-h-16 flex-wrap gap-2 overflow-auto rounded-xl border border-blue-100 bg-white px-3 py-2');
 s=s.slice(0,indexStart)+s.slice(indexEnd);
 const headerStart=s.indexOf('className="sticky top-3 z-40'),headerEnd=s.indexOf('\n        </div>',headerStart);
 if(headerStart<0||headerEnd<0)throw Error("sticky header");
 s=s.slice(0,headerEnd)+'\n          {activeStep===3&&'+index+'}'+s.slice(headerEnd);
 s=s.replaceAll('scroll-mt-56 rounded-2xl','scroll-mt-72 sm:scroll-mt-56 rounded-2xl');
 s=s.replace('className="line-clamp-2 min-w-0 flex-1"','className="line-clamp-2 min-w-0 flex-1 leading-relaxed"');
 return s;
}
const p="app/examen/crear/page.tsx";writeFileSync(p,patchVisual(readFileSync(p,"utf8")));
console.log("[exam-visual] editor visual y navegación fija");
