import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,normalizeForm,templateQuestions,validateSubmission,type FormRecord} from '../lib/forms/model';
import {summarizeResponses,responseCsv,reportLatex} from '../lib/forms/analytics';

function sampleForm(): FormRecord {
  const questions=templateQuestions('encuesta');
  return {id:crypto.randomUUID(),slug:crypto.randomUUID(),title:'Consulta de prueba',description:'',
    kind:'encuesta',status:'published',questions,
    settings:{...DEFAULT_SETTINGS,collectEmail:true,oneResponse:true}};
}
test('templates and normalization retain question ids and formats',()=>{
  for(const kind of ['encuesta','entrevista','registro','checklist','ticket','evaluacion'] as const){
    const questions=templateQuestions(kind);
    const normalized=normalizeForm({...sampleForm(),kind,questions});
    assert.ok(normalized.questions.length>=2);
    assert.equal(new Set(normalized.questions.map(q=>q.id)).size,normalized.questions.length);
  }
});
test('public validation requires consent and email when requested',()=>{
  const form=sampleForm();
  const answers=Object.fromEntries(form.questions.filter(q=>q.required).map(q=>[
    q.id,q.type==='single'?q.options[0]:q.type==='multi'?[q.options[0]]:'respuesta'
  ]));
  assert.throws(()=>validateSubmission(form,{answers,identity:{email:'test@example.com'},consent:false}),/aceptar/);
  const result=validateSubmission(form,{answers,identity:{email:'test@example.com'},consent:true});
  assert.equal(result.identity.email,'test@example.com');
});
test('rejects manipulated answer choices, duplicate answers and invalid scales',()=>{
  const form=sampleForm();
  const answers:Record<string,unknown>={};
  const required=form.questions.filter(q=>q.required);
  for(const q of required)answers[q.id]=q.type==='single'?q.options[0]:q.type==='multi'?[q.options[0]]:'ok';
  const choice=required.find(q=>q.type==='single')!;
  answers[choice.id]='option invented';
  assert.throws(()=>validateSubmission(form,{answers,identity:{email:'a@b.com'},consent:true}),/Opción inválida/);
});
test('percentages, numeric mean, median and variance are deterministic',()=>{
  const form=sampleForm();
  const choice=form.questions[0];
  const numeric={id:'numeric-1',type:'number' as const,label:'Puntaje',options:[],required:true};
  const data=[
    {id:'1',form_id:form.id,answers:{[choice.id]:choice.options[0],[numeric.id]:4},identity:{},submitted_at:''},
    {id:'2',form_id:form.id,answers:{[choice.id]:choice.options[0],[numeric.id]:6},identity:{},submitted_at:''},
    {id:'3',form_id:form.id,answers:{[choice.id]:choice.options[1],[numeric.id]:8},identity:{},submitted_at:''}
  ];
  const [categorical,number]=summarizeResponses([choice,numeric],data);
  assert.equal(categorical.series[0].percentage,66.67);
  assert.equal(number.numeric?.mean,6);
  assert.equal(number.numeric?.median,6);
  assert.equal(number.series.reduce((a,b)=>a+b.count,0),3);
});
test('CSV export neutralizes spreadsheet formulas and LaTeX remains a document',()=>{
  const csv=responseCsv([{id:'a',type:'short',label:'Detalle',options:[],required:false}],
    [{id:'1',form_id:'f',identity:{},answers:{a:'=HYPERLINK("bad")'},submitted_at:''}]);
  assert.ok(csv.includes("'=HYPERLINK"));
  const latex=reportLatex('Resultados',[],0);
  assert.ok(latex.includes('\\documentclass'));
  assert.ok(latex.includes('\\end{document}'));
});
