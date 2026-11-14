/** @typedef {{mc:number,mixed:number,tf:number,dev:number}} Counts */
/** @typedef {{requireOA:boolean,oaCodes:string[],modeIds:string[]}} Curriculum */
/** @param {Counts} counts @param {number} [configuredSize] */
export function planExamBatches(counts, configuredSize=3) {
  const size = Number.isFinite(configuredSize) ? Math.max(1,Math.min(4,Math.floor(configuredSize))) : 3;
  const ordered = /** @type {(keyof Counts)[]} */ (["mc","mixed","tf","dev"]);
  const plans = [];
  let batch={total:0,mc:0,mixed:0,tf:0,dev:0};
  for(const kind of ordered) {
    for(let n=0;n<counts[kind];n++) {
      if(batch.total===size){plans.push(batch);batch={total:0,mc:0,mixed:0,tf:0,dev:0};}
      batch[kind]++;batch.total++;
    }
  }
  if(batch.total)plans.push(batch);
  return plans;
}
/** @param {unknown} value */
export function normalizeStem(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[¿?¡!]/gu,"").replace(/\s+/g," ").trim()}
/** @param {any} question @param {Curriculum | null} curriculum @param {ReadonlySet<string>} used */
export function examContractIssues(question,curriculum,used) {
  const issues=[];
  if(!question || typeof question.question!=="string" || !question.question.trim()) return ["Falta el enunciado"];
  const stem=normalizeStem(question.question);
  if(!stem || used.has(stem))issues.push("Enunciado repetido");
  if(!["multiple_choice","mixed_choice_development","true_false","development"].includes(question.type))issues.push("Tipo de pregunta inválido");
  if(question.type!=="development"){
    const count=question.type==="true_false"?2:Array.isArray(question.options)?question.options.length:0;
    if(question.type!=="true_false" && count!==4)issues.push("Se requieren cuatro alternativas");
    if(!Number.isInteger(question.correctAnswer)||question.correctAnswer<0||question.correctAnswer>=count)issues.push("Índice de respuesta correcto ausente o inválido");
  }
  if(curriculum){
    const codes=Array.isArray(question.oaCodes)?question.oaCodes.map(String):[];
    if(curriculum.requireOA && !codes.length)issues.push("Falta el OA requerido");
    if(codes.some(code=>!curriculum.oaCodes.includes(code)))issues.push("Código OA no seleccionado");
    if(curriculum.modeIds.length && !curriculum.modeIds.includes(question.pedagogicalMode))issues.push("Modo pedagógico no seleccionado");
  }
  return issues;
}

/** Small requests for long-answer tasks; preserve exact totals and type ordering.
 * @param {Counts} counts */
export function planAdaptiveExamBatches(counts) {
  return [
    ...planExamBatches({mc:counts.mc,mixed:0,tf:0,dev:0},3),
    ...planExamBatches({mc:0,mixed:counts.mixed,tf:0,dev:0},1),
    ...planExamBatches({mc:0,mixed:0,tf:counts.tf,dev:0},3),
    ...planExamBatches({mc:0,mixed:0,tf:0,dev:counts.dev},1),
  ];
}
/** @param {any} value */
function firstText(...values) {
  return values.find(v=>typeof v==="string"&&v.trim()) || "";
}
/** Normalize only explicitly provided model data; never fabricate a stem, answer or rubric.
 * @param {any} q */
export function canonicalExamQuestion(q) {
  if(!q||typeof q!=="object"||Array.isArray(q))return q;
  const types={alternativas:"multiple_choice",desarrollo:"development",respuesta_construida:"development",verdadero_falso:"true_false",alternativa_desarrollo:"mixed_choice_development"};
  const type=types[q.type]||q.type;
  const result={...q,type,question:firstText(q.question,q.enunciado,q.statement,q.prompt),modelAnswer:firstText(q.modelAnswer,q.expectedAnswer,q.respuestaModelo,q.model_answer),responseMode:firstText(q.responseMode,q.response_mode,q.answerMode),expectedLatex:firstText(q.expectedLatex,q.expected_latex)};
  const rubric=q.rubric??q.rubrica??q.rúbrica??q.rubricCriteria??q.pauta;
  if(Array.isArray(rubric))result.rubric=rubric.map(r=>({criteria:firstText(r?.criteria,r?.criterion,r?.criterio,r?.description,r?.descripcion),points:Number(r?.points??r?.puntos??r?.score)}));
  if(Array.isArray(q.oa_codes)&&!Array.isArray(q.oaCodes))result.oaCodes=q.oa_codes;
  if(typeof q.pedagogical_mode==="string"&&!q.pedagogicalMode)result.pedagogicalMode=q.pedagogical_mode;
  return result;
}
/** @param {any} parsed */
export function extractExamQuestions(parsed) {
  const items=Array.isArray(parsed)?parsed:Array.isArray(parsed?.questions)?parsed.questions:Array.isArray(parsed?.items)?parsed.items:Array.isArray(parsed?.preguntas)?parsed.preguntas:parsed?.question&&typeof parsed.question==="object"?[parsed.question]:parsed?.type?[parsed]:[];
  return items.map(canonicalExamQuestion);
}
/** @param {any} q @param {string[]} allowedModes */
export function constructedContractIssues(q,allowedModes=[]) {
  if(!q||!["development","mixed_choice_development"].includes(q.type))return [];
  const issues=[];
  if(allowedModes.length&&!allowedModes.includes(q.responseMode))issues.push("Formato de respuesta no seleccionado");
  if(typeof q.modelAnswer!=="string"||!q.modelAnswer.trim())issues.push("Falta respuesta modelo");
  if(q.responseMode==="short_text"&&q.type==="development") {
    if(!Array.isArray(q.acceptedAnswers)||!q.acceptedAnswers.some(a=>typeof a==="string"&&a.trim()))issues.push("Faltan respuestas breves aceptadas");
  } else if(!Array.isArray(q.rubric)||!q.rubric.length||q.rubric.some(r=>!r?.criteria?.trim()||!Number.isFinite(r.points)||r.points<=0))issues.push("Falta una rúbrica válida con criterios y puntajes positivos");
  return issues;
}
/** @param {Counts} counts @param {any[]} questions @returns {Counts} */
export function remainingExamCounts(counts,questions){
  const names={mc:"multiple_choice",mixed:"mixed_choice_development",tf:"true_false",dev:"development"};
  return {mc:Math.max(0,counts.mc-questions.filter(q=>q?.type===names.mc).length),mixed:Math.max(0,counts.mixed-questions.filter(q=>q?.type===names.mixed).length),tf:Math.max(0,counts.tf-questions.filter(q=>q?.type===names.tf).length),dev:Math.max(0,counts.dev-questions.filter(q=>q?.type===names.dev).length)};
}
