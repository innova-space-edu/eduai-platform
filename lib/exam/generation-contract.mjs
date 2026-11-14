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
export function normalizeStem(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim()}
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
