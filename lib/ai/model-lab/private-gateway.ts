/** Fixed private inference bridge. Never accept an inference URL or token from the browser. */
export type LabRemoteModel = {
  id: string;
  available: boolean;
  loaded?: boolean;
  detail?: string;
};
export type LabChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type LabInferenceResponse = {
  model: string;
  text: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  engine: string;
};
export class LabInferenceError extends Error {
  constructor(message:string,public readonly status:number=503){super(message)}
}
function config(){
  const input=process.env.EDUAI_MODEL_LAB_INFERENCE_URL?.trim();
  const token=process.env.EDUAI_MODEL_LAB_INFERENCE_TOKEN?.trim();
  if(!input||!token)return null;
  let url:URL;
  try{url=new URL(input)}catch{return null}
  const allowedLocal=["localhost","127.0.0.1","[::1]","::1"].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||
    !(url.protocol==="https:"||(url.protocol==="http:"&&allowedLocal)))return null;
  // The browser cannot override the host; a fixed administrator-controlled URL is used.
  return {base:url.href.replace(/\/$/,""),token};
}
export function configuredLabInference():boolean{return Boolean(config())}
async function callRemote(path:string,init:RequestInit,deadlineMs:number){
  const cfg=config();
  if(!cfg)throw new LabInferenceError("El motor Nano/Lite todavía no está conectado al servidor Dell.",503);
  const controller=new AbortController();
  const id=setTimeout(()=>controller.abort(),deadlineMs);
  const headers:Record<string,string>={
    "Authorization":"Bearer "+cfg.token,"Content-Type":"application/json",
  };
  const cfId=process.env.EDUAI_MODEL_LAB_CF_CLIENT_ID?.trim();
  const cfSecret=process.env.EDUAI_MODEL_LAB_CF_CLIENT_SECRET?.trim();
  if(cfId&&cfSecret){
    headers["CF-Access-Client-Id"]=cfId;
    headers["CF-Access-Client-Secret"]=cfSecret;
  }
  try{
    const response=await fetch(cfg.base+path,{
      ...init,headers,
      cache:"no-store",signal:controller.signal,
    });
    if(!response.ok){
      if(response.status===401)throw new LabInferenceError("Credencial interna del laboratorio rechazada.",503);
      if(response.status===404)throw new LabInferenceError("Adaptador no instalado en el Dell.",503);
      if(response.status===429)throw new LabInferenceError("El motor está ocupado. Vuelve a intentarlo.",503);
      throw new LabInferenceError("Motor Nano/Lite no disponible (HTTP "+response.status+").",503);
    }
    return await response.json() as unknown;
  }catch(error){
    if(error instanceof LabInferenceError)throw error;
    throw new LabInferenceError("No se pudo conectar al motor del Dell o se agotó el tiempo de respuesta.",503);
  }finally{clearTimeout(id)}
}
export async function probeLabInference():Promise<{online:boolean;models:LabRemoteModel[];reason?:string}>{
  if(!configuredLabInference())return {online:false,models:[],reason:"Servicio Dell no configurado"};
  try{
    const payload=await callRemote("/models",{method:"GET"},4500) as Record<string,unknown>;
    const models=Array.isArray(payload.models)?payload.models.filter((item):item is LabRemoteModel=>{
      if(!item||typeof item!=="object")return false;
      const v=item as Record<string,unknown>;
      return typeof v.id==="string"&&typeof v.available==="boolean";
    }).map(model=>({id:model.id.slice(0,30),available:model.available,loaded:Boolean(model.loaded),detail:typeof model.detail==="string"?model.detail.slice(0,120):undefined})):[];
    return {online:true,models};
  }catch{return {online:false,models:[],reason:"Servicio Dell desconectado"}}
}
export async function inferLabModel(model:string,messages:LabChatMessage[]):Promise<LabInferenceResponse>{
  const started=Date.now();
  const payload=await callRemote("/chat",{
    method:"POST",
    body:JSON.stringify({model,messages,max_new_tokens:192,temperature:0.15}),
  },52000) as Record<string,unknown>;
  if(typeof payload.text!=="string"||!payload.text.trim()||payload.text.length>15000||payload.model!==model){
    throw new LabInferenceError("El servicio devolvió una respuesta inválida.",502);
  }
  const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
  return {
    model,
    text:payload.text.slice(0,15000),
    latencyMs:number(payload.latency_ms)??Date.now()-started,
    promptTokens:number(payload.prompt_tokens),
    completionTokens:number(payload.completion_tokens),
    engine:typeof payload.engine==="string"?payload.engine.slice(0,70):"transformers-peft",
  };
}
