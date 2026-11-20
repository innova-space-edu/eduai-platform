'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {DEFAULT_SETTINGS,DEFAULT_TABLE_COLUMNS,QUESTION_TYPES,isTableAnswer,normalizeForm,templateQuestions,type Answer,type FormKind,type FormQuestion,type FormRecord,type FormResponse,type QuestionType} from '@/lib/forms/model';
import {downloadText,reportLatex,responseCsv,summarizeResponses,tableRowsCsv} from '@/lib/forms/analytics';
import {ArrowDown,ArrowLeft,ArrowUp,BarChart3,Check,ChevronRight,ClipboardList,Copy,Download,ExternalLink,FileDown,FilePlus2,Files,Link2,Table2,Loader2,Mail,Plus,Save,Search,Settings2,Share2,Sparkles,Trash2,WandSparkles,X} from 'lucide-react';

const field='min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950';
const button='inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const primary='inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50';
const panel='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6';
const kindLabels:Record<FormKind,string>={encuesta:'Encuesta',entrevista:'Entrevista',registro:'Listado / registro',checklist:'Lista de cotejo',ticket:'Ticket de salida',evaluacion:'Evaluación'};
const typeLabels:Record<QuestionType,string>={single:'Alternativas · única',multi:'Alternativas · varias',dropdown:'Desplegable',short:'Respuesta corta',long:'Desarrollo / entrevista',number:'Número',scale:'Escala',date:'Fecha',yesno:'Sí / No',checklist:'Casillas de verificación',email:'Correo electrónico',table:'Tabla / listado editable',section:'Título de sección'};
const choiceTypes=new Set<QuestionType>(['single','multi','dropdown','checklist']);
const kinds=Object.keys(kindLabels) as FormKind[];
const makeQuestion=(type:QuestionType='short'):FormQuestion=>({id:crypto.randomUUID(),type,label:type==='section'?'Nueva sección':type==='table'?'Listado de materiales':'Nueva pregunta',description:'',required:type!=='section',options:type==='table'?[...DEFAULT_TABLE_COLUMNS]:choiceTypes.has(type)?['Opción 1','Opción 2']:[],...(type==='scale'?{min:1,max:5}:{})});
const emptyForm=(kind:FormKind='encuesta'):FormRecord=>({id:'',slug:'',title:kindLabels[kind]+' sin título',description:'',kind,status:'draft',questions:[],settings:{...DEFAULT_SETTINGS}});
const nameFile=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,45)||'formulario';
const responseLabel=(value:Answer|undefined)=>isTableAnswer(value)
  ? value.map((row,i)=>(i+1)+'. '+row.join(' | ')).join('\n')
  : Array.isArray(value)?value.join('; '):String(value??'');

