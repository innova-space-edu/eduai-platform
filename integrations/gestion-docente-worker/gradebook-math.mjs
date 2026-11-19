// Gradebook arithmetic; exact tenths and integer relative weights.
// No inferred grades, no normalization of absences to zero/1.0.
const STATES=new Set(['pending','draft','validated','absent','exempt']);
export function gradeTenths(value){
 if(typeof value!=='string'&&typeof value!=='number')throw new TypeError('Nota inválida');
 const s=String(value).trim().replace(',','.');
 if(!/^[1-7](?:\.[0-9])?$/.test(s))throw new RangeError('Nota entre 1,0 y 7,0, con un decimal');
 const [a,b='0']=s.split('.'),n=Number(a)*10+Number(b);
 if(n<10||n>70)throw new RangeError('Nota fuera de rango');
 return n;
}
export function formatTenths(n){if(n===null)return '—';if(!Number.isInteger(n)||n<10||n>70)throw new RangeError('Nota fuera de rango');return (n/10).toFixed(1).replace('.',',');}
export function summarize(assessments,entries){
 if(!Array.isArray(assessments)||!Array.isArray(entries)||assessments.length>1000||entries.length>1000)throw new RangeError('Cantidad inválida');
 const ids=new Set(), map=new Map();
 for(const a of assessments){if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||!Number.isInteger(a.weight_bps)||a.weight_bps<1||a.weight_bps>10000)throw new Error('Evaluación inválida');ids.add(a.id);}
 for(const e of entries){if(!e||!ids.has(e.assessment_id)||map.has(e.assessment_id)||!STATES.has(e.state))throw new Error('Registro inválido');if(['draft','validated'].includes(e.state))gradeTenths(e.grade);else if(e.grade!==null&&e.grade!==undefined)throw new Error('Estado sin nota');map.set(e.assessment_id,e);}
 let numerator=0,weight=0,validated=0,pending=0,draft=0,absent=0,exempt=0;
 for(const a of assessments){const e=map.get(a.id);switch(e?.state??'pending'){case 'validated':numerator+=gradeTenths(e.grade)*a.weight_bps;weight+=a.weight_bps;validated++;break;case 'draft':draft++;break;case 'absent':absent++;break;case 'exempt':exempt++;break;default:pending++;}}
 const average=weight?Math.floor((2*numerator+weight)/(2*weight)):null;
 return {average_tenths:average,average:formatTenths(average),validated,pending,draft,absent,exempt,weight,provisional:!validated||pending+draft+absent>0};
}
