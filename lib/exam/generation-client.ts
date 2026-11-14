import { planAdaptiveExamBatches, remainingExamCounts } from "./generation-contract.mjs"

export type ExamGenerationCache = {
  key: string
  completed: number
  questions: any[]
  providers: string[]
  title: string
}
type CacheRef = { current: ExamGenerationCache | null }
export type ExamGenerationProgress = {
  phase: string; completed: number; total: number; elapsedSeconds: number; remainingSeconds: number | null;
}

async function readProgress(response: Response, onPhase:(phase:string)=>void):Promise<{status:number;data:any}> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return {status:response.status,data:await response.json().catch(()=>null)}
  if(!response.body)throw new Error("Respuesta sin contenido")
  const reader=response.body.getReader(), decoder=new TextDecoder()
  let buffer="", result:{status:number;data:any}|null=null
  const consume=(line:string)=>{
    if(!line.trim())return
    const item=JSON.parse(line)
    if(item.event==="progress"&&typeof item.phase==="string")onPhase(item.phase)
    if(item.event==="result")result={status:item.status,data:item.data}
  }
  try{
    while(true){
      const {value,done}=await reader.read()
      if(done)break
      buffer+=decoder.decode(value,{stream:true})
      const lines=buffer.split("\n");buffer=lines.pop()||""
      for(const line of lines)consume(line)
    }
    buffer+=decoder.decode();if(buffer.trim())consume(buffer)
  }finally{reader.releaseLock()}
  if(!result)throw new Error("El proveedor cerró la conexión antes de completar la tanda.")
  return result
}

export async function requestExamGeneration(
  url: string, init: RequestInit, setProgress: (label: string) => void, cache: CacheRef,
  onProgress?: (progress:ExamGenerationProgress)=>void,
): Promise<Response> {
  if (typeof init.body !== "string") return fetch(url, init)
  const body=JSON.parse(init.body)
  const counts={mc:Number(body.mc||0),mixed:Number(body.mixed||0),tf:Number(body.tf||0),dev:Number(body.dev||0)}
  const key=JSON.stringify(body)
  if(!cache.current||cache.current.key!==key)cache.current={key,completed:0,questions:[],providers:[],title:""}
  const state=cache.current!
  const total=counts.mc+counts.mixed+counts.tf+counts.dev
  const batches=planAdaptiveExamBatches(remainingExamCounts(counts,state.questions))
  const start=Date.now(),initial=state.questions.length
  let phase="Preparando contexto",elapsedVerified=0
  const update=(next?:string)=>{
    if(next)phase=next
    const elapsed=(Date.now()-start)/1000, finished=state.questions.length-initial
    const remaining=total-state.questions.length
    const estimate=finished>0?Math.max(0,Math.ceil((elapsedVerified/finished)*remaining-(elapsed-elapsedVerified))):null
    setProgress(phase+" · "+state.questions.length+"/"+total+" preguntas verificadas")
    onProgress?.({phase,completed:state.questions.length,total,elapsedSeconds:Math.floor(elapsed),remainingSeconds:estimate})
  }
  const timer=setInterval(()=>{if(!init.signal?.aborted)update()},1000)
  try{
    for(let i=0;i<batches.length;i++){
      if(init.signal?.aborted)throw new DOMException("Generación cancelada","AbortError")
      const batch=batches[i]
      update("Preparando pregunta o lote "+(i+1)+"/"+batches.length)
      let result:{status:number;data:any}
      try{
        const headers=new Headers(init.headers);headers.set("x-exam-progress","1")
        const response=await fetch(url,{...init,headers,body:JSON.stringify({...body,mc:batch.mc,mixed:batch.mixed,tf:batch.tf,dev:batch.dev,preferredProvider:state.providers[state.providers.length-1],existingQuestions:[...(Array.isArray(body.existingQuestions)?body.existingQuestions:[]),...state.questions.map(q=>q.question)]})})
        result=await readProgress(response,update)
      }catch(error){
        if(init.signal?.aborted)throw error
        return Response.json({error:"La conexión se interrumpió. Se conservaron "+state.questions.length+" preguntas verificadas. Reintenta con los mismos ajustes."},{status:502})
      }
      if(init.signal?.aborted)throw new DOMException("Generación cancelada","AbortError")
      const {status,data}=result
      const typeCounts={multiple_choice:batch.mc,mixed_choice_development:batch.mixed,true_false:batch.tf,development:batch.dev}
      if(status<200||status>=300||!data?.success||!Array.isArray(data.questions)||data.questions.length!==batch.total||Object.entries(typeCounts).some(([type,count])=>data.questions.filter((q:any)=>q?.type===type).length!==count)){
        return Response.json({error:(data?.error||"El lote devolvió una respuesta incompleta.")+" Se conservaron "+state.questions.length+" de "+total+" preguntas. Puedes reintentar con los mismos ajustes.",details:data?.details},{status:status>=400?status:502})
      }
      state.questions.push(...data.questions)
      if(!state.title&&typeof data.title==="string")state.title=data.title
      for(const provider of (Array.isArray(data.providers)?data.providers:[data.provider]))if(typeof provider==="string")state.providers.push(provider)
      state.completed++
      elapsedVerified=(Date.now()-start)/1000
      update("Pregunta o lote verificado")
    }
    update("Preparando vista previa")
    const result=Response.json({success:true,title:state.title,questions:state.questions,provider:state.providers[0],providers:[...new Set(state.providers)]})
    if(cache.current===state)cache.current=null
    return result
  }finally{clearInterval(timer)}
}
