import {isTableAnswer,type FormQuestion,type FormResponse,type Answer} from './model';
import {groupQuestionsByVersion,questionsAtSubmission,questionSignature} from './history';

export type SeriesItem = { label: string; count: number; percentage: number };
export type NumericStats = { n: number; mean: number; median: number; min: number; max: number; sd: number };
export type QuestionSummary = {
  question: FormQuestion;
  answered: number;
  missing: number;
  series: SeriesItem[];
  numeric?: NumericStats;
  textValues?: string[];
  table?: { rowCount: number; columns: {label:string; values:number; numericTotal?:number; top:SeriesItem[]}[] };
};

const round = (v: number) => Math.round(v * 100) / 100;

export function summarizeResponses(questions: FormQuestion[], responses: FormResponse[]): QuestionSummary[] {
  return questions.filter(q => q.type !== 'section').map(question => {
    const values = responses.map(r => r.answers?.[question.id]).filter(v => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length));
    const counts = new Map<string, number>();
    let numeric: NumericStats | undefined;
    const numericValues = values.map(v => typeof v === 'number' ? v : Number(v)).filter(Number.isFinite);
    if (['scale','number'].includes(question.type) && numericValues.length) {
      const sorted = [...numericValues].sort((a,b) => a-b);
      const n = sorted.length;
      const mean = sorted.reduce((a,b)=>a+b,0)/n;
      numeric = { n, mean:round(mean), median:round(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2), min:sorted[0], max:sorted[n-1], sd:round(Math.sqrt(sorted.reduce((sum,x)=>sum+(x-mean)**2,0)/n)) };
    }
    if (['single','dropdown','multi','checklist','yesno','scale'].includes(question.type)) {
      for (const value of values) {
        for (const item of Array.isArray(value) ? value : [value]) {
          const label = String(item);
          counts.set(label,(counts.get(label)||0)+1);
        }
      }
    }
    if (question.type === 'number' && numeric) {
      const low = numeric.min, high = numeric.max;
      const bins = low === high ? 1 : 5;
      const step = bins === 1 ? 1 : (high - low) / bins;
      const histogram = Array.from({length:bins},(_,i)=>({
        low:low+i*step, high:i===bins-1?high:low+(i+1)*step, count:0
      }));
      for (const n of numericValues) {
        const idx = bins === 1 ? 0 : Math.min(bins-1,Math.floor((n-low)/step));
        histogram[idx].count++;
      }
      for (const bin of histogram) {
        const label = bin.low.toFixed(2) + ' a ' + bin.high.toFixed(2);
        counts.set(label,bin.count);
      }
    }
    const labels = question.type === 'yesno' ? ['Sí','No'] : question.options.length ? question.options : [...counts.keys()].sort((a,b)=>Number(a)-Number(b));
    const tableRows = question.type === 'table' ? values.filter(isTableAnswer).flat() : [];
    const table = question.type === 'table' ? {
      rowCount:tableRows.length,
      columns:question.options.map((label,index)=>{
        const cellValues=tableRows.map(row=>row[index]).filter(Boolean);
        const frequencies=new Map<string,number>();
        for(const cell of cellValues)frequencies.set(cell,(frequencies.get(cell)||0)+1);
        const numbers=cellValues.map(cell=>Number(cell));
        const numericTotal=cellValues.length&&numbers.every(Number.isFinite)
          ? round(numbers.reduce((sum,n)=>sum+n,0)):undefined;
        return {
          label,values:cellValues.length,
          ...(numericTotal!==undefined?{numericTotal}:{}),
          top:[...frequencies.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)
            .map(([value,count])=>({label:value,count,percentage:round(100*count/(cellValues.length||1))}))
        };
      })
    }:undefined;
    const base = values.length || 1;
    return {
      question,
      answered: values.length,
      missing: responses.length - values.length,
      series: (labels.length ? labels : [...counts.keys()]).map(label => ({label,count:counts.get(label)||0,percentage:round(100*(counts.get(label)||0)/base)})),
      ...(numeric ? { numeric } : {}),
      ...(table ? { table } : {}),
      ...(['short','long','email','date'].includes(question.type) ? {textValues:values.filter((v):v is string=>typeof v==='string').slice(0,500)} : {})
    };
  });
}

export function escapeCsv(value: unknown) {
  const s = Array.isArray(value) ? (isTableAnswer(value) ? JSON.stringify(value) : value.join('; ')) : String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g,'""') + '"';
}

