import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, DEFAULT_TABLE_COLUMNS,MAX_TABLE_ROWS,normalizeForm,validateSubmission,
  type FormRecord,type FormQuestion,type FormResponse
} from '../lib/forms/model';
import {responseCsv,tableRowsCsv,summarizeResponses,reportLatex} from '../lib/forms/analytics';
import {buildTicketPdf} from '../lib/forms/ticket-pdf';

const question:FormQuestion={
  id:'tabla-1',type:'table',label:'Listado de materiales',
  required:true,options:[...DEFAULT_TABLE_COLUMNS]
};
function form(kind:'registro'|'ticket'='registro'):FormRecord {
  return {id:'form-1',slug:'slug-1',title:'Solicitud de materiales',description:'',
    kind,status:'published',questions:[question],settings:{...DEFAULT_SETTINGS}};
}
const rows=[
  ['3','Tubos de ensayo','Química','OA19'],
  ['1','Microscopio','Ciencias','OA3']
];
function submit(rowsValue:unknown){
  return validateSubmission(form(),{answers:{'tabla-1':rowsValue}});
}

test('predefined material table has four editable columns and normalizes',()=>{
  const normalized=normalizeForm(form());
  assert.deepEqual(normalized.questions[0].options,['Cantidad','Material','Asignatura','OA']);
  assert.equal(normalized.questions[0].type,'table');
});
test('accepts multiple complete table rows and preserves their sequence',()=>{
  assert.deepEqual(submit(rows).answers['tabla-1'],rows);
});
test('ignores wholly blank rows and refuses partly completed rows',()=>{
  assert.deepEqual(submit([...rows,['','','','']]).answers['tabla-1'],rows);
  assert.throws(()=>submit([['1','Reactivo','','OA19']]),/Completa todas las columnas/);
  assert.throws(()=>submit([['','','','']]),/Falta responder/);
  assert.deepEqual(validateSubmission({...form(),questions:[{...question,required:false}]},
    {answers:{'tabla-1':[['','','','']]}}).answers,{});
});
test('rejects malformed or excessive input, including nested arrays and injected objects',()=>{
  assert.throws(()=>submit([['1','Tubos','Química']]),/Fila inválida/);
  assert.throws(()=>submit([{cantidad:'1'}]),/Fila inválida/);
  assert.throws(()=>submit(Array.from({length:MAX_TABLE_ROWS+1},()=>rows[0])),/Máximo/);
  assert.throws(()=>submit([[42,'Tubos','Química','OA19']]),/Fila inválida/);
  assert.throws(()=>submit([['1','x'.repeat(181),'Química','OA19']]),/Fila inválida/);
});
test('rejects duplicate, too few and too many headers in a published form',()=>{
  assert.throws(()=>normalizeForm({...form(),questions:[{...question,options:['Material']}]}),/entre 2 y/);
  assert.throws(()=>normalizeForm({...form(),questions:[{...question,options:['Material','material']}]}),/diferentes/);
  assert.throws(()=>normalizeForm({...form(),questions:[{...question,options:['A','B','C','D','E','F','G','H','I']}]}),/entre 2 y/);
});
test('CSV exports one material per row with correct columns and protected formulas',()=>{
  const response:FormResponse={id:'resp-1',form_id:'form-1',submitted_at:'2026-11-20T16:00:00Z',
    identity:{name:'Equipo 1'},answers:{'tabla-1':[...rows,['2','=HYPERLINK("mal")','Química','OA19']]}};
  const csv=tableRowsCsv([question],[response]);
  assert.ok(csv.includes('"Cantidad","Material","Asignatura","OA"'));
  assert.equal(csv.trim().split('\r\n').length,4);
  assert.ok(csv.includes("\"'=HYPERLINK"));
  const standard=responseCsv([question],[response]);
  assert.ok(standard.includes('Tubos de ensayo'));
  assert.ok(standard.includes('Microscopio'));
  assert.ok(standard.includes('[['));
});
test('aggregates the total quantity and common subjects in table analytics',()=>{
  const answers:{[key:string]:string[][]}={'tabla-1':rows};
  const data:FormResponse[]=[{id:'resp-1',form_id:'form-1',submitted_at:'',identity:{},answers}];
  const s=summarizeResponses([question],data)[0];
  assert.equal(s.table?.rowCount,2);
  assert.equal(s.table?.columns[0].numericTotal,4);
  assert.equal(s.table?.columns[2].top.length,2);
  const latex=reportLatex('Materiales',[s],1);
  assert.ok(latex.includes('Filas registradas: 2'));
});
test('printable tickets embed the table in A4 PDF and paginate long lists',()=>{
  const largeRows=Array.from({length:MAX_TABLE_ROWS},(_,i)=>[
    String(i+1),'Material de laboratorio con descripción '+i,'Química','OA19']);
  const record:FormResponse={id:'resp',form_id:'form-1',submitted_at:'2026-11-20T16:00:00Z',
    identity:{},answers:{'tabla-1':largeRows}};
  const pdf=buildTicketPdf(form('ticket'),record);
  assert.ok(pdf.getNumberOfPages()>1);
  const bytes=new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
  const empty=buildTicketPdf(form('ticket'));
  assert.ok(empty.output('arraybuffer').byteLength>1000);
});
