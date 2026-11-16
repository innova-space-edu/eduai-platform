"use client"
import TrainingFeedback from "@/components/ai/TrainingFeedback"
import MathRenderer from "@/components/ui/MathRenderer"
import Link from "next/link"
import { useCallback,useEffect,useRef,useState } from "react"
import { ArrowLeft, ArrowRight, Bot, Briefcase, ChevronRight, FileText, FlaskConical, GraduationCap, History, Lightbulb, MessageCircle, Palette, Pause, Play, Plus, RefreshCw, Send, Sparkles, Trash2, Users, X } from "lucide-react"

type SocialRoomSlug = "ideas" | "research" | "teaching-lab" | "creative-studio" | "user-support" | "anticipation"
type SocialParticipantRole = "supervisor" | "researcher" | "educator" | "engineer" | "mathematician" | "creative" | "assistant"

type SocialParticipant = {
  id: string; name: string; role: SocialParticipantRole; specialty: string; tone: string
}
type SocialMessage = {
  id: string; authorId: string; authorName: string
  role: SocialParticipantRole; content: string; createdAt: string
  provider?: string; model?: string
}
type SocialSession = {
  sessionId: string; userId?: string; status: "active" | "paused" | "closed"
  room: { id: string; slug: SocialRoomSlug; title: string; topic: string; createdAt: string }
  participants: SocialParticipant[]; messages: SocialMessage[]
  summary: string; createdAt: string; updatedAt: string
  lastUserActivityAt: string; lastAgentActivityAt: string; inactivityTimeoutMs: number
}
type SocialActionTarget = "drafts" | "educador" | "examen" | "paper" | "matematico" | "imagenes" | "unknown"
type SocialActionIntent =
  | "create_lesson_plan" | "create_study_guide" | "create_exam"
  | "create_research_outline" | "create_math_support" | "create_visual_material" | "unknown"
type SocialActionSuggestion = {
  detected: boolean; intent: SocialActionIntent; target: SocialActionTarget
  label: string; reason: string; suggestedGoal: string
}
type ExecutedActionResult = {
  ok: boolean; executed: boolean
  target: SocialActionTarget; intent: SocialActionIntent
  label: string; message: string
  mode: "draft_created" | "prepared_action"
  draft?: DraftFile; payload?: Record<string, unknown>
}
type SocialSessionResponse = {
  ok: boolean; name?: string; alias?: string; action?: string
  session?: SocialSession; sessions?: SocialSession[]; pausedCount?: number
  actionSuggestion?: SocialActionSuggestion; error?: string
}
type DraftType = "study_guide" | "lesson_plan" | "exam" | "research_outline" | "prompt_pack" | "generic"
type DraftFile = {
  id: string; title: string; filename: string; draftType: DraftType
  content: string; summary: string; createdAt: string; metadata?: Record<string, unknown>
}
type DraftApiResponse = {
  ok: boolean; name?: string; alias?: string; message?: string; target?: "drafts"
  draft?: DraftFile; logs?: Record<string, unknown>[]; error?: string
}


type Recent = {id:string;title:string;topic:string;updatedAt:string}
type LiveEvent =
  | {type:"session";session:SocialSession}
  | {type:"speakers";speakers:SocialParticipant[]}
  | {type:"delta";authorId:string;content:string}
  | {type:"message";message:SocialMessage}
  | {type:"agent-error";authorId:string;name:string}
  | {type:"done";session:SocialSession;actionSuggestion?:SocialActionSuggestion;warning?:string}
  | {type:"error";error:string}
