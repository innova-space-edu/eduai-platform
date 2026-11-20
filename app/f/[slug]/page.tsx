'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState, type FormEvent} from 'react';
import {ArrowLeft, CheckCircle2, ClipboardList, FileDown, LockKeyhole, Send, Sparkles} from 'lucide-react';
import type {Answer,FormRecord,FormQuestion} from '@/lib/forms/model';

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-violet-900';
const questionTypes:Record<string,string> = {
  single:'Selección única',multi:'Selección múltiple',dropdown:'Lista desplegable',
  short:'Respuesta corta',long:'Desarrollo',number:'Respuesta numérica',
  scale:'Escala',date:'Fecha',yesno:'Sí o no',checklist:'Lista de cotejo',email:'Correo',section:'Sección'
};

export default function PublicFormPage() {
  const {slug}=useParams<{slug:string}>();
  const [form,setForm]=useState<FormRecord|null>(null);
  const [answers,setAnswers]=useState<Record<string,Answer>>({});
  const [identity,setIdentity]=useState({name:'',email:''});
  const [consent,setConsent]=useState(false);
  const [website,setWebsite]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [submissionId,setSubmissionId]=useState('');
  const [submittedAt,setSubmittedAt]=useState('');
  useEffect(()=>{
    if(!slug)return;
    const controller=new AbortController();
    fetch('/api/formularios/public/'+encodeURIComponent(slug),{cache:'no-store',signal:controller.signal})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Formulario no disponible.');return data.form as FormRecord;})
      .then(data=>{setForm(data);setError('');})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[slug]);
  const setAnswer=(id:string,value:Answer)=>setAnswers(prev=>({...prev,[id]:value}));
  const toggle=(id:string,option:string)=>{
    const existing=answers[id];
    const list=Array.isArray(existing)?existing:[];
    setAnswer(id,list.includes(option)?list.filter(v=>v!==option):[...list,option]);
  };
  const question=(q:FormQuestion)=>{
    const v=answers[q.id];
    const options=q.type==='yesno'?['Sí','No']:q.options;
    if(q.type==='section')return <div className="rounded-2xl bg-violet-50 p-4 text-lg font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{q.label}{q.description&&<p className="mt-1 text-sm font-normal">{q.description}</p>}</div>;
    if(['single','yesno','multi','checklist'].includes(q.type))return <div className="space-y-2">{options.map((option,i)=>{
      const checked=Array.isArray(v)?v.includes(option):v===option;
      return <label key={i} className={'flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition '+(checked?'border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100':'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900')}>
        <input className="mt-0.5 accent-violet-600" type={['multi','checklist'].includes(q.type)?'checkbox':'radio'} checked={checked} onChange={()=>['multi','checklist'].includes(q.type)?toggle(q.id,option):setAnswer(q.id,option)} />
        <span>{option}</span></label>;
    })}</div>;
    if(q.type==='dropdown')return <select required={q.required} className={inputClass} value={String(v??'')} onChange={e=>setAnswer(q.id,e.target.value)}><option value="">Selecciona una opción</option>{options.map((o,i)=><option key={i} value={o}>{o}</option>)}</select>;
    if(q.type==='long')return <textarea required={q.required} maxLength={5000} rows={5} className={inputClass} placeholder="Escribe tu respuesta..." value={String(v??'')} onChange={e=>setAnswer(q.id,e.target.value)}/>;
    if(q.type==='scale'){
      const min=q.min??1,max=q.max??5;
      const steps=Math.max(1,Math.min(15,Math.floor(max-min)+1));
      return <div className="flex flex-wrap gap-2">{Array.from({length:steps},(_,i)=>min+i).map(n=><button key={n} type="button" aria-pressed={Number(v)===n} onClick={()=>setAnswer(q.id,n)} className={'min-h-12 min-w-12 rounded-xl border px-3 font-semibold transition '+(Number(v)===n?'border-violet-600 bg-violet-600 text-white':'border-slate-200 bg-white text-slate-700 hover:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200')}>{n}</button>)}</div>;
    }
    return <input className={inputClass} required={q.required} type={q.type==='number'?'number':q.type==='date'?'date':q.type==='email'?'email':'text'} maxLength={q.type==='short'?500:undefined} min={q.type==='number'?q.min:undefined} max={q.type==='number'?q.max:undefined} value={v??''} onChange={e=>setAnswer(q.id,e.target.value)}/>;
  };
  async function send(event:FormEvent) {
    event.preventDefault();if(!form||saving)return;
    setError('');setSaving(true);
    try {
      const r=await fetch('/api/formularios/public/'+encodeURIComponent(slug),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({answers,identity,consent,website})
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'No se pudo guardar.');
      setMessage(data.message);setSubmissionId(data.id);setSubmittedAt(new Date().toISOString());setDone(true);
    }catch(e){setError(e instanceof Error?e.message:'Error al enviar.');}
    finally{setSaving(false);}
  }
  async function downloadMyTicket() {
    if(!form||form.kind!=='ticket'||!submissionId)return;
    try {
      const {downloadTicketPdf}=await import('@/lib/forms/ticket-pdf');
      downloadTicketPdf(form,{
        id:submissionId,form_id:form.id,answers,
        identity:{
          ...(form.settings.collectName?{name:identity.name}:{}),
          ...(form.settings.collectEmail?{email:identity.email}:{})
        },
        submitted_at:submittedAt
      });
    } catch(e) {
      setError(e instanceof Error?e.message:'No fue posible descargar el PDF.');
    }
  }
  const total=form?.questions.filter(q=>q.type!=='section').length??0;
  const completed=form?.questions.filter(q=>q.type!=='section'&&answers[q.id]!==undefined&&answers[q.id]!==''&&(!Array.isArray(answers[q.id])||(answers[q.id] as string[]).length>0)).length??0;
  const needsConsent=!!form&&(form.settings.collectName||form.settings.collectEmail||form.questions.some(q=>q.type==='email'));
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:py-10" style={{backgroundImage:'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,.13), transparent 58%)'}}>
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><ArrowLeft size={16}/> EDUAI</Link>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300"><Sparkles size={16}/> Formularios EDUAI</span>
      </header>
      {loading&&<div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">Cargando formulario...</div>}
      {!loading&&!form&&<div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900"><ClipboardList className="mx-auto mb-3 text-violet-500" size={40}/><h1 className="text-xl font-bold">Formulario no disponible</h1><p className="mt-3 text-sm text-slate-500">{error||'El enlace está cerrado o ha caducado.'}</p></div>}
      {form&&<div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-7 text-white sm:p-10">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">{form.kind}</span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{form.title}</h1>
          {form.description&&<p className="mt-3 leading-relaxed text-violet-100">{form.description}</p>}
          {!done&&<div className="mt-7"><div className="mb-2 flex justify-between text-xs text-violet-100"><span>Tu avance</span><span>{completed} de {total} preguntas</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{width:(total?completed/total*100:0)+'%'}}/></div></div>}
        </div>
        {done?<div className="p-10 text-center"><CheckCircle2 size={54} className="mx-auto mb-3 text-emerald-500"/><h2 className="text-xl font-bold">Respuesta enviada</h2><p className="mt-3 text-slate-600 dark:text-slate-300">{message||form.settings.confirmationMessage}</p>{form.kind==='ticket'&&submissionId&&<button type="button" onClick={()=>void downloadMyTicket()} className="mx-auto mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"><FileDown size={18}/> Descargar mi ticket en PDF</button>}{error&&<p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}<p className="mt-4 text-xs text-slate-500">Puedes cerrar esta pestaña.</p></div>:
        <form onSubmit={send} className="space-y-7 p-5 sm:p-9">
          {(form.settings.collectName||form.settings.collectEmail)&&<div className="space-y-4 rounded-3xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900 dark:bg-violet-950/30">
            <h2 className="font-bold">Datos solicitados por el creador</h2>
            {form.settings.collectName&&<label className="block space-y-2 text-sm font-medium">Nombre <span className="text-rose-500">*</span><input className={inputClass} required maxLength={160} autoComplete="name" value={identity.name} onChange={e=>setIdentity(p=>({...p,name:e.target.value}))}/></label>}
            {form.settings.collectEmail&&<label className="block space-y-2 text-sm font-medium">Correo electrónico <span className="text-rose-500">*</span><input className={inputClass} type="email" required autoComplete="email" maxLength={254} value={identity.email} onChange={e=>setIdentity(p=>({...p,email:e.target.value}))}/></label>}
          </div>}
          {form.questions.map((q,i)=><section key={q.id} className={q.type==='section'?'':'space-y-3'}>
            {q.type!=='section'&&<div className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-200">{i+1}</span><div><label className="block font-semibold leading-snug">{q.label} {q.required&&<span className="text-rose-500">*</span>}</label>{q.description&&<p className="mt-1 text-sm text-slate-500">{q.description}</p>}<p className="mt-1 text-xs text-slate-400">{questionTypes[q.type]}</p></div></div>}
            {question(q)}
          </section>)}
          <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
          {needsConsent&&<label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-violet-600"/><span><LockKeyhole size={16} className="mr-1 inline text-violet-600"/>{form.settings.consentText} <span className="text-rose-500">*</span></span></label>}
          <p className="text-xs leading-relaxed text-slate-500">Las respuestas serán visibles únicamente para quien creó este formulario. No incluyas información sensible que no te hayan solicitado. Los campos con * son obligatorios.</p>
          {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button disabled={saving||!total} type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-60"><Send size={18}/>{saving?'Enviando...':'Enviar respuestas'}</button>
        </form>}
      </div>}
      <p className="mt-5 text-center text-xs text-slate-500">Creado con EDUAI · Formularios y análisis de datos</p>
    </div>
  </main>;
}
