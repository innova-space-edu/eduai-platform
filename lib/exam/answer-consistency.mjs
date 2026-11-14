/** Deterministic checks for recurring exam tasks; unsupported patterns are not certified. */
export function examAnswerConsistencyIssues(q){
 const issues=[];
 const fields=[q?.modelAnswer,q?.expectedLatex,q?.explanation,...(Array.isArray(q?.solutionSteps)?q.solutionSteps:[])].filter(x=>typeof x==="string");
 if(fields.some(s=>/(?:borrador mental|paso \d+ corregido|CORRECCI[ÓO]N:|espera, el enunciado|revisi[oó]n del c[aá]lculo anterior)/i.test(s)))issues.push("La pauta contiene borradores o autocorrecciones. Reescribe una solución final limpia y coherente.");
 const clean=s=>String(s??"").replace(/\\+text\s*\{([^{}]*)\}/g,"$1").replace(/\$+/g,"").replace(/\\+[,;]/g," ").replace(/\\+parallel/g,"∥").replace(/\\+frac\s*\{(\d+)\}\s*\{(\d+)\}/g,(_,a,b)=>String(Number(a)/Number(b))).replace(/,/g,".");
 const stem=clean(q?.question);
 if(!/tales/i.test(stem)||!/\bD\b[\s\S]{0,65}\bAB\b|\bAB\b[\s\S]{0,65}\bD\b/i.test(stem)||!/\bparalela\b[\s\S]{0,35}\bAC\b|\bDE\s*∥\s*AC\b/i.test(stem)||!/\bBC\b[\s\S]{0,45}\bE\b|\bE\b[\s\S]{0,45}\bBC\b/i.test(stem)||!/(?:determina|calcula|longitud|hallar|valor|segmento)\b[\s\S]{0,65}\bBE\b/i.test(stem))return issues;
 const get=name=>{const m=stem.match(new RegExp("\\b"+name+"\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|mm|m)\\b","i"));return m?{v:Number(m[1]),unit:m[2].toLowerCase()}:null};
 const ab=get("AB"),ad=get("AD"),bc=get("BC");
 if(!ab||!ad||!bc||ab.unit!==ad.unit||ab.unit!==bc.unit||ab.v<=0||ad.v<=0||ad.v>=ab.v||bc.v<=0)return issues;
 const expected=(ab.v-ad.v)*bc.v/ab.v;
 if(fields.some(s=>/\b(?:tri[aá]ngulo\s+|\\+triangle\s*)ADE\b/i.test(s)&&/(?:semejante|similar|\\+sim|~)/i.test(s)))issues.push("La semejanza indicada usa ADE, pero la configuración dada garantiza la semejanza entre DBE y ABC. Revisa la justificación geométrica.");
 for(const field of [q?.modelAnswer,q?.expectedLatex]){
  const matches=Array.from(clean(field).matchAll(/\bBE\s*(?:=|:|mide)\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)\b/gi));
  if(matches.some(m=>m[2].toLowerCase()===bc.unit&&Math.abs(Number(m[1])-expected)>0.0051)){issues.push("La longitud BE declarada contradice la proporción de Tales: el valor calculado es "+Number(expected.toFixed(6))+" "+bc.unit+". Revisa respuesta y procedimiento.");break}
 }
 return issues;
}