const rooms = [
  {slug:"ideas",title:"Ideas",description:"Explora soluciones y nuevas perspectivas.",prompt:"Quiero explorar nuevas ideas y discutir sus posibilidades.",icon:Lightbulb,color:"#b45309"},
  {slug:"research",title:"Investigación",description:"Analiza hipótesis, evidencia y métodos.",prompt:"Quiero conversar sobre una idea de investigación.",icon:FlaskConical,color:"#7c3aed"},
  {slug:"teaching-lab",title:"Docencia",description:"Diseña experiencias de aprendizaje.",prompt:"Necesito apoyo para planificar una experiencia educativa.",icon:GraduationCap,color:"#047857"},
  {slug:"creative-studio",title:"Creatividad",description:"Desarrolla conceptos, recursos y diseños.",prompt:"Quiero desarrollar una idea creativa.",icon:Palette,color:"#be185d"},
  {slug:"user-support",title:"Soporte",description:"Resuelve dudas y problemas técnicos.",prompt:"Necesito ayuda para resolver un problema.",icon:Briefcase,color:"#2563eb"},
  {slug:"anticipation",title:"Proyectos",description:"Organiza próximos pasos y borradores.",prompt:"Quiero anticipar los pasos de un proyecto.",icon:FileText,color:"#0891b2"},
] as const
const roles:Record<SocialParticipantRole,{label:string;color:string}> = {
 supervisor:{label:"Coordinación",color:"#7c3aed"},researcher:{label:"Investigación",color:"#6d28d9"},
 educator:{label:"Educación",color:"#047857"},engineer:{label:"Ingeniería",color:"#2563eb"},
 mathematician:{label:"Matemáticas",color:"#b45309"},creative:{label:"Creatividad",color:"#be185d"},
 assistant:{label:"Asistente",color:"#64748b"},
}
const endpoint="/api/superagent/social/live"
const control="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-soft bg-card-theme px-3 py-2 text-xs font-semibold text-sub transition hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40"
const primary="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50"
const backdrop={backgroundImage:"radial-gradient(ellipse at 7% 0%,rgba(167,139,250,.14),transparent 48%),radial-gradient(ellipse at 99% 20%,rgba(45,212,191,.10),transparent 50%)"}
function Bubble({msg,prompt,partial=false}:{msg:SocialMessage;prompt?:string;partial?:boolean}){
 const user=msg.authorId==="user",style=roles[msg.role]||roles.assistant
 return <article className={"flex items-start gap-2.5 "+(user?"flex-row-reverse":"")}>
  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold" style={{background:user?"#7c3aed":style.color+"18",color:user?"white":style.color}}>{user?"Tú":msg.authorName.slice(0,2)}</div>
  <div className={"min-w-0 max-w-[88%] sm:max-w-[82%] "+(user?"text-right":"")}>
   {!user&&<div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><strong style={{color:style.color}}>{msg.authorName}</strong><span className="text-muted2">{style.label}</span>{partial&&<span className="text-violet-600">Escribiendo…</span>}</div>}
   <div className={"overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed "+(user?"rounded-tr-sm border-violet-400/20 bg-violet-500/10":"rounded-tl-sm border-soft bg-card-theme shadow-sm")} style={user?undefined:{backgroundImage:"linear-gradient(145deg,transparent,"+style.color+"08)"}}>
    {user||partial?<p className="whitespace-pre-wrap break-words">{msg.content||"…"}</p>:<><MathRenderer content={msg.content}/><TrainingFeedback answer={msg.content} prompt={prompt} module="ai-social" comparisonOnly/></>}
   </div>
  </div>
 </article>
}
export default function AISocialPage(){
 const [session,setSession]=useState<SocialSession|null>(null)
 const [phase,setPhase]=useState<"start"|"chat">("start")
 const [topic,setTopic]=useState("")
 const [input,setInput]=useState("")
 const [selectedRoom,setSelectedRoom]=useState<SocialRoomSlug|undefined>()
 const [recent,setRecent]=useState<Recent[]>([])
 const [historyError,setHistoryError]=useState("")
 const [loading,setLoading]=useState(false)
 const [waiting,setWaiting]=useState(false)
 const [remoteBusy,setRemoteBusy]=useState(false)
 const [optimistic,setOptimistic]=useState("")
 const [speakers,setSpeakers]=useState<SocialParticipant[]>([])
 const [partials,setPartials]=useState<Record<string,string>>({})
 const [finished,setFinished]=useState<string[]>([])
 const [error,setError]=useState("")
 const [warning,setWarning]=useState("")
 const [action,setAction]=useState<SocialActionSuggestion|null>(null)
 const [result,setResult]=useState<ExecutedActionResult|null>(null)
 const [draft,setDraft]=useState<DraftFile|null>(null)
 const [draftBusy,setDraftBusy]=useState(false)
 const feed=useRef<HTMLDivElement>(null)
 const composer=useRef<HTMLTextAreaElement>(null)
 const operation=useRef(false)
 const streamAbort=useRef<AbortController|null>(null)
 const nearBottom=useRef(true)
 const busy=loading||waiting||remoteBusy
 const loadRecent=useCallback(async()=>{
  try{const res=await fetch(endpoint,{cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error);setRecent(data.sessions||[]);setHistoryError("")}catch{setHistoryError("No se pudo cargar el historial.")}
 },[])
 useEffect(()=>{void loadRecent();return()=>streamAbort.current?.abort()},[loadRecent])
 useEffect(()=>{if(phase==="chat"&&nearBottom.current&&feed.current)feed.current.scrollTop=feed.current.scrollHeight},[phase,session?.messages,partials,speakers,optimistic,warning,error])
 async function open(id:string){
  if(operation.current)return
  operation.current=true;setLoading(true);setError("")
  try{const res=await fetch(endpoint+"?sessionId="+encodeURIComponent(id),{cache:"no-store"});const data=await res.json();if(!res.ok||!data.session)throw Error(data.error||"No se pudo abrir.");setSession(data.session);setRemoteBusy(!!data.busy);setPhase("chat");setOptimistic("");setSpeakers([]);setPartials({});setFinished([]);setAction(null);setWarning("");setDraft(null);setResult(null);nearBottom.current=true}
  catch(e){setError(e instanceof Error?e.message:"No se pudo abrir.")}finally{operation.current=false;setLoading(false)}
 }
 async function run(body:Record<string,unknown>,userText:string){
  if(operation.current||remoteBusy)return
  operation.current=true
  const controller=new AbortController();streamAbort.current=controller
  const timer=window.setTimeout(()=>controller.abort(),45000)
  const creating=body.action==="create"
  setWaiting(true);setError("");setWarning("");setAction(null);setResult(null);setDraft(null)
  setSpeakers([]);setPartials({});setFinished([]);setOptimistic(userText);nearBottom.current=true
  if(creating){setSession(null);setPhase("chat")}
  if(body.action==="turn")setInput("")
  let accepted=false,completed=false
  try{
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal})
    if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||"No se pudo iniciar la respuesta.")}
    if(!response.body)throw Error("No se recibió la conversación.")
    const reader=response.body.getReader(),decoder=new TextDecoder()
    let buffer=""
    const handle=(event:LiveEvent)=>{
      switch(event.type){
       case "session":accepted=true;setSession(event.session);setOptimistic("");break
       case "speakers":setSpeakers(event.speakers);break
       case "delta":setPartials(prev=>({...prev,[event.authorId]:event.content}));break
       case "message":setSession(prev=>prev?{...prev,messages:prev.messages.some(m=>m.id===event.message.id)?prev.messages:[...prev.messages,event.message]}:prev);setFinished(prev=>[...prev,event.message.authorId]);break
       case "agent-error":setFinished(prev=>[...prev,event.authorId]);break
       case "done":completed=true;setSession(event.session);setAction(event.actionSuggestion||null);setWarning(event.warning||"");break
       case "error":throw Error(event.error)
      }
    }
    while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";for(const line of lines)if(line.trim())handle(JSON.parse(line))}
    buffer+=decoder.decode();if(buffer.trim())handle(JSON.parse(buffer))
    if(!completed)throw Error("La conexión terminó antes de finalizar. Revisa el historial o reintenta.")
  }catch(e){
    setError(controller.signal.aborted?"La respuesta tardó demasiado. Puedes recuperar la conversación desde el historial.":e instanceof Error?e.message:"No se pudo responder.")
    if(!accepted&&creating){setPhase("start");setTopic(userText)}
    if(!accepted&&body.action==="turn")setInput(userText)
    if(accepted)setWarning("Si la ronda sigue activa, actualiza la conversación antes de volver a enviar.")
  }finally{window.clearTimeout(timer);streamAbort.current=null;operation.current=false;setWaiting(false);setOptimistic("");setSpeakers([]);setPartials({});setFinished([]);void loadRecent()}
 }
 const start=(value:string,room=selectedRoom)=>{const text=value.trim();if(text)void run({action:"create",topic:text,room},text)}
 const send=()=>{const content=input.trim();if(session&&content&&!busy&&session.status==="active")void run({action:"turn",sessionId:session.sessionId,content},content)}
 async function changeStatus(action:"pause"|"resume"){
  if(!session||operation.current||remoteBusy)return
  operation.current=true;setLoading(true);setError("")
  try{const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,sessionId:session.sessionId})});const data=await res.json();if(!res.ok)throw Error(data.error);setSession(data.session)}catch(e){setError(e instanceof Error?e.message:"No se pudo cambiar el estado.")}finally{operation.current=false;setLoading(false)}
 }
 async function remove(id:string){
  if(operation.current||!window.confirm("¿Eliminar esta conversación de EduAI Social?"))return
  operation.current=true;setLoading(true)
  try{const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",sessionId:id})});const data=await res.json();if(!res.ok)throw Error(data.error);await loadRecent()}catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar.")}finally{operation.current=false;setLoading(false)}
 }
 async function createDraft(){
  if(!session||draftBusy||busy)return
  setDraftBusy(true);setError("")
  try{const res=await fetch("/api/superagent/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPage:"/ai-social",activeAgent:"drafts",userGoal:session.room.topic+"\n\n"+session.messages.slice(-20).map(m=>m.authorName+": "+m.content).join("\n").slice(0,18000),tags:["social","draft",session.room.slug],metadata:{source:"ai-social",sessionId:session.sessionId}})});const data=await res.json() as DraftApiResponse;if(!res.ok||!data.ok||!data.draft)throw Error(data.error||"No se pudo generar el borrador.");setDraft(data.draft)}catch(e){setError(e instanceof Error?e.message:"No se pudo generar el borrador.")}finally{setDraftBusy(false)}
 }
 async function execute(){
  if(!session||busy||!action||operation.current)return
  operation.current=true;setLoading(true);setError("")
  try{const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"execute-suggested-action",sessionId:session.sessionId})});const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||"No se pudo ejecutar.");setResult(data.result);if(data.result?.draft)setDraft(data.result.draft);setAction(null)}catch(e){setError(e instanceof Error?e.message:"No se pudo ejecutar.")}finally{operation.current=false;setLoading(false)}
 }
 const goHome=()=>{if(waiting)return;setPhase("start");setSession(null);setRemoteBusy(false);setError("");setWarning("");void loadRecent()}
 const lastUser=session?.messages.filter(m=>m.authorId==="user").at(-1)
 const pendingLast=session?.messages.at(-1)?.authorId==="user"
 return <main className={phase==="chat"?"flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-app text-main":"min-h-screen bg-app text-main"} style={backdrop}>
  <header className="shrink-0 border-b border-soft bg-card-theme/90 backdrop-blur-xl">
   <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
    {phase==="chat"?<button type="button" onClick={goHome} disabled={waiting} aria-label="Volver a salas" className={control}><ArrowLeft size={17}/></button>:<Link href="/dashboard" aria-label="Volver a EduAI" className={control}><ArrowLeft size={17}/></Link>}
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-md"><Users size={21}/></div>
    <div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold">{phase==="chat"?session?.room.title||"EduAI Social":"EduAI Social"}</h1><p className="truncate text-xs text-muted2">{phase==="chat"?session?.room.topic||optimistic:"Conversaciones con especialistas de IA"}</p></div>
    {phase==="chat"&&<button type="button" onClick={goHome} disabled={waiting} className={control}><Plus size={15}/><span className="hidden sm:inline">Nueva conversación</span></button>}
    <Link href="/dashboard" className={control}><Bot size={15}/> Claw</Link>
   </div>
  </header>
  {phase==="start"?<div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6">
   <section className="rounded-3xl border border-violet-400/20 bg-card-theme p-5 shadow-sm sm:p-6" style={{backgroundImage:"linear-gradient(115deg,rgba(167,139,250,.17),rgba(96,165,250,.09),rgba(45,212,191,.11))"}}>
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-600"><Sparkles size={15}/> Tu equipo inteligente</p>
    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Conversa con tus agentes</h2><p className="mt-1 text-sm text-muted2">Plantea una pregunta o una idea. Los especialistas pertinentes te responderán en el mismo chat.</p>
    <form onSubmit={e=>{e.preventDefault();start(topic)}} className="mt-4 rounded-2xl border border-violet-400/25 bg-card-theme p-3 shadow-sm">
     <textarea aria-label="Tema de conversación" maxLength={6000} rows={2} value={topic} onChange={e=>setTopic(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();start(topic)}}} placeholder="¿Sobre qué quieres conversar?" className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted2"/>
     <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft pt-2"><span className="text-xs text-muted2">{selectedRoom?rooms.find(r=>r.slug===selectedRoom)?.title:"Selección automática de agentes"}</span><button type="submit" disabled={!topic.trim()||loading} className={primary}>Iniciar conversación <ArrowRight size={16}/></button></div>
    </form>
   </section>
   <section><h2 className="mb-2 text-sm font-bold">Salas temáticas</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rooms.map(r=><button type="button" key={r.slug} disabled={loading} onClick={()=>{setSelectedRoom(r.slug);setTopic(r.prompt);start(r.prompt,r.slug)}} className="group flex items-center gap-3 rounded-2xl border bg-card-theme p-3 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-violet-500" style={{borderColor:r.color+"25",backgroundImage:"linear-gradient(145deg,transparent,"+r.color+"0b)"}}><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{background:r.color+"18",color:r.color}}><r.icon size={22}/></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{r.title}</p><p className="text-xs text-muted2">{r.description}</p></div><ChevronRight size={16} className="shrink-0 text-muted2"/></button>)}</div></section>
   {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-600">{error}</p>}
   <section className="rounded-2xl border border-soft bg-card-theme p-3 shadow-sm"><div className="mb-2 flex items-center gap-2"><History size={17} className="text-violet-500"/><h2 className="text-sm font-bold">Conversaciones recientes</h2><button type="button" className={control+" ml-auto"} onClick={()=>void loadRecent()} aria-label="Actualizar historial"><RefreshCw size={14}/></button></div>{historyError?<p className="text-xs text-muted2">{historyError}</p>:!recent.length?<p className="p-2 text-xs text-muted2">Tus nuevas conversaciones aparecerán aquí.</p>:<div className="grid gap-2 sm:grid-cols-2">{recent.slice(0,6).map(item=><div key={item.id} className="flex min-w-0 items-center gap-1 rounded-xl border border-soft p-2"><button type="button" disabled={loading} onClick={()=>void open(item.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium">{item.topic}</p><p className="text-xs text-muted2">{item.title} · {new Date(item.updatedAt).toLocaleDateString("es-CL")}</p></button><button type="button" disabled={loading} className={control+" !px-2"} onClick={()=>void remove(item.id)} aria-label="Eliminar conversación"><Trash2 size={14}/></button></div>)}</div>}</section>
  </div>:<>
   <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-3 sm:px-6">
    {session&&<div className="flex shrink-0 flex-wrap items-center gap-1.5 py-2"><span className="mr-1 text-xs font-semibold text-muted2">Equipo:</span>{session.participants.map(p=>{const color=roles[p.role]?.color||"#64748b";const writing=waiting&&speakers.some(s=>s.id===p.id)&&!finished.includes(p.id);return <button key={p.id} type="button" title={"Mencionar a "+p.name} onClick={()=>{setInput(prev=>prev+" @"+p.id+" ");composer.current?.focus()}} className="inline-flex items-center gap-1.5 rounded-full border bg-card-theme px-2.5 py-1 text-xs" style={{borderColor:color+"30",color}}><span className={"h-2 w-2 rounded-full "+(writing?"animate-pulse":"")} style={{background:color}}/>{p.name}{writing?" · escribiendo":""}</button>})}</div>}
    <div ref={feed} onScroll={()=>{const el=feed.current;if(el)nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<100}} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-2xl px-1 py-3 sm:px-3" aria-label="Conversación">
     {session?.messages.map((m,i)=><Bubble key={m.id} msg={m} prompt={session.messages.slice(0,i).reverse().find(p=>p.authorId==="user")?.content}/>)}
     {optimistic&&<Bubble msg={{id:"pending",authorId:"user",authorName:"Usuario",role:"assistant",content:optimistic,createdAt:""}}/>}
     {waiting&&speakers.filter(p=>!finished.includes(p.id)).map(p=><Bubble key={p.id} partial msg={{id:p.id,authorId:p.id,authorName:p.name,role:p.role,content:partials[p.id]||"",createdAt:""}}/>)}
     {waiting&&!speakers.length&&<div role="status" className="flex items-center gap-2 text-sm text-muted2"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-500"/> Conectando con los agentes…</div>}
     {remoteBusy&&<div className="rounded-xl border border-violet-400/25 p-3 text-sm">Hay una ronda en curso. <button type="button" disabled={loading} className="font-semibold underline" onClick={()=>session&&void open(session.sessionId)}>Actualizar conversación</button></div>}
     {warning&&<p role="status" className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-sm text-sub">{warning}</p>}
     {error&&<p role="alert" className="rounded-xl border border-red-400/30 p-3 text-sm text-red-600">{error}</p>}
     {action?.detected&&<div className="rounded-2xl border border-violet-400/25 bg-card-theme p-3"><p className="text-sm font-semibold">{action.label}</p><p className="mt-1 text-xs text-muted2">{action.reason}</p><button type="button" disabled={busy} className={control+" mt-2"} onClick={()=>void execute()}>Ejecutar acción <ArrowRight size={14}/></button></div>}
     {result&&<div className="rounded-xl border border-soft bg-card-theme p-3 text-sm">{result.message}</div>}
     {draft&&<div className="rounded-2xl border border-emerald-400/25 bg-card-theme p-3"><p className="font-semibold">{draft.title}</p><p className="mt-1 text-xs text-muted2">{draft.summary}</p><pre className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap text-xs">{draft.content}</pre></div>}
    </div>
    <div className="shrink-0 space-y-2 py-2 sm:py-3">
     {!waiting&&session&&pendingLast&&!remoteBusy&&session.status==="active"&&<button type="button" disabled={loading} className={control} onClick={()=>void run({action:"retry",sessionId:session.sessionId},"")}><RefreshCw size={14}/> Reintentar última respuesta</button>}
     {session?.status==="paused"&&<div className="flex items-center justify-between rounded-xl border border-soft bg-card-theme p-2 text-xs"><span>Conversación pausada</span><button type="button" disabled={busy} className={control} onClick={()=>void changeStatus("resume")}><Play size={14}/> Reanudar</button></div>}
     <form onSubmit={e=>{e.preventDefault();send()}} className="rounded-2xl border border-violet-400/30 bg-card-theme p-3 shadow-md shadow-violet-500/10" style={{backgroundImage:"linear-gradient(115deg,rgba(167,139,250,.08),transparent,rgba(96,165,250,.07))"}}>
      <textarea ref={composer} aria-label="Mensaje" maxLength={6000} rows={2} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Escribe tu mensaje o menciona a un agente con @…" className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted2"/>
      <div className="flex flex-wrap items-center gap-2 border-t border-soft pt-2"><button type="button" className={control} disabled={busy||draftBusy||!session||!lastUser} onClick={()=>void createDraft()}><FileText size={14}/> {draftBusy?"Creando…":"Borrador"}</button>{session?.status==="active"&&<button type="button" className={control} disabled={busy} onClick={()=>void changeStatus("pause")}><Pause size={14}/> Pausar</button>}<span className="ml-auto text-xs text-muted2">{waiting?"Agentes respondiendo…":""}</span><button type="submit" disabled={busy||!session||session.status!=="active"||!input.trim()} className={primary}><Send size={16}/> Enviar</button></div>
     </form>
    </div>
   </div>
  </>}
 </main>
}
