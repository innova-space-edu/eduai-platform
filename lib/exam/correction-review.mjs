/** @param {any} q */
export function correctionSignature(q){
 return JSON.stringify([q?.type,q?.question,q?.responseMode||"",q?.modelAnswer||"",q?.expectedLatex||"",q?.explanation||"",q?.solutionSteps||[],q?.rubric||[],q?.options||[],q?.correctAnswer??null,q?.acceptedAnswers||[],q?.stimulusText||"",q?.stimulusTitle||"",q?.imageUrl||"",q?.optionImageUrls||[],q?.maxPoints??null,q?.selectionPoints??null,q?.developmentMaxPoints??null,q?.justificationMaxPoints??null,q?.oaCodes||[],q?.showStimulusToStudent===true,q?.showRubricToStudent===true]);
}
/** @param {any} q @param {string[]} issues */
export function needsCorrectionConfirmation(q,issues=[]){
 return issues.length>0 || Boolean(q?.correctionReview?.required && q.correctionReview.confirmedSignature!==correctionSignature(q));
}
/** @param {any[]} questions @param {(q:any)=>string[]} check */
export function correctionPublicationIssue(questions,check){
 if(!Array.isArray(questions))return "";
 for(let i=0;i<questions.length;i++){
  const q=questions[i],issues=check(q);
  if(issues.length)return "Pregunta "+(i+1)+": "+issues.join(" · ");
  if(needsCorrectionConfirmation(q))return "Pregunta "+(i+1)+": debes revisar y presionar Corregido antes de publicar.";
 }
 return "";
}