export default function FormulariosPage() {
  const supabase=useMemo(()=>createClient(),[]);
  const [userId,setUserId]=useState('');
  const [loading,setLoading]=useState(true);
  const [forms,setForms]=useState<FormRecord[]>([]);
  const [editor,setEditor]=useState<FormRecord|null>(null);
  const [view,setView]=useState<'collection'|'editor'|'results'>('collection');
  const [tab,setTab]=useState<'charts'|'responses'>('charts');
  const [responses,setResponses]=useState<FormResponse[]>([]);
  const [truncated,setTruncated]=useState(false);
  const [saving,setSaving]=useState(false);
  const [resultLoading,setResultLoading]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('');
  const [count,setCount]=useState(6);
  const [range,setRange]=useState('all');
  const [openSettings,setOpenSettings]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active)return;
      if(!user){setError('Inicia sesión para administrar tus formularios.');setLoading(false);return;}
      setUserId(user.id);
      const {data,error}=await supabase.from('eduai_forms').select('*').order('updated_at',{ascending:false}).limit(150);
      if(!active)return;
      if(error)setError('No fue posible cargar formularios. Comprueba que la migración de base de datos esté aplicada.');
      else setForms((data||[]) as FormRecord[]);
      setLoading(false);
    })();
    return()=>{active=false};
  },[supabase]);

  function start(kind:FormKind,withTemplate:boolean) {
    setEditor({...emptyForm(kind),questions:withTemplate?templateQuestions(kind):[]});
    setView('editor');setError('');setNotice('');setResponses([]);setOpenSettings(false);
  }
  function select(form:FormRecord){setEditor({...form,questions:form.questions.map(q=>({...q,options:[...q.options]})),settings:{...DEFAULT_SETTINGS,...form.settings}});setView('editor');setResponses([]);setError('');setNotice('');}
  function patch(partial:Partial<FormRecord>){setEditor(v=>v?{...v,...partial}:v)}
  function patchSettings(partial:Partial<FormRecord['settings']>){setEditor(v=>v?{...v,settings:{...v.settings,...partial}}:v)}
  function patchQuestion(id:string,partial:Partial<FormQuestion>){setEditor(v=>v?{...v,questions:v.questions.map(q=>q.id===id?{...q,...partial}:q)}:v)}
  function addQuestion(type:QuestionType='short'){setEditor(v=>v?{...v,questions:[...v.questions,makeQuestion(type)]}:v)}
  function moveQuestion(index:number,offset:number){setEditor(v=>{if(!v||index+offset<0||index+offset>=v.questions.length)return v;const next=[...v.questions];[next[index],next[index+offset]]=[next[index+offset],next[index]];return {...v,questions:next};})}
  function linkFor(form:FormRecord){return typeof window==='undefined'?'':window.location.origin+'/f/'+form.slug}
  async function copyPublicLink(form:FormRecord){try{await navigator.clipboard.writeText(linkFor(form));setNotice('Enlace copiado al portapapeles.');}catch{setNotice('Copia manualmente el enlace mostrado.');}}
  async function refreshForms(selected?:FormRecord){
    const {data}=await supabase.from('eduai_forms').select('*').order('updated_at',{ascending:false}).limit(150);
    if(data)setForms(data as FormRecord[]);
    if(selected)setEditor(selected);
  }
  async function save(status?:FormRecord['status']) {
    if(!editor||saving||!userId)return;
    setError('');setNotice('');
    try{
      const clean=normalizeForm(editor);
      const newStatus=status??editor.status;
      if(newStatus==='published'&&!clean.questions.some(q=>q.type!=='section'))throw new Error('Agrega al menos una pregunta antes de publicar.');
      if(newStatus==='published'&&clean.settings.endsAt&&Date.parse(clean.settings.endsAt)<Date.now())throw new Error('La fecha de cierre ya pasó.');
      setSaving(true);
      const payload={...clean,status:newStatus,updated_at:new Date().toISOString()};
      const action=editor.id
        ? supabase.from('eduai_forms').update(payload).eq('id',editor.id).eq('user_id',userId)
        : supabase.from('eduai_forms').insert({...payload,user_id:userId});
      const {data,error}=await action.select('*').single();
      if(error)throw error;
      await refreshForms(data as FormRecord);
      setNotice(newStatus==='published'?'Formulario publicado. Ya puedes compartir su enlace.':newStatus==='closed'?'Formulario cerrado.':'Cambios guardados correctamente.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
    finally{setSaving(false);}
  }
  async function remove(form:FormRecord){
    if(!confirm('Se eliminarán definitivamente el formulario y todas sus respuestas. ¿Continuar?'))return;
    const {error}=await supabase.from('eduai_forms').delete().eq('id',form.id).eq('user_id',userId);
    if(error){setError(error.message);return;}
    setEditor(null);setResponses([]);setView('collection');setNotice('Formulario eliminado.');await refreshForms();
  }
  async function duplicate(form:FormRecord){
    setEditor({...form,id:'',slug:'',status:'draft',title:form.title+' (copia)',questions:form.questions.map(q=>({...q,id:crypto.randomUUID()}))});
    setView('editor');setResponses([]);setNotice('Copia preparada. Guárdala para crear un enlace independiente.');
  }
  async function showResults(form:FormRecord){
    setEditor(form);setView('results');setTab('charts');setError('');setResponses([]);setResultLoading(true);setTruncated(false);
    try{
      const all:FormResponse[]=[];
      for(let page=0;page<5;page++){
        const {data,error}=await supabase.from('eduai_form_responses').select('id,form_id,answers,identity,submitted_at')
          .eq('form_id',form.id).order('submitted_at',{ascending:false}).range(page*1000,page*1000+999);
        if(error)throw error;
        all.push(...(data||[]) as FormResponse[]);
        if(!data||data.length<1000)break;
      }
      setTruncated(all.length===5000);
      setResponses(all);
    }catch(e){setError(e instanceof Error?e.message:'Error al cargar resultados.');}
    finally{setResultLoading(false);}
  }
  async function generateAI(){
    if(!editor||aiBusy)return;
    if(topic.trim().length<5){setError('Describe el objetivo o tema del formulario.');return;}
    setAiBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/agents/formularios/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,kind:editor.kind,count})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||'No fue posible generar preguntas.');
      const generated=json.suggestion as FormRecord;
      const shouldReplace=editor.questions.length===0||confirm('¿Reemplazar las preguntas actuales por las sugeridas por IA?');
      if(shouldReplace){patch({title:generated.title,description:generated.description,questions:generated.questions});setNotice('Preguntas generadas. Revísalas antes de publicar.');}
    }catch(e){setError(e instanceof Error?e.message:'Error del generador.');}
    finally{setAiBusy(false);}
  }
  const filteredForms=forms.filter(f=>(f.title+' '+f.kind).toLowerCase().includes(query.toLowerCase()));
  const filteredResponses=useMemo(()=>{
    const days=range==='7'?7:range==='30'?30:0;
    return days?responses.filter(r=>new Date(r.submitted_at).getTime()>=Date.now()-days*86400000):responses;
  },[responses,range]);
  const summaries=useMemo(()=>summarizeResponses(editor?.questions||[],filteredResponses),[editor,filteredResponses]);
  const completion=filteredResponses.length&&summaries.length?Math.round(100*summaries.reduce((s,q)=>s+q.answered,0)/(filteredResponses.length*summaries.length)):0;
  async function exportTicket(response?: FormResponse) {
    if(!editor || editor.kind!=='ticket')return;
    setError('');
    try {
      const {downloadTicketPdf}=await import('@/lib/forms/ticket-pdf');
      downloadTicketPdf(editor,response);
      setNotice(response?'PDF de la respuesta descargado.':'Ticket de salida en PDF descargado.');
    } catch(e) {
      setError(e instanceof Error?e.message:'No fue posible crear el PDF.');
    }
  }
  function exportTables(){
    if(!editor)return;
    const tables=editor.questions.filter(q=>q.type==='table');
    if(!tables.length)return;
    downloadText(nameFile(editor.title)+'_filas_tabla.csv',tableRowsCsv(editor.questions,filteredResponses),'text/csv;charset=utf-8');
    setNotice('Listado de tablas exportado en filas, listo para Excel.');
  }
  function exportFile(format:'csv'|'json'|'tex'){
    if(!editor)return;
    const name=nameFile(editor.title);
    if(format==='csv')downloadText(name+'.csv',responseCsv(editor.questions,filteredResponses),'text/csv;charset=utf-8');
    if(format==='json')downloadText(name+'.json',JSON.stringify({form:{title:editor.title,questions:editor.questions},responses:filteredResponses},null,2),'application/json');
    if(format==='tex')downloadText(name+'.tex',reportLatex(editor.title,summaries,filteredResponses.length),'application/x-tex');
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{backgroundImage:'radial-gradient(ellipse at 10% 0%, rgba(139,92,246,.11),transparent 45%),radial-gradient(ellipse at 100% 10%,rgba(56,189,248,.10),transparent 44%)'}}>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-violet-200/50 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-6 text-white shadow-xl shadow-violet-500/10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/20 ring-[38px] ring-white/5"/>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Link href="/agentes" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/10 hover:bg-white/20" aria-label="Volver a agentes"><ArrowLeft size={20}/></Link><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><ClipboardList size={27}/></div><div><p className="text-xs font-bold uppercase tracking-widest text-violet-100">Nuevo agente EDUAI</p><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Formularios Studio</h1><p className="mt-1 text-sm text-violet-100">Encuestas, entrevistas, listados y análisis estadístico</p></div></div>
          <button onClick={()=>start('encuesta',true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-violet-700 shadow-sm hover:bg-violet-50"><Plus size={18}/> Nuevo formulario</button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          {([['collection','Mis formularios',Files],['editor','Constructor',Settings2],['results','Resultados',BarChart3]] as const).map(([id,label,Icon])=><button key={id} disabled={id!=='collection'&&!editor} onClick={()=>{setView(id);setError('');}} className={'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40 '+(view===id?'bg-white text-violet-700':'bg-white/15 text-white hover:bg-white/25')}><Icon size={16}/>{label}</button>)}
        </div>
      </header>
      {notice&&<div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={18}/>{notice}<button className="ml-auto" aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}
      {error&&<div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}<button className="ml-auto" aria-label="Cerrar error" onClick={()=>setError('')}><X size={17}/></button></div>}
      {loading?<div className={panel+' text-center text-slate-500'}><Loader2 className="mx-auto mb-3 animate-spin" size={25}/>Cargando tus formularios...</div>:
      !userId?<div className={panel}><p>Debes iniciar sesión para crear y administrar formularios.</p><Link href="/login" className={primary+' mt-4'}>Iniciar sesión</Link></div>:
      view==='collection'?<section className="space-y-5">
        <div className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Crear un instrumento</h2><p className="mt-1 text-sm text-slate-500">Comienza con una plantilla editable o desde cero.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200">{forms.length} formularios</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{kinds.map((kind,i)=><button key={kind} onClick={()=>start(kind,true)} className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-lg dark:border-slate-700 dark:from-slate-950 dark:to-violet-950/30"><div className="mb-3 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-900">{i+1}</span><ChevronRight className="text-violet-500" size={18}/></div><h3 className="font-bold">{kindLabels[kind]}</h3><p className="mt-1 text-xs text-slate-500">Preguntas listas para personalizar</p></button>)}</div>
          <button className={button+' mt-4'} onClick={()=>start('encuesta',false)}><FilePlus2 size={17}/> Formulario en blanco</button>
        </div>
        <div className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Mis formularios</h2><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input className={field+' pl-9'} placeholder="Buscar formularios..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
          {!filteredForms.length?<p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aún no hay formularios. Crea uno utilizando las plantillas.</p>:<div className="grid gap-3 md:grid-cols-2">{filteredForms.map(form=><article key={form.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{form.title}</h3><p className="mt-1 text-xs text-slate-500">{kindLabels[form.kind]} · {form.questions?.filter(q=>q.type!=='section').length||0} preguntas</p></div><span className={'rounded-full px-2.5 py-1 text-xs font-semibold '+(form.status==='published'?'bg-emerald-100 text-emerald-800':form.status==='closed'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-600')}>{form.status==='published'?'Publicado':form.status==='closed'?'Cerrado':'Borrador'}</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>select(form)} className={button}>Editar</button><button onClick={()=>showResults(form)} className={button}><BarChart3 size={15}/> Resultados</button>{form.status==='published'&&<button className={button} onClick={()=>copyPublicLink(form)}><Link2 size={15}/> Copiar enlace</button>}<button aria-label="Duplicar" title="Duplicar" onClick={()=>duplicate(form)} className={button}><Copy size={16}/></button><button aria-label="Eliminar" title="Eliminar" onClick={()=>remove(form)} className={button+' text-rose-600!'}><Trash2 size={16}/></button></div></article>)}</div>}
        </div>
      </section>:
      view==='editor'&&editor?<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className={panel}>
            <div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Constructor de formularios</h2><p className="mt-1 text-xs text-slate-500">Personaliza cada pregunta, sus opciones y si es obligatoria.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{editor.status==='published'?'Publicado':editor.status==='closed'?'Cerrado':'Borrador'}</span></div>
            <div className="grid gap-4"><label className="space-y-2 text-sm font-semibold">Título<input value={editor.title} maxLength={160} onChange={e=>patch({title:e.target.value})} className={field} /></label><label className="space-y-2 text-sm font-semibold">Descripción<textarea rows={2} maxLength={1500} value={editor.description} onChange={e=>patch({description:e.target.value})} className={field} placeholder="Objetivo e instrucciones para responder..."/></label><label className="space-y-2 text-sm font-semibold">Tipo de instrumento<select value={editor.kind} onChange={e=>patch({kind:e.target.value as FormKind})} className={field}>{kinds.map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label></div>
          </div>
          <div className={panel}>
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold">Preguntas ({editor.questions.length})</h3><div className="flex flex-wrap gap-2"><button onClick={()=>addQuestion('table')} className={button+' !border-violet-300 !text-violet-700'}><Table2 size={16}/> Añadir tabla</button><button onClick={()=>addQuestion()} className={button}><Plus size={16}/> Añadir</button></div></div>
            {!editor.questions.length&&<div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-8 text-center text-sm text-violet-700 dark:bg-violet-950/20">Agrega preguntas manualmente o utiliza el generador IA.</div>}
            <div className="space-y-4">{editor.questions.map((q,i)=><section key={q.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-violet-600">Ítem {i+1}</span><div className="flex gap-1"><button title="Subir pregunta" disabled={i===0} onClick={()=>moveQuestion(i,-1)} className={button+' !min-h-8 !px-2'}><ArrowUp size={15}/></button><button title="Bajar pregunta" disabled={i===editor.questions.length-1} onClick={()=>moveQuestion(i,1)} className={button+' !min-h-8 !px-2'}><ArrowDown size={15}/></button><button title="Duplicar pregunta" onClick={()=>patch({questions:[...editor.questions.slice(0,i+1),{...q,id:crypto.randomUUID()},...editor.questions.slice(i+1)]})} className={button+' !min-h-8 !px-2'}><Copy size={15}/></button><button title="Eliminar pregunta" onClick={()=>patch({questions:editor.questions.filter(x=>x.id!==q.id)})} className={button+' !min-h-8 !px-2 text-rose-600!'}><Trash2 size={15}/></button></div></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]"><label className="space-y-1 text-xs font-semibold text-slate-500">Enunciado<input className={field} value={q.label} maxLength={500} onChange={e=>patchQuestion(q.id,{label:e.target.value})}/></label><label className="space-y-1 text-xs font-semibold text-slate-500">Tipo<select className={field} value={q.type} onChange={e=>{const type=e.target.value as QuestionType;patchQuestion(q.id,{type,options:type==='table'?q.type==='table'?q.options:[...DEFAULT_TABLE_COLUMNS]:choiceTypes.has(type)?q.options.length>=2?q.options:['Opción 1','Opción 2']:[],required:type==='section'?false:q.required,...(type==='scale'?{min:1,max:5}:{})});}}>{QUESTION_TYPES.map(t=><option key={t} value={t}>{typeLabels[t]}</option>)}</select></label></div>
              <label className="mt-3 block space-y-1 text-xs font-semibold text-slate-500">Indicaciones (opcional)<input className={field} value={q.description||''} maxLength={600} placeholder="Texto de ayuda para quien responde" onChange={e=>patchQuestion(q.id,{description:e.target.value})}/></label>
              {choiceTypes.has(q.type)&&<label className="mt-3 block space-y-1 text-xs font-semibold text-slate-500">Opciones (una por línea)<textarea className={field} rows={Math.min(8,Math.max(3,q.options.length+1))} value={q.options.join('\n')} onChange={e=>patchQuestion(q.id,{options:e.target.value.split('\n').map(v=>v.slice(0,180))})}/></label>}
              {q.type==='table'&&<div className="mt-3 space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
                <label className="block space-y-2 text-xs font-semibold text-violet-800 dark:text-violet-200">Encabezados de la tabla (uno por línea, entre 2 y 8 columnas)
                  <textarea className={field} rows={Math.min(8,Math.max(4,q.options.length))} value={q.options.join('\n')} onChange={e=>patchQuestion(q.id,{options:e.target.value.split('\n').map(c=>c.slice(0,180))})}/>
                </label>
                <p className="text-xs text-slate-500">Los participantes podrán añadir hasta 40 filas y completar cada columna.</p>
                <div className="overflow-x-auto rounded-xl border border-violet-200 bg-white dark:border-violet-800 dark:bg-slate-900">
                  <table className="w-full min-w-[420px] text-left text-xs"><thead><tr>{q.options.filter(Boolean).map((c,j)=><th key={j} className="border-r border-violet-100 bg-violet-100 p-2 font-bold text-violet-900 last:border-0 dark:bg-violet-900 dark:text-white">{c}</th>)}</tr></thead><tbody>{[0,1].map(r=><tr key={r}>{q.options.filter(Boolean).map((_,j)=><td key={j} className="border-r border-t border-violet-100 p-3 text-slate-400 last:border-r-0">Fila {r+1}</td>)}</tr>)}</tbody></table>
                </div>
              </div>}
              {['number','scale'].includes(q.type)&&<div className="mt-3 grid grid-cols-2 gap-3"><label className="space-y-1 text-xs font-semibold text-slate-500">Mínimo<input type="number" className={field} value={q.min??''} onChange={e=>patchQuestion(q.id,{min:e.target.value===''?undefined:Number(e.target.value)})}/></label><label className="space-y-1 text-xs font-semibold text-slate-500">Máximo<input type="number" className={field} value={q.max??''} onChange={e=>patchQuestion(q.id,{max:e.target.value===''?undefined:Number(e.target.value)})}/></label></div>}
              {q.type!=='section'&&<label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" className="accent-violet-600" checked={q.required} onChange={e=>patchQuestion(q.id,{required:e.target.checked})}/> Respuesta obligatoria</label>}
            </section>)}</div>
            <div className="mt-4 flex flex-wrap gap-2"><select aria-label="Tipo de nueva pregunta" className={field+' !w-auto'} id="new-question-type" defaultValue="single">{QUESTION_TYPES.map(t=><option key={t} value={t}>{typeLabels[t]}</option>)}</select><button className={button} onClick={()=>{const e=document.getElementById('new-question-type') as HTMLSelectElement|null;addQuestion((e?.value||'short') as QuestionType)}}><Plus size={16}/> Añadir tipo seleccionado</button></div>
          </div>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-5">
          <div className={panel}>
            <div className="mb-3 flex items-center gap-2"><WandSparkles size={21} className="text-violet-600"/><h3 className="font-bold">Generador de preguntas IA</h3></div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">Describe qué deseas investigar, registrar o entrevistar. Puedes modificar todas las preguntas resultantes.</p>
            <textarea className={field} rows={4} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Ej.: encuesta de convivencia escolar, dirigida a docentes, con preguntas neutrales..."/>
            <label className="mt-3 block text-xs font-semibold text-slate-500">Cantidad de preguntas<input type="number" className={field+' mt-1'} min={2} max={20} value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
            <button className={primary+' mt-4 w-full'} disabled={aiBusy} onClick={generateAI}><Sparkles size={17}/>{aiBusy?'Generando preguntas...':'Generar con IA'}</button>
          </div>
          <div className={panel}>
            <button className="flex w-full items-center justify-between font-bold" onClick={()=>setOpenSettings(v=>!v)}><span className="inline-flex items-center gap-2"><Settings2 size={20} className="text-violet-600"/> Configuración y privacidad</span><ChevronRight size={18} className={openSettings?'rotate-90 transition':'transition'}/></button>
            {openSettings&&<div className="mt-4 space-y-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-600" checked={editor.settings.collectName} onChange={e=>patchSettings({collectName:e.target.checked})}/> Solicitar nombre</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-600" checked={editor.settings.collectEmail} onChange={e=>patchSettings({collectEmail:e.target.checked,oneResponse:e.target.checked?editor.settings.oneResponse:false})}/> Solicitar correo electrónico</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-600" disabled={!editor.settings.collectEmail} checked={editor.settings.oneResponse} onChange={e=>patchSettings({oneResponse:e.target.checked})}/> Una respuesta por correo</label>
              <label className="block space-y-1 text-xs font-semibold text-slate-500">Fecha de cierre<input className={field} type="datetime-local" value={editor.settings.endsAt?new Date(editor.settings.endsAt).toISOString().slice(0,16):''} onChange={e=>patchSettings({endsAt:e.target.value?new Date(e.target.value).toISOString():null})}/></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-500">Mensaje al terminar<textarea className={field} rows={2} value={editor.settings.confirmationMessage} onChange={e=>patchSettings({confirmationMessage:e.target.value})}/></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-500">Aviso de consentimiento<textarea className={field} rows={3} value={editor.settings.consentText} onChange={e=>patchSettings({consentText:e.target.value})}/></label>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">Recopila solo datos necesarios. No solicites información sensible de menores sin la autorización y el aviso de privacidad correspondientes.</p>
            </div>}
          </div>
          <div className={panel}>
            <h3 className="mb-3 font-bold">Guardar y compartir</h3>
            <div className="grid gap-2"><button className={button+' w-full'} disabled={saving} onClick={()=>save()}><Save size={17}/>{saving?'Guardando...':'Guardar cambios'}</button><button className={primary+' w-full'} disabled={saving} onClick={()=>save('published')}><Share2 size={17}/> Publicar formulario</button>{editor.kind==='ticket'&&<button className={button+' w-full'} onClick={()=>void exportTicket()}><FileDown size={17}/> Descargar ticket en PDF</button>}{editor.id&&<button className={button+' w-full'} disabled={saving} onClick={()=>save('closed')}>Cerrar recepción de respuestas</button>}{editor.id&&<button className={button+' w-full'} onClick={()=>showResults(editor)}><BarChart3 size={17}/> Ver resultados</button>}</div>
            {editor.id&&editor.status==='published'&&<div className="mt-4 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Enlace público activo</p><input readOnly className={field+' !text-xs'} value={linkFor(editor)}/><div className="flex flex-wrap gap-2"><button onClick={()=>copyPublicLink(editor)} className={button}><Copy size={15}/> Copiar</button><a href={linkFor(editor)} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={15}/> Abrir</a><a className={button} href={'https://wa.me/?text='+encodeURIComponent(editor.title+' '+linkFor(editor))} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className={button} href={'mailto:?subject='+encodeURIComponent(editor.title)+'&body='+encodeURIComponent(linkFor(editor))}><Mail size={15}/> Correo</a></div></div>}
          </div>
        </aside>
      </div>:
      view==='results'&&editor?<section className="space-y-5">
        <div className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Resultados privados</p><h2 className="mt-1 text-xl font-bold">{editor.title}</h2></div><div className="flex flex-wrap gap-2"><button className={button} onClick={()=>select(editor)}>Editar</button><button className={button} onClick={()=>showResults(editor)}><BarChart3 size={16}/> Actualizar</button>{editor.status==='published'&&<button className={button} onClick={()=>copyPublicLink(editor)}><Link2 size={16}/> Enlace</button>}</div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button onClick={()=>setTab('charts')} className={tab==='charts'?primary:button}><BarChart3 size={16}/> Gráficos</button><button onClick={()=>setTab('responses')} className={tab==='responses'?primary:button}><ClipboardList size={16}/> Respuestas</button></div><div className="flex flex-wrap gap-2"><select aria-label="Período" className={field+' !w-auto'} value={range} onChange={e=>setRange(e.target.value)}><option value="all">Todo el período</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select><button onClick={()=>exportFile('csv')} className={button}><Download size={15}/> CSV</button>{editor.questions.some(q=>q.type==='table')&&<button onClick={exportTables} className={button}><Table2 size={15}/> Filas de tabla (CSV)</button>}<button onClick={()=>exportFile('json')} className={button}>JSON</button><button onClick={()=>exportFile('tex')} className={button}>LaTeX</button>{editor.kind==='ticket'&&<button onClick={()=>void exportTicket()} className={button}><FileDown size={15}/> Ticket en PDF</button>}</div></div>
          {truncated&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Se muestran hasta 5.000 respuestas recientes. Los porcentajes y exportaciones corresponden solo a este conjunto.</p>}
        </div>
        {resultLoading?<div className={panel+' text-center'}><Loader2 className="mx-auto mb-3 animate-spin"/>Calculando resultados...</div>:<>
          <div className="grid gap-3 sm:grid-cols-3"><div className={panel}><p className="text-sm text-slate-500">Respuestas</p><p className="mt-2 text-3xl font-extrabold text-violet-600">{filteredResponses.length.toLocaleString('es-CL')}</p></div><div className={panel}><p className="text-sm text-slate-500">Preguntas</p><p className="mt-2 text-3xl font-extrabold">{summaries.length}</p></div><div className={panel}><p className="text-sm text-slate-500">Preguntas respondidas</p><p className="mt-2 text-3xl font-extrabold">{completion}%</p></div></div>
          {tab==='charts'?<div className="grid items-start gap-4 lg:grid-cols-2">{summaries.map((summary,i)=><article key={summary.question.id} className={panel}>
            <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-200">{i+1}</span><div className="min-w-0"><h3 className="font-bold">{summary.question.label}</h3><p className="mt-1 text-xs text-slate-500">{summary.answered} respuestas · {summary.missing} sin respuesta</p></div></div>
            {summary.table&&<div className="mt-4 space-y-3"><div className="rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{summary.table.rowCount} filas de tabla registradas</div>
              <div className="grid gap-2 sm:grid-cols-2">{summary.table.columns.map((c,j)=><div key={j} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <h4 className="text-sm font-bold">{c.label}</h4><p className="text-xs text-slate-500">{c.values} valores{c.numericTotal!==undefined?' · Total: '+c.numericTotal:''}</p>
                <div className="mt-2 space-y-1">{c.top.map((v,k)=><div key={k} className="flex justify-between gap-2 text-xs"><span className="min-w-0 break-words">{v.label}</span><span className="shrink-0 text-violet-600">{v.count} ({v.percentage}%)</span></div>)}</div>
              </div>)}</div></div>}
            {summary.numeric&&<div className="mt-4 grid grid-cols-3 gap-2">{([['Media',summary.numeric.mean],['Mediana',summary.numeric.median],['Desv. est.',summary.numeric.sd],['Mínimo',summary.numeric.min],['Máximo',summary.numeric.max],['n',summary.numeric.n]] as const).map(([name,value])=><div key={name} className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-950/40"><p className="text-[11px] text-slate-500">{name}</p><p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-200">{value}</p></div>)}</div>}
            {summary.series.length>0&&<div className="mt-5 space-y-3">{summary.series.map((bar,j)=><div key={j}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="min-w-0 break-words text-slate-700 dark:text-slate-200">{bar.label}</span><span className="shrink-0 font-semibold">{bar.count} · {bar.percentage}%</span></div><div className="h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div role="img" aria-label={bar.label+': '+bar.percentage+' por ciento'} className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all" style={{width:bar.percentage+'%'}}/></div></div>)}</div>}
            {summary.textValues&&<div className="mt-4 max-h-52 space-y-2 overflow-y-auto">{summary.textValues.length?summary.textValues.slice(0,15).map((t,j)=><p key={j} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">{t}</p>):<p className="text-sm text-slate-500">Sin respuestas abiertas.</p>}</div>}
            {!summary.series.length&&!summary.textValues&&!summary.numeric&&<p className="mt-4 text-sm text-slate-500">No hay datos suficientes para calcular estadísticas.</p>}
          </article>)}</div>:<div className={panel+' overflow-x-auto'}><table className="w-full min-w-[680px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">{editor.kind==='ticket'&&<th className="p-3">PDF</th>}<th className="p-3">Fecha</th><th className="p-3">Nombre</th><th className="p-3">Correo</th>{editor.questions.filter(q=>q.type!=='section').map(q=><th key={q.id} className="min-w-40 p-3">{q.label}</th>)}</tr></thead><tbody>{filteredResponses.map(r=><tr key={r.id} className="border-b border-slate-100 align-top dark:border-slate-800">{editor.kind==='ticket'&&<td className="p-3"><button title="Descargar esta respuesta en PDF" aria-label="Descargar respuesta en PDF" className={button} onClick={()=>void exportTicket(r)}><FileDown size={15}/> PDF</button></td>}<td className="whitespace-nowrap p-3">{new Date(r.submitted_at).toLocaleString('es-CL')}</td><td className="p-3">{r.identity?.name||'—'}</td><td className="p-3">{r.identity?.email||'—'}</td>{editor.questions.filter(q=>q.type!=='section').map(q=><td className="max-w-72 whitespace-pre-line break-words p-3" key={q.id}>{q.type==='table'&&isTableAnswer(r.answers[q.id])?<div className="max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"><table className="min-w-96 text-xs"><thead><tr>{q.options.map((header,i)=><th key={i} className="bg-violet-50 p-2 text-left dark:bg-violet-950">{header}</th>)}</tr></thead><tbody>{r.answers[q.id].map((cells,i)=><tr key={i}>{cells.map((cell,j)=><td key={j} className="border-t border-slate-100 p-2 dark:border-slate-800">{cell}</td>)}</tr>)}</tbody></table></div>:responseLabel(r.answers[q.id])||'—'}</td>)}</tr>)}</tbody></table>{!filteredResponses.length&&<p className="py-8 text-center text-sm text-slate-500">No se han recibido respuestas para este período.</p>}</div>}
          <p className="text-xs text-slate-500">Los porcentajes usan como denominador las respuestas válidas de cada pregunta. En selección múltiple pueden sumar más del 100%. La desviación estándar mostrada es poblacional.</p>
        </>}
      </section>:null}
      <p className="pb-3 text-center text-xs text-slate-500">EDUAI Formularios Studio · Crea, comparte y analiza en un mismo espacio</p>
    </div>
  </main>;
}
