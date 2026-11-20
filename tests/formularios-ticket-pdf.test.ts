import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTicketPdf} from '../lib/forms/ticket-pdf';
import {DEFAULT_SETTINGS,templateQuestions,type FormRecord,type FormResponse} from '../lib/forms/model';

function ticket(): FormRecord {
  return {
    id:'00000000-0000-4000-8000-000000000123', slug:'00000000-0000-4000-8000-000000000456',
    title:'Ticket de salida - Matemática', description:'Clase de fracciones: reflexiona sobre lo aprendido.',
    kind:'ticket',status:'draft',questions:templateQuestions('ticket'),
    settings:{...DEFAULT_SETTINGS,collectName:true}
  };
}

test('exports an A4 printable exit ticket as valid PDF without submission',()=>{
  const pdf=buildTicketPdf(ticket());
  assert.ok(pdf.internal.getNumberOfPages()>=1);
  assert.equal(Math.round(pdf.internal.pageSize.getWidth()),210);
  assert.equal(Math.round(pdf.internal.pageSize.getHeight()),297);
  const bytes=new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
  assert.ok(bytes.length>1400);
});

test('exports submitted answers and handles thousands of characters across pages',()=>{
  const form=ticket();
  const longQuestion=form.questions.find(q=>q.type==='short')!;
  const modified: FormRecord={...form,questions:[...form.questions, {...longQuestion,id:'long-1',type:'long',label:'Explica detalladamente tu procedimiento y las dificultades encontradas.'}]};
  const response: FormResponse={
    id:'00000000-0000-4000-8000-000000000888',
    form_id:form.id,
    submitted_at:'2026-11-20T16:00:00.000Z',
    identity:{name:'Estudiante de prueba'},
    answers:{[longQuestion.id]:'Aprendí a simplificar fracciones.', 'long-1':'En este ejercicio analicé el procedimiento. '.repeat(120)}
  };
  const pdf=buildTicketPdf(modified,response);
  assert.ok(pdf.internal.getNumberOfPages()>1,'Long responses must create additional pages');
  assert.ok(new Uint8Array(pdf.output('arraybuffer')).length>1800);
});

test('refuses non-ticket forms and empty tickets',()=>{
  const form=ticket();
  assert.throws(()=>buildTicketPdf({...form,kind:'encuesta'}),/solo está disponible/);
  assert.throws(()=>buildTicketPdf({...form,questions:[]}),/al menos una pregunta/);
});