export function responseCsv(questions: FormQuestion[], responses: FormResponse[]) {
  const groups=groupQuestionsByVersion(questions,responses);
  const memberIds=groups.map(g=>new Set(g.responses.map(r=>r.id)));
  const headers=groups.map(g=>g.question.label+(g.current?'':' [versión anterior]'));
  const rows=[
    ['ID','Fecha','Nombre','Correo',...headers],
    ...responses.map(r=>[
      r.id,r.submitted_at,r.identity?.name||'',r.identity?.email||'',
      ...groups.map((g,i)=>memberIds[i].has(r.id)?r.answers?.[g.question.id]??'':'')
    ])
  ];
  return '\uFEFF'+rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
}

/**
 * Long-format CSV: one row per material/item, preserving respondent identity,
 * question name, row order and configured column headers.
 */
export function tableRowsCsv(questions: FormQuestion[], responses: FormResponse[]) {
  const allQuestions=groupQuestionsByVersion(questions,responses)
    .map(g=>g.question).filter(q=>q.type==='table');
  const columns=[...new Set(allQuestions.flatMap(q=>q.options))];
  const rows:(string|number)[][]=[
    ['ID respuesta','Fecha','Nombre','Correo','Tabla','Fila',...columns]
  ];
  for(const response of responses)for(const q of questionsAtSubmission(response,questions)){
    if(q.type!=='table')continue;
    const values=response.answers?.[q.id];
    if(!isTableAnswer(values))continue;
    for(const [idx,row] of values.entries()){
      const byName=new Map(q.options.map((name,i)=>[name,row[i]||'']));
      rows.push([response.id,response.submitted_at,response.identity?.name||'',response.identity?.email||'',q.label,idx+1,
        ...columns.map(c=>byName.get(c)||'')]);
    }
  }
  return '\uFEFF'+rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
}

function escapeLatex(value: string) {
  return value.replace(/\\/g,'\\textbackslash{}').replace(/[{}#$%&_]/g,c=>'\\'+c).replace(/~/g,'\\textasciitilde{}').replace(/\^/g,'\\textasciicircum{}');
}

export function reportLatex(title: string, summaries: QuestionSummary[], total: number) {
  const lines = [
    '\\documentclass[11pt]{article}', '\\usepackage[utf8]{inputenc}', '\\usepackage[spanish]{babel}',
    '\\usepackage{booktabs}', '\\usepackage{amsmath}', '\\usepackage[margin=2.3cm]{geometry}',
    '\\title{' + escapeLatex(title) + '}', '\\date{\\today}', '\\begin{document}', '\\maketitle',
    '\\section*{Resultados}', 'Respuestas registradas: ' + total + '.'
  ];
  for (const s of summaries) {
    lines.push('\\subsection*{' + escapeLatex(s.question.label) + '}');
    lines.push('Respondidas: ' + s.answered + '; sin respuesta: ' + s.missing + '.');
    if(s.table) {
      lines.push('Filas registradas: ' + s.table.rowCount + '.');
      for(const column of s.table.columns){
        lines.push('\\textbf{' + escapeLatex(column.label) + '} ('+column.values+' valores).'+
          (column.numericTotal!==undefined?' Total numérico: '+column.numericTotal+'.':''));
        for(const entry of column.top) lines.push(escapeLatex(entry.label)+' ('+entry.count+'; '+entry.percentage+'\\%).');
      }
    }
    if(s.numeric) lines.push('Media: $\\bar{x}=' + s.numeric.mean + '$; mediana: $\\tilde{x}=' + s.numeric.median + '$; desviación estándar: $\\sigma=' + s.numeric.sd + '$; rango: [' + s.numeric.min + ', ' + s.numeric.max + '].');
    if(s.series.length) {
      lines.push('\\begin{tabular}{lrr}', '\\toprule', 'Opción & Frecuencia & Porcentaje \\\\', '\\midrule');
      for(const v of s.series) lines.push(escapeLatex(v.label) + ' & ' + v.count + ' & ' + v.percentage + '\\% \\\\');
      lines.push('\\bottomrule', '\\end{tabular}');
    }
  }
  lines.push('\\section*{Método}', 'Los porcentajes de selección se calcularon como $100\\cdot f_i/n$, donde $n$ es el número de respuestas válidas a cada pregunta. Para selección múltiple, la suma de porcentajes puede superar el 100\\%.', '\\end{document}');
  return lines.join('\n');
}

export function downloadText(name: string, content: string, mime: string) {
  const blob = new Blob([content], {type:mime});
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href; link.download = name; link.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}
