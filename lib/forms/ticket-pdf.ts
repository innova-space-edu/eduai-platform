import {jsPDF} from 'jspdf';
import type {Answer, FormQuestion, FormRecord, FormResponse} from './model';

type TicketForm = Pick<FormRecord, 'title' | 'description' | 'kind' | 'questions' | 'settings'>;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 277;
const INK: [number, number, number] = [27, 34, 57];
const GRAY: [number, number, number] = [92, 101, 118];
const PURPLE: [number, number, number] = [104, 64, 195];

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function answerText(value: Answer | undefined): string {
  return Array.isArray(value) ? value.join(', ') : clean(value);
}

function safeFileName(title: string): string {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48).replace(/^_+|_+$/g, '') || 'ticket_salida';
}

/**
 * Printable A4 exit ticket. A response is optional: without it, the PDF contains
 * ruled space to answer by hand. PDF creation is local to the browser.
 */
export function buildTicketPdf(form: TicketForm, response?: FormResponse): jsPDF {
  if (form.kind !== 'ticket') throw new Error('La exportación de ticket solo está disponible para tickets de salida.');
  if (!form.questions.some(q => q.type !== 'section')) throw new Error('El ticket necesita al menos una pregunta.');

  const pdf = new jsPDF({orientation:'portrait', unit:'mm', format:'a4', compress:true});
  pdf.setProperties({
    title: clean(form.title).slice(0, 150),
    subject: 'Ticket de salida - EDUAI',
    creator: 'EDUAI Formularios Studio',
    keywords: 'ticket de salida, educación',
  });
  let y = 0;
  let currentPage = 0;
  const lineHeight = 5.2;

  function pageHeader() {
    currentPage += 1;
    pdf.setFillColor(...PURPLE);
    pdf.rect(0, 0, PAGE_W, 13, 'F');
    pdf.setTextColor(255,255,255);
    pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
    pdf.text('EDUAI  /  TICKET DE SALIDA', MARGIN, 8.5);
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);
    pdf.text('PAGINA ' + currentPage, PAGE_W-MARGIN, 8.5, {align:'right'});
    y = 24;
  }
  function ensure(required: number) {
    if (y + required > BOTTOM) {pdf.addPage(); pageHeader();}
  }
  function lines(text: string, width = CONTENT_W, size = 10): string[] {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(clean(text), width) as string[];
  }
  function paragraph(text: string, opts?: {size?:number; bold?:boolean; color?:[number,number,number]; indent?:number; gap?:number}) {
    const size=opts?.size??10, indent=opts?.indent??0;
    pdf.setFont('helvetica',opts?.bold?'bold':'normal');
    pdf.setTextColor(...(opts?.color??INK));
    const wrapped=lines(text, CONTENT_W-indent,size);
    for (const line of wrapped) {
      ensure(lineHeight);
      pdf.text(line, MARGIN+indent, y);
      y += lineHeight;
    }
    y += opts?.gap??2;
  }
  function ruleRows(count: number) {
    for (let i=0;i<count;i++) {
      ensure(8);
      pdf.setDrawColor(202, 208, 222);
      pdf.setLineWidth(0.25);
      pdf.line(MARGIN+2, y+2, PAGE_W-MARGIN-2, y+2);
      y+=8;
    }
  }
  function checkbox(label: string, active: boolean) {
    const optionLines=lines(label,CONTENT_W-13,9.8);
    // Keep the square aligned with its first answer line after a page break.
    ensure(Math.min(optionLines.length * 5.5 + 1, BOTTOM - 24));
    const boxX=MARGIN+2;
    pdf.setDrawColor(110,118,140);
    pdf.setLineWidth(0.32);
    pdf.rect(boxX,y-3.2,3.7,3.7);
    if(active) {
      pdf.setDrawColor(...PURPLE); pdf.setLineWidth(0.65);
      pdf.line(boxX+0.7,y-1.4,boxX+1.65,y-0.5);
      pdf.line(boxX+1.65,y-0.5,boxX+3.1,y-2.5);
    }
    pdf.setFont('helvetica','normal');pdf.setFontSize(9.8);pdf.setTextColor(...INK);
    for(const line of optionLines) {
      ensure(5.5);
      pdf.text(line,MARGIN+9,y);
      y += 5.5;
    }
    y += 1;
  }
  pageHeader();
  paragraph(clean(form.title) || 'Ticket de salida', {size:17,bold:true,gap:3});
  if (form.description) paragraph(form.description,{size:9.5,color:GRAY,gap:3});

  const identity = response?.identity || {};
  if(form.settings.collectName || identity.name) {
    paragraph('Nombre: ' + (identity.name ? clean(identity.name) : '_______________________________________________________'),{size:9,gap:1});
  }
  if(form.settings.collectEmail || identity.email) {
    paragraph('Correo: ' + (identity.email ? clean(identity.email) : '_______________________________________________________'),{size:9,gap:1});
  }
  const date = response?.submitted_at && Number.isFinite(Date.parse(response.submitted_at))
    ? new Date(response.submitted_at).toLocaleDateString('es-CL', {timeZone:'America/Santiago'})
    : '________________';
  paragraph('Fecha: ' + date, {size:9,gap:4});
  pdf.setDrawColor(205,208,220); pdf.line(MARGIN,y-2,PAGE_W-MARGIN,y-2);

  let item = 0;
  for (const q of form.questions) {
    if(q.type === 'section') {
      ensure(16);y+=3;
      paragraph(q.label,{size:12,bold:true,color:PURPLE,gap:1});
      if(q.description)paragraph(q.description,{size:9,color:GRAY,gap:1});
      continue;
    }
    item += 1;
    ensure(15);y += 3;
    paragraph(item + '. ' + q.label,{size:10.5,bold:true,gap:1});
    if(q.description)paragraph(q.description,{size:9,color:GRAY,gap:1});
    const answer = response?.answers?.[q.id];
    const answered = answer !== undefined && answer !== null && answerText(answer).length > 0;
    if (['single','multi','dropdown','checklist','yesno'].includes(q.type)) {
      const choices=q.type==='yesno'?['Sí','No']:q.options;
      const selected=Array.isArray(answer)?answer:[answer];
      for (const choice of choices) checkbox(choice, answered && selected.includes(choice));
    } else if (q.type === 'scale') {
      const min=q.min??1,max=q.max??5;
      const limit=Math.min(15,Math.max(0,Math.floor(max-min)+1));
      if (limit>0) {
        for (let n=0;n<limit;n++) checkbox(String(min+n), answered && Number(answer)===min+n);
      } else if (answered) paragraph(answerText(answer),{size:10,gap:2});
      else ruleRows(1);
    } else if (answered) {
      paragraph(answerText(answer),{size:10,gap:2});
    } else {
      ruleRows(q.type==='long'?5:q.type==='short'?2:1);
    }
  }
  if(!response) {
    ensure(13);y+=5;
    paragraph('Gracias por participar.', {size:8.5,color:GRAY});
  }
  const pages=pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++) {
    pdf.setPage(page);
    pdf.setDrawColor(226,229,237);pdf.line(MARGIN,285,PAGE_W-MARGIN,285);
    pdf.setFont('helvetica','normal');pdf.setTextColor(...GRAY);pdf.setFontSize(8);
    pdf.text('Generado con EDUAI Formularios Studio',MARGIN,290);
    pdf.text(page+' / '+pages,PAGE_W-MARGIN,290,{align:'right'});
  }
  return pdf;
}

export function downloadTicketPdf(form: TicketForm, response?: FormResponse): void {
  const pdf=buildTicketPdf(form,response);
  const suffix=response ? '_respuesta_'+response.id.slice(0,8) : '_imprimible';
  pdf.save('ticket_salida_'+safeFileName(form.title)+suffix+'.pdf');
}
