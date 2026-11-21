import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupQuestionsByVersion,questionSignature,questionsAtSubmission} from '../lib/forms/history';
import {responseCsv,tableRowsCsv,summarizeResponses} from '../lib/forms/analytics';
import {buildTicketPdf} from '../lib/forms/ticket-pdf';
import {DEFAULT_SETTINGS,type FormQuestion,type FormResponse,type FormRecord} from '../lib/forms/model';

const oldQuestion:FormQuestion={
  id:'materials',type:'table',label:'Materiales de laboratorio',
  required:true,options:['Cantidad','Material','Asignatura','OA']
};
const revised:FormQuestion={...oldQuestion,
  label:'Materiales y unidades para el año escolar',
  options:['Cantidad','Material o equipo','Asignatura','OA']
};
const oldResponse:FormResponse={
  id:'before',form_id:'f',submitted_at:'2026-11-20T16:00:00Z',
  identity:{},answers:{materials:[['2','Tubos','Química','OA19']]},
  questions_snapshot:[oldQuestion]
};
const newResponse:FormResponse={
  id:'after',form_id:'f',submitted_at:'2026-11-20T17:00:00Z',
  identity:{},answers:{materials:[['1','Balanza','Química','OA19']]},
  questions_snapshot:[revised]
};

test('editing a published table creates separate historical question cohorts',()=>{
  const groups=groupQuestionsByVersion([revised],[oldResponse,newResponse]);
  assert.equal(groups.length,2);
  const current=groups.find(g=>g.current)!;
  const historical=groups.find(g=>!g.current)!;
  assert.equal(current.question.label,revised.label);
  assert.equal(historical.question.label,oldQuestion.label);
  assert.deepEqual(historical.responses.map(r=>r.id),['before']);
  assert.deepEqual(current.responses.map(r=>r.id),['after']);
  assert.notEqual(questionSignature(revised),questionSignature(oldQuestion));
});

test('historical answers do not get aggregated under the new wording or columns',()=>{
  const groups=groupQuestionsByVersion([revised],[oldResponse,newResponse]);
  const summaries=groups.map(g=>summarizeResponses([g.question],g.responses)[0]);
  assert.equal(summaries[0].table?.rowCount,1);
  assert.equal(summaries[0].table?.columns[0].numericTotal,1);
  assert.equal(summaries[1].table?.columns[0].numericTotal,2);
});

test('CSV export preserves both versions, and historical table columns remain mapped',()=>{
  const csv=responseCsv([revised],[oldResponse,newResponse]);
  assert.ok(csv.includes('Materiales de laboratorio [versión anterior]'));
  assert.ok(csv.includes('Materiales y unidades para el año escolar'));
  assert.ok(csv.includes('Balanza'));
  assert.ok(csv.includes('Tubos'));
  const table=tableRowsCsv([revised],[oldResponse,newResponse]);
  assert.ok(table.includes('Material o equipo'));
  assert.ok(table.includes('"Material"'));
  assert.ok(table.includes('Tubos'));
  assert.ok(table.includes('Balanza'));
  assert.equal(table.split('\r\n').length,3);
});

test('individual ticket PDF can use the historical question definition',()=>{
  const form:FormRecord={id:'f',slug:'slug',title:'Ticket de salida',description:'',
    kind:'ticket',status:'published',questions:[revised],settings:{...DEFAULT_SETTINGS}};
  const historic=buildTicketPdf({...form,questions:questionsAtSubmission(oldResponse,form.questions)},oldResponse);
  const latest=buildTicketPdf(form,newResponse);
  assert.equal(new TextDecoder().decode(new Uint8Array(historic.output('arraybuffer')).slice(0,5)),'%PDF-');
  assert.ok(latest.output('arraybuffer').byteLength>1000);
});

test('database migration explicitly backfills and locks in historical snapshots',()=>{
  const sql=readFileSync('supabase/migrations/20261120190000_eduai_forms_question_history.sql','utf8');
  assert.match(sql,/SET questions_snapshot = f\.questions/);
  assert.match(sql,/ALTER COLUMN questions_snapshot SET NOT NULL/);
  assert.match(sql,/BEFORE INSERT ON public\.eduai_form_responses/);
  assert.match(sql,/AND r\.questions_snapshot IS NULL/);
  const route=readFileSync('app/api/formularios/public/[slug]/route.ts','utf8');
  assert.match(route,/questions_snapshot:form\.questions/);
});
