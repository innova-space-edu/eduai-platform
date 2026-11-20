import type {FormQuestion,FormResponse} from './model';

export type QuestionVersionGroup = {
  signature: string;
  question: FormQuestion;
  current: boolean;
  responses: FormResponse[];
};

export function questionSignature(q: FormQuestion): string {
  return JSON.stringify([
    q.id,q.type,q.label,q.description || '',q.required,
    q.options,q.min ?? null,q.max ?? null
  ]);
}

export function questionsAtSubmission(
  response: FormResponse, fallback: FormQuestion[]
): FormQuestion[] {
  // Legacy responses are backfilled by the database migration.
  // Keep a fallback for older API payloads during rolling deploys.
  return Array.isArray(response.questions_snapshot)
    ? response.questions_snapshot
    : fallback;
}

/**
 * Each prompt version has independent denominators and labels. Editing a
 * published question cannot relabel earlier responses or merge different scales.
 */
export function groupQuestionsByVersion(
  questions: FormQuestion[],responses: FormResponse[]
): QuestionVersionGroup[] {
  const currentKeys=new Set(questions.filter(q=>q.type!=='section').map(questionSignature));
  const groups=new Map<string,QuestionVersionGroup>();
  for(const question of questions){
    if(question.type==='section')continue;
    const signature=questionSignature(question);
    if(!groups.has(signature))groups.set(signature,{signature,question,current:true,responses:[]});
  }
  for(const response of responses){
    const seen=new Set<string>();
    for(const question of questionsAtSubmission(response,questions)){
      if(question.type==='section')continue;
      const signature=questionSignature(question);
      if(seen.has(signature))continue;
      seen.add(signature);
      let group=groups.get(signature);
      if(!group){
        group={signature,question,current:currentKeys.has(signature),responses:[]};
        groups.set(signature,group);
      }
      group.responses.push(response);
    }
  }
  return [...groups.values()];
}
